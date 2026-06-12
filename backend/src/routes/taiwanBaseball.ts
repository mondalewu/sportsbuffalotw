import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

async function ensureTables() {
  for (const file of [
    'migration_006_taiwan_baseball.sql',
    'migration_007_taiwan_baseball_category.sql',
    'migration_008_soccer_category.sql',
    'migration_009_basketball_category.sql',
    'migration_010_tw_baseball_rosters.sql',
    'seed_001_yushan2026.sql',
  ]) {
    const sql = fs.readFileSync(path.join(__dirname, '../db', file), 'utf8');
    await pool.query(sql);
  }
}

ensureTables().catch(err => console.warn('[TW Baseball] migration warning:', err.message));

// GET /api/v1/taiwan-baseball/tournaments?level=senior&year=2026
router.get('/tournaments', async (req: Request, res: Response): Promise<void> => {
  const { level, year } = req.query;
  try {
    const params: unknown[] = [];
    const conds: string[] = [];
    if (level) { params.push(level); conds.push(`level = $${params.length}`); }
    if (year)  { params.push(Number(year)); conds.push(`year = $${params.length}`); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM tw_baseball_tournaments ${where} ORDER BY start_date DESC NULLS LAST, id DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得賽事列表' });
  }
});

// GET /api/v1/taiwan-baseball/tournaments/:id
router.get('/tournaments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tw_baseball_tournaments WHERE id = $1',
      [req.params.id],
    );
    if (!rows.length) { res.status(404).json({ message: '找不到賽事' }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: '無法取得賽事' });
  }
});

// GET /api/v1/taiwan-baseball/tournaments/:id/games
router.get('/tournaments/:id/games', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tw_baseball_games WHERE tournament_id = $1 ORDER BY game_date ASC NULLS LAST, id ASC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得賽程' });
  }
});

// GET /api/v1/taiwan-baseball/tournaments/:id/rosters
router.get('/tournaments/:id/rosters', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tw_baseball_rosters WHERE tournament_id = $1 ORDER BY team_name ASC, id ASC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得名單' });
  }
});

// POST /api/v1/taiwan-baseball/tournaments (editor+)
router.post('/tournaments', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { level, name, year, start_date, end_date, format, status } = req.body;
  if (!level || !name || !year) { res.status(400).json({ message: '缺少必要欄位' }); return; }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tw_baseball_tournaments (level, name, year, start_date, end_date, format, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [level, name, year, start_date || null, end_date || null, format || null, status || 'upcoming'],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: '新增失敗' });
  }
});

// PATCH /api/v1/taiwan-baseball/tournaments/:id (editor+)
router.patch('/tournaments/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const fields = ['level', 'name', 'year', 'start_date', 'end_date', 'format', 'status'];
  const updates: string[] = [];
  const params: unknown[] = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f} = $${params.length}`); }
  });
  if (!updates.length) { res.status(400).json({ message: '沒有可更新的欄位' }); return; }
  params.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE tw_baseball_tournaments SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) { res.status(404).json({ message: '找不到賽事' }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: '更新失敗' });
  }
});

// POST /api/v1/taiwan-baseball/tournaments/:id/games (editor+)
router.post('/tournaments/:id/games', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { team_home, team_away, score_home, score_away, status, game_date, venue, round, game_detail } = req.body;
  if (!team_home || !team_away) { res.status(400).json({ message: '缺少必要欄位' }); return; }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tw_baseball_games
         (tournament_id, team_home, team_away, score_home, score_away, status, game_date, venue, round, game_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, team_home, team_away, score_home ?? null, score_away ?? null,
       status || 'scheduled', game_date || null, venue || null, round || null, game_detail || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: '新增比賽失敗' });
  }
});

// PATCH /api/v1/taiwan-baseball/games/:id (editor+)
router.patch('/games/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const fields = ['team_home', 'team_away', 'score_home', 'score_away', 'status', 'game_date', 'venue', 'round', 'game_detail'];
  const updates: string[] = [];
  const params: unknown[] = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f} = $${params.length}`); }
  });
  if (!updates.length) { res.status(400).json({ message: '沒有可更新的欄位' }); return; }
  params.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE tw_baseball_games SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) { res.status(404).json({ message: '找不到比賽' }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: '更新失敗' });
  }
});

// DELETE /api/v1/taiwan-baseball/games/:id (admin only)
router.delete('/games/:id', verifyToken, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('DELETE FROM tw_baseball_games WHERE id = $1', [req.params.id]);
    res.json({ message: '已刪除' });
  } catch (err) {
    res.status(500).json({ message: '刪除失敗' });
  }
});

// DELETE /api/v1/taiwan-baseball/tournaments/:id (admin only)
router.delete('/tournaments/:id', verifyToken, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('DELETE FROM tw_baseball_tournaments WHERE id = $1', [req.params.id]);
    res.json({ message: '已刪除' });
  } catch (err) {
    res.status(500).json({ message: '刪除失敗' });
  }
});

export default router;
