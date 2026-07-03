import path from 'path';
import fs from 'fs';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

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

// ─── 圖片上傳設定 ─────────────────────────────────────────────────────────────
const imgUploadDir = path.join(__dirname, '../../uploads/articles');
if (!fs.existsSync(imgUploadDir)) fs.mkdirSync(imgUploadDir, { recursive: true });

const imgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imgUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const imgUpload = multer({
  storage: imgStorage,
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
    const params: (string | number)[] = [];
    let where = `WHERE COALESCE(a.status, 'published') = 'published'`;

    if (category) {
      params.push(category as string);
      where += ` AND a.category = $${params.length}`;
    }

    const query = `
      SELECT a.id, a.title, a.slug, a.category, a.summary, a.content, a.image_url, a.image_position, a.is_hot, a.published_at,
             u.username as author_name
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      ${where}
      ORDER BY a.published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get articles error:', err);
    res.status(500).json({ message: '無法取得新聞列表' });
  }
});

// GET /api/v1/articles/drafts  [editor+]
router.get('/drafts', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.slug, a.category, a.summary, a.content, a.image_url, a.image_position, a.published_at, a.status,
              u.username as author_name
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE COALESCE(a.status, 'published') = 'draft'
       ORDER BY a.published_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get drafts error:', err);
    res.status(500).json({ message: '無法取得草稿列表' });
  }
});

// GET /api/v1/articles/search?q=...  (must be before /:slug)
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, title, slug, category, summary, image_url, published_at
       FROM articles
       WHERE COALESCE(status, 'published') = 'published'
         AND (title ILIKE $1 OR COALESCE(summary, '') ILIKE $1 OR content ILIKE $1)
       ORDER BY published_at DESC
       LIMIT 12`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: '搜尋失敗' });
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
  const { title, category, summary, content, image_url, image_position, ig_embed_url, status = 'published' } = req.body;

  if (!title || !category || !content) {
    res.status(400).json({ message: '標題、分類、內文為必填欄位' });
    return;
  }

  try {
    const slug = generateSlug(title);
    const isDraft = status === 'draft';
    const result = await pool.query(
      `INSERT INTO articles (title, slug, category, summary, content, image_url, image_position, author_id, is_hot, ig_embed_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [title, slug, category, summary || '', content, image_url || '', image_position || 'center', req.user!.userId, !isDraft, ig_embed_url || null, isDraft ? 'draft' : 'published']
    );

    if (!isDraft) {
      await pool.query('UPDATE articles SET is_hot = false WHERE id != $1', [result.rows[0].id]);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ message: '建立文章失敗' });
  }
});

// PATCH /api/v1/articles/:id/publish  [editor+]
router.patch('/:id/publish', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `UPDATE articles SET status = 'published', is_hot = true, published_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) { res.status(404).json({ message: '文章不存在' }); return; }
    await pool.query('UPDATE articles SET is_hot = false WHERE id != $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Publish article error:', err);
    res.status(500).json({ message: '發布失敗' });
  }
});

// PUT /api/v1/articles/:id  [editor+]
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, category, summary, content, image_url, image_position, is_hot, ig_embed_url } = req.body;

  try {
    // 更新前先儲存當前版本
    const current = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) { res.status(404).json({ message: '文章不存在' }); return; }
    const cur = current.rows[0];
    await pool.query(
      `INSERT INTO article_versions (article_id, title, category, summary, content, image_url, saved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cur.id, cur.title, cur.category, cur.summary, cur.content, cur.image_url, req.user!.userId]
    );
    // 只保留最新 20 筆版本
    await pool.query(
      `DELETE FROM article_versions WHERE article_id = $1 AND id NOT IN (
        SELECT id FROM article_versions WHERE article_id = $1 ORDER BY saved_at DESC LIMIT 20
      )`,
      [cur.id]
    );

    const result = await pool.query(
      `UPDATE articles
       SET title = COALESCE($1, title),
           category = COALESCE($2, category),
           summary = COALESCE($3, summary),
           content = COALESCE($4, content),
           image_url = COALESCE($5, image_url),
           image_position = COALESCE($6, image_position),
           is_hot = COALESCE($7, is_hot),
           ig_embed_url = COALESCE($8, ig_embed_url)
       WHERE id = $9
       RETURNING *`,
      [title, category, summary, content, image_url, image_position ?? null, is_hot, ig_embed_url ?? null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ message: '更新文章失敗' });
  }
});

// GET /api/v1/articles/:id/versions  [editor+]
router.get('/:id/versions', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.article_id, v.title, v.category, v.summary, v.content, v.image_url, v.saved_at,
              u.username as saved_by_name
       FROM article_versions v
       LEFT JOIN users u ON v.saved_by = u.id
       WHERE v.article_id = $1
       ORDER BY v.saved_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得版本紀錄' });
  }
});

// POST /api/v1/articles/:id/versions/:versionId/restore  [editor+]
router.post('/:id/versions/:versionId/restore', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const ver = await pool.query('SELECT * FROM article_versions WHERE id = $1 AND article_id = $2', [req.params.versionId, req.params.id]);
    if (ver.rows.length === 0) { res.status(404).json({ message: '版本不存在' }); return; }
    const v = ver.rows[0];

    // 還原前先存一筆目前版本
    const cur = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (cur.rows.length > 0) {
      const c = cur.rows[0];
      await pool.query(
        `INSERT INTO article_versions (article_id, title, category, summary, content, image_url, saved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.id, c.title, c.category, c.summary, c.content, c.image_url, req.user!.userId]
      );
    }

    const result = await pool.query(
      `UPDATE articles SET title=$1, category=$2, summary=$3, content=$4, image_url=$5 WHERE id=$6 RETURNING *`,
      [v.title, v.category, v.summary, v.content, v.image_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '還原失敗' });
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

// POST /api/v1/articles/upload-cover — 上傳封面圖（不需文章 ID）[editor+]
router.post(
  '/upload-cover',
  verifyToken,
  requireRole('editor', 'admin'),
  imgUpload.single('image'),
  (req: Request, res: Response): void => {
    const file = req.file;
    if (!file) { res.status(400).json({ message: '未提供圖片' }); return; }
    res.json({ url: `/uploads/articles/${file.filename}` });
  }
);

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
        const url = `/uploads/articles/${file.filename}`;
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
    // 若為本地上傳檔案則刪除
    const imgPath = r.rows[0].image_url as string;
    if (imgPath.startsWith('/uploads/articles/')) {
      const fullPath = path.join(__dirname, '../../', imgPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '刪除圖片失敗' });
  }
});

// GET /api/v1/articles/:id/comments
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.article_id, c.user_id, c.author_name, c.content, c.created_at
       FROM article_comments c
       WHERE c.article_id = $1 AND c.is_hidden = FALSE
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ message: '無法取得留言' });
  }
});

// POST /api/v1/articles/:id/comments  [member+]
router.post('/:id/comments', verifyToken, async (req: Request, res: Response): Promise<void> => {
  const { content } = req.body;
  if (!content || content.trim().length === 0) {
    res.status(400).json({ message: '留言內容不可空白' });
    return;
  }
  if (content.length > 500) {
    res.status(400).json({ message: '留言不可超過 500 字' });
    return;
  }

  try {
    // 取得留言者名稱
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [req.user!.userId]);
    if (userRes.rows.length === 0) { res.status(403).json({ message: '找不到使用者' }); return; }
    const authorName = userRes.rows[0].username;

    const result = await pool.query(
      `INSERT INTO article_comments (article_id, user_id, author_name, content)
       VALUES ($1, $2, $3, $4) RETURNING id, article_id, user_id, author_name, content, created_at`,
      [req.params.id, req.user!.userId, authorName, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ message: '留言失敗' });
  }
});

// DELETE /api/v1/articles/:id/comments/:commentId  [admin 或留言本人]
router.delete('/:id/comments/:commentId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const commentRes = await pool.query(
      'SELECT user_id FROM article_comments WHERE id = $1 AND article_id = $2',
      [req.params.commentId, req.params.id]
    );
    if (commentRes.rows.length === 0) { res.status(404).json({ message: '留言不存在' }); return; }

    const isOwner = commentRes.rows[0].user_id === req.user!.userId;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) { res.status(403).json({ message: '無權限刪除此留言' }); return; }

    await pool.query('DELETE FROM article_comments WHERE id = $1', [req.params.commentId]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ message: '刪除留言失敗' });
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
