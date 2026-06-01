import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// 自動建表（若不存在）
pool.query(`
  CREATE TABLE IF NOT EXISTS athletes (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    country    VARCHAR(50)  NOT NULL DEFAULT 'TW 台灣',
    event      VARCHAR(200) NOT NULL,
    pb         VARCHAR(50),
    note       VARCHAR(300),
    image_url  VARCHAR(1000),
    sort_order INT          NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`).catch(err => console.error('athletes table init error:', err));

// GET /api/v1/athletes — 公開
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM athletes WHERE is_active = true ORDER BY sort_order ASC, id ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: '無法取得選手列表' });
  }
});

// GET /api/v1/athletes/all — 後台（含停用）
router.get('/all', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`SELECT * FROM athletes ORDER BY sort_order ASC, id ASC`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: '無法取得選手列表' });
  }
});

// POST /api/v1/athletes
router.post('/', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { name, country, event, pb, note, image_url, sort_order } = req.body;
  if (!name || !event) { res.status(400).json({ message: '姓名與項目為必填' }); return; }
  try {
    const result = await pool.query(
      `INSERT INTO athletes (name, country, event, pb, note, image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, country ?? 'TW 台灣', event, pb ?? '', note ?? '', image_url ?? '', sort_order ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ message: '新增選手失敗' });
  }
});

// PUT /api/v1/athletes/:id
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { name, country, event, pb, note, image_url, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE athletes
       SET name       = COALESCE($1, name),
           country    = COALESCE($2, country),
           event      = COALESCE($3, event),
           pb         = COALESCE($4, pb),
           note       = COALESCE($5, note),
           image_url  = COALESCE($6, image_url),
           sort_order = COALESCE($7, sort_order),
           is_active  = COALESCE($8, is_active)
       WHERE id = $9 RETURNING *`,
      [name, country, event, pb, note, image_url, sort_order, is_active, req.params.id]
    );
    if (!result.rows.length) { res.status(404).json({ message: '選手不存在' }); return; }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ message: '更新選手失敗' });
  }
});

// DELETE /api/v1/athletes/:id
router.delete('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('DELETE FROM athletes WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: '刪除選手失敗' });
  }
});

export default router;
