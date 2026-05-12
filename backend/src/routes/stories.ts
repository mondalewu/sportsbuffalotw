import { Router, Request, Response } from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// ── 影片上傳設定 ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/stories');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /mp4|webm|mov|avi|mkv/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

// POST /api/v1/stories/upload — 上傳影片
router.post('/upload', verifyToken, requireRole('editor', 'admin'), upload.single('video'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ message: '未收到影片檔案，或格式不支援' });
    return;
  }
  const url = `/uploads/stories/${req.file.filename}`;
  // 同時回傳影片時長（秒）
  ffmpeg.ffprobe(req.file.path, (err, meta) => {
    const duration = err ? null : (meta?.format?.duration ?? null);
    res.status(201).json({ url, duration });
  });
});

// POST /api/v1/stories/trim — 裁切影片
router.post('/trim', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { filename, start, end } = req.body as { filename: string; start: number; end: number };

  if (!filename || start == null || end == null || end <= start) {
    res.status(400).json({ message: '必填：filename, start, end（end 必須大於 start）' });
    return;
  }

  // 安全性：只允許 uploads/stories 目錄內的檔案，防止路徑穿越
  const safeName = path.basename(filename);
  const inputPath = path.join(uploadDir, safeName);
  if (!fs.existsSync(inputPath)) {
    res.status(404).json({ message: '找不到原始影片' });
    return;
  }

  const ext = path.extname(safeName) || '.mp4';
  const outName = `trim-${Date.now()}${ext}`;
  const outputPath = path.join(uploadDir, outName);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(start)
        .setDuration(end - start)
        .outputOptions('-c copy')          // stream copy：不重新編碼，速度極快
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (e) => reject(e))
        .run();
    });
    res.json({ url: `/uploads/stories/${outName}`, duration: end - start });
  } catch (err) {
    console.error('FFmpeg trim error:', err);
    res.status(500).json({ message: '裁切失敗' });
  }
});

// ── 公開：取得所有啟用中的 Stories（含 clips）─────────────────────────────────

// GET /api/v1/stories
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const storiesRes = await pool.query(
      `SELECT id, home_team, away_team, home_abbr, away_abbr,
              home_color, away_color, league, is_live, sort_order
       FROM stories
       WHERE is_active = true
         AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY sort_order ASC, id ASC`,
    );

    if (storiesRes.rows.length === 0) {
      res.json([]);
      return;
    }

    const storyIds = storiesRes.rows.map(r => r.id);
    const clipsRes = await pool.query(
      `SELECT id, story_id, background_image_url, video_url, score, situation,
              key_play, ai_insight, duration_ms, clip_order
       FROM story_clips
       WHERE story_id = ANY($1)
       ORDER BY story_id, clip_order ASC`,
      [storyIds],
    );

    // 將 clips 對應到各 story
    const clipsMap = new Map<number, typeof clipsRes.rows>();
    for (const clip of clipsRes.rows) {
      if (!clipsMap.has(clip.story_id)) clipsMap.set(clip.story_id, []);
      clipsMap.get(clip.story_id)!.push(clip);
    }

    const result = storiesRes.rows.map(s => ({
      ...s,
      clips: clipsMap.get(s.id) ?? [],
    }));

    res.json(result);
  } catch (err) {
    console.error('Get stories error:', err);
    res.status(500).json({ message: '無法取得 Stories 資料' });
  }
});

// ── 管理：以下需要 editor+ 權限 ──────────────────────────────────────────────

// GET /api/v1/stories/admin — 取得所有（含停用）
router.get('/admin', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const storiesRes = await pool.query(
      `SELECT id, home_team, away_team, home_abbr, away_abbr,
              home_color, away_color, league, is_live, is_active, sort_order, created_at
       FROM stories
       ORDER BY sort_order ASC, id ASC`,
    );

    const storyIds = storiesRes.rows.map(r => r.id);
    let clipsMap = new Map<number, object[]>();

    if (storyIds.length > 0) {
      const clipsRes = await pool.query(
        `SELECT id, story_id, background_image_url, video_url, score, situation,
                key_play, ai_insight, duration_ms, clip_order
         FROM story_clips
         WHERE story_id = ANY($1)
         ORDER BY story_id, clip_order ASC`,
        [storyIds],
      );
      for (const clip of clipsRes.rows) {
        if (!clipsMap.has(clip.story_id)) clipsMap.set(clip.story_id, []);
        clipsMap.get(clip.story_id)!.push(clip);
      }
    }

    res.json(storiesRes.rows.map(s => ({ ...s, clips: clipsMap.get(s.id) ?? [] })));
  } catch (err) {
    res.status(500).json({ message: '無法取得 Stories 資料' });
  }
});

// POST /api/v1/stories — 新增 Story
router.post('/', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { home_team, away_team, home_abbr, away_abbr, home_color, away_color, league, is_live, sort_order } = req.body;

  if (!home_team || !away_team || !home_abbr || !away_abbr) {
    res.status(400).json({ message: '必填：home_team, away_team, home_abbr, away_abbr' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO stories (home_team, away_team, home_abbr, away_abbr, home_color, away_color, league, is_live, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [home_team, away_team, home_abbr, away_abbr,
       home_color ?? '#333333', away_color ?? '#666666',
       league ?? 'CPBL', is_live ?? false, sort_order ?? 0],
    );
    res.status(201).json({ ...result.rows[0], clips: [] });
  } catch (err) {
    res.status(500).json({ message: '新增 Story 失敗' });
  }
});

// PUT /api/v1/stories/:id — 更新 Story
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { home_team, away_team, home_abbr, away_abbr, home_color, away_color, league, is_live, is_active, sort_order } = req.body;

  try {
    const result = await pool.query(
      `UPDATE stories SET
         home_team  = COALESCE($1, home_team),
         away_team  = COALESCE($2, away_team),
         home_abbr  = COALESCE($3, home_abbr),
         away_abbr  = COALESCE($4, away_abbr),
         home_color = COALESCE($5, home_color),
         away_color = COALESCE($6, away_color),
         league     = COALESCE($7, league),
         is_live    = COALESCE($8, is_live),
         is_active  = COALESCE($9, is_active),
         sort_order = COALESCE($10, sort_order),
         updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [home_team ?? null, away_team ?? null, home_abbr ?? null, away_abbr ?? null,
       home_color ?? null, away_color ?? null, league ?? null,
       is_live ?? null, is_active ?? null, sort_order ?? null, req.params.id],
    );
    if (!result.rows.length) { res.status(404).json({ message: 'Story 不存在' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '更新 Story 失敗' });
  }
});

// DELETE /api/v1/stories/:id — 刪除 Story（連帶刪除 clips）
router.delete('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM stories WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ message: 'Story 不存在' }); return; }
    res.json({ message: '已刪除', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: '刪除 Story 失敗' });
  }
});

// ── Clips CRUD ────────────────────────────────────────────────────────────────

// POST /api/v1/stories/:id/clips — 新增 Clip
router.post('/:id/clips', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { background_image_url, video_url, score, situation, key_play, ai_insight, duration_ms, clip_order } = req.body;

  if (!background_image_url && !video_url) {
    res.status(400).json({ message: '必填：background_image_url 或 video_url 至少提供一個' });
    return;
  }

  try {
    // 若未給 clip_order，自動排到最後
    let order = clip_order;
    if (order == null) {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(clip_order),0)+1 AS next FROM story_clips WHERE story_id=$1',
        [req.params.id],
      );
      order = maxRes.rows[0].next;
    }

    const result = await pool.query(
      `INSERT INTO story_clips (story_id, background_image_url, video_url, score, situation, key_play, ai_insight, duration_ms, clip_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, background_image_url ?? '', video_url ?? null, score ?? '', situation ?? '',
       key_play ?? '', ai_insight ?? null, duration_ms ?? 6000, order],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '新增 Clip 失敗' });
  }
});

// PUT /api/v1/stories/:id/clips/:clipId — 更新 Clip
router.put('/:id/clips/:clipId', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { background_image_url, video_url, score, situation, key_play, ai_insight, duration_ms, clip_order } = req.body;

  try {
    const result = await pool.query(
      `UPDATE story_clips SET
         background_image_url = COALESCE($1, background_image_url),
         video_url   = COALESCE($2, video_url),
         score       = COALESCE($3, score),
         situation   = COALESCE($4, situation),
         key_play    = COALESCE($5, key_play),
         ai_insight  = COALESCE($6, ai_insight),
         duration_ms = COALESCE($7, duration_ms),
         clip_order  = COALESCE($8, clip_order)
       WHERE id=$9 AND story_id=$10 RETURNING *`,
      [background_image_url ?? null, video_url ?? null, score ?? null, situation ?? null,
       key_play ?? null, ai_insight ?? null, duration_ms ?? null,
       clip_order ?? null, req.params.clipId, req.params.id],
    );
    if (!result.rows.length) { res.status(404).json({ message: 'Clip 不存在' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '更新 Clip 失敗' });
  }
});

// DELETE /api/v1/stories/:id/clips/:clipId — 刪除 Clip
router.delete('/:id/clips/:clipId', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'DELETE FROM story_clips WHERE id=$1 AND story_id=$2 RETURNING id',
      [req.params.clipId, req.params.id],
    );
    if (!result.rows.length) { res.status(404).json({ message: 'Clip 不存在' }); return; }
    res.json({ message: '已刪除', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: '刪除 Clip 失敗' });
  }
});

export default router;
