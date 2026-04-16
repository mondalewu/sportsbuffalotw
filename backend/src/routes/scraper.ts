import { Router, Request, Response } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { runScraper, scraperStatus, runCpblFullScheduleScraper, scheduleScraperStatus, runCpblStandingsScraper, runCpblFarmScheduleScraper, farmScraperStatus, runCpblPlayerStatsScraper, rescrapeGameByGameSno, aggregateCpblSeasonStats, runCpblPitcherStatsScraper, aggregateCpblPitcherSeasonStats } from '../services/cpblScraper';
import { runCpblWikiRosterScraper, cpblRosterScraperStatus } from '../services/cpblRosterScraper';
import { runNpbScraper, npbScraperStatus, runNpbHistoricalBackfill, backfillStatus, runPbpBackfill, pbpBackfillStatus, runFarmYahooPbpScraper, farmPbpBackfillStatus } from '../services/npbScraper';
import { runNpbScheduleScraper, npbScheduleScraperStatus } from '../services/npbScheduleScraper';
import { runNpbRosterScraper, npbRosterScraperStatus, initNpbTeams } from '../services/npbRosterScraper';
import { runNpbFarmScraper, npbFarmScraperStatus, runNpbFarmScraperMonth } from '../services/npbFarmScraper';
import { runYahooFarmScraper, yahooFarmScraperStatus, runYahooFarmScheduleScraper, yahooFarmScheduleStatus, scrapeYahooGameById } from '../services/yahooFarmScraper';
import { runYahooFarmRosterScraper, farmRosterScraperStatus } from '../services/npbYahooFarmRosterScraper';
import { runNpbStandingsScraper, npbStandingsScraperStatus } from '../services/npbStandingsScraper';
import { runDocomoFarmScraper, docomoScraperStatus } from '../services/docomoFarmScraper';
import pool from '../db/pool';

const router = Router();

// GET /api/v1/scraper/status
router.get('/status', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({
    cpbl: scraperStatus,
    cpblSchedule: scheduleScraperStatus,
    cpblFarm: farmScraperStatus,
    cpblRoster: cpblRosterScraperStatus,
    npb: npbScraperStatus,
    npbSchedule: npbScheduleScraperStatus,
    npbRoster: npbRosterScraperStatus,
    npbFarm: npbFarmScraperStatus,
    npbFarmRoster: farmRosterScraperStatus,
    npbStandings: npbStandingsScraperStatus,
    docomoFarm: docomoScraperStatus,
    npbBackfill: backfillStatus,
    npbPbpBackfill: pbpBackfillStatus,
    npbFarmPbp: farmPbpBackfillStatus,
    yahooFarm: yahooFarmScraperStatus,
    yahooFarmSchedule: yahooFarmScheduleStatus,
  });
});

// POST /api/v1/scraper/trigger-yahoo-farm — 手動觸發 Yahoo 二軍爬蟲
router.post('/trigger-yahoo-farm', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (yahooFarmScraperStatus.isRunning) {
    res.json({ message: 'Yahoo 二軍爬蟲正在執行中', status: yahooFarmScraperStatus });
    return;
  }
  runYahooFarmScraper().catch(console.error);
  res.json({ message: 'Yahoo 二軍爬蟲已啟動', status: yahooFarmScraperStatus });
});

// POST /api/v1/scraper/trigger-yahoo-farm-schedule — 爬取 Yahoo 二軍月賽程
router.post('/trigger-yahoo-farm-schedule', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (yahooFarmScheduleStatus.isRunning) {
    res.json({ message: 'Yahoo 二軍賽程爬蟲正在執行中', status: yahooFarmScheduleStatus });
    return;
  }
  const year  = parseInt((_req as Request).body?.year  ?? '2026', 10);
  const month = parseInt((_req as Request).body?.month ?? String(new Date().getMonth() + 1), 10);
  runYahooFarmScheduleScraper(year, month).catch(console.error);
  res.status(202).json({ message: `已開始爬取 Yahoo 二軍 ${year}年${month}月 賽程，背景執行中`, status: yahooFarmScheduleStatus });
});

// GET /api/v1/scraper/trigger-yahoo-farm-schedule — 查詢進度
router.get('/trigger-yahoo-farm-schedule', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: yahooFarmScheduleStatus });
});

// POST /api/v1/scraper/scrape-yahoo-game — 爬取指定 Yahoo 二軍比賽（比分+速報+成績）
router.post('/scrape-yahoo-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const gameId = req.body?.gameId as string;
  if (!gameId) {
    res.status(400).json({ message: '請提供 gameId（Yahoo 比賽 ID）' });
    return;
  }
  try {
    const result = await scrapeYahooGameById(gameId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: `爬取失敗: ${(err as Error).message}` });
  }
});

// POST /api/v1/scraper/trigger — 手動觸發 CPBL 比分爬蟲
router.post('/trigger', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runScraper();
  res.json({ ...result, status: scraperStatus });
});

// POST /api/v1/scraper/trigger-cpbl-schedule — 爬取 CPBL 整季賽程
router.post('/trigger-cpbl-schedule', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (scheduleScraperStatus.isRunning) {
    res.json({ message: '賽程爬蟲正在執行中', status: scheduleScraperStatus });
    return;
  }
  const year = parseInt((_req as Request).body?.year ?? '2026', 10);
  const startMonth = parseInt((_req as Request).body?.startMonth ?? '3', 10);
  const endMonth = parseInt((_req as Request).body?.endMonth ?? '11', 10);
  runCpblFullScheduleScraper(year, startMonth, endMonth).catch(console.error);
  res.status(202).json({ message: `已開始爬取 ${year} 年 ${startMonth}～${endMonth} 月賽程，背景執行中`, status: scheduleScraperStatus });
});

// GET /api/v1/scraper/trigger-cpbl-schedule — 查詢賽程爬蟲進度
router.get('/trigger-cpbl-schedule', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: scheduleScraperStatus });
});

// POST /api/v1/scraper/trigger-cpbl-roster — 爬取 CPBL 球員名冊（來源：TWBS Wiki）
router.post('/trigger-cpbl-roster', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (cpblRosterScraperStatus.isRunning) {
    res.json({ message: '名冊爬蟲正在執行中', status: cpblRosterScraperStatus });
    return;
  }
  runCpblWikiRosterScraper().catch(console.error);
  res.status(202).json({ message: '已開始從 TWBS Wiki 爬取 CPBL 球員名冊，背景執行中', status: cpblRosterScraperStatus });
});

// GET /api/v1/scraper/trigger-cpbl-roster — 查詢名冊爬蟲進度
router.get('/trigger-cpbl-roster', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: cpblRosterScraperStatus });
});

// POST /api/v1/scraper/trigger-cpbl-farm — 爬取 CPBL 二軍賽程
router.post('/trigger-cpbl-farm', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (farmScraperStatus.isRunning) {
    res.json({ message: '二軍賽程爬蟲正在執行中', status: farmScraperStatus });
    return;
  }
  const year = parseInt((_req as Request).body?.year ?? '2026', 10);
  const startMonth = parseInt((_req as Request).body?.startMonth ?? '3', 10);
  const endMonth = parseInt((_req as Request).body?.endMonth ?? '11', 10);
  runCpblFarmScheduleScraper(year, startMonth, endMonth).catch(console.error);
  res.status(202).json({ message: `已開始爬取 CPBL ${year} 年二軍賽程（${startMonth}〜${endMonth} 月），背景執行中`, status: farmScraperStatus });
});

// GET /api/v1/scraper/trigger-cpbl-farm — 查詢二軍賽程爬蟲進度
router.get('/trigger-cpbl-farm', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: farmScraperStatus });
});

// POST /api/v1/scraper/trigger-cpbl-standings — 爬取 CPBL 積分榜
router.post('/trigger-cpbl-standings', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runCpblStandingsScraper();
  res.json(result);
});

// POST /api/v1/scraper/trigger-cpbl-player-stats — 聚合 CPBL 打者賽季成績
router.post('/trigger-cpbl-player-stats', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const year = parseInt(req.body?.year ?? '2026', 10);
  const result = await aggregateCpblSeasonStats(year);
  res.json(result);
});

// POST /api/v1/scraper/trigger-cpbl-pitcher-stats — 爬取/聚合 CPBL 投手賽季成績
router.post('/trigger-cpbl-pitcher-stats', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const year = parseInt(req.body?.year ?? '2026', 10);
  const result = await runCpblPitcherStatsScraper(year);
  res.json(result);
});

// POST /api/v1/scraper/rescrape-cpbl-all — 重刷所有 CPBL 歷史比賽打者成績
router.post('/rescrape-cpbl-all', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const games = await pool.query<{ id: number; game_detail: string; league: string; game_date: string }>(
      `SELECT id, game_detail, league, game_date FROM games
       WHERE league IN ('CPBL','CPBL-W') AND status = 'final' AND game_detail IS NOT NULL
       ORDER BY game_date ASC`
    );
    res.json({ message: `開始重刷 ${games.rows.length} 場 CPBL 比賽，後台執行中...` });
    (async () => {
      let ok = 0, fail = 0;
      for (const g of games.rows) {
        try {
          const year = new Date(g.game_date).getFullYear();
          const kindCode = g.league === 'CPBL' ? 'A' : 'G';
          const gameDate = new Date(g.game_date);
          await rescrapeGameByGameSno(g.id, parseInt(g.game_detail, 10), kindCode, year, gameDate);
          ok++;
        } catch { fail++; }
      }
      console.log(`[Rescrape] CPBL 重刷完成：${ok} 成功, ${fail} 失敗`);
    })();
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// POST /api/v1/scraper/rescrape-cpbl-game — 重新爬蟲指定場次
router.post('/rescrape-cpbl-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { gameId, gameSno, kindCode, year } = req.body;
  if (!gameId || !gameSno || !kindCode || !year) {
    res.status(400).json({ message: '必填: gameId, gameSno, kindCode, year' });
    return;
  }
  const result = await rescrapeGameByGameSno(
    parseInt(gameId, 10), parseInt(gameSno, 10), kindCode, parseInt(year, 10),
  );
  res.json(result);
});

// POST /api/v1/scraper/trigger-npb — 手動觸發 NPB 比分爬蟲
router.post('/trigger-npb', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runNpbScraper();
  res.json({ ...result, status: npbScraperStatus });
});

// POST /api/v1/scraper/trigger-npb-schedule — 爬取整季賽程
router.post('/trigger-npb-schedule', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const year = parseInt(req.body?.year ?? '2026', 10);
  const result = await runNpbScheduleScraper(year);
  res.json({ ...result, status: npbScheduleScraperStatus });
});

// POST /api/v1/scraper/trigger-npb-roster — 爬取球隊名冊
router.post('/trigger-npb-roster', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runNpbRosterScraper();
  res.json({ ...result, status: npbRosterScraperStatus });
});

// POST /api/v1/scraper/init-npb-teams — 初始化球隊基本資料（不爬名冊）
router.post('/init-npb-teams', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  await initNpbTeams();
  res.json({ message: 'NPB 球隊資料初始化完成' });
});

// POST /api/v1/scraper/trigger-npb-farm — 爬取二軍賽程（當月）
router.post('/trigger-npb-farm', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runNpbFarmScraper(14, 7);
  res.json({ ...result, status: npbFarmScraperStatus });
});

// POST /api/v1/scraper/backfill-npb-farm — 補抓二軍全季賽程 (3〜11月)
router.post('/backfill-npb-farm', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (npbFarmScraperStatus.isRunning) {
    res.json({ message: '二軍爬蟲正在執行中', status: npbFarmScraperStatus });
    return;
  }
  runNpbFarmScraper(365, 365).catch(console.error); // days≥30 → full backfill
  res.status(202).json({ message: '已開始補抓二軍全季賽程（3〜11月），背景執行中', status: npbFarmScraperStatus });
});

// POST /api/v1/scraper/backfill-npb — 補抓 preseason 全部已完賽場次的比分與球員成績
router.post('/backfill-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (backfillStatus.isRunning) {
    res.json({ message: '補抓正在執行中', status: backfillStatus });
    return;
  }
  // 非同步執行，立即回傳 202
  runNpbHistoricalBackfill().catch(console.error);
  res.status(202).json({ message: '已開始補抓歷史比賽資料，可透過 /status 查看進度', status: backfillStatus });
});

// GET /api/v1/scraper/backfill-npb — 查詢補抓進度
router.get('/backfill-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: backfillStatus });
});

// POST /api/v1/scraper/backfill-pbp — 補抓所有已完賽場次的文字速報（NPB.jp）
router.post('/backfill-pbp', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (pbpBackfillStatus.isRunning) {
    res.json({ message: 'PBP 補抓正在執行中', status: pbpBackfillStatus });
    return;
  }
  runPbpBackfill().catch(console.error);
  res.status(202).json({ message: '已開始補抓文字速報，可透過 /status 查看進度', status: pbpBackfillStatus });
});

// GET /api/v1/scraper/backfill-pbp — 查詢 PBP 補抓進度
router.get('/backfill-pbp', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: pbpBackfillStatus });
});

// POST /api/v1/scraper/fix-stuck-live — 立即修復卡住的 live 比賽
router.post('/fix-stuck-live', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const r = await pool.query(`
      UPDATE games SET status = 'final'
      WHERE status = 'live'
        AND (
          (league LIKE 'CPBL%'
           AND DATE(game_date AT TIME ZONE 'Asia/Taipei')
               < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date)
          OR
          (league LIKE 'NPB%'
           AND DATE(game_date AT TIME ZONE 'Asia/Tokyo')
               < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date)
        )
      RETURNING id, league, team_away, team_home, game_date
    `);
    res.json({ message: `修復 ${r.rowCount} 場卡住的 live 比賽`, fixed: r.rows });
  } catch (err) {
    res.status(500).json({ message: `修復失敗: ${(err as Error).message}` });
  }
});

// POST /api/v1/scraper/cleanup-duplicates — 清除重複比賽（每日同組合只保留一筆）
router.post('/cleanup-duplicates', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      DELETE FROM games
      WHERE id NOT IN (
        SELECT DISTINCT ON (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo'))
          id
        FROM games
        ORDER BY league, team_home, team_away,
                 DATE(game_date AT TIME ZONE 'Asia/Tokyo'),
                 -- 優先保留有比分的記錄，其次保留最新的
                 CASE WHEN score_home IS NOT NULL THEN 0 ELSE 1 END,
                 id DESC
      )
    `);
    res.json({ message: `清除完成，刪除 ${result.rowCount} 筆重複記錄` });
  } catch (err) {
    res.status(500).json({ message: `清除失敗: ${(err as Error).message}` });
  }
});

// POST /api/v1/scraper/trigger-npb-farm-roster — 爬取二軍獨立球隊 Yahoo 名冊
router.post('/trigger-npb-farm-roster', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runYahooFarmRosterScraper();
  res.json({ ...result, status: farmRosterScraperStatus });
});

// POST /api/v1/scraper/trigger-npb-standings — 爬取 NPB 一軍積分榜
router.post('/trigger-npb-standings', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runNpbStandingsScraper();
  res.json({ ...result, status: npbStandingsScraperStatus });
});

// POST /api/v1/scraper/trigger-npb-farm-month — 爬取二軍指定月份賽程
router.post('/trigger-npb-farm-month', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const year  = parseInt(req.body?.year  ?? '2026', 10);
  const month = parseInt(req.body?.month ?? String(new Date().getMonth() + 1), 10);
  if (npbFarmScraperStatus.isRunning) {
    res.json({ message: '二軍爬蟲正在執行中', status: npbFarmScraperStatus });
    return;
  }
  runNpbFarmScraperMonth(year, month).catch(console.error);
  res.status(202).json({ message: `已開始爬取 ${year}年${month}月 二軍賽程，背景執行中`, status: npbFarmScraperStatus });
});

// POST /api/v1/scraper/backfill-farm-pbp — 補抓二軍 Yahoo 文字速報
router.post('/backfill-farm-pbp', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (farmPbpBackfillStatus.isRunning) {
    res.json({ message: '二軍 PBP 補抓正在執行中', status: farmPbpBackfillStatus });
    return;
  }
  const forceRefresh = (_req as Request).body?.force === true;
  runFarmYahooPbpScraper(forceRefresh).catch(console.error);
  res.status(202).json({
    message: `已開始補抓二軍 Yahoo 文字速報${forceRefresh ? '（強制重抓）' : ''}，背景執行中`,
    status: farmPbpBackfillStatus,
  });
});

// GET /api/v1/scraper/backfill-farm-pbp — 查詢二軍 PBP 補抓進度
router.get('/backfill-farm-pbp', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: farmPbpBackfillStatus });
});

// POST /api/v1/scraper/trigger-docomo-farm — 手動觸發 Docomo 二軍爬蟲（含投球資料）
router.post('/trigger-docomo-farm', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  if (docomoScraperStatus.isRunning) {
    res.json({ message: 'Docomo 爬蟲正在執行中', status: docomoScraperStatus });
    return;
  }
  runDocomoFarmScraper().catch(console.error);
  res.status(202).json({ message: 'Docomo 二軍爬蟲已啟動（含打投成績 + 投球位置）', status: docomoScraperStatus });
});

// GET /api/v1/scraper/trigger-docomo-farm — 查詢進度
router.get('/trigger-docomo-farm', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: docomoScraperStatus });
});

// POST /api/v1/scraper/import-games — 手動匯入比賽資料（用於無法爬取的聯盟，如 CPBL 二軍）
router.post('/import-games', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  interface ImportGame {
    date: string;       // YYYY-MM-DD
    time?: string;      // HH:MM (optional, default 14:05)
    home: string;       // 主場球隊中文名
    away: string;       // 客場球隊中文名
    venue?: string;     // 場地（optional）
    league?: string;    // 聯盟 (default CPBL-B)
    gameNo?: string;    // 場次編號（optional）
    status?: string;    // scheduled | final
  }

  const games: ImportGame[] = req.body?.games;
  if (!Array.isArray(games) || games.length === 0) {
    res.status(400).json({ message: '請提供 games 陣列' });
    return;
  }

  const TEAM_MAP: Record<string, string> = {
    '中信兄弟': '中信兄弟',
    '統一7-ELEVEn獅': '統一獅', '統一獅': '統一獅',
    '富邦悍將': '富邦悍將',
    '樂天桃猿': '樂天桃猿',
    '台鋼雄鷹': '台鋼雄鷹',
    '味全龍': '味全龍',
  };
  const normTeam = (n: string) => TEAM_MAP[n?.trim()] ?? n?.trim() ?? '';

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const g of games) {
    try {
      const home = normTeam(g.home);
      const away = normTeam(g.away);
      const league = g.league ?? 'CPBL-B';
      const timeStr = g.time ? `${g.time}:00` : '14:05:00';
      const gameTs = `${g.date}T${timeStr}+08:00`;
      const status = g.status ?? 'scheduled';

      const existing = await pool.query(
        `SELECT id FROM games
         WHERE league = $1
           AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $2::date
           AND team_home ILIKE $3 AND team_away ILIKE $4
         LIMIT 1`,
        [league, g.date, `%${home}%`, `%${away}%`]
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      await pool.query(
        `INSERT INTO games (league, team_home, team_away, venue, game_date, status, game_detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [league, home, away, g.venue ?? null, gameTs, status, g.gameNo ?? null]
      );
      inserted++;
    } catch (e) {
      errors.push(`${g.date} ${g.home}vs${g.away}: ${(e as Error).message}`);
    }
  }

  res.json({
    message: `匯入完成：新增 ${inserted} 場，跳過 ${skipped} 場（重複）`,
    inserted, skipped,
    errors: errors.slice(0, 10),
  });
});

export default router;
