import { Router, Request, Response } from 'express';
import { fetchNbaScoreboard, fetchNbaStandings } from '../services/nbaScraper';

const router = Router();

// GET /api/v1/nba/scoreboard  — 今日比賽
router.get('/scoreboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const games = await fetchNbaScoreboard();
    res.json(games);
  } catch {
    res.status(500).json({ message: 'NBA 比分抓取失敗' });
  }
});

// GET /api/v1/nba/standings  — 積分榜
router.get('/standings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const standings = await fetchNbaStandings();
    res.json(standings);
  } catch {
    res.status(500).json({ message: 'NBA 積分榜抓取失敗' });
  }
});

export default router;
