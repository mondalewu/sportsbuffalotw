import { Router, Request, Response } from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v2 as cloudinary } from 'cloudinary';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// ── Cloudinary 設定 ───────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// ── 暫存目錄（上傳後即刪除）─────────────────────────────────────────────────
const tmpDir = path.join(os.tmpdir(), 'stories-upload');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /mp4|webm|mov|avi|mkv/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

// GET /api/v1/stories/sign-upload — 產生 Cloudinary 直傳簽名（前端直傳用）
router.get('/sign-upload', verifyToken, requireRole('editor', 'admin'), (req: Request, res: Response): void => {
  if (!hasCloudinary) {
    res.status(503).json({ message: 'Cloudinary 未設定' });
    return;
  }
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'sports-buffalo/stories';
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!
  );
  res.json({
    timestamp,
    signature,
    folder,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
  });
});

// POST /api/v1/stories/upload — 上傳影片到 Cloudinary（小檔用，大檔請用 sign-upload 直傳）
router.post('/upload', verifyToken, requireRole('editor', 'admin'), upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: '未收到影片檔案，或格式不支援' });
    return;
  }

  const localPath = req.file.path;

  // 取得影片時長
  const duration: number | null = await new Promise(resolve => {
    ffmpeg.ffprobe(localPath, (err, meta) => resolve(err ? null : (meta?.format?.duration ?? null)));
  });

  if (!hasCloudinary) {
    // fallback：沒設定 Cloudinary 時仍回傳本地路徑（開發用）
    res.status(201).json({ url: `/uploads/stories/${req.file.filename}`, duration });
    return;
  }

  try {
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: 'video',
      folder: 'sports-buffalo/stories',
      use_filename: false,
    });
    fs.unlink(localPath, () => {});
    res.status(201).json({ url: result.secure_url, duration, public_id: result.public_id });
  } catch (err) {
    fs.unlink(localPath, () => {});
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ message: '影片上傳失敗，請稍後再試' });
  }
});

// POST /api/v1/stories/trim — 裁切影片後上傳到 Cloudinary
router.post('/trim', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { url: videoUrl, start, end } = req.body as { url: string; start: number; end: number };

  if (!videoUrl || start == null || end == null || end <= start) {
    res.status(400).json({ message: '必填：url, start, end（end 必須大於 start）' });
    return;
  }

  const outName = `trim-${Date.now()}.mp4`;
  const outputPath = path.join(tmpDir, outName);

  try {
    // ffmpeg 可直接讀取 Cloudinary URL
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoUrl)
        .setStartTime(start)
        .setDuration(end - start)
        .outputOptions('-c copy')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (e) => reject(e))
        .run();
    });

    if (!hasCloudinary) {
      res.json({ url: `/uploads/stories/${outName}`, duration: end - start });
      return;
    }

    const result = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'sports-buffalo/stories',
    });
    fs.unlink(outputPath, () => {});
    res.json({ url: result.secure_url, duration: end - start, public_id: result.public_id });
  } catch (err) {
    fs.unlink(outputPath, () => {});
    console.error('FFmpeg/Cloudinary trim error:', err);
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

// ══════════════════════════════════════════════════════════════════════════════
// Story Cards（首頁精華 Reels 卡片）
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/stories/cards — 公開：取得啟用中的卡片
router.get('/cards', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, title, image_url, video_url, category, link_url, duration_ms, created_at
       FROM story_cards WHERE is_active = true
       ORDER BY sort_order ASC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get story cards error:', err);
    res.status(500).json({ message: '無法取得精華卡片' });
  }
});

// GET /api/v1/stories/cards/admin — 管理：取得全部卡片
router.get('/cards/admin', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM story_cards ORDER BY sort_order ASC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得精華卡片' });
  }
});

// POST /api/v1/stories/cards — 新增卡片
router.post('/cards', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, image_url, video_url, category, link_url, duration_ms, sort_order } = req.body;
  if (!title || !image_url) {
    res.status(400).json({ message: '必填：title, image_url' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO story_cards (title, image_url, video_url, category, link_url, duration_ms, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, image_url, video_url ?? null, category ?? '', link_url ?? null, duration_ms ?? 6000, sort_order ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create story card error:', err);
    res.status(500).json({ message: '新增精華卡片失敗' });
  }
});

// PUT /api/v1/stories/cards/:id — 更新卡片
router.put('/cards/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, image_url, video_url, category, link_url, duration_ms, is_active, sort_order } = req.body;
  try {
    const result = await pool.query(
      `UPDATE story_cards SET
         title      = COALESCE($1, title),
         image_url  = COALESCE($2, image_url),
         video_url  = COALESCE($3, video_url),
         category   = COALESCE($4, category),
         link_url   = COALESCE($5, link_url),
         duration_ms= COALESCE($6, duration_ms),
         is_active  = COALESCE($7, is_active),
         sort_order = COALESCE($8, sort_order)
       WHERE id = $9 RETURNING *`,
      [title ?? null, image_url ?? null, video_url ?? null, category ?? null,
       link_url ?? null, duration_ms ?? null, is_active ?? null, sort_order ?? null, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ message: '卡片不存在' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '更新精華卡片失敗' });
  }
});

// DELETE /api/v1/stories/cards/:id — 刪除卡片
router.delete('/cards/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM story_cards WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ message: '卡片不存在' }); return; }
    res.json({ message: '已刪除', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: '刪除精華卡片失敗' });
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
