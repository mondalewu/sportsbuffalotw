import { Router, Request, Response } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { runScraper, scraperStatus, runCpblFullScheduleScraper, scheduleScraperStatus, runCpblStandingsScraper, runCpblFarmScheduleScraper, farmScraperStatus, runCpblPlayerStatsScraper, rescrapeGameByGameSno, aggregateCpblSeasonStats, runCpblPitcherStatsScraper, aggregateCpblPitcherSeasonStats, backfillCpblScheduledGames } from '../services/cpblScraper';
import { runCpblWikiRosterScraper, cpblRosterScraperStatus } from '../services/cpblRosterScraper';
import { runNpbScraper, npbScraperStatus, runNpbHistoricalBackfill, backfillStatus, runPbpBackfill, pbpBackfillStatus, runFarmYahooPbpScraper, farmPbpBackfillStatus } from '../services/npbScraper';
import { runNpbScheduleScraper, npbScheduleScraperStatus } from '../services/npbScheduleScraper';
import { runNpbRosterScraper, npbRosterScraperStatus, initNpbTeams } from '../services/npbRosterScraper';
import { runNpbFarmScraper, npbFarmScraperStatus, runNpbFarmScraperMonth } from '../services/npbFarmScraper';
import { runYahooFarmScraper, yahooFarmScraperStatus, runYahooFarmScheduleScraper, yahooFarmScheduleStatus, scrapeYahooGameById } from '../services/yahooFarmScraper';
import { runYahooFarmRosterScraper, farmRosterScraperStatus } from '../services/npbYahooFarmRosterScraper';
import { runNpbStandingsScraper, npbStandingsScraperStatus, runNpbFarmStandingsScraper, npbFarmStandingsScraperStatus } from '../services/npbStandingsScraper';
import { runDocomoFarmScraper, docomoScraperStatus, rescrapeDocomoByDbGameId, backfillPitchDataByDocomoId, backfillYahooBatterStats, previewYahooBatterStats, runBatchYahooBackfill, batchYahooBackfillStatus } from '../services/docomoFarmScraper';
import { scrapeDocomoNpbGame, scrapeDocomoNpbGameAuto, runDocomoNpbDailyScraper, docomoNpbDailyStatus } from '../services/docomoNpbScraper';
import { scrapeSanspoGame, scrapeSanspoGameAuto, runSanspoNpbDailyScraper, sanspoNpbScraperStatus, mergeNamesIntoSanspoPitchData, fetchGameList, parseSanspoDate, normalizeSanspoTeam } from '../services/sanspoNpbScraper';
import { runCombinedNpbDailyScraper, runCombinedScrapeForGame, runMergeNamesForTodayGames, combinedNpbScraperStatus } from '../services/combinedNpbScraper';
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
    docomoNpb: docomoNpbDailyStatus,
    sanspoNpb: sanspoNpbScraperStatus,
    combinedNpb: combinedNpbScraperStatus,
    npbBackfill: backfillStatus,
    npbPbpBackfill: pbpBackfillStatus,
    npbFarmPbp: farmPbpBackfillStatus,
    yahooFarm: yahooFarmScraperStatus,
    yahooFarmSchedule: yahooFarmScheduleStatus,
    yahooBatchBackfill: batchYahooBackfillStatus,
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

// GET /api/v1/scraper/test-cpbl — 診斷：直接測試 CPBL API 連通性
router.get('/test-cpbl', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const axios = (await import('axios')).default;
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
    const params = new URLSearchParams({ GameDate: dateStr, KindCode: 'A' });
    const CPBL_BASE = 'https://www.cpbl.com.tw';

    // Step 1: GET 首頁取 cookie
    let cookie = '';
    try {
      await axios.get(`${CPBL_BASE}/games`, { timeout: 10000, maxRedirects: 0,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; headers?: Record<string, unknown> } };
      if (err.response?.status === 308 || err.response?.status === 307) {
        const raw = err.response.headers?.['set-cookie'];
        const parts = Array.isArray(raw) ? raw : (raw ? [raw as string] : []);
        cookie = parts.map((c: string) => c.split(';')[0]).join('; ');
      }
    }

    // Step 2: POST getdetaillist
    const postRes = await axios.post(`${CPBL_BASE}/home/getdetaillist`, params.toString(), {
      timeout: 10000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0',
        ...(cookie ? { Cookie: cookie } : {}) },
      maxRedirects: 5,
    });

    const data = postRes.data as { Success: boolean; GameADetailJson: string | null };
    const games = data.GameADetailJson ? JSON.parse(data.GameADetailJson) : [];
    res.json({ ok: true, date: dateStr, cookieLen: cookie.length, success: data.Success, gamesCount: games.length,
      games: games.map((g: { GameSno: number; VisitingTeamName: string; HomeTeamName: string; GameStatus: number; GameStatusChi: string }) => ({ sno: g.GameSno, away: g.VisitingTeamName, home: g.HomeTeamName, status: g.GameStatus, statusChi: g.GameStatusChi }))
    });
  } catch (err) {
    res.json({ ok: false, error: (err as Error).message });
  }
});

// POST /api/v1/scraper/backfill-cpbl-scheduled — 補抓過去仍是 scheduled 的 CPBL 比賽
router.post('/backfill-cpbl-scheduled', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const daysBack = parseInt(req.body?.daysBack ?? '14', 10);
  const result = await backfillCpblScheduledGames(daysBack);
  res.json(result);
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

// POST /api/v1/scraper/cleanup-swapped-duplicates — 清除主客場互換的重複二軍比賽
router.post('/cleanup-swapped-duplicates', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  // venue 關鍵字 → 主場球隊（作為資料品質相同時的備援判斷）
  const VENUE_HOME: Record<string, string> = {
    '戸田': 'ヤクルト',
    'ZOZOマリン': 'ロッテ', '幕張': 'ロッテ', 'QVC': 'ロッテ', 'ロッテ': 'ロッテ',
    '鎌スタ': '楽天', '楽天生命': '楽天', '宮城': '楽天',
    'ファイターズ': '日本ハム', 'ESCON': '日本ハム', 'エスコン': '日本ハム',
    'タマスタ': 'ソフトバンク', 'みずほ': 'ソフトバンク', '北九州': 'ソフトバンク',
    '所沢': '西武', '西武': '西武', 'カーミニーク': '西武', 'ベルーナ': '西武',
    'ほっともっと': 'オリックス', '京セラ': 'オリックス',
    '鳴尾浜': '阪神', '甲子園': '阪神',
    '横須賀': 'DeNA', 'サーティーフォー': 'DeNA',
    '由宇': '広島', 'マツダ': '広島',
    'ナゴヤ': '中日', 'バンテリン': '中日', '岡崎': '中日',
    '浜松': 'くふうハヤテ', 'ハヤテ': 'くふうハヤテ', '静岡': 'くふうハヤテ',
    'オイシックス': 'オイシックス', '新潟': 'オイシックス',
  };

  function guessHomeTeam(venue: string | null): string | null {
    if (!venue) return null;
    for (const [kw, team] of Object.entries(VENUE_HOME)) {
      if (venue.includes(kw)) return team;
    }
    return null;
  }

  // 資料品質分數：live 狀態 > 非 null 分數 > 總得分
  function dataScore(row: { score_home: number | null; score_away: number | null; status: string }): number {
    const isLive  = row.status === 'live'  ? 10000 : 0;
    const notNull = (row.score_home !== null ? 1 : 0) + (row.score_away !== null ? 1 : 0);
    const total   = (row.score_home ?? 0) + (row.score_away ?? 0);
    return isLive + notNull * 1000 + total;
  }

  try {
    const dupRes = await pool.query<{
      id_a: number; id_b: number;
      home_a: string; away_a: string;
      sh_a: number | null; sa_a: number | null; status_a: string;
      sh_b: number | null; sa_b: number | null; status_b: string;
      venue_a: string | null;
    }>(`
      SELECT
        a.id    AS id_a,   b.id    AS id_b,
        a.team_home AS home_a, a.team_away AS away_a,
        a.score_home AS sh_a, a.score_away AS sa_a, a.status AS status_a,
        b.score_home AS sh_b, b.score_away AS sa_b, b.status AS status_b,
        a.venue AS venue_a
      FROM games a
      JOIN games b
        ON a.league = b.league
       AND DATE(a.game_date AT TIME ZONE 'Asia/Tokyo') = DATE(b.game_date AT TIME ZONE 'Asia/Tokyo')
       AND a.team_home = b.team_away
       AND a.team_away = b.team_home
       AND a.id < b.id
      WHERE a.league IN ('NPB2', 'CPBL-W', 'CPBL-B')
    `);

    if (dupRes.rows.length === 0) {
      res.json({ message: '沒有找到主客場互換的重複記錄', deleted: 0 });
      return;
    }

    const delIds: number[] = [];
    const pairs: { keep: number; del: number; reason: string }[] = [];

    for (const row of dupRes.rows) {
      const scoreA = dataScore({ score_home: row.sh_a, score_away: row.sa_a, status: row.status_a });
      const scoreB = dataScore({ score_home: row.sh_b, score_away: row.sa_b, status: row.status_b });

      let keepId: number, delId: number, reason: string;

      if (scoreA !== scoreB) {
        // 資料品質不同 → 保留較好的那筆
        keepId = scoreA > scoreB ? row.id_a : row.id_b;
        delId  = scoreA > scoreB ? row.id_b : row.id_a;
        reason = `資料品質 ${scoreA} vs ${scoreB}`;
      } else {
        // 資料品質相同 → 以場地判斷主場球隊
        const guessedHome = guessHomeTeam(row.venue_a);
        if (guessedHome && guessedHome === row.home_a) {
          // id_a 的 team_home 符合場地主場 → 保留 id_a
          keepId = row.id_a; delId = row.id_b;
          reason = `場地 ${row.venue_a} → 主場 ${guessedHome}`;
        } else if (guessedHome && guessedHome === row.away_a) {
          // id_a 的 team_away 才是正確主場 → 保留 id_b（team_home = away_a = 正確主場）
          keepId = row.id_b; delId = row.id_a;
          reason = `場地 ${row.venue_a} → 主場 ${guessedHome}（id_b 正確）`;
        } else {
          // 無法判斷 → 保留較低 id（較早入庫）
          keepId = row.id_a; delId = row.id_b;
          reason = '無法判斷，保留較早 id';
        }
      }
      delIds.push(delId);
      pairs.push({ keep: keepId, del: delId, reason });
    }

    const delResult = await pool.query(
      `DELETE FROM games WHERE id = ANY($1)`,
      [delIds],
    );
    res.json({
      message: `清除完成，刪除 ${delResult.rowCount} 筆主客場互換的重複記錄`,
      deleted: delResult.rowCount,
      pairs,
    });
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

// POST /api/v1/scraper/trigger-npb-farm-standings — 爬取 NPB 二軍順位表
router.post('/trigger-npb-farm-standings', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runNpbFarmStandingsScraper();
  res.json({ ...result, status: npbFarmStandingsScraperStatus });
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

// POST /api/v1/scraper/clear-farm-stats — 清除所有 NPB2 打投成績（重新爬取前使用）
router.post('/clear-farm-stats', verifyToken, requireRole('admin'), async (_req: Request, res: Response): Promise<void> => {
  const gameIds = await pool.query(`SELECT id FROM games WHERE league = 'NPB2'`);
  const ids = gameIds.rows.map((r: { id: number }) => r.id);
  const [bRes, pRes] = await Promise.all([
    pool.query(`DELETE FROM game_batter_stats  WHERE game_id = ANY($1)`, [ids]),
    pool.query(`DELETE FROM game_pitcher_stats WHERE game_id = ANY($1)`, [ids]),
  ]);
  res.json({ message: `✅ 清除完成：打者 ${bRes.rowCount} 筆、投手 ${pRes.rowCount} 筆`, batters: bRes.rowCount, pitchers: pRes.rowCount });
});

// POST /api/v1/scraper/rescrape-npb-docomo-game — NPB 一軍 Docomo 逐球 + 文字速報
router.post('/rescrape-npb-docomo-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const docomoGameId = String(req.body?.docomoGameId ?? '').trim();
  const dbGameId     = parseInt(req.body?.dbGameId, 10);
  const isFinal      = req.body?.isFinal === true;
  if (!docomoGameId || !dbGameId || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 docomoGameId（Docomo URL 的 game_id）與 dbGameId（DB 中的比賽 ID）' });
    return;
  }
  const result = await scrapeDocomoNpbGame(docomoGameId, dbGameId, isFinal);
  res.json(result);
});

// POST /api/v1/scraper/rescrape-npb-docomo-game-auto — 僅需 Docomo game_id，自動查找 DB 比賽
router.post('/rescrape-npb-docomo-game-auto', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const docomoGameId = String(req.body?.docomoGameId ?? '').trim();
  const isFinal      = req.body?.isFinal === true;
  if (!docomoGameId) {
    res.status(400).json({ message: '請提供 docomoGameId（Docomo URL 的 game_id）' });
    return;
  }
  const result = await scrapeDocomoNpbGameAuto(docomoGameId, isFinal);
  res.json(result);
});

// POST /api/v1/scraper/trigger-docomo-npb — 手動觸發 NPB 一軍 Docomo 日排程爬蟲
router.post('/trigger-docomo-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (docomoNpbDailyStatus.isRunning) {
    res.json({ message: 'Docomo NPB 一軍爬蟲正在執行中', status: docomoNpbDailyStatus });
    return;
  }
  runDocomoNpbDailyScraper().catch(e => console.warn('[DocomoNPB] 手動觸發失敗:', (e as Error).message));
  res.status(202).json({ message: 'Docomo NPB 一軍爬蟲已啟動（文字速報 + 好球帶）', status: docomoNpbDailyStatus });
});

// GET /api/v1/scraper/trigger-docomo-npb — 查詢狀態
router.get('/trigger-docomo-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: docomoNpbDailyStatus });
});

// POST /api/v1/scraper/rescrape-docomo-game — 指定 DB game_id 強制重新爬蟲 Docomo 二軍資料
router.post('/rescrape-docomo-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const dbGameId = parseInt(req.body?.dbGameId, 10);
  if (!dbGameId || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 dbGameId（DB 中的比賽 ID）' });
    return;
  }
  const result = await rescrapeDocomoByDbGameId(dbGameId);
  res.json(result);
});

// POST /api/v1/scraper/backfill-docomo-pitch — 補完指定比賽的全場逐球資料（Docomo game_id + DB game_id）
router.post('/backfill-docomo-pitch', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const docomoGameId = parseInt(req.body?.docomoGameId, 10);
  const dbGameId = parseInt(req.body?.dbGameId, 10);
  if (!docomoGameId || !dbGameId || isNaN(docomoGameId) || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 docomoGameId（Docomo URL 的 game_id）與 dbGameId（DB 中的比賽 ID）' });
    return;
  }
  const result = await backfillPitchDataByDocomoId(docomoGameId, dbGameId);
  res.json(result);
});

// GET /api/v1/scraper/preview-yahoo-batter-stats?gameId=XXXX — 診斷 Yahoo 解析結果（不存 DB）
router.get('/preview-yahoo-batter-stats', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const gameId = req.query?.gameId as string;
  if (!gameId) {
    res.status(400).json({ message: '請提供 gameId 查詢參數' });
    return;
  }
  const result = await previewYahooBatterStats(gameId);
  res.json(result);
});

// POST /api/v1/scraper/backfill-yahoo-batter-stats — 補完指定比賽的 Yahoo 打者逐回成績
router.post('/backfill-yahoo-batter-stats', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const yahooGameId = req.body?.yahooGameId as string;
  const dbGameId = parseInt(req.body?.dbGameId, 10);
  if (!yahooGameId || !dbGameId || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 yahooGameId（Yahoo URL 的 game_id）與 dbGameId（DB 中的比賽 ID）' });
    return;
  }
  const result = await backfillYahooBatterStats(yahooGameId, dbGameId);
  res.json(result);
});

// POST /api/v1/scraper/batch-backfill-yahoo-batter-stats — 一鍵補完所有缺少 Yahoo 逐回成績的二軍比賽
router.post('/batch-backfill-yahoo-batter-stats', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (batchYahooBackfillStatus.isRunning) {
    res.json({ message: '批量補完已在執行中', status: batchYahooBackfillStatus });
    return;
  }
  runBatchYahooBackfill().catch(console.error);
  res.status(202).json({ message: '已開始批量補完 Yahoo 二軍打者逐回成績，背景執行中', status: batchYahooBackfillStatus });
});

// GET /api/v1/scraper/batch-backfill-yahoo-batter-stats — 查詢批量補完進度
router.get('/batch-backfill-yahoo-batter-stats', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: batchYahooBackfillStatus });
});

// POST /api/v1/scraper/trigger-sanspo-npb — 手動觸發 Sanspo NPB 一軍一球速報爬蟲
router.post('/trigger-sanspo-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (sanspoNpbScraperStatus.isRunning) {
    res.json({ message: 'Sanspo NPB 爬蟲正在執行中', status: sanspoNpbScraperStatus });
    return;
  }
  runSanspoNpbDailyScraper().catch(e => console.warn('[SanspoNPB] 手動觸發失敗:', (e as Error).message));
  res.status(202).json({ message: 'Sanspo NPB 一球速報爬蟲已啟動', status: sanspoNpbScraperStatus });
});

// GET /api/v1/scraper/trigger-sanspo-npb — 查詢狀態
router.get('/trigger-sanspo-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: sanspoNpbScraperStatus });
});

// POST /api/v1/scraper/scrape-sanspo-game — 爬取指定 Sanspo globalId 的比賽（自動查找 DB）
router.post('/scrape-sanspo-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const globalId = parseInt(req.body?.globalId, 10);
  if (!globalId || isNaN(globalId)) {
    res.status(400).json({ message: '請提供 globalId（Sanspo gameGlobalId）' });
    return;
  }
  const result = await scrapeSanspoGameAuto(globalId);
  res.json(result);
});

// POST /api/v1/scraper/scrape-sanspo-game-direct — 爬取指定 Sanspo globalId + DB game_id
router.post('/scrape-sanspo-game-direct', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const globalId  = parseInt(req.body?.globalId, 10);
  const dbGameId  = parseInt(req.body?.dbGameId, 10);
  const maxInnings = parseInt(req.body?.maxInnings ?? '12', 10);
  if (!globalId || !dbGameId || isNaN(globalId) || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 globalId（Sanspo gameGlobalId）與 dbGameId（DB 比賽 ID）' });
    return;
  }
  const result = await scrapeSanspoGame(globalId, dbGameId, maxInnings);
  res.json({ success: true, message: `爬取完成：${result.pitchCount} 球，${result.innings} 局半`, ...result });
});

// POST /api/v1/scraper/trigger-combined-npb — Docomo + Sanspo 雙來源合併爬蟲
router.post('/trigger-combined-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  if (combinedNpbScraperStatus.isRunning) {
    res.json({ message: '合併爬蟲正在執行中', status: combinedNpbScraperStatus });
    return;
  }
  runCombinedNpbDailyScraper().catch(e => console.warn('[CombinedNPB] 失敗:', (e as Error).message));
  res.status(202).json({ message: 'NPB 一軍合併爬蟲已啟動（Docomo + Sanspo + 姓名補完）', status: combinedNpbScraperStatus });
});

// GET /api/v1/scraper/trigger-combined-npb — 查詢狀態
router.get('/trigger-combined-npb', verifyToken, requireRole('editor', 'admin'), (_req: Request, res: Response): void => {
  res.json({ status: combinedNpbScraperStatus });
});

// POST /api/v1/scraper/scrape-combined-game — 單場合併補完（Sanspo globalId + DB game_id）
router.post('/scrape-combined-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const globalId = parseInt(req.body?.globalId, 10);
  const dbGameId = parseInt(req.body?.dbGameId, 10);
  if (!globalId || !dbGameId || isNaN(globalId) || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 globalId（Sanspo gameGlobalId）與 dbGameId（DB 比賽 ID）' });
    return;
  }
  const result = await runCombinedScrapeForGame(globalId, dbGameId);
  res.json(result);
});

// POST /api/v1/scraper/merge-npb-names — 僅補完今日比賽的姓名（Docomo → Sanspo）
router.post('/merge-npb-names', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const result = await runMergeNamesForTodayGames();
  res.json({ message: `補完完成：${result.gamesProcessed} 場，${result.totalNamesUpdated} 筆`, ...result });
});

// POST /api/v1/scraper/merge-npb-names-game — 補完指定場次的姓名
router.post('/merge-npb-names-game', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const dbGameId = parseInt(req.body?.dbGameId, 10);
  if (!dbGameId || isNaN(dbGameId)) {
    res.status(400).json({ message: '請提供 dbGameId（DB 比賽 ID）' });
    return;
  }
  const result = await mergeNamesIntoSanspoPitchData(dbGameId);
  res.json({ message: `補完完成：打者 ${result.battersUpdated} 筆，投手 ${result.pitchersUpdated} 筆`, ...result });
});

// GET /api/v1/scraper/npb-game-ids?date=YYYY-MM-DD — 查詢指定日期 NPB 一軍比賽的所有 ID
router.get('/npb-game-ids', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const dateParam = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);

    // 1. 從 DB 取得當日 NPB 比賽
    const dbGames = await pool.query<{
      id: number;
      team_home: string;
      team_away: string;
      game_date: string;
      status: string;
      docomo_game_id: string | null;
    }>(
      `SELECT id, team_home, team_away, game_date, status, docomo_game_id
       FROM games
       WHERE league = 'NPB'
         AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
       ORDER BY game_date ASC`,
      [dateParam],
    );

    if (dbGames.rows.length === 0) {
      res.json({ date: dateParam, games: [] });
      return;
    }

    // 2. 嘗試從 Sanspo gamelist 取得 globalId（僅今日有效）
    // gamelist 回傳 "2026-05-19" 格式，直接與 dateParam 比對
    let sanspoGames: Awaited<ReturnType<typeof fetchGameList>> = [];
    try {
      const all = await fetchGameList();
      sanspoGames = all.filter(g => g.gameDate === dateParam);
    } catch { /* Sanspo 不可用時略過 */ }

    // 3. 合併資料
    const result = dbGames.rows.map(g => {
      const homeNorm = g.team_home;
      const awayNorm = g.team_away;

      // 比對 Sanspo：主客隊名部分相符即可
      const sanspoMatch = sanspoGames.find(s => {
        const sHome = normalizeSanspoTeam(s.home?.nickname ?? '');
        const sAway = normalizeSanspoTeam(s.visitor?.nickname ?? '');
        return (homeNorm.includes(sHome) || sHome.includes(homeNorm.substring(0, 2))) &&
               (awayNorm.includes(sAway) || sAway.includes(awayNorm.substring(0, 2)));
      });

      return {
        dbId: g.id,
        teamHome: g.team_home,
        teamAway: g.team_away,
        gameDate: g.game_date,
        status: g.status,
        docomoGameId: g.docomo_game_id ?? null,
        sanspoGlobalId: sanspoMatch?.gameGlobalId ?? null,
      };
    });

    res.json({ date: dateParam, games: result });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
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
