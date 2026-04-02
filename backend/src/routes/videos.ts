import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// YouTube URL → video ID
function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

// GET /api/v1/videos — 公開，返回啟用中影片
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT * FROM home_videos WHERE is_active = true ORDER BY sort_order ASC, created_at DESC`
  );
  res.json(rows);
});

// GET /api/v1/videos/admin — 管理後台，返回全部
router.get('/admin', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT * FROM home_videos ORDER BY sort_order ASC, created_at DESC`
  );
  res.json(rows);
});

// POST /api/v1/videos — 新增影片
router.post('/', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, type, url, thumbnail_url, sort_order, category } = req.body;

  if (!url) { res.status(400).json({ message: '必填：url' }); return; }

  let finalUrl = url;
  let finalThumb = thumbnail_url ?? null;
  let finalType = type ?? 'youtube';

  if (finalType === 'youtube') {
    const videoId = extractYoutubeId(url);
    if (!videoId) { res.status(400).json({ message: '無法解析 YouTube 網址' }); return; }
    finalUrl = videoId;
    finalThumb = finalThumb || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    finalType = 'youtube';
  }

  const { rows } = await pool.query(
    `INSERT INTO home_videos (title, type, url, thumbnail_url, sort_order, category)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title ?? '', finalType, finalUrl, finalThumb, sort_order ?? 0, category ?? '']
  );
  res.status(201).json(rows[0]);
});

// PUT /api/v1/videos/:id — 更新
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, is_active, sort_order, category } = req.body;
  const { rows } = await pool.query(
    `UPDATE home_videos SET
       title = COALESCE($1, title),
       is_active = COALESCE($2, is_active),
       sort_order = COALESCE($3, sort_order),
       category = COALESCE($4, category)
     WHERE id = $5 RETURNING *`,
    [title, is_active, sort_order, category, req.params.id]
  );
  if (rows.length === 0) { res.status(404).json({ message: '找不到' }); return; }
  res.json(rows[0]);
});

// DELETE /api/v1/videos/:id
router.delete('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  await pool.query('DELETE FROM home_videos WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

export default router;
