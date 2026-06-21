import { Router, Request, Response } from 'express';
import { fetchNbaScoreboard, fetchNbaStandings, fetchNbaGameSummary } from '../services/nbaScraper';

const router = Router();

router.get('/scoreboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await fetchNbaScoreboard());
  } catch {
    res.status(500).json({ message: 'NBA 比分抓取失敗' });
  }
});

router.get('/standings', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await fetchNbaStandings());
  } catch {
    res.status(500).json({ message: 'NBA 積分榜抓取失敗' });
  }
});

router.get('/game/:gameId', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await fetchNbaGameSummary(req.params.gameId));
  } catch {
    res.status(500).json({ message: 'NBA 比賽詳細資料抓取失敗' });
  }
});

export default router;
