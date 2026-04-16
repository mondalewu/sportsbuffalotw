/**
 * Docomo Farm Baseball Scraper
 *
 * 資料來源：Docomo Sports API
 *   今日賽程：https://sports-api.smt.docomo.ne.jp/data/baseball/farm/top_today_schedule.json
 *   比賽資料：https://sports-api.smt.docomo.ne.jp/data/baseball/farm/result/{game_id}/{type}.json
 *
 * 可取得：
 *   ✅ 今日賽程 + 即時比分（live/final）
 *   ✅ 各局比分（home.json / visit.json）
 *   ✅ 打者成績（batter_info.json）
 *   ✅ 投手成績（pitcher_info.json）
 *   ✅ 文字速報（index_text.json）
 *   ✅ 先發名單（starting.json）
 */

import axios from 'axios';
import pool from '../db/pool';

const DOCOMO_API = 'https://sports-api.smt.docomo.ne.jp/data/baseball/farm';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
  'Referer': 'https://service.smt.docomo.ne.jp/',
};

// Docomo 短縮チーム名 → DB チーム名
const TEAM_MAP: Record<string, string> = {
  'ロッテ': 'ロッテ',       '日本ハム': '日本ハム',
  '楽天': '楽天',           '西武': '西武',
  'オリックス': 'オリックス', 'ソフトバンク': 'ソフトバンク',
  '巨人': '巨人',           'DeNA': 'DeNA',
  'ＤｅＮＡ': 'DeNA',
  '阪神': '阪神',           '広島': '広島',
  '中日': '中日',           'ヤクルト': 'ヤクルト',
  'ハヤテ': 'くふうハヤテ', 'くふうハヤテ': 'くふうハヤテ',
  'オイシックス': 'オイシックス',
};

function normalizeTeam(name: string): string {
  return TEAM_MAP[name] ?? name;
}

// game_state: 0=scheduled, 1=live, 2/4=final
const STATE_TO_STATUS: Record<number, 'scheduled' | 'live' | 'final'> = {
  0: 'scheduled',
  1: 'live',
  2: 'final',
  4: 'final',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocomoGame {
  game_id: number;
  game_state: number;
  game_date: string;         // "2026/04/14"
  time: string;              // "12:00:00"
  stadium_name_s: string;
  home_team_id: number;
  visit_team_id: number;
  home_team_name_s: string;
  visit_team_name_s: string;
  home_score: number | null;
  visit_score: number | null;
  inning: number | null;
  tb: number | null;         // 1=top, 2=bottom
}

interface DocomoSchedule {
  today: DocomoGame[];
}

interface DocomoInnScore {
  inn: number | string;
  tb: string;                // "1"=top(visit), "2"=bottom(home)
  r: number | string;
  h: number | string;
  col_count: number | string;
}

interface DocomoPitcherRef {
  id: string;
  name_l: string;
  name_s: string;
  team_id: string;
}

interface DocomoTeamStats {
  team_id: string;
  inn_score: DocomoInnScore[];
  score: string | number;
  hits: string | number;
  pitcher: DocomoPitcherRef[];
}

interface DocomoStartingPlayer {
  player_id: number;
  player_name_l: string;
  start_bat_no: number;
  start_position_name: string;
  team_id: string;
}

interface DocomoStartingTeam {
  '@attributes'?: { hv: number };
  hv?: number;
  team_id: string;
  team_name_s: string;
  player_info: DocomoStartingPlayer[];
}

interface DocomotBatter {
  '@attributes'?: { row_no: string };
  id: string;
  name_s: string;
  name_l: string;
  bat_no: string;
  seq_no: string;
  pos_char: string;
  pa: string; ab: string; r: string; h: string;
  h2b: string; h3b: string; hr: string; rbi: string;
  so: string; bb: string; hp: string; sh: string; sf: string; sb: string;
}

interface DocomotPitcher {
  '@attributes'?: { no: string };
  id: string;
  name_s: string;
  name_l: string;
  ip: string;
  ip3: string;
  bf: string; so: string; bb: string; hbp: string;
  h: string; hr: string; r: string; er: string; nop: string;
  total_win_c: string; total_lose_c: string; total_save_c: string;
  total_era: string;
}

interface DocomoPbpEntry {
  bat_num: string;
  team_name_s: string;
  name_s: string;
  text: string;
  option: number;
  ball_kind: string;
  result_id: string;
  result_flg: string;
  ball_num: string;
  inning_text?: Record<string, unknown>;
}

interface DocomoIndexEntry {
  file_name: string;
  inning: string;
  tb: string;               // "1"=top, "2"=bottom
  pitcher: { name: string; name_l?: string; name_s?: string };
  batter:  { name: string; name_l?: string; name_s?: string };
  pitch_info?: Record<string, {
    ball_kind_id: string;
    ball_kind_name: string;
    ball_kind: string;       // "1"=straight, "2"=offspeed
    x: string;
    y: string;
    speed: string;
    result_id: string;
    result: string;
    course_no?: string;
  }>;
}

// ── Status ────────────────────────────────────────────────────────────────────

export interface DocomoScraperStatus {
  lastRun: string | null;
  lastResult: string;
  isRunning: boolean;
  lastError: string | null;
}

export const docomoScraperStatus: DocomoScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  isRunning: false,
  lastError: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await axios.get<T>(url, {
      timeout: 15000,
      headers: HEADERS,
      validateStatus: s => s < 500,
    });
    if (typeof res.data === 'string' && (res.data as string).includes('Not Found')) return null;
    return res.data;
  } catch (e) {
    console.warn('[Docomo] fetch失敗:', url, (e as Error).message);
    return null;
  }
}

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

// Parse inning and tb from index_text key format: "IITXXXX"
// e.g. "0510401" → inning=5, isTop=true (tb=1)
function parseInnTb(key: string): { inning: number; isTop: boolean } {
  const inning = parseInt(key.substring(0, 2), 10) || 1;
  const tb = key.charAt(2); // "1"=top(visit), "2"=bottom(home)
  return { inning, isTop: tb === '1' };
}

// ── Game matching ─────────────────────────────────────────────────────────────

interface DbGameMatch {
  id: number;
  homeIsDocHome: boolean; // true = DB team_home matches Docomo home_team
}

async function findDbGame(homeTeam: string, visitTeam: string, gameDate: string): Promise<DbGameMatch | null> {
  const date = gameDate.replace(/\//g, '-');
  const homeNorm  = normalizeTeam(homeTeam);
  const visitNorm = normalizeTeam(visitTeam);

  const res = await pool.query<{ id: number; team_home: string }>(
    `SELECT id, team_home FROM games
     WHERE league = 'NPB2'
       AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
       AND (
         (team_home = $2 AND team_away = $3)
         OR (team_home = $3 AND team_away = $2)
       )
     LIMIT 1`,
    [date, homeNorm, visitNorm],
  );
  if (!res.rows[0]) return null;
  return {
    id: res.rows[0].id,
    homeIsDocHome: res.rows[0].team_home === homeNorm,
  };
}

// ── Score + inning update ─────────────────────────────────────────────────────

async function updateGameScore(
  dbGameId: number,
  homeScore: number | null,
  visitScore: number | null,
  status: 'scheduled' | 'live' | 'final',
  inning: number | null,
  tb: number | null,
): Promise<void> {
  let gameDetail: string;
  if (status === 'final') {
    gameDetail = '試合終了';
  } else if (status === 'live' && inning) {
    gameDetail = `${inning}回${tb === 1 ? '表' : '裏'}`;
  } else {
    gameDetail = '試合開始前';
  }

  await pool.query(
    `UPDATE games
     SET score_home  = COALESCE($1, score_home),
         score_away  = COALESCE($2, score_away),
         status      = $3,
         game_detail = $4
     WHERE id = $5`,
    [homeScore, visitScore, status, gameDetail, dbGameId],
  );
}

async function saveInnings(
  dbGameId: number,
  homeData: DocomoTeamStats | null,
  visitData: DocomoTeamStats | null,
): Promise<void> {
  const map: Record<number, { away: number | null; home: number | null }> = {};

  for (const inn of visitData?.inn_score ?? []) {
    const i = toNum(inn.inn);
    const colCount = toNum(inn.col_count);
    if (i < 1 || colCount === 0) continue;
    map[i] ??= { away: null, home: null };
    map[i].away = toNum(inn.r);
  }
  for (const inn of homeData?.inn_score ?? []) {
    const i = toNum(inn.inn);
    const colCount = toNum(inn.col_count);
    if (i < 1 || colCount === 0) continue;
    map[i] ??= { away: null, home: null };
    map[i].home = toNum(inn.r);
  }

  for (const [innStr, scores] of Object.entries(map)) {
    if (scores.away === null && scores.home === null) continue;
    await pool.query(
      `INSERT INTO game_innings (game_id, inning, score_away, score_home)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, inning) DO UPDATE
         SET score_away = COALESCE(EXCLUDED.score_away, game_innings.score_away),
             score_home = COALESCE(EXCLUDED.score_home, game_innings.score_home)`,
      [dbGameId, parseInt(innStr, 10), scores.away, scores.home],
    ).catch(() => {});
  }
}

// ── Batter stats ──────────────────────────────────────────────────────────────

async function saveBatterStats(
  dbGameId: number,
  batterData: Record<string, DocomotBatter>,
  playerTeamMap: Record<string, string>,
): Promise<void> {
  await pool.query('DELETE FROM game_batter_stats WHERE game_id = $1', [dbGameId]);

  const entries = Object.entries(batterData).sort(([, a], [, b]) => {
    const orderDiff = toNum(a.bat_no) - toNum(b.bat_no);
    if (orderDiff !== 0) return orderDiff;
    return toNum(a.seq_no) - toNum(b.seq_no);
  });

  for (const [playerId, batter] of entries) {
    const teamCode = playerTeamMap[playerId];
    if (!teamCode) continue;

    const playerName = batter.name_l || batter.name_s || '';
    if (!playerName) continue;

    const batNo  = toNum(batter.bat_no);
    const seqNo  = toNum(batter.seq_no);
    const posChar = batter.pos_char ?? '';
    // seq_no=1 → starter (先発), wrap in parens so LineupPanel can distinguish
    const position = posChar ? (seqNo <= 1 ? `(${posChar})` : posChar) : '';

    await pool.query(
      `INSERT INTO game_batter_stats
         (game_id, team_code, batting_order, position, player_name,
          at_bats, hits, rbi, runs, home_runs, strikeouts, walks, stolen_bases, hit_by_pitch, sacrifice_hits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        dbGameId, teamCode, batNo, position, playerName,
        toNum(batter.ab), toNum(batter.h), toNum(batter.rbi), toNum(batter.r),
        toNum(batter.hr), toNum(batter.so), toNum(batter.bb),
        toNum(batter.sb), toNum(batter.hp), toNum(batter.sh),
      ],
    ).catch(e => console.warn('[Docomo] batter insert失敗:', playerName, e.message));
  }
}

// ── Pitcher stats ─────────────────────────────────────────────────────────────

async function savePitcherStats(
  dbGameId: number,
  pitcherData: Record<string, DocomotPitcher>,
  homePitcherIds: Set<string>,
  visitPitcherIds: Set<string>,
  homeTeamName: string,
  visitTeamName: string,
): Promise<void> {
  let homeOrder = 1;
  let visitOrder = 1;

  for (const [playerId, p] of Object.entries(pitcherData)) {
    let teamCode: string;
    let pitcherOrder: number;

    if (homePitcherIds.has(playerId)) {
      teamCode = homeTeamName;
      pitcherOrder = homeOrder++;
    } else if (visitPitcherIds.has(playerId)) {
      teamCode = visitTeamName;
      pitcherOrder = visitOrder++;
    } else {
      continue; // cannot determine team
    }

    const ip  = toNum(p.ip);
    const ip3 = p.ip3 ? toNum(p.ip3) : 0;
    const ipStr = ip3 > 0 ? `${ip}.${ip3}` : String(ip);
    const playerName = p.name_l || p.name_s || '';
    if (!playerName) continue;

    await pool.query(
      `INSERT INTO game_pitcher_stats
         (game_id, team_code, pitcher_order, player_name, innings_pitched,
          hits_allowed, runs_allowed, earned_runs, walks, strikeouts,
          home_runs_allowed, hit_by_pitch, pitch_count, batters_faced)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (game_id, team_code, player_name) DO UPDATE
         SET innings_pitched    = EXCLUDED.innings_pitched,
             hits_allowed       = EXCLUDED.hits_allowed,
             runs_allowed       = EXCLUDED.runs_allowed,
             earned_runs        = EXCLUDED.earned_runs,
             walks              = EXCLUDED.walks,
             strikeouts         = EXCLUDED.strikeouts,
             home_runs_allowed  = EXCLUDED.home_runs_allowed,
             hit_by_pitch       = EXCLUDED.hit_by_pitch,
             pitch_count        = EXCLUDED.pitch_count,
             batters_faced      = EXCLUDED.batters_faced`,
      [
        dbGameId, teamCode, pitcherOrder, playerName, ipStr,
        toNum(p.h), toNum(p.r), toNum(p.er),
        toNum(p.bb), toNum(p.so), toNum(p.hr), toNum(p.hbp),
        toNum(p.nop), toNum(p.bf),
      ],
    ).catch(e => console.warn('[Docomo] pitcher insert失敗:', playerName, e.message));
  }
}

// ── Pitch data (location + type) ─────────────────────────────────────────────

// Strike-zone result IDs that are called strikes
// result_id=18 = ボール（壞球）; 其餘為好球、觸身、進場等
const BALL_RESULT_ID = '18';

async function savePitchData(
  dbGameId: number,
  indexData: Record<string, DocomoIndexEntry>,
): Promise<void> {
  // 每次完整重抓：先刪除再寫入最新資料
  await pool.query('DELETE FROM game_pitch_data WHERE game_id = $1', [dbGameId]);

  for (const [atBatKey, atBat] of Object.entries(indexData)) {
    if (!atBat.pitch_info || typeof atBat.pitch_info !== 'object') continue;

    const inning = parseInt(atBat.inning ?? '1', 10);
    const isTop  = (atBat.tb ?? '1') === '1';
    const pitcherName = atBat.pitcher?.name ?? atBat.pitcher?.name_l ?? atBat.pitcher?.name_s ?? '';
    const batterName  = atBat.batter?.name  ?? atBat.batter?.name_l  ?? atBat.batter?.name_s  ?? '';

    for (const [pitchNumStr, pitch] of Object.entries(atBat.pitch_info)) {
      const pitchNum = parseInt(pitchNumStr, 10);
      if (!pitch || !pitch.x || !pitch.y) continue;

      const x       = parseInt(pitch.x, 10);
      const y       = parseInt(pitch.y, 10);
      const speed   = pitch.speed ? parseInt(pitch.speed, 10) : null;
      const isStrike = (pitch.result_id ?? '') !== BALL_RESULT_ID && (pitch.result_id ?? '') !== '';

      await pool.query(
        `INSERT INTO game_pitch_data
           (game_id, at_bat_key, pitch_num, inning, is_top,
            pitcher_name, batter_name, ball_kind, ball_kind_id,
            x, y, speed, result, result_id, is_strike)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (game_id, at_bat_key, pitch_num) DO UPDATE
           SET x=EXCLUDED.x, y=EXCLUDED.y, speed=EXCLUDED.speed,
               result=EXCLUDED.result, result_id=EXCLUDED.result_id,
               is_strike=EXCLUDED.is_strike`,
        [
          dbGameId, atBatKey, pitchNum, inning, isTop,
          pitcherName, batterName, pitch.ball_kind_name ?? '', pitch.ball_kind_id ?? '',
          x, y, speed, pitch.result ?? '', pitch.result_id ?? '', isStrike,
        ],
      ).catch(() => {});
    }
  }
}

// ── Play-by-play ──────────────────────────────────────────────────────────────

async function savePlayByPlay(
  dbGameId: number,
  pbpData: Record<string, DocomoPbpEntry>,
): Promise<void> {
  // 完整重抓：刪除後重新寫入
  await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [dbGameId]);

  // 只取打席結果（ball_num 空白 = 打席摘要）
  const entries = Object.entries(pbpData)
    .filter(([, e]) => !e.ball_num)
    .sort(([a], [b]) => a.localeCompare(b));

  let playOrder = 0;
  for (const [key, pbp] of entries) {
    if (!pbp.text) continue;
    const { inning, isTop } = parseInnTb(key);

    await pool.query(
      `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [dbGameId, inning, isTop, ++playOrder, pbp.text],
    ).catch(() => {});
  }
}

// ── Per-game full fetch ───────────────────────────────────────────────────────

async function fetchAndSaveGame(
  gameInfo: DocomoGame,
  match: DbGameMatch,
): Promise<void> {
  const { id: dbGameId, homeIsDocHome } = match;
  const gid = gameInfo.game_id.toString();
  const homeTeam  = normalizeTeam(gameInfo.home_team_name_s);
  const visitTeam = normalizeTeam(gameInfo.visit_team_name_s);
  const status    = STATE_TO_STATUS[gameInfo.game_state] ?? 'scheduled';

  // Docomo home/visit might be swapped vs DB storage: adjust scores accordingly
  const dbHomeScore  = homeIsDocHome ? gameInfo.home_score  : gameInfo.visit_score;
  const dbAwayScore  = homeIsDocHome ? gameInfo.visit_score : gameInfo.home_score;

  // 1. Update score in games table
  await updateGameScore(
    dbGameId,
    dbHomeScore,
    dbAwayScore,
    status,
    gameInfo.inning,
    gameInfo.tb,
  );

  // 2. Inning scores
  const [docHomeData, docVisitData] = await Promise.all([
    fetchJson<DocomoTeamStats>(`${DOCOMO_API}/result/${gid}/home.json`),
    fetchJson<DocomoTeamStats>(`${DOCOMO_API}/result/${gid}/visit.json`),
  ]);
  // If DB stores teams swapped vs Docomo, swap home/visit for inning saving
  const homeData  = homeIsDocHome ? docHomeData  : docVisitData;
  const visitData = homeIsDocHome ? docVisitData : docHomeData;
  await saveInnings(dbGameId, homeData, visitData);

  // Save R/H to game_stats
  if (homeData || visitData) {
    await pool.query(
      `INSERT INTO game_stats (game_id, hits_home, hits_away)
       VALUES ($1, $2, $3)
       ON CONFLICT (game_id) DO UPDATE
         SET hits_home = EXCLUDED.hits_home,
             hits_away = EXCLUDED.hits_away,
             updated_at = NOW()`,
      [
        dbGameId,
        toNum(homeData?.hits ?? 0),  // homeData is already DB-aligned
        toNum(visitData?.hits ?? 0),
      ],
    ).catch(() => {});
  }

  // Skip detailed stats for scheduled games
  if (status === 'scheduled') return;

  // 3. Starting lineup → player-team map
  const startingData = await fetchJson<DocomoStartingTeam[]>(`${DOCOMO_API}/result/${gid}/starting.json`);
  const playerTeamMap: Record<string, string> = {}; // player_id → teamName

  if (Array.isArray(startingData)) {
    for (const teamData of startingData) {
      const hv = teamData['@attributes']?.hv ?? teamData.hv ?? null;
      // hv=1 = Docomo home; map to DB team name
      const docTeamName = hv === 1 ? homeTeam : visitTeam;
      const dbTeamName  = homeIsDocHome
        ? docTeamName
        : (docTeamName === homeTeam ? visitTeam : homeTeam);
      for (const player of teamData.player_info ?? []) {
        playerTeamMap[String(player.player_id)] = dbTeamName;
      }
    }
  }

  // 4. Batter stats
  const batterData = await fetchJson<Record<string, DocomotBatter>>(
    `${DOCOMO_API}/result/${gid}/batter_info.json`,
  );
  if (batterData && typeof batterData === 'object' && !Array.isArray(batterData)) {
    await saveBatterStats(dbGameId, batterData, playerTeamMap);
  }

  // 5. Pitcher stats
  const pitcherData = await fetchJson<Record<string, DocomotPitcher>>(
    `${DOCOMO_API}/result/${gid}/pitcher_info.json`,
  );
  if (pitcherData && typeof pitcherData === 'object' && !Array.isArray(pitcherData)) {
    // Use Docomo home/visit to identify pitcher IDs, then assign to DB team names
    const docHomePitcherIds  = new Set((docHomeData?.pitcher  ?? []).map(p => p.id));
    const docVisitPitcherIds = new Set((docVisitData?.pitcher ?? []).map(p => p.id));
    // Map to DB team names (homeIsDocHome = DB team_home matches Docomo home)
    const dbHomePitcherIds  = homeIsDocHome ? docHomePitcherIds  : docVisitPitcherIds;
    const dbAwayPitcherIds  = homeIsDocHome ? docVisitPitcherIds : docHomePitcherIds;
    const dbHomeTeamName    = homeIsDocHome ? homeTeam  : visitTeam;
    const dbAwayTeamName    = homeIsDocHome ? visitTeam : homeTeam;
    await savePitcherStats(
      dbGameId, pitcherData,
      dbHomePitcherIds, dbAwayPitcherIds,
      dbHomeTeamName, dbAwayTeamName,
    );
  }

  // 6. Play-by-play text
  const pbpData = await fetchJson<Record<string, DocomoPbpEntry>>(
    `${DOCOMO_API}/result/${gid}/index_text.json`,
  );
  if (pbpData && typeof pbpData === 'object' && !Array.isArray(pbpData)) {
    await savePlayByPlay(dbGameId, pbpData);
  }

  // 7. Pitch location + type data (index.json)
  const indexData = await fetchJson<Record<string, DocomoIndexEntry>>(
    `${DOCOMO_API}/result/${gid}/index.json`,
  );
  if (indexData && typeof indexData === 'object' && !Array.isArray(indexData)) {
    await savePitchData(dbGameId, indexData);
  }
}

// ── Main scraper ──────────────────────────────────────────────────────────────

export async function runDocomoFarmScraper(): Promise<{ updated: number; message: string }> {
  if (docomoScraperStatus.isRunning) {
    return { updated: 0, message: 'Docomo 爬蟲正在執行中' };
  }
  docomoScraperStatus.isRunning = true;
  docomoScraperStatus.lastRun = new Date().toISOString();
  docomoScraperStatus.lastError = null;

  try {
    const scheduleData = await fetchJson<DocomoSchedule>(`${DOCOMO_API}/top_today_schedule.json`);
    const games = scheduleData?.today ?? [];

    if (games.length === 0) {
      const msg = '⚠️ 今日無二軍賽事（Docomo）';
      docomoScraperStatus.lastResult = msg;
      docomoScraperStatus.isRunning = false;
      return { updated: 0, message: msg };
    }

    let updated = 0;
    let skipped = 0;

    for (const game of games) {
      const match = await findDbGame(
        game.home_team_name_s,
        game.visit_team_name_s,
        game.game_date,
      );

      if (!match) {
        console.warn(
          `[Docomo] DB に未登録の試合: ${game.home_team_name_s} vs ${game.visit_team_name_s} ${game.game_date}`,
        );
        skipped++;
        continue;
      }

      try {
        await fetchAndSaveGame(game, match);
        updated++;
        console.log(
          `[Docomo] 更新: ${game.home_team_name_s} vs ${game.visit_team_name_s} (${STATE_TO_STATUS[game.game_state]})`,
        );
      } catch (e) {
        console.warn('[Docomo] fetchAndSaveGame失敗:', game.game_id, (e as Error).message);
      }

      await new Promise(r => setTimeout(r, 600));
    }

    const msg = `✅ Docomo 二軍: ${updated} 場更新，${skipped} 場DB未登録`;
    docomoScraperStatus.lastResult = msg;
    docomoScraperStatus.isRunning = false;
    return { updated, message: msg };

  } catch (err) {
    const msg = (err as Error).message;
    docomoScraperStatus.lastResult = `❌ Docomo 爬蟲錯誤: ${msg}`;
    docomoScraperStatus.lastError = msg;
    docomoScraperStatus.isRunning = false;
    return { updated: 0, message: msg };
  }
}

// ── Live update (30-second loop) ──────────────────────────────────────────────

export async function runDocomoLiveUpdate(): Promise<void> {
  try {
    const scheduleData = await fetchJson<DocomoSchedule>(`${DOCOMO_API}/top_today_schedule.json`);
    const liveGames = (scheduleData?.today ?? []).filter(g => g.game_state === 1);

    if (liveGames.length === 0) return;

    for (const game of liveGames) {
      const match = await findDbGame(
        game.home_team_name_s,
        game.visit_team_name_s,
        game.game_date,
      );
      if (!match) continue;

      try {
        await fetchAndSaveGame(game, match);
      } catch (e) {
        console.warn('[Docomo Live] 更新失敗:', game.game_id, (e as Error).message);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.warn('[Docomo Live] 全体エラー:', (e as Error).message);
  }
}
