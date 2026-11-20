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

// GET /api/v1/articles/trending — 一周內瀏覽成長最快的文章
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await pool.query(
      `SELECT a.id, a.title, a.slug, a.category, a.summary, a.image_url, a.published_at,
              COUNT(v.id)::int AS week_views
       FROM articles a
       LEFT JOIN article_views v ON v.article_id = a.id AND v.viewed_at > NOW() - INTERVAL '7 days'
       WHERE COALESCE(a.status, 'published') = 'published'
       GROUP BY a.id
       ORDER BY week_views DESC, a.published_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get trending error:', err);
    res.status(500).json({ message: '無法取得熱門排名' });
  }
});

// GET /api/v1/articles/me/liked — 我按讚的文章
router.get('/me/liked', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.slug, a.category, a.summary, a.image_url, a.published_at, l.created_at AS liked_at
       FROM article_likes l
       JOIN articles a ON a.id = l.article_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT 50`,
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get liked articles error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// GET /api/v1/articles/me/bookmarked — 我收藏的文章
router.get('/me/bookmarked', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.slug, a.category, a.summary, a.image_url, a.published_at, b.created_at AS bookmarked_at
       FROM article_bookmarks b
       JOIN articles a ON a.id = b.article_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get bookmarked articles error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// POST /api/v1/articles/:id/view — 記錄瀏覽
router.post('/:id/view', async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('INSERT INTO article_views (article_id) VALUES ($1)', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: '記錄失敗' });
  }
});

// GET /api/v1/articles/:id/related
router.get('/:id/related', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows: current } = await pool.query('SELECT category FROM articles WHERE id = $1', [req.params.id]);
    if (current.length === 0) { res.status(404).json({ message: '文章不存在' }); return; }

    const result = await pool.query(
      `SELECT id, title, slug, category, summary, image_url, published_at
       FROM articles
       WHERE id != $1 AND category = $2 AND COALESCE(status, 'published') = 'published'
       ORDER BY published_at DESC
       LIMIT 6`,
      [req.params.id, current[0].category]
    );

    // If fewer than 6 same-category articles, fill with recent articles from other categories
    if (result.rows.length < 6) {
      const excludeIds = [parseInt(req.params.id as string), ...result.rows.map((r: any) => r.id)];
      const fill = await pool.query(
        `SELECT id, title, slug, category, summary, image_url, published_at
         FROM articles
         WHERE id != ALL($1::int[]) AND COALESCE(status, 'published') = 'published'
         ORDER BY published_at DESC
         LIMIT $2`,
        [excludeIds, 6 - result.rows.length]
      );
      result.rows.push(...fill.rows);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Get related articles error:', err);
    res.status(500).json({ message: '無法取得相關新聞' });
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
  const { title, category, summary, content, image_url, image_position, ig_embed_url, placement = 'default', status = 'published' } = req.body;

  if (!title || !category || !content) {
    res.status(400).json({ message: '標題、分類、內文為必填欄位' });
    return;
  }

  try {
    const slug = generateSlug(title);
    const isDraft = status === 'draft';
    const result = await pool.query(
      `INSERT INTO articles (title, slug, category, summary, content, image_url, image_position, author_id, is_hot, ig_embed_url, placement, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [title, slug, category, summary || '', content, image_url || '', image_position || 'center', req.user!.userId, !isDraft, ig_embed_url || null, placement, isDraft ? 'draft' : 'published']
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
  const { title, category, summary, content, image_url, image_position, is_hot, ig_embed_url, placement } = req.body;

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
           ig_embed_url = COALESCE($8, ig_embed_url),
           placement = COALESCE($9, placement)
       WHERE id = $10
       RETURNING *`,
      [title, category, summary, content, image_url, image_position ?? null, is_hot, ig_embed_url ?? null, placement ?? null, req.params.id]
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

// ─── 留言表情反應 API ─────────────────────────────────────────────────────────

const VALID_REACTIONS = ['empathy', 'informative', 'hmm'] as const;

// GET /api/v1/articles/:articleId/comments/:commentId/reactions
router.get('/:articleId/comments/:commentId/reactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const countRes = await pool.query(
      'SELECT reaction, COUNT(*)::int AS count FROM comment_reactions WHERE comment_id = $1 GROUP BY reaction',
      [commentId]
    );
    const counts: Record<string, number> = { empathy: 0, informative: 0, hmm: 0 };
    for (const row of countRes.rows) counts[row.reaction] = row.count;

    let userReactions: string[] = [];
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const r = await pool.query('SELECT reaction FROM comment_reactions WHERE comment_id = $1 AND user_id = $2', [commentId, decoded.userId]);
        userReactions = r.rows.map(row => row.reaction);
      } catch {}
    }
    res.json({ counts, userReactions });
  } catch (err) {
    console.error('Get comment reactions error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// POST /api/v1/articles/:articleId/comments/:commentId/reactions
router.post('/:articleId/comments/:commentId/reactions', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.userId;
    const { reaction } = req.body;
    if (!reaction || !VALID_REACTIONS.includes(reaction)) {
      res.status(400).json({ message: '無效的反應類型' }); return;
    }
    const existing = await pool.query(
      'SELECT id FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND reaction = $3',
      [commentId, userId, reaction]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND reaction = $3', [commentId, userId, reaction]);
    } else {
      await pool.query('INSERT INTO comment_reactions (comment_id, user_id, reaction) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [commentId, userId, reaction]);
    }
    const countRes = await pool.query('SELECT reaction, COUNT(*)::int AS count FROM comment_reactions WHERE comment_id = $1 GROUP BY reaction', [commentId]);
    const counts: Record<string, number> = { empathy: 0, informative: 0, hmm: 0 };
    for (const row of countRes.rows) counts[row.reaction] = row.count;
    const userRes = await pool.query('SELECT reaction FROM comment_reactions WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
    res.json({ counts, userReactions: userRes.rows.map(r => r.reaction) });
  } catch (err) {
    console.error('Toggle comment reaction error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ─── 按讚 / 收藏 API ──────────────────────────────────────────────────────────

// GET /api/v1/articles/:id/like — 查詢是否已按讚 & 讚數
router.get('/:id/like', async (req: Request, res: Response): Promise<void> => {
  try {
    const articleId = req.params.id;
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id = $1', [articleId]);
    const count = countRes.rows[0].count;

    // 嘗試從 token 取得 userId
    let liked = false;
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const userRes = await pool.query('SELECT 1 FROM article_likes WHERE article_id = $1 AND user_id = $2', [articleId, decoded.userId]);
        liked = userRes.rows.length > 0;
      } catch {}
    }
    res.json({ count, liked });
  } catch (err) {
    console.error('Get like error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// POST /api/v1/articles/:id/like — 切換按讚
router.post('/:id/like', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const articleId = req.params.id;
    const userId = req.user!.userId;
    const existing = await pool.query('SELECT id FROM article_likes WHERE article_id = $1 AND user_id = $2', [articleId, userId]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM article_likes WHERE article_id = $1 AND user_id = $2', [articleId, userId]);
    } else {
      await pool.query('INSERT INTO article_likes (article_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [articleId, userId]);
    }
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM article_likes WHERE article_id = $1', [articleId]);
    const liked = existing.rows.length === 0;
    res.json({ count: countRes.rows[0].count, liked });
  } catch (err) {
    console.error('Toggle like error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// GET /api/v1/articles/:id/bookmark — 查詢是否已收藏
router.get('/:id/bookmark', async (req: Request, res: Response): Promise<void> => {
  try {
    const articleId = req.params.id;
    let bookmarked = false;
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const r = await pool.query('SELECT 1 FROM article_bookmarks WHERE article_id = $1 AND user_id = $2', [articleId, decoded.userId]);
        bookmarked = r.rows.length > 0;
      } catch {}
    }
    res.json({ bookmarked });
  } catch (err) {
    console.error('Get bookmark error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// POST /api/v1/articles/:id/bookmark — 切換收藏
router.post('/:id/bookmark', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const articleId = req.params.id;
    const userId = req.user!.userId;
    const existing = await pool.query('SELECT id FROM article_bookmarks WHERE article_id = $1 AND user_id = $2', [articleId, userId]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM article_bookmarks WHERE article_id = $1 AND user_id = $2', [articleId, userId]);
    } else {
      await pool.query('INSERT INTO article_bookmarks (article_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [articleId, userId]);
    }
    const bookmarked = existing.rows.length === 0;
    res.json({ bookmarked });
  } catch (err) {
    console.error('Toggle bookmark error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

export default router;
