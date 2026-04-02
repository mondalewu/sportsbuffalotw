/**
 * CPBL 比分爬蟲 — 來源: cpbl.com.tw JSON API
 *
 * 端點：
 *   POST /home/getdetaillist  → 當日比賽列表 + 即時局分 + 目前打席 + W/L/S 投手
 *   POST /box/getlive          → 單場完整打席成績 (BattingJson)
 *
 * KindCode:
 *   G = 一軍熱身賽 (春訓/熱身)
 *   A = 一軍例行賽
 */

import axios from 'axios';
import pool from '../db/pool';

const CPBL_BASE = 'https://www.cpbl.com.tw';
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const COMMON_HEADERS = {
  'User-Agent': CHROME_UA,
  'Referer': 'https://www.cpbl.com.tw/',
  'Origin': 'https://www.cpbl.com.tw',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

// 球隊名稱正規化
const TEAM_MAP: Record<string, string> = {
  '中信兄弟': '中信兄弟',
  '統一7-ELEVEn獅': '統一獅', '統一獅': '統一獅',
  '統一7-ELEVEN獅': '統一獅', '統一7ELEVEn獅': '統一獅',
  '富邦悍將': '富邦悍將',
  '樂天桃猿': '樂天桃猿',
  '台鋼雄鷹': '台鋼雄鷹',
  '味全龍': '味全龍',
};

function normTeam(name: string): string {
  const t = name?.trim() ?? '';
  return TEAM_MAP[t] ?? t;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 型別 ─────────────────────────────────────────────────────────────────────

interface GameApiItem {
  FieldAbbe: string;
  VisitingTeamName: string;
  HomeTeamName: string;
  VisitingTeamCode: string;
  HomeTeamCode: string;
  GameStatus: number;         // 1=賽前 2=進行中 3=終場 4=延賽
  GameStatusChi: string | null;
  VisitingTotalScore: number;
  HomeTotalScore: number;
  WinningPitcherName: string;
  LosePitcherName: string;
  CloserPitcherName: string;
  VisitingFirstMover: string;
  HomeFirstMover: string;
  AudienceCntBackend: number;
  GameDuringTime: string;
  Year: string;
  KindCode: string;
  GameSno: number;
  GameDate: string;
  PreExeDate: string;
  GameDateTimeE: string | null;
  VisitingScoreboards: InningBoard[] | null;
  HomeScoreboards: InningBoard[] | null;
  CurtBatting: CurtBatting | null;
  HeadUmpire: string;
}

interface InningBoard {
  InningSeq: number;
  ScoreCnt: number;
  HittingCnt: number;
  ErrorCnt: number;
  VisitingHomeType: string;   // "1"=away "2"=home
  TeamAbbr: string;
}

interface CurtBatting {
  HitterName: string;
  HitterUniformNo: string;
  HitterDefendStation: string;
  PitcherName: string;
  PitcherUniformNo: string;
  CatcherName: string;
  InningSeq: number;
  VisitingHomeType: string;   // "1"=客隊打 "2"=主隊打
  BattingOrder: number;
  StrikeCnt: number;
  BallCnt: number;
  OutCnt: number;
  PitchCnt: number;
  FirstBase: string;
  SecondBase: string;
  ThirdBase: string;
  Content: string;
  ActionName: string;
  BattingActionName: string;
  IsStrike: string;
  IsBall: string;
  IsChangePlayer: string;
  IsSpecialEvent: string;
  VisitingScore: number;
  HomeScore: number;
  HitterAcnt: string;
  PitcherAcnt: string;
  HitterImgPath: string;
}

interface BatterStatItem {
  HitterAcnt: string;
  HitterName: string;
  HitterUniformNo: string;
  VisitingHomeType: string;   // "1"=away "2"=home
  PlateAppearances: number;
  HittingCnt: number;         // at_bats
  HitCnt: number;
  OneBaseHitCnt: number;
  TwoBaseHitCnt: number;
  ThreeBaseHitCnt: number;
  HomeRunCnt: number;
  RunBattedINCnt: number;
  ScoreCnt: number;
  BasesONBallsCnt: number;
  StrikeOutCnt: number;
  StealBaseOKCnt: number;
}

interface LiveLogItem {
  InningSeq: number;
  VisitingHomeType: string;   // "1"=away batting "2"=home batting
  BattingOrder: number;
  HitterName: string;
  PitcherName: string;
  Content: string;
  StrikeCnt: number;
  BallCnt: number;
  OutCnt: number;
  FirstBase: string;
  SecondBase: string;
  ThirdBase: string;
  VisitingScore: number;
  HomeScore: number;
  HitterAcnt: string;
  HitterUniformNo: string;
}

interface FirstSnoItem {
  TeamNo: string;             // e.g. "AAA011"
  VisitingHomeType: string;   // "1"=away "2"=home
  UniformNo: string;
  Lineup: number;             // 0=pitcher, 1-9=batting order
  DefendStationCode: string;  // "P","C","1B","2B","3B","SS","LF","CF","RF","DH"
  CHName: string;
  Acnt: string;
  MainEventNoS: string;       // "0000000000" = started from game beginning
}

// ─── Step 1: 取得當日比賽列表 ─────────────────────────────────────────────────

async function fetchDailyGames(date: Date, kindCode: string): Promise<GameApiItem[]> {
  const params = new URLSearchParams({ GameDate: formatDate(date), KindCode: kindCode });
  let res;
  try {
    res = await axios.post(`${CPBL_BASE}/home/getdetaillist`, params.toString(), {
      timeout: 15000,
      headers: COMMON_HEADERS,
      maxRedirects: 10,
    });
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    console.warn(`[CPBL] /home/getdetaillist 請求失敗 (KindCode=${kindCode}, HTTP ${status ?? 'N/A'}):`, (e as Error).message);
    throw e;
  }

  const data = res.data as { Success: boolean; GameADetailJson: string | null };
  if (!data.Success) {
    console.warn(`[CPBL] /home/getdetaillist Success=false (KindCode=${kindCode}, date=${formatDate(date)})`);
    return [];
  }
  if (!data.GameADetailJson) return [];
  try {
    return JSON.parse(data.GameADetailJson) as GameApiItem[];
  } catch { return []; }
}

// ─── Step 2: 取得單場 box/getlive 數據 ───────────────────────────────────────

interface BoxLiveResponse {
  Success: boolean;
  BattingJson: string | null;     // 打者成績，key=打順 "0"-"26"，value=BatterStatItem[]
  LiveLogJson: string | null;     // 逐球紀錄，LiveLogItem[]
  FirstSnoJson: string | null;    // 先發名單，FirstSnoItem[]
}

// ─── Cookie session cache (避免每次都重新 GET 頁面) ─────────────────────────
const boxSessionCache = new Map<string, { cookie: string; ts: number }>();
const SESSION_TTL_MS = 4 * 60 * 1000; // 4 分鐘（CPBL session 壽命較短）

async function getBoxSession(year: number, kindCode: string, gameSno: number): Promise<string> {
  const key = `${year}-${kindCode}-${gameSno}`;
  const cached = boxSessionCache.get(key);
  if (cached && Date.now() - cached.ts < SESSION_TTL_MS) return cached.cookie;

  const pageUrl = `${CPBL_BASE}/box/live?year=${year}&kindCode=${kindCode}&gameSno=${gameSno}`;
  try {
    const resp = await axios.get(pageUrl, {
      timeout: 15000,
      headers: {
        ...COMMON_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'sec-fetch-site': 'none',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 10,
    });
    const raw = resp.headers['set-cookie'];
    const parts = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const cookie = parts.map((c: string) => c.split(';')[0]).join('; ');
    if (cookie) {
      boxSessionCache.set(key, { cookie, ts: Date.now() });
      console.log(`[CPBL box] 取得 session cookie (${cookie.length} chars)`);
    }
    return cookie;
  } catch (e) {
    console.warn('[CPBL box] 取 session 失敗:', (e as Error).message);
    return '';
  }
}

async function fetchBoxLive(
  year: number, kindCode: string, gameSno: number,
): Promise<{ batters: BatterStatItem[]; liveLog: LiveLogItem[]; firstSno: FirstSnoItem[] }> {
  const pageRef = `${CPBL_BASE}/box/live?year=${year}&kindCode=${kindCode}&gameSno=${gameSno}`;
  const cookie  = await getBoxSession(year, kindCode, gameSno);

  const params = new URLSearchParams({ Year: String(year), KindCode: kindCode, GameSno: String(gameSno) });
  const res = await axios.post(`${CPBL_BASE}/box/getlive`, params.toString(), {
    timeout: 20000,
    headers: {
      ...COMMON_HEADERS,
      Referer: pageRef,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    maxRedirects: 10,
  });

  const data = res.data as BoxLiveResponse;
  if (!data.Success) {
    console.warn(`[CPBL box] getlive 回傳 Success=false (gameSno=${gameSno})`);
    return { batters: [], liveLog: [], firstSno: [] };
  }

  // BattingJson: { "0": BatterStatItem[], "1": BatterStatItem[], ... } (indexed by batting order)
  // Preserve batting order key so we can save it to DB
  let batters: Array<BatterStatItem & { _battingOrder: number }> = [];
  if (data.BattingJson) {
    try {
      const byOrder = JSON.parse(data.BattingJson) as Record<string, BatterStatItem | BatterStatItem[] | null>;
      for (const [key, val] of Object.entries(byOrder)) {
        const order = parseInt(key, 10);
        if (!val) continue;
        if (Array.isArray(val)) val.forEach(b => batters.push({ ...b, _battingOrder: order }));
        else batters.push({ ...val, _battingOrder: order });
      }
    } catch { /* 略 */ }
  }

  let liveLog: LiveLogItem[] = [];
  if (data.LiveLogJson) {
    try { liveLog = JSON.parse(data.LiveLogJson) as LiveLogItem[]; } catch { /* 略 */ }
  }

  let firstSno: FirstSnoItem[] = [];
  if (data.FirstSnoJson) {
    try { firstSno = JSON.parse(data.FirstSnoJson) as FirstSnoItem[]; } catch { /* 略 */ }
  }

  return { batters, liveLog, firstSno };
}

// ─── Step 2b-1: 從 liveLog 推導局分並儲存 game_innings ───────────────────────

async function saveInningsFromLiveLog(gameId: number, liveLog: LiveLogItem[]): Promise<void> {
  if (!liveLog.length) return;

  // 按局分組：每局 { top: 客隊打席, bot: 主隊打席 }
  const inningMap = new Map<number, { top: LiveLogItem[]; bot: LiveLogItem[] }>();
  for (const e of liveLog) {
    if (!inningMap.has(e.InningSeq)) inningMap.set(e.InningSeq, { top: [], bot: [] });
    const half = inningMap.get(e.InningSeq)!;
    if (e.VisitingHomeType === '1') half.top.push(e);
    else half.bot.push(e);
  }

  let prevAway = 0;
  let prevHome = 0;

  for (const inning of [...inningMap.keys()].sort((a, b) => a - b)) {
    const { top, bot } = inningMap.get(inning)!;

    let score_away: number | null = null;
    let score_home: number | null = null;

    if (top.length > 0) {
      const last = top[top.length - 1];
      score_away = last.VisitingScore - prevAway;
      prevAway = last.VisitingScore;
    }
    if (bot.length > 0) {
      const last = bot[bot.length - 1];
      score_home = last.HomeScore - prevHome;
      prevHome = last.HomeScore;
    }

    await pool.query(
      `INSERT INTO game_innings (game_id, inning, score_away, score_home)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, inning) DO UPDATE
         SET score_away = COALESCE(EXCLUDED.score_away, game_innings.score_away),
             score_home = COALESCE(EXCLUDED.score_home, game_innings.score_home)`,
      [gameId, inning, score_away, score_home],
    );
  }
}

// ─── Step 2b: 儲存逐球紀錄到 play_by_play ────────────────────────────────────

async function saveLiveLog(gameId: number, liveLog: LiveLogItem[]): Promise<void> {
  if (!liveLog.length) return;

  // 確認 liveLog 覆蓋的最大局數
  const liveLogMaxInning = Math.max(...liveLog.map(e => e.InningSeq));

  // 查詢 DB 中已完成的最大局數（來自 game_innings）
  const existingInnRes = await pool.query<{ max_inning: number }>(
    `SELECT COALESCE(MAX(inning), 0) AS max_inning FROM game_innings WHERE game_id = $1`, [gameId]
  );
  const dbMaxInning = existingInnRes.rows[0]?.max_inning ?? 0;

  // 只有當 liveLog 覆蓋的局數 ≥ DB 已知最大局時，才整批替換
  // （避免 API 只回傳最後幾局、刪掉進行中逐筆累積的完整資料）
  if (liveLogMaxInning >= dbMaxInning && dbMaxInning > 0) {
    await pool.query('DELETE FROM play_by_play WHERE game_id = $1', [gameId]);
  } else {
    console.log(`[CPBL PBP] liveLog 僅含至 ${liveLogMaxInning}局，DB 有至 ${dbMaxInning}局 — 保留既有 PBP 資料`);
    return;
  }

  for (const entry of liveLog) {
    if (!entry.Content?.trim()) continue;
    const isTop = entry.VisitingHomeType === '1';
    const bases = `${entry.FirstBase ? '一' : ''}${entry.SecondBase ? '二' : ''}${entry.ThirdBase ? '三' : ''}`;
    const situation = `${entry.OutCnt}出 ${bases || '無人'}壘 ${entry.BallCnt}B${entry.StrikeCnt}S`;
    await pool.query(
      `INSERT INTO play_by_play
         (game_id, inning, is_top, batter_name, pitcher_name, situation, result_text, score_home, score_away)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [gameId, entry.InningSeq, isTop,
       entry.HitterName, entry.PitcherName,
       situation, entry.Content.trim(),
       entry.HomeScore, entry.VisitingScore],
    );
  }
}

// ─── Step 2c: 儲存先發名單到 game_lineups ─────────────────────────────────────

async function saveLineups(gameId: number, firstSno: FirstSnoItem[], item: GameApiItem): Promise<void> {
  if (!firstSno.length) return;
  await pool.query('DELETE FROM game_lineups WHERE game_id = $1', [gameId]);

  const home = normTeam(item.HomeTeamName);
  const away = normTeam(item.VisitingTeamName);

  for (const p of firstSno) {
    const isHome = p.VisitingHomeType === '2';
    const teamCode = isHome ? item.HomeTeamCode : item.VisitingTeamCode;
    const teamName = isHome ? home : away;

    // 先發打者 (Lineup 1-9) 和 先發投手 (Lineup=0, 從比賽開始上場)
    const isStartingPitcher = p.DefendStationCode === 'P' && p.MainEventNoS === '0000000000';
    if (p.Lineup === 0 && !isStartingPitcher) continue;  // 後援投手略過

    const battingOrder = p.Lineup > 0 ? p.Lineup : 0;  // 0 代表先發投手

    await pool.query(
      `INSERT INTO game_lineups (game_id, team_code, is_home, batting_order, position, player_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, teamCode || teamName, isHome, battingOrder, p.DefendStationCode, p.CHName],
    ).catch(() => {/* 略 */});
  }
}

// ─── Step 3: 確保 DB 有該場比賽 ───────────────────────────────────────────────

async function ensureGameInDB(item: GameApiItem): Promise<number | null> {
  const home = normTeam(item.HomeTeamName);
  const away = normTeam(item.VisitingTeamName);
  // GameDate is always YYYY-MM-DDT00:00:00 (TW date midnight, no timezone).
  const gameDateTW = item.GameDate.slice(0, 10); // "YYYY-MM-DD"
  const league = item.KindCode === 'A' ? 'CPBL' : item.KindCode === 'B' ? 'CPBL-B' : 'CPBL-W';

  // 先查
  const ex = await pool.query(
    `SELECT id FROM games
     WHERE league = $1
       AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $2::date
       AND team_home ILIKE $3 AND team_away ILIKE $4
     LIMIT 1`,
    [league, gameDateTW, `%${home}%`, `%${away}%`]
  );
  if (ex.rows.length > 0) return ex.rows[0].id as number;

  // 沒有就新增 — use GameDateTimeE for actual start time (TW local), fall back to 18:00
  // GameDateTimeE format examples: "2026-03-18T18:00:00" or null
  let timeStr = '18:00:00';
  if (item.GameDateTimeE) {
    const tm = item.GameDateTimeE.match(/T(\d{2}:\d{2})/);
    if (tm) timeStr = `${tm[1]}:00`;
  }
  const gameTs = `${gameDateTW}T${timeStr}+08:00`;

  await pool.query(
    `INSERT INTO games
       (league, team_home, team_away, venue, game_date, status, game_detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [league, home, away, item.FieldAbbe || null,
     gameTs, 'scheduled', String(item.GameSno)]
  );
  // Always fetch by date+teams (covers both insert and conflict cases)
  const found = await pool.query(
    `SELECT id FROM games
     WHERE league = $1
       AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $2::date
       AND team_home ILIKE $3 AND team_away ILIKE $4
     LIMIT 1`,
    [league, gameDateTW, `%${home}%`, `%${away}%`]
  );
  return found.rows[0]?.id ?? null;
}

// ─── Step 4: 更新比分、局分、打者資料 ────────────────────────────────────────

async function updateGame(gameId: number, item: GameApiItem): Promise<boolean> {
  let status: 'scheduled' | 'live' | 'final' = 'scheduled';
  let gameDetail = String(item.GameSno);

  if (item.GameStatus === 2) {
    status = 'live';
    if (item.CurtBatting) {
      const cb = item.CurtBatting;
      const half = cb.VisitingHomeType === '1' ? '上' : '下';
      gameDetail = `${cb.InningSeq}局${half}`;
    }
  } else if (item.GameStatus === 3) {
    status = 'final';
  } else if (item.GameStatus === 4) {
    status = 'scheduled';
    gameDetail = `${gameDetail}-延賽`;
  }

  // 更新 games 主表
  const scoreHome = item.GameStatus >= 2 ? (item.HomeTotalScore ?? null) : null;
  const scoreAway = item.GameStatus >= 2 ? (item.VisitingTotalScore ?? null) : null;
  await pool.query(
    `UPDATE games SET
       score_home  = COALESCE($1::int, score_home),
       score_away  = COALESCE($2::int, score_away),
       status      = $3,
       game_detail = $4
     WHERE id = $5`,
    [scoreHome, scoreAway, status, gameDetail, gameId]
  );

  // 更新 game_stats (W/L/S pitcher, audience, duration)
  if (item.GameStatus === 3 && (item.WinningPitcherName || item.AudienceCntBackend)) {
    const durationMin = item.GameDuringTime
      ? parseInt(item.GameDuringTime.slice(0, 2)) * 60 + parseInt(item.GameDuringTime.slice(2, 4))
      : null;
    await pool.query(
      `INSERT INTO game_stats
         (game_id, win_pitcher, loss_pitcher, save_pitcher, attendance, game_time, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (game_id) DO UPDATE
         SET win_pitcher  = COALESCE(NULLIF(EXCLUDED.win_pitcher,''), game_stats.win_pitcher),
             loss_pitcher = COALESCE(NULLIF(EXCLUDED.loss_pitcher,''), game_stats.loss_pitcher),
             save_pitcher = COALESCE(NULLIF(EXCLUDED.save_pitcher,''), game_stats.save_pitcher),
             attendance   = COALESCE(EXCLUDED.attendance, game_stats.attendance),
             game_time    = COALESCE(EXCLUDED.game_time, game_stats.game_time),
             updated_at   = NOW()`,
      [gameId,
       item.WinningPitcherName || '',
       item.LosePitcherName || '',
       item.CloserPitcherName || '',
       item.AudienceCntBackend || null,
       durationMin ? `${Math.floor(durationMin / 60)}:${String(durationMin % 60).padStart(2, '0')}` : null]
    );
  }

  // 更新 game_innings (局分) + 加總安打/失誤寫入 game_stats
  if (item.VisitingScoreboards?.length) {
    let totalHitsAway = 0;
    let totalErrorsAway = 0;
    for (const inning of item.VisitingScoreboards) {
      totalHitsAway  += inning.HittingCnt ?? 0;
      totalErrorsAway += inning.ErrorCnt  ?? 0;
      await pool.query(
        `INSERT INTO game_innings (game_id, inning, score_away, score_home)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (game_id, inning) DO UPDATE
           SET score_away = EXCLUDED.score_away`,
        [gameId, inning.InningSeq, inning.ScoreCnt]
      );
    }
    if (totalHitsAway > 0 || totalErrorsAway > 0) {
      await pool.query(
        `INSERT INTO game_stats (game_id, hits_away, errors_away)
         VALUES ($1, $2, $3)
         ON CONFLICT (game_id) DO UPDATE
           SET hits_away   = EXCLUDED.hits_away,
               errors_away = EXCLUDED.errors_away`,
        [gameId, totalHitsAway, totalErrorsAway]
      ).catch(() => {});
    }
  }
  if (item.HomeScoreboards?.length) {
    let totalHitsHome = 0;
    let totalErrorsHome = 0;
    for (const inning of item.HomeScoreboards) {
      totalHitsHome  += inning.HittingCnt ?? 0;
      totalErrorsHome += inning.ErrorCnt  ?? 0;
      await pool.query(
        `INSERT INTO game_innings (game_id, inning, score_away, score_home)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (game_id, inning) DO UPDATE
           SET score_home = EXCLUDED.score_home`,
        [gameId, inning.InningSeq, inning.ScoreCnt]
      );
    }
    if (totalHitsHome > 0 || totalErrorsHome > 0) {
      await pool.query(
        `INSERT INTO game_stats (game_id, hits_home, errors_home)
         VALUES ($1, $2, $3)
         ON CONFLICT (game_id) DO UPDATE
           SET hits_home   = EXCLUDED.hits_home,
               errors_home = EXCLUDED.errors_home`,
        [gameId, totalHitsHome, totalErrorsHome]
      ).catch(() => {});
    }
  }

  // 即時打席 → play_by_play (僅 live 且有內容)
  const cb = item.CurtBatting;
  if (cb && item.GameStatus === 2 && cb.Content) {
    const isTop = cb.VisitingHomeType === '1';
    await pool.query(
      `INSERT INTO play_by_play
         (game_id, inning, is_top, batter_name, pitcher_name, situation, result_text, score_home, score_away)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [gameId, cb.InningSeq, isTop,
       cb.HitterName,
       cb.PitcherName,
       `${cb.OutCnt}出 ${cb.FirstBase ? '一' : ''}${cb.SecondBase ? '二' : ''}${cb.ThirdBase ? '三' : ''}壘 ${cb.BallCnt}B${cb.StrikeCnt}S`,
       cb.Content.trim(),
       cb.HomeScore, cb.VisitingScore]
    );
  }

  return true;
}

// ─── Step 5: 儲存打者成績 ─────────────────────────────────────────────────────

async function saveBatterStats(gameId: number, batters: Array<BatterStatItem & { _battingOrder?: number }>, item: GameApiItem): Promise<void> {
  const home = normTeam(item.HomeTeamName);
  const away = normTeam(item.VisitingTeamName);

  // 只在終場時才清除重刷（進行中用 UPSERT 更新以保持即時資料）
  if (item.GameStatus === 3) {
    await pool.query('DELETE FROM game_batter_stats WHERE game_id = $1', [gameId]);
  }

  for (const b of batters) {
    const isHome = b.VisitingHomeType === '2';
    const teamCode = isHome ? item.HomeTeamCode : item.VisitingTeamCode;
    const teamName = isHome ? home : away;

    // HitCnt from CPBL API may represent plate appearances; calculate hits from base hit counts
    const actualHits = (b.OneBaseHitCnt ?? 0) + (b.TwoBaseHitCnt ?? 0) + (b.ThreeBaseHitCnt ?? 0) + (b.HomeRunCnt ?? 0);
    await pool.query(
      `INSERT INTO game_batter_stats
         (game_id, team_code, batting_order, position, player_name,
          at_bats, hits, rbi, runs, home_runs, strikeouts, walks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (game_id, team_code, player_name) DO UPDATE
         SET batting_order = EXCLUDED.batting_order,
             at_bats   = EXCLUDED.at_bats,
             hits      = EXCLUDED.hits,
             rbi       = EXCLUDED.rbi,
             runs      = EXCLUDED.runs,
             home_runs = EXCLUDED.home_runs,
             strikeouts = EXCLUDED.strikeouts,
             walks     = EXCLUDED.walks`,
      [gameId, teamCode || teamName,
       b._battingOrder ?? null,
       null,
       b.HitterName,
       b.HittingCnt ?? 0,
       actualHits,
       b.RunBattedINCnt ?? 0,
       b.ScoreCnt ?? 0,
       b.HomeRunCnt ?? 0,
       b.StrikeOutCnt ?? 0,
       b.BasesONBallsCnt ?? 0]
    );

    // 同步更新 cpbl_players 基本資料
    if (b.HitterAcnt) {
      await pool.query(
        `INSERT INTO cpbl_players (acnt, team_code, team_name, uniform_no, name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (acnt) DO UPDATE
           SET team_code = EXCLUDED.team_code,
               team_name = EXCLUDED.team_name,
               uniform_no = EXCLUDED.uniform_no,
               name = EXCLUDED.name,
               updated_at = NOW()`,
        [b.HitterAcnt, teamCode, teamName, b.HitterUniformNo, b.HitterName]
      ).catch(() => {/* 略過 */});
    }
  }
}

// ─── CPBL 積分榜 ──────────────────────────────────────────────────────────────

interface StandingsApiItem {
  TeamCode: string;
  TeamName: string;
  GameCnt: number;
  WinCnt: number;
  LoseCnt: number;
  TieCnt: number;
  WinRate: number;
  GameBehind: number | null;
  StrategicOrder: number;
}

async function fetchCpblStandingsData(year: number, kindCode: string): Promise<StandingsApiItem[]> {
  const params = new URLSearchParams({ Year: String(year), KindCode: kindCode });
  try {
    const res = await axios.post(`${CPBL_BASE}/standings/getstandings`, params.toString(), {
      timeout: 15000,
      headers: COMMON_HEADERS,
    });
    const data = res.data;
    if (Array.isArray(data)) return data as StandingsApiItem[];
    if (data && typeof data === 'object') {
      const d = data as { Success?: boolean; TeamStandingsJson?: string | null };
      if (d.TeamStandingsJson) return JSON.parse(d.TeamStandingsJson) as StandingsApiItem[];
    }
  } catch (e) {
    console.warn(`[CPBL Standings] API ${kindCode} 失敗:`, (e as Error).message);
  }
  return [];
}

export async function runCpblStandingsScraper(year = 2026): Promise<{ updated: number; message: string }> {
  let updated = 0;
  for (const kindCode of ['G', 'A']) {
    const league = kindCode === 'A' ? 'CPBL' : 'CPBL-W';
    const items = await fetchCpblStandingsData(year, kindCode);
    if (!items.length) { console.warn(`[CPBL Standings] ${league} 無資料`); continue; }
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      const teamName = normTeam(s.TeamName);
      const rank = s.StrategicOrder ?? (i + 1);
      try {
        await pool.query(
          `INSERT INTO standings (league, season, team_name, wins, losses, draws, win_rate, games_behind, rank)
           VALUES ($1,'2026',$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (league, season, team_name) DO UPDATE
             SET wins=$3, losses=$4, draws=$5, win_rate=$6, games_behind=$7, rank=$8, updated_at=NOW()`,
          [league, teamName, s.WinCnt, s.LoseCnt, s.TieCnt, s.WinRate, s.GameBehind ?? 0, rank],
        );
        updated++;
      } catch (e) {
        console.warn('[CPBL Standings] 儲存失敗:', teamName, (e as Error).message);
      }
    }
    console.log(`[CPBL Standings] ${league} 更新 ${items.length} 支球隊`);
  }
  return { updated, message: updated > 0 ? `✅ CPBL 積分榜更新 ${updated} 條` : '⚠ CPBL 積分榜無資料（API 可能尚未開放）' };
}

// ─── 整季賽程補抓 ─────────────────────────────────────────────────────────────

export interface ScheduleScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesInserted: number;
  isRunning: boolean;
  lastError: string | null;
  progress: string;
}

export const scheduleScraperStatus: ScheduleScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  gamesInserted: 0,
  isRunning: false,
  lastError: null,
  progress: '',
};

export async function runCpblFullScheduleScraper(
  year = 2026,
  startMonth = 3,
  endMonth = 11,
): Promise<{ inserted: number; message: string }> {
  if (scheduleScraperStatus.isRunning) {
    return { inserted: 0, message: '賽程爬蟲正在執行中，請稍後再試' };
  }
  scheduleScraperStatus.isRunning = true;
  scheduleScraperStatus.lastRun = new Date().toISOString();
  scheduleScraperStatus.lastError = null;
  scheduleScraperStatus.gamesInserted = 0;

  let inserted = 0;

  try {
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth - 1, 30);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      scheduleScraperStatus.progress = `${dateStr} (已新增 ${inserted} 場)`;

      for (const kindCode of ['G', 'A']) {
        let games: GameApiItem[];
        try {
          games = await fetchDailyGames(new Date(d), kindCode);
        } catch {
          continue;
        }
        if (!games.length) continue;

        for (const item of games) {
          try {
            const existing = await pool.query(
              `SELECT id FROM games
               WHERE league = $1
                 AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $2::date
                 AND team_home ILIKE $3 AND team_away ILIKE $4
               LIMIT 1`,
              [
                item.KindCode === 'A' ? 'CPBL' : item.KindCode === 'B' ? 'CPBL-B' : 'CPBL-W',
                item.GameDate.slice(0, 10),
                `%${normTeam(item.HomeTeamName)}%`,
                `%${normTeam(item.VisitingTeamName)}%`,
              ],
            );
            if (existing.rows.length === 0) {
              await ensureGameInDB(item);
              inserted++;
            }
            // Update scores for already-finished games
            const gameId = existing.rows[0]?.id ?? (await ensureGameInDB(item));
            if (gameId && item.GameStatus === 3) {
              await updateGame(gameId, item);
            }
          } catch (e) {
            console.warn(`[CPBL Schedule] ${dateStr} 儲存失敗:`, (e as Error).message);
          }
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    scheduleScraperStatus.gamesInserted = inserted;
    scheduleScraperStatus.lastResult = `✅ CPBL 整季賽程：新增 ${inserted} 場`;
    scheduleScraperStatus.progress = '完成';
    scheduleScraperStatus.isRunning = false;
    return { inserted, message: scheduleScraperStatus.lastResult };

  } catch (err) {
    const msg = (err as Error).message;
    scheduleScraperStatus.lastError = msg;
    scheduleScraperStatus.lastResult = `❌ CPBL 賽程爬蟲錯誤：${msg}`;
    scheduleScraperStatus.isRunning = false;
    console.error('[CPBL Schedule]', msg);
    return { inserted, message: scheduleScraperStatus.lastResult };
  }
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

export interface ScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesUpdated: number;
  isRunning: boolean;
  lastError: string | null;
}

export const scraperStatus: ScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  gamesUpdated: 0,
  isRunning: false,
  lastError: null,
};

export async function runScraper(): Promise<{ updated: number; message: string }> {
  if (scraperStatus.isRunning) {
    return { updated: 0, message: '爬蟲正在執行中，請稍後再試' };
  }
  scraperStatus.isRunning = true;
  scraperStatus.lastRun = new Date().toISOString();
  scraperStatus.lastError = null;

  try {
    const now = new Date();
    const year = now.getFullYear();
    let updated = 0;

    // 同時抓 熱身賽(G) 和 例行賽(A)
    for (const kindCode of ['G', 'A']) {
      let games: GameApiItem[];
      try {
        games = await fetchDailyGames(now, kindCode);
      } catch (e) {
        console.warn(`[CPBL] fetchDailyGames(${kindCode}) 失敗:`, (e as Error).message);
        continue;
      }
      if (!games.length) continue;

      console.log(`[CPBL] KindCode=${kindCode} 取得 ${games.length} 場`);

      for (const item of games) {
        try {
          const gameId = await ensureGameInDB(item);
          if (!gameId) continue;

          await updateGame(gameId, item);
          updated++;

          // 進行中 or 終場：抓完整箱型資料（打者成績、逐球、先發名單）
          if (item.GameStatus === 2 || item.GameStatus === 3) {
            try {
              const { batters, liveLog, firstSno } = await fetchBoxLive(year, kindCode, item.GameSno);

              // 先發名單：進行中只在尚未儲存時抓一次；終場強制覆寫
              if (firstSno.length > 0) {
                if (item.GameStatus === 3) {
                  await saveLineups(gameId, firstSno, item);
                } else {
                  const hasLineup = await pool.query(
                    'SELECT 1 FROM game_lineups WHERE game_id = $1 LIMIT 1', [gameId]
                  );
                  if (!hasLineup.rows.length) await saveLineups(gameId, firstSno, item);
                }
              }

              // 打者成績：每次都更新（即時累計）
              if (batters.length > 0) await saveBatterStats(gameId, batters, item);

              // 局分：從 liveLog 推導（主 API 直播中不回傳 Scoreboards）
              if (liveLog.length > 0) await saveInningsFromLiveLog(gameId, liveLog);

              // 逐球紀錄：終場才完整儲存（進行中由 CurtBatting 逐筆累積）
              if (item.GameStatus === 3 && liveLog.length > 0) await saveLiveLog(gameId, liveLog);

            } catch (e) {
              console.warn(`[CPBL] fetchBoxLive(${item.GameSno}) 失敗:`, (e as Error).message);
            }
            await new Promise(r => setTimeout(r, 600));
          }
        } catch (e) {
          console.warn(`[CPBL] 更新 ${item.VisitingTeamName} vs ${item.HomeTeamName} 失敗:`, (e as Error).message);
        }
      }
    }

    scraperStatus.gamesUpdated = updated;
    scraperStatus.lastResult = `✅ CPBL 更新 ${updated} 場`;
    scraperStatus.isRunning = false;
    return { updated, message: scraperStatus.lastResult };

  } catch (err) {
    const msg = (err as Error).message;
    scraperStatus.lastError = msg;
    scraperStatus.lastResult = `❌ CPBL 爬蟲錯誤：${msg}`;
    scraperStatus.isRunning = false;
    console.error('[CPBL] 錯誤:', msg);
    return { updated: 0, message: scraperStatus.lastResult };
  }
}

// ─── CPBL 二軍賽程爬蟲 ────────────────────────────────────────────────────────

export interface FarmScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesInserted: number;
  isRunning: boolean;
  lastError: string | null;
}

export const farmScraperStatus: FarmScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  gamesInserted: 0,
  isRunning: false,
  lastError: null,
};

/**
 * 抓取 CPBL 二軍(kindCode=B)賽程並存入 league='CPBL-B' 的 games 表
 * 使用與一軍相同的 POST /home/getdetaillist endpoint（kindCode=B）
 */
export async function runCpblFarmScheduleScraper(
  year = 2026,
  startMonth = 3,
  endMonth = 11,
): Promise<{ inserted: number; message: string }> {
  if (farmScraperStatus.isRunning) {
    return { inserted: 0, message: '二軍賽程爬蟲正在執行中，請稍後再試' };
  }
  farmScraperStatus.isRunning = true;
  farmScraperStatus.lastRun = new Date().toISOString();
  farmScraperStatus.lastError = null;
  farmScraperStatus.gamesInserted = 0;

  let inserted = 0;

  try {
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth - 1, 30);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      let games: GameApiItem[];
      try {
        games = await fetchDailyGames(new Date(d), 'B');
      } catch (e) {
        console.warn(`[CPBL-B] ${dateStr} fetchDailyGames 失敗:`, (e as Error).message);
        continue;
      }
      if (!games.length) continue;

      console.log(`[CPBL-B] ${dateStr} 取得 ${games.length} 場`);

      for (const item of games) {
        try {
          const existing = await pool.query(
            `SELECT id FROM games
             WHERE league = 'CPBL-B'
               AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $1::date
               AND team_home ILIKE $2 AND team_away ILIKE $3
             LIMIT 1`,
            [item.GameDate.slice(0, 10),
             `%${normTeam(item.HomeTeamName)}%`,
             `%${normTeam(item.VisitingTeamName)}%`],
          );
          if (existing.rows.length === 0) {
            await ensureGameInDB(item);
            inserted++;
          }
          const gameId = existing.rows[0]?.id ?? (await ensureGameInDB(item));
          if (gameId && item.GameStatus === 3) {
            await updateGame(gameId, item);
          }
        } catch (e) {
          console.warn(`[CPBL-B] 儲存失敗:`, (e as Error).message);
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    farmScraperStatus.gamesInserted = inserted;
    farmScraperStatus.lastResult = `✅ CPBL 二軍賽程：新增 ${inserted} 場`;
    farmScraperStatus.isRunning = false;
    return { inserted, message: farmScraperStatus.lastResult };

  } catch (err) {
    const msg = (err as Error).message;
    farmScraperStatus.lastError = msg;
    farmScraperStatus.lastResult = `❌ CPBL 二軍賽程爬蟲錯誤：${msg}`;
    farmScraperStatus.isRunning = false;
    console.error('[CPBL-B]', msg);
    return { inserted, message: farmScraperStatus.lastResult };
  }
}

/** 每分鐘即時抓今日二軍比賽比分 */
export async function runFarmScoreScraper(): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  let games: GameApiItem[];
  try {
    games = await fetchDailyGames(now, 'B');
  } catch {
    return;
  }
  for (const item of games) {
    try {
      const gameId = await ensureGameInDB(item);
      if (gameId) await updateGame(gameId, item);
    } catch (e) {
      console.error('[CPBL-B] 儲存失敗:', (e as Error).message, '| home:', item.HomeTeamName, 'away:', item.VisitingTeamName, 'date:', item.GameDate);
    }
  }
  if (games.length) console.log(`[CPBL-B] 即時更新 ${games.length} 場 (year=${year})`);
}
