import path from 'path';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';
import { uploadToR2, deleteFromR2, extractR2Key, generateR2Key } from '../services/r2Storage';

const router = Router();

function generateSlug(title: string): string {
  const timestamp = Date.now();
  const base = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  return `${base}-${timestamp}`;
}

// ─── 圖片上傳設定（使用 memoryStorage，上傳至 Cloudflare R2）────────────────
const imgUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允許上傳圖片'));
  },
});

// GET /api/v1/articles
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { category, page = '1', limit = '10' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    let query = `
      SELECT a.id, a.title, a.slug, a.category, a.summary, a.image_url, a.is_hot, a.published_at,
             u.username as author_name
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
    `;
    const params: (string | number)[] = [];

    if (category) {
      params.push(category as string);
      query += ` WHERE a.category = $${params.length}`;
    }

    query += ` ORDER BY a.published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get articles error:', err);
    res.status(500).json({ message: '無法取得新聞列表' });
  }
});

// GET /api/v1/articles/:slug
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.username as author_name
       FROM articles a LEFT JOIN users u ON a.author_id = u.id
       WHERE a.slug = $1`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '文章不存在' });
      return;
    }
    const article = result.rows[0];

    // 附帶多圖
    const imgs = await pool.query(
      `SELECT id, image_url, caption, sort_order
       FROM article_images WHERE article_id = $1
       ORDER BY sort_order, id`,
      [article.id]
    );
    article.images = imgs.rows;

    res.json(article);
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ message: '無法取得文章' });
  }
});

// POST /api/v1/articles  [editor+]
router.post('/', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, category, summary, content, image_url } = req.body;

  if (!title || !category || !content) {
    res.status(400).json({ message: '標題、分類、內文為必填欄位' });
    return;
  }

  try {
    const slug = generateSlug(title);
    const result = await pool.query(
      `INSERT INTO articles (title, slug, category, summary, content, image_url, author_id, is_hot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [title, slug, category, summary || '', content, image_url || '', req.user!.userId]
    );

    await pool.query('UPDATE articles SET is_hot = false WHERE id != $1', [result.rows[0].id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ message: '建立文章失敗' });
  }
});

// PUT /api/v1/articles/:id  [editor+]
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, category, summary, content, image_url, is_hot } = req.body;

  try {
    const result = await pool.query(
      `UPDATE articles
       SET title = COALESCE($1, title),
           category = COALESCE($2, category),
           summary = COALESCE($3, summary),
           content = COALESCE($4, content),
           image_url = COALESCE($5, image_url),
           is_hot = COALESCE($6, is_hot)
       WHERE id = $7
       RETURNING *`,
      [title, category, summary, content, image_url, is_hot, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '文章不存在' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ message: '更新文章失敗' });
  }
});

// DELETE /api/v1/articles/:id  [editor+]
router.delete('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM articles WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: '文章不存在' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ message: '刪除文章失敗' });
  }
});

// ─── 多圖管理 ─────────────────────────────────────────────────────────────────

// GET /api/v1/articles/:id/images
router.get('/:id/images', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, image_url, caption, sort_order, created_at
       FROM article_images WHERE article_id = $1 ORDER BY sort_order, id`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得圖片列表' });
  }
});

// POST /api/v1/articles/:id/images/upload — 上傳圖片檔案 [editor+]
router.post(
  '/:id/images/upload',
  verifyToken,
  requireRole('editor', 'admin'),
  imgUpload.array('images', 10),
  async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ message: '未提供圖片' });
      return;
    }

    try {
      // 取目前最大 sort_order
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS mx FROM article_images WHERE article_id = $1',
        [req.params.id]
      );
      let order = (maxRes.rows[0]?.mx ?? -1) + 1;

      const inserted = [];
      for (const file of files) {
        // 上傳至 Cloudflare R2
        const key = generateR2Key('articles', file.originalname);
        const url = await uploadToR2(file.buffer, key, file.mimetype);
        const r = await pool.query(
          `INSERT INTO article_images (article_id, image_url, caption, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [req.params.id, url, '', order++]
        );
        inserted.push(r.rows[0]);
      }
      res.status(201).json(inserted);
    } catch (err) {
      console.error('Upload images error:', err);
      res.status(500).json({ message: '圖片上傳失敗' });
    }
  }
);

// POST /api/v1/articles/:id/images — 以 URL 新增圖片 [editor+]
router.post('/:id/images', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { image_url, caption = '' } = req.body;
  if (!image_url) { res.status(400).json({ message: 'image_url 必填' }); return; }

  try {
    const maxRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS mx FROM article_images WHERE article_id = $1',
      [req.params.id]
    );
    const order = (maxRes.rows[0]?.mx ?? -1) + 1;
    const r = await pool.query(
      `INSERT INTO article_images (article_id, image_url, caption, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, image_url, caption, order]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '新增圖片失敗' });
  }
});

// DELETE /api/v1/articles/:id/images/:imgId  [editor+]
router.delete('/:id/images/:imgId', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const r = await pool.query(
      'DELETE FROM article_images WHERE id=$1 AND article_id=$2 RETURNING image_url',
      [req.params.imgId, req.params.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ message: '圖片不存在' }); return; }
    // 若為 R2 圖片則從雲端刪除
    const imgUrl = r.rows[0].image_url as string;
    const r2Key = extractR2Key(imgUrl);
    if (r2Key) {
      deleteFromR2(r2Key).catch(e => console.warn('R2 刪除失敗:', e.message));
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '刪除圖片失敗' });
  }
});

// POST /api/v1/articles/fetch-external  [editor+]
router.post('/fetch-external', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const externalArticles = [
      {
        title: `外部新聞：${new Date().toLocaleDateString('zh-TW')} 體育快訊`,
        category: 'CPBL',
        summary: '今日中華職棒賽事精彩回顧，多場比賽好手頻出。',
        content: '今日中華職棒賽事精彩回顧，多場比賽好手頻出。\n\n敬請期待更多詳細報導。',
        image_url: `https://picsum.photos/seed/${Date.now()}/800/400`,
      }
    ];

    const inserted = [];
    for (const article of externalArticles) {
      const slug = generateSlug(article.title);
      const result = await pool.query(
        `INSERT INTO articles (title, slug, category, summary, content, image_url, author_id, is_hot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (slug) DO NOTHING
         RETURNING *`,
        [article.title, slug, article.category, article.summary, article.content, article.image_url, req.user!.userId]
      );
      if (result.rows.length > 0) inserted.push(result.rows[0]);
    }

    res.json(inserted);
  } catch (err) {
    console.error('Fetch external error:', err);
    res.status(500).json({ message: '拉取外部新聞失敗' });
  }
});

export default router;
