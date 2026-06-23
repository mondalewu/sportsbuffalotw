import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const API_KEY = process.env.API_FOOTBALL_KEY ?? '';
const BASE_URL = 'https://v3.football.api-sports.io';
const WC_LEAGUE = 1;   // FIFA World Cup
const WC_SEASON = 2026;

const NOT_CONFIGURED = { configured: false, message: 'API_FOOTBALL_KEY 未設定，足球功能尚未啟用' };

// 簡易記憶體快取（避免超出免費 100 req/day 限制）
const cache = new Map<string, { data: unknown; at: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

async function apiFetch(path: string): Promise<unknown> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const res = await axios.get(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
    timeout: 10_000,
  });
  cache.set(path, { data: res.data, at: Date.now() });
  return res.data;
}

// GET /api/v1/worldcup/fixtures — 所有賽程（含即時比分）
router.get('/fixtures', async (_req: Request, res: Response): Promise<void> => {
  if (!API_KEY) { res.json(NOT_CONFIGURED); return; }
  try {
    const data = await apiFetch(`/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`);
    res.json(data);
  } catch (err) {
    console.error('[worldcup/fixtures]', err);
    res.status(502).json({ message: '無法取得賽程資料' });
  }
});

// GET /api/v1/worldcup/fixtures/live — 正在進行的比賽
router.get('/fixtures/live', async (_req: Request, res: Response): Promise<void> => {
  if (!API_KEY) { res.json(NOT_CONFIGURED); return; }
  try {
    const data = await apiFetch(`/fixtures?live=all&league=${WC_LEAGUE}`);
    res.json(data);
  } catch (err) {
    console.error('[worldcup/fixtures/live]', err);
    res.status(502).json({ message: '無法取得即時比賽' });
  }
});

// GET /api/v1/worldcup/standings — 小組積分榜
router.get('/standings', async (_req: Request, res: Response): Promise<void> => {
  if (!API_KEY) { res.json(NOT_CONFIGURED); return; }
  try {
    const data = await apiFetch(`/standings?league=${WC_LEAGUE}&season=${WC_SEASON}`);
    res.json(data);
  } catch (err) {
    console.error('[worldcup/standings]', err);
    res.status(502).json({ message: '無法取得積分榜' });
  }
});

// GET /api/v1/worldcup/teams — 所有參賽隊伍
router.get('/teams', async (_req: Request, res: Response): Promise<void> => {
  if (!API_KEY) { res.json(NOT_CONFIGURED); return; }
  try {
    const data = await apiFetch(`/teams?league=${WC_LEAGUE}&season=${WC_SEASON}`);
    res.json(data);
  } catch (err) {
    console.error('[worldcup/teams]', err);
    res.status(502).json({ message: '無法取得球隊資料' });
  }
});

// GET /api/v1/worldcup/topscorers — 射手榜
router.get('/topscorers', async (_req: Request, res: Response): Promise<void> => {
  if (!API_KEY) { res.json(NOT_CONFIGURED); return; }
  try {
    const data = await apiFetch(`/players/topscorers?league=${WC_LEAGUE}&season=${WC_SEASON}`);
    res.json(data);
  } catch (err) {
    console.error('[worldcup/topscorers]', err);
    res.status(502).json({ message: '無法取得射手榜' });
  }
});

export default router;
