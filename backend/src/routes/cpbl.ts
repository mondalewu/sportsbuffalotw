import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/v1/cpbl/players?teamCode=AJL011&year=2026
router.get('/players', async (req: Request, res: Response): Promise<void> => {
  const { teamCode, teamName } = req.query;
  try {
    let query = 'SELECT * FROM cpbl_players';
    const params: string[] = [];
    const conds: string[] = [];

    if (teamCode) { params.push(teamCode as string); conds.push(`team_code = $${params.length}`); }
    if (teamName) { params.push(`%${teamName}%`); conds.push(`team_name ILIKE $${params.length}`); }

    if (conds.length) query += ' WHERE ' + conds.join(' AND ');
    query += ' ORDER BY uniform_no::int NULLS LAST, name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得球員資料' });
  }
});

// GET /api/v1/cpbl/players/:acnt/stats?year=2026
router.get('/players/:acnt/stats', async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query;
  try {
    const result = await pool.query(
      `SELECT cps.*, cp.name, cp.team_name, cp.uniform_no, cp.position
       FROM cpbl_player_stats cps
       JOIN cpbl_players cp ON cp.acnt = cps.acnt
       WHERE cps.acnt = $1 ${year ? 'AND cps.year = $2' : ''}
       ORDER BY cps.year DESC, cps.kind_code`,
      year ? [req.params.acnt, year] : [req.params.acnt]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得球員數據' });
  }
});

// GET /api/v1/cpbl/stats/hitting?year=2026&kindCode=G&teamCode=...
router.get('/stats/hitting', async (req: Request, res: Response): Promise<void> => {
  const { year = 2026, kindCode, teamCode, limit = 50 } = req.query;
  try {
    const params: unknown[] = [year];
    let conds = 'cps.year = $1';
    if (kindCode) { params.push(kindCode); conds += ` AND cps.kind_code = $${params.length}`; }
    if (teamCode) { params.push(teamCode); conds += ` AND cp.team_code = $${params.length}`; }
    params.push(limit);

    const result = await pool.query(
      `SELECT cps.*, cp.name, cp.team_name, cp.uniform_no, cp.position, cp.team_code
       FROM cpbl_player_stats cps
       JOIN cpbl_players cp ON cp.acnt = cps.acnt
       WHERE ${conds} AND cps.at_bats > 0
       ORDER BY cps.avg DESC, cps.at_bats DESC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得打擊數據' });
  }
});

// GET /api/v1/cpbl/standings?year=2026&kindCode=A
router.get('/standings', async (req: Request, res: Response): Promise<void> => {
  const { year = '2026', kindCode = 'A' } = req.query;
  const league = kindCode === 'A' ? 'CPBL' : 'CPBL-W';
  try {
    const result = await pool.query(
      `SELECT team_name, wins, losses, draws, win_rate::float, games_behind::float, rank,
              (wins + losses + draws) AS games
       FROM standings
       WHERE league = $1 AND season = $2
       ORDER BY rank ASC`,
      [league, String(year)],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得積分榜', error: (err as Error).message });
  }
});

// GET /api/v1/cpbl/teams
router.get('/teams', async (_req: Request, res: Response): Promise<void> => {
  const TEAMS = [
    { code: 'AJL011', name: '樂天桃猿', color: '#CC0000' },
    { code: 'AEO011', name: '富邦悍將', color: '#003399' },
    { code: 'ACN011', name: '中信兄弟', color: '#F5A623' },
    { code: 'AKP011', name: '台鋼雄鷹', color: '#00897B' },
    { code: 'AAA011', name: '味全龍',   color: '#E91E8C' },
    { code: 'AJD011', name: '統一獅',   color: '#3F51B5' },
  ];
  res.json(TEAMS);
});

export default router;
