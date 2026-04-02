import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/v1/standings
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { league, season } = req.query;

  try {
    let query = 'SELECT * FROM standings';
    const params: string[] = [];
    const conditions: string[] = [];

    if (league) {
      params.push(league as string);
      conditions.push(`league = $${params.length}`);
    }
    if (season) {
      params.push(season as string);
      conditions.push(`season = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY rank ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get standings error:', err);
    res.status(500).json({ message: '無法取得積分榜資料' });
  }
});

export default router;
