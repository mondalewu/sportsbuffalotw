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
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const YAHOO_FARM_STATS_URL = 'https://baseball.yahoo.co.jp/npb/game';

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
  box_avg?: string;  // 今季打率（例: ".253"）
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

// 單顆投球資料（index.json pitch_info 與個別打席檔案共用）
type DocomotPitchEntry = {
  ball_kind_id: string;
  ball_kind_name: string;
  ball_kind: string;       // "1"=straight, "2"=offspeed
  x: string;
  y: string;
  speed: string;
  result_id: string;
  result: string;
  course_no?: string;
};
type DocomotPitchInfo = Record<string, DocomotPitchEntry>;

// 個別打席檔案的可能格式（多種包裝方式）
interface DocomoAtBatFile {
  pitch_info?: DocomotPitchInfo;    // 格式A：{ pitch_info: { "1": {...} } }
  [key: string]: unknown;           // 格式B：直接是 { "1": {...}, "2": {...} }
}

interface DocomoIndexEntry {
  file_name: string;
  inning: string;
  tb: string;               // "1"=top, "2"=bottom
  pitcher: { name: string; name_l?: string; name_s?: string };
  batter:  { name: string; name_l?: string; name_s?: string };
  pitch_info?: DocomotPitchInfo;
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

// ── 守備位置：日文フルネーム→一文字変換 ────────────────────────────────────────

const POS_FULL_TO_SHORT: Record<string, string> = {
  '中堅手': '中', '中堅': '中',
  '左翼手': '左', '左翼': '左',
  '右翼手': '右', '右翼': '右',
  '一塁手': '一', '一塁': '一',
  '二塁手': '二', '二塁': '二',
  '三塁手': '三', '三塁': '三',
  '遊撃手': '遊', '遊撃': '遊',
  '捕手':   '捕',
  '投手':   '投',
  '指名打者': '指', '指名': '指',
  '二遊間': '二遊',
  // そのまま短縮形も通す
  '中': '中', '左': '左', '右': '右',
  '一': '一', '二': '二', '三': '三',
  '遊': '遊', '捕': '捕', '投': '投', '指': '指',
};

function toShortPos(posName: string): string {
  const t = (posName ?? '').trim();
  return POS_FULL_TO_SHORT[t] ?? t.slice(0, 1);
}

// ── Batter stats ──────────────────────────────────────────────────────────────

interface StartingEntry {
  name: string;
  batNo: number;
  posChar: string;
  teamName: string;
}

async function saveBatterStats(
  dbGameId: number,
  batterData: Record<string, DocomotBatter>,
  playerTeamMap: Record<string, string>,
  startingLineup: StartingEntry[] = [],
): Promise<void> {
  await pool.query('DELETE FROM game_batter_stats WHERE game_id = $1', [dbGameId]);

  // ── Step 1: 先発メンバーを 0 成績で先挿入（打席未到来の選手を確保）─────────
  for (const s of startingLineup) {
    if (!s.name || !s.teamName || s.batNo < 1 || s.batNo > 9) continue;
    const position = s.posChar ? `(${s.posChar})` : '';
    await pool.query(
      `INSERT INTO game_batter_stats
         (game_id, team_code, batting_order, position, player_name,
          at_bats, hits, rbi, runs, home_runs, strikeouts, walks,
          stolen_bases, hit_by_pitch, sacrifice_hits)
       VALUES ($1,$2,$3,$4,$5,0,0,0,0,0,0,0,0,0,0)
       ON CONFLICT (game_id, team_code, player_name) DO NOTHING`,
      [dbGameId, s.teamName, s.batNo, position, s.name],
    ).catch(() => {});
  }

  // ── Step 2: batter_info.json の実績で上書き UPSERT ─────────────────────────
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

    const batNo   = toNum(batter.bat_no);
    const seqNo   = toNum(batter.seq_no);
    const posChar  = batter.pos_char ?? '';
    const position = posChar ? (seqNo <= 1 ? `(${posChar})` : posChar) : '';

    const boxAvgVal = batter.box_avg ? parseFloat(batter.box_avg) : null;
    const boxAvg = (boxAvgVal != null && !isNaN(boxAvgVal)) ? boxAvgVal : null;

    await pool.query(
      `INSERT INTO game_batter_stats
         (game_id, team_code, batting_order, position, player_name,
          at_bats, hits, rbi, runs, home_runs, strikeouts, walks,
          stolen_bases, hit_by_pitch, sacrifice_hits, box_avg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (game_id, team_code, player_name) DO UPDATE
         SET batting_order  = EXCLUDED.batting_order,
             position       = EXCLUDED.position,
             at_bats        = EXCLUDED.at_bats,
             hits           = EXCLUDED.hits,
             rbi            = EXCLUDED.rbi,
             runs           = EXCLUDED.runs,
             home_runs      = EXCLUDED.home_runs,
             strikeouts     = EXCLUDED.strikeouts,
             walks          = EXCLUDED.walks,
             stolen_bases   = EXCLUDED.stolen_bases,
             hit_by_pitch   = EXCLUDED.hit_by_pitch,
             sacrifice_hits = EXCLUDED.sacrifice_hits,
             box_avg        = COALESCE(EXCLUDED.box_avg, game_batter_stats.box_avg)`,
      [
        dbGameId, teamCode, batNo, position, playerName,
        toNum(batter.ab), toNum(batter.h), toNum(batter.rbi), toNum(batter.r),
        toNum(batter.hr), toNum(batter.so), toNum(batter.bb),
        toNum(batter.sb), toNum(batter.hp), toNum(batter.sh),
        boxAvg,
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

/** 從個別打席檔案解析出 pitch_info（支援多種包裝格式） */
function extractPitchInfoFromFile(raw: DocomoAtBatFile | null): DocomotPitchInfo | null {
  if (!raw || typeof raw !== 'object') return null;

  // 格式 A：{ pitch_info: { "1": {...}, ... } }
  if (raw.pitch_info && typeof raw.pitch_info === 'object') {
    return raw.pitch_info as DocomotPitchInfo;
  }

  // 格式 B：直接是 { "1": {...}, "2": {...} }（key 為數字字串）
  const keys = Object.keys(raw);
  if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
    return raw as unknown as DocomotPitchInfo;
  }

  // 格式 C：其他巢狀結構，嘗試找第一個含有 result_id 的物件
  for (const val of Object.values(raw)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const inner = val as Record<string, unknown>;
      const innerKeys = Object.keys(inner);
      if (innerKeys.length > 0 && innerKeys.every(k => /^\d+$/.test(k))) {
        return inner as unknown as DocomotPitchInfo;
      }
    }
  }

  return null;
}

/** 將一組 pitch_info 寫入 DB */
async function insertPitchInfo(
  dbGameId: number,
  atBatKey: string,
  inning: number,
  isTop: boolean,
  pitcherName: string,
  batterName: string,
  pitchInfo: DocomotPitchInfo,
): Promise<void> {
  for (const [pitchNumStr, pitch] of Object.entries(pitchInfo)) {
    const pitchNum = parseInt(pitchNumStr, 10);
    if (!pitch || isNaN(pitchNum)) continue;

    const hasPos    = !!pitch.x && !!pitch.y;
    const hasResult = !!(pitch.result || pitch.ball_kind_name || pitch.result_id);
    if (!hasPos && !hasResult) continue;

    const x        = hasPos ? parseInt(pitch.x, 10) : null;
    const y        = hasPos ? parseInt(pitch.y, 10) : null;
    const speed    = pitch.speed ? parseInt(pitch.speed, 10) : null;
    const isStrike = (pitch.result_id ?? '') !== BALL_RESULT_ID && (pitch.result_id ?? '') !== '';

    await pool.query(
      `INSERT INTO game_pitch_data
         (game_id, at_bat_key, pitch_num, inning, is_top,
          pitcher_name, batter_name, ball_kind, ball_kind_id,
          x, y, speed, result, result_id, is_strike)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (game_id, at_bat_key, pitch_num) DO UPDATE
         SET x         = COALESCE(EXCLUDED.x,          game_pitch_data.x),
             y         = COALESCE(EXCLUDED.y,          game_pitch_data.y),
             speed     = COALESCE(EXCLUDED.speed,      game_pitch_data.speed),
             result    = EXCLUDED.result,
             result_id = EXCLUDED.result_id,
             is_strike = EXCLUDED.is_strike,
             ball_kind = COALESCE(NULLIF(EXCLUDED.ball_kind,''), game_pitch_data.ball_kind)`,
      [
        dbGameId, atBatKey, pitchNum, inning, isTop,
        pitcherName, batterName,
        pitch.ball_kind_name ?? '', pitch.ball_kind_id ?? '',
        x, y, speed,
        pitch.result ?? '', pitch.result_id ?? '', isStrike,
      ],
    ).catch(() => {});
  }
}

/**
 * 逐球資料存入 DB
 *
 * @param fetchIndividual
 *   true（final 時）→ inline pitch_info が空の打席は個別 file_name を取得
 *   false（live 時）→ inline だけ使用（リクエスト数を抑える）
 */
async function savePitchData(
  dbGameId: number,
  indexData: Record<string, DocomoIndexEntry>,
  gid: string,
  fetchIndividual = false,
): Promise<void> {
  for (const [atBatKey, atBat] of Object.entries(indexData)) {
    const inning = parseInt(atBat.inning ?? '1', 10);
    const isTop  = (atBat.tb ?? '1') === '1';
    const pitcherName = atBat.pitcher?.name ?? atBat.pitcher?.name_l ?? atBat.pitcher?.name_s ?? '';
    const batterName  = atBat.batter?.name  ?? atBat.batter?.name_l  ?? atBat.batter?.name_s  ?? '';

    // ── inline pitch_info（index.json に埋め込まれたもの）
    const inlinePitchInfo = atBat.pitch_info && typeof atBat.pitch_info === 'object'
      ? atBat.pitch_info
      : null;
    const inlineCount = inlinePitchInfo ? Object.keys(inlinePitchInfo).length : 0;

    if (inlineCount > 0 && inlinePitchInfo) {
      // inline にデータあり → そのまま保存
      await insertPitchInfo(dbGameId, atBatKey, inning, isTop, pitcherName, batterName, inlinePitchInfo);
      continue;
    }

    // ── inline が空 → 個別 file_name を取得（final 時のみ）
    if (!fetchIndividual || !atBat.file_name) continue;

    const fileUrl = `${DOCOMO_API}/result/${gid}/${atBat.file_name}`;
    const raw = await fetchJson<DocomoAtBatFile>(fileUrl);
    const filePitchInfo = extractPitchInfoFromFile(raw);

    if (filePitchInfo && Object.keys(filePitchInfo).length > 0) {
      console.log(`[Docomo] 個別打席取得: ${atBat.file_name} (${inning}局${isTop?'上':'下'} ${batterName})`);
      await insertPitchInfo(dbGameId, atBatKey, inning, isTop, pitcherName, batterName, filePitchInfo);
    }

    // Docomo レート制限対策：打席ごとに少し待つ
    await new Promise(r => setTimeout(r, 150));
  }
}

// ── Play-by-play（index.json から再構成）────────────────────────────────────
//
// index.json は打席ごとの pitch_info を持つ。各打席の最終球 result から
// 打席結果を、前球の集計から BSO を再現し、parseNpbDescription が解析できる
// 形式の description を生成する。
//
// Description 形式："{打者名} {B}-{S}より {最終球result}"
// （例: "田中 2-1より センターフライ"）

async function savePlayByPlayFromIndex(
  dbGameId: number,
  indexData: Record<string, DocomoIndexEntry>,
): Promise<void> {
  await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [dbGameId]);

  // 打者名があり pitch_info を持つ打席のみ対象
  const entries = Object.entries(indexData)
    .filter(([, e]) => {
      const name = e.batter?.name_l || e.batter?.name || e.batter?.name_s || '';
      return name && e.pitch_info && Object.keys(e.pitch_info).length > 0;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  let playOrder = 0;
  for (const [, entry] of entries) {
    const inning = parseInt(entry.inning ?? '1', 10);
    const isTop  = (entry.tb ?? '1') === '1';
    const batterName = entry.batter.name_l || entry.batter.name || entry.batter.name_s || '';
    if (!batterName) continue;

    // 球番号順にソート
    const pitches = Object.entries(entry.pitch_info!)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .map(([, p]) => p);

    if (pitches.length === 0) continue;

    // 最終球以外からカウントを再現
    let balls = 0, strikes = 0;
    for (let i = 0; i < pitches.length - 1; i++) {
      const rid    = pitches[i].result_id ?? '';
      const result = pitches[i].result    ?? '';
      if (rid === BALL_RESULT_ID || result.includes('ボール')) {
        if (balls < 3) balls++;
      } else {
        // ファウルは 2 ストライク未満のときのみカウント
        if (result.includes('ファウル')) {
          if (strikes < 2) strikes++;
        } else {
          if (strikes < 2) strikes++;
        }
      }
    }

    const lastResult = pitches[pitches.length - 1].result ?? '';

    // parseNpbDescription が解析できる形式
    const desc = `${batterName} ${balls}-${strikes}より ${lastResult}`;

    await pool.query(
      `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [dbGameId, inning, isTop, ++playOrder, desc],
    ).catch(() => {});
  }
}

// ── Play-by-play（index_text.json フォールバック）────────────────────────────

async function savePlayByPlay(
  dbGameId: number,
  pbpData: Record<string, DocomoPbpEntry>,
): Promise<void> {
  await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [dbGameId]);

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

// ── Yahoo 二軍打者成績（含逐回結果）────────────────────────────────────────────

async function scrapeYahooFarmBatterStats(gid: string, dbGameId: number): Promise<void> {
  try {
    const url = `${YAHOO_FARM_STATS_URL}/${gid}/stats`;
    const res = await axios.get<string>(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      responseType: 'text',
    });

    const $ = cheerio.load(res.data);

    // 解析每張打者成績表（每隊一張）
    $('table.bb-statsTable').each((_tableIdx, table) => {
      const rows = $(table).find('tbody tr.bb-statsTable__row');

      rows.each((_rowIdx, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;

        // 選手名
        const playerName = $(cells[1]).find('a').text().trim() ||
                           $(cells[1]).text().trim();
        if (!playerName || playerName === '合計') return;

        // 逐回結果（class --inning 的欄位）
        const inningCells = $(row).find('td.bb-statsTable__data--inning');
        const atBatResults: string[] = [];
        inningCells.each((_i, cell) => {
          const result = $(cell).find('.bb-statsTable__dataDetail').text().trim() ||
                         $(cell).text().trim();
          atBatResults.push(result); // 空字串也保留（該局未打）
        });

        // 移除尾端空白欄（沒上場的局數）
        while (atBatResults.length > 0 && atBatResults[atBatResults.length - 1] === '') {
          atBatResults.pop();
        }

        if (atBatResults.length === 0) return;

        // 更新 DB（by player_name + game_id）— 直接傳陣列，匹配 TEXT[] 欄位
        pool.query(
          `UPDATE game_batter_stats
           SET at_bat_results = $1
           WHERE game_id = $2 AND player_name = $3`,
          [atBatResults, dbGameId, playerName],
        ).catch(e => console.warn('[Yahoo Farm] at_bat_results update失敗:', playerName, e.message));
      });
    });

    console.log(`[Yahoo Farm] 打者逐回成績更新: game_id=${gid}`);
  } catch (e) {
    console.warn('[Yahoo Farm] 爬蟲失敗:', gid, (e as Error).message);
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

  // 3. Starting lineup → player-team map + 先発打順リスト
  const startingData = await fetchJson<DocomoStartingTeam[]>(`${DOCOMO_API}/result/${gid}/starting.json`);
  const playerTeamMap: Record<string, string> = {}; // player_id → teamName
  const startingLineup: StartingEntry[] = [];        // 先発 9 人（batting_order 1-9）

  if (Array.isArray(startingData)) {
    for (const teamData of startingData) {
      const hv = teamData['@attributes']?.hv ?? teamData.hv ?? null;
      // team_code は常に実際のチーム名を使用。
      // DB のホーム/アウェイ配置（homeIsDocHome）とは無関係。
      // フロントは game.team_home / game.team_away（実際のチーム名）でフィルタするため。
      const teamName = hv === 1 ? homeTeam : visitTeam;
      for (const player of teamData.player_info ?? []) {
        playerTeamMap[String(player.player_id)] = teamName;
        // 先発打順（1-9）があれば先発リストに追加
        const batNo = player.start_bat_no;
        if (batNo >= 1 && batNo <= 9 && player.player_name_l) {
          startingLineup.push({
            name:     player.player_name_l,
            batNo,
            posChar:  toShortPos(player.start_position_name ?? ''),
            teamName,
          });
        }
      }
    }
  }

  // 4. Batter stats（先発を 0 成績で先挿入 → batter_info で UPSERT）
  const batterData = await fetchJson<Record<string, DocomotBatter>>(
    `${DOCOMO_API}/result/${gid}/batter_info.json`,
  );
  if (batterData && typeof batterData === 'object' && !Array.isArray(batterData)) {
    await saveBatterStats(dbGameId, batterData, playerTeamMap, startingLineup);
  } else if (startingLineup.length > 0) {
    // batter_info がまだ無い場合も先発だけ挿入（試合前表示用）
    await saveBatterStats(dbGameId, {}, playerTeamMap, startingLineup);
  }

  // 4b. Yahoo 打者逐回成績（at_bat_results）＋ yahoo_game_id を DB に保存
  await pool.query(
    `UPDATE games SET yahoo_game_id = $1 WHERE id = $2`,
    [gid, dbGameId],
  ).catch(() => {});
  await scrapeYahooFarmBatterStats(gid, dbGameId);

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

  // 6+7. index.json → PBP（打席単位・BSO付き）+ 球種コース
  const indexData = await fetchJson<Record<string, DocomoIndexEntry>>(
    `${DOCOMO_API}/result/${gid}/index.json`,
  );
  if (indexData && typeof indexData === 'object' && !Array.isArray(indexData)) {
    const validAtBats = Object.values(indexData).filter(
      e => (e.batter?.name_l || e.batter?.name || e.batter?.name_s) &&
           e.pitch_info && Object.keys(e.pitch_info).length > 0,
    ).length;

    if (validAtBats > 0) {
      // index.json に打席データあり → 高品質 PBP を生成
      await savePlayByPlayFromIndex(dbGameId, indexData);
    } else {
      // index.json が未充填 → index_text.json にフォールバック
      const pbpData = await fetchJson<Record<string, DocomoPbpEntry>>(
        `${DOCOMO_API}/result/${gid}/index_text.json`,
      );
      if (pbpData && typeof pbpData === 'object' && !Array.isArray(pbpData)) {
        await savePlayByPlay(dbGameId, pbpData);
      }
    }

    // final 時のみ個別打席ファイルを取得（live 時はリクエスト数を抑える）
    await savePitchData(dbGameId, indexData, gid, status === 'final');
  } else {
    // index.json 取得失敗 → index_text.json にフォールバック
    const pbpData = await fetchJson<Record<string, DocomoPbpEntry>>(
      `${DOCOMO_API}/result/${gid}/index_text.json`,
    );
    if (pbpData && typeof pbpData === 'object' && !Array.isArray(pbpData)) {
      await savePlayByPlay(dbGameId, pbpData);
    }
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

// ── 指定 Docomo game_id で強制再スクレイプ ──────────────────────────────────────

export async function rescrapeDocomoGameById(
  docomoGameId: number,
): Promise<{ success: boolean; message: string }> {
  try {
    // Docomo schedule から今日の試合を取得し、該当 game_id を探す
    const scheduleData = await fetchJson<DocomoSchedule>(`${DOCOMO_API}/top_today_schedule.json`);
    let gameInfo = (scheduleData?.today ?? []).find(g => g.game_id === docomoGameId);

    // 今日のスケジュールに無い場合、game_id から直接 home.json で確認
    if (!gameInfo) {
      // home.json を取って DB の試合と照合する
      const homeData = await fetchJson<DocomoTeamStats>(`${DOCOMO_API}/result/${docomoGameId}/home.json`);
      if (!homeData) {
        return { success: false, message: `Docomo game_id ${docomoGameId} のデータが見つかりません` };
      }
      // DB から近い NPB2 試合を探す（game_id だけでは特定困難なため、手動で指定した DB game_id も受け付ける）
      return { success: false, message: `game_id ${docomoGameId} は今日のスケジュールにありません。db_game_id を直接指定してください` };
    }

    const match = await findDbGame(
      gameInfo.home_team_name_s,
      gameInfo.visit_team_name_s,
      gameInfo.game_date,
    );
    if (!match) {
      return { success: false, message: `DB に対応する試合が見つかりません: ${gameInfo.home_team_name_s} vs ${gameInfo.visit_team_name_s}` };
    }

    await fetchAndSaveGame(gameInfo, match);
    return { success: true, message: `✅ 再スクレイプ完了: game_id=${docomoGameId}, db_game_id=${match.id}` };
  } catch (err) {
    return { success: false, message: `❌ 失敗: ${(err as Error).message}` };
  }
}

// ── DB game_id で Docomo データを強制再スクレイプ ─────────────────────────────

export async function rescrapeDocomoByDbGameId(
  dbGameId: number,
): Promise<{ success: boolean; message: string }> {
  try {
    // DB から試合情報取得
    const dbRes = await pool.query<{
      id: number; team_home: string; team_away: string; game_date: string; status: string;
    }>(
      `SELECT id, team_home, team_away, game_date, status FROM games WHERE id = $1 AND league = 'NPB2'`,
      [dbGameId],
    );
    if (!dbRes.rows[0]) {
      return { success: false, message: `DB game_id=${dbGameId} が見つかりません（NPB2 のみ対応）` };
    }
    const dbGame = dbRes.rows[0];

    // Docomo の今日スケジュールから対応するゲームを探す
    const scheduleData = await fetchJson<DocomoSchedule>(`${DOCOMO_API}/top_today_schedule.json`);
    const homeNorm  = normalizeTeam(dbGame.team_home);
    const awayNorm  = normalizeTeam(dbGame.team_away);
    const dateStr   = dbGame.game_date.slice(0, 10).replace(/-/g, '/');

    const gameInfo = (scheduleData?.today ?? []).find(g => {
      const h = normalizeTeam(g.home_team_name_s);
      const v = normalizeTeam(g.visit_team_name_s);
      return g.game_date === dateStr &&
        ((h === homeNorm && v === awayNorm) || (h === awayNorm && v === homeNorm));
    });

    if (!gameInfo) {
      return { success: false, message: `Docomo の今日スケジュールに ${dbGame.team_home} vs ${dbGame.team_away} (${dateStr}) が見つかりません。昨日以前の試合は再スクレイプできません。` };
    }

    const homeIsDocHome = normalizeTeam(gameInfo.home_team_name_s) === homeNorm;
    await fetchAndSaveGame(gameInfo, { id: dbGameId, homeIsDocHome });
    return { success: true, message: `✅ 再スクレイプ完了: db_game_id=${dbGameId} (Docomo game_id=${gameInfo.game_id})` };
  } catch (err) {
    return { success: false, message: `❌ 失敗: ${(err as Error).message}` };
  }
}

// ── Docomo game_id 直接指定で逐球データを全量補完 ─────────────────────────────
//
// 過去の試合（今日以外）も対応。
// Docomo game_id（URL の game_id）と DB game_id（games.id）を両方指定する。
//
export async function backfillPitchDataByDocomoId(
  docomoGameId: number,
  dbGameId: number,
): Promise<{ success: boolean; message: string; saved: number }> {
  try {
    const gid = String(docomoGameId);

    // index.json 取得
    const indexData = await fetchJson<Record<string, DocomoIndexEntry>>(
      `${DOCOMO_API}/result/${gid}/index.json`,
    );
    if (!indexData || typeof indexData !== 'object' || Array.isArray(indexData)) {
      return { success: false, message: `index.json 取得失敗 (game_id=${gid})`, saved: 0 };
    }

    const atBatEntries = Object.entries(indexData);
    if (atBatEntries.length === 0) {
      return { success: false, message: 'index.json に打席データがありません', saved: 0 };
    }

    let saved = 0;

    for (const [atBatKey, atBat] of atBatEntries) {
      const inning = parseInt(atBat.inning ?? '1', 10);
      const isTop  = (atBat.tb ?? '1') === '1';
      const pitcherName = atBat.pitcher?.name ?? atBat.pitcher?.name_l ?? atBat.pitcher?.name_s ?? '';
      const batterName  = atBat.batter?.name  ?? atBat.batter?.name_l  ?? atBat.batter?.name_s  ?? '';

      // inline pitch_info を試す
      const inlinePitchInfo = atBat.pitch_info && typeof atBat.pitch_info === 'object'
        ? atBat.pitch_info : null;
      const inlineCount = inlinePitchInfo ? Object.keys(inlinePitchInfo).length : 0;

      let pitchInfo: DocomotPitchInfo | null = inlineCount > 0 ? inlinePitchInfo : null;

      // inline が空なら個別 file_name を取得
      if (!pitchInfo && atBat.file_name) {
        const raw = await fetchJson<DocomoAtBatFile>(
          `${DOCOMO_API}/result/${gid}/${atBat.file_name}`,
        );
        pitchInfo = extractPitchInfoFromFile(raw);
        await new Promise(r => setTimeout(r, 150)); // レート制限対策
      }

      if (!pitchInfo || Object.keys(pitchInfo).length === 0) continue;

      await insertPitchInfo(dbGameId, atBatKey, inning, isTop, pitcherName, batterName, pitchInfo);
      saved++;
      console.log(`[Docomo Backfill] ${inning}局${isTop?'上':'下'} ${batterName} (${atBatKey}) 保存完了`);
    }

    return {
      success: true,
      message: `✅ 逐球補完完了: Docomo game_id=${gid}, db_game_id=${dbGameId}, ${saved}打席保存`,
      saved,
    };
  } catch (err) {
    return { success: false, message: `❌ 補完失敗: ${(err as Error).message}`, saved: 0 };
  }
}

// ── Yahoo 打者逐回成績診斷（只解析，不存 DB）────────────────────────────────────

export async function previewYahooBatterStats(
  yahooGameId: string,
): Promise<{ success: boolean; message: string; rows: { name: string; results: string[] }[] }> {
  try {
    const url = `${YAHOO_FARM_STATS_URL}/${yahooGameId}/stats`;
    const res = await axios.get<string>(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      responseType: 'text',
    });

    const $ = cheerio.load(res.data);
    const rows: { name: string; results: string[] }[] = [];

    $('table.bb-statsTable').each((_ti, table) => {
      $(table).find('tbody tr.bb-statsTable__row').each((_ri, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        const name = $(cells[1]).find('a').text().trim() || $(cells[1]).text().trim();
        if (!name || name === '合計') return;

        const inningCells = $(row).find('td.bb-statsTable__data--inning');
        const results: string[] = [];
        inningCells.each((_i, cell) => {
          results.push(
            $(cell).find('.bb-statsTable__dataDetail').text().trim() || $(cell).text().trim(),
          );
        });
        while (results.length > 0 && results[results.length - 1] === '') results.pop();
        rows.push({ name, results });
      });
    });

    if (rows.length === 0) {
      return { success: false, message: `找不到打者資料（可能選擇器不符或頁面結構不同）`, rows: [] };
    }
    return { success: true, message: `✅ 解析成功：${rows.length} 位打者`, rows };
  } catch (e) {
    return { success: false, message: `❌ 爬蟲失敗: ${(e as Error).message}`, rows: [] };
  }
}

// ── Yahoo 打者逐回成績補完（指定過去比賽）────────────────────────────────────────

export async function backfillYahooBatterStats(
  yahooGameId: string,
  dbGameId: number,
): Promise<{ success: boolean; message: string; updated: number }> {
  try {
    await scrapeYahooFarmBatterStats(yahooGameId, dbGameId);
    // scrapeYahooFarmBatterStats 內部用 pool.query().catch()，無法直接取得更新筆數
    // 查 DB 確認有多少選手已有 at_bat_results
    const r = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM game_batter_stats
       WHERE game_id = $1 AND array_length(at_bat_results, 1) > 0`,
      [dbGameId],
    );
    const updated = parseInt(r.rows[0]?.count ?? '0', 10);
    return { success: true, message: `✅ Yahoo 逐回成績補完完成：${updated} 位打者已更新`, updated };
  } catch (err) {
    return { success: false, message: `❌ 補完失敗: ${(err as Error).message}`, updated: 0 };
  }
}

// ── 全量批次補完 Yahoo 打者逐回成績 ────────────────────────────────────────────────

export interface BatchYahooBackfillStatus {
  isRunning: boolean;
  total: number;
  done: number;
  failed: number;
  message: string;
}

export const batchYahooBackfillStatus: BatchYahooBackfillStatus = {
  isRunning: false,
  total: 0,
  done: 0,
  failed: 0,
  message: '尚未執行',
};

const YAHOO_BASE = 'https://baseball.yahoo.co.jp';
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
};

/** 從 Yahoo /score 頁取得主客隊名稱與日期（用於比對 DB）*/
async function fetchYahooGameMeta(gid: string, year?: number): Promise<{ homeTeam: string; awayTeam: string; gameDate: string } | null> {
  try {
    const res = await axios.get<string>(`${YAHOO_BASE}/npb/game/${gid}/score`, {
      headers: YAHOO_HEADERS, timeout: 10000, responseType: 'text',
    });
    const $ = cheerio.load(res.data);

    // 日期格式：「5月10日（日）」→ 無年份，由呼叫端傳入 year
    let gameDate = '';
    const dateText = $('.bb-gameRound--matchDate').first().text().trim();
    const dateM = dateText.match(/(\d{1,2})月(\d{1,2})日/);
    if (dateM) {
      const y = year ?? new Date().getFullYear();
      gameDate = `${y}-${dateM[1].padStart(2, '0')}-${dateM[2].padStart(2, '0')}`;
    }

    // 主客隊名：第一行 = 客隊, 第二行 = 主隊
    const teams: string[] = [];
    $('.bb-gameScoreTable__data--team').each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, '');
      if (t) teams.push(t);
    });

    if (teams.length < 2 || !gameDate) return null;

    // Yahoo 頁面順序：away 先，home 後
    const norm = (s: string) => TEAM_MAP[s] ?? s;
    return { awayTeam: norm(teams[0]), homeTeam: norm(teams[1]), gameDate };
  } catch {
    return null;
  }
}

export async function runBatchYahooBackfill(): Promise<void> {
  if (batchYahooBackfillStatus.isRunning) return;

  batchYahooBackfillStatus.isRunning = true;
  batchYahooBackfillStatus.done = 0;
  batchYahooBackfillStatus.failed = 0;
  batchYahooBackfillStatus.message = '準備中...';

  try {
    // 1. 取 DB 中待補完的比賽（final & yahoo_game_id IS NULL）
    const dbRes = await pool.query<{ id: number; team_home: string; team_away: string; game_date: string }>(
      `SELECT id, team_home, team_away, game_date
       FROM games
       WHERE league = 'NPB2' AND status = 'final' AND yahoo_game_id IS NULL
       ORDER BY game_date`,
    );
    const pending = dbRes.rows;
    if (pending.length === 0) {
      batchYahooBackfillStatus.message = '✅ 所有比賽已補完，無需重跑';
      batchYahooBackfillStatus.isRunning = false;
      return;
    }

    batchYahooBackfillStatus.total = pending.length;
    const currentYear = new Date().getFullYear();

    // 2. 從 Docomo 今日賽程取最大 game_id 作為掃描起點
    batchYahooBackfillStatus.message = '取得 Docomo 今日賽程以定位 ID 範圍...';
    const scheduleData = await fetchJson<DocomoSchedule>(`${DOCOMO_API}/top_today_schedule.json`);
    const todayGames = scheduleData?.today ?? [];

    let maxId: number;
    if (todayGames.length > 0) {
      maxId = Math.max(...todayGames.map(g => g.game_id));
    } else {
      // Fallback：使用 5/11 確認過的 ID
      maxId = 2021040490;
    }

    // 3. 計算掃描範圍
    // 賽季從 3/1 開始，平均每天約 7 場，掃描所有可能的 ID
    const today = new Date();
    const seasonStart = new Date(currentYear, 2, 1); // 3/1
    const daysSinceStart = Math.max(
      Math.floor((today.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)),
      1,
    );
    const estimatedTotal = Math.ceil(daysSinceStart * 7 * 1.4); // 40% 安全緩衝
    const startId = maxId - Math.min(estimatedTotal, 1200); // 最多往前掃 1200 個

    console.log(`[Yahoo Batch] 掃描範圍: ${startId} → ${maxId}（共 ${maxId - startId} 個候選 ID）`);
    batchYahooBackfillStatus.message = `掃描 ${maxId - startId} 個候選 ID（${pending.length} 場待補）...`;

    // 4. 建立快速查詢 Map："YYYY-MM-DD_home_away" → dbGame
    const pendingMap = new Map<string, typeof pending[0]>();
    for (const g of pending) {
      const date = g.game_date.slice(0, 10);
      pendingMap.set(`${date}_${g.team_home}_${g.team_away}`, g);
      pendingMap.set(`${date}_${g.team_away}_${g.team_home}`, g);
    }
    const pendingDates = new Set(pending.map(g => g.game_date.slice(0, 10)));

    // 5. 逐一掃描：先用 Docomo home.json 快速驗證（確認是二軍比賽），再用 Yahoo score 頁取日期/球隊
    let matched = 0;
    for (let gid = maxId; gid >= startId; gid--) {
      if (matched >= pending.length) break; // 全部配對完成，提前結束

      const gidStr = String(gid);

      // 5a. Docomo 快速驗證（/data/baseball/farm/ 路徑只有二軍比賽）
      const homeCheck = await fetchJson<DocomoTeamStats>(`${DOCOMO_API}/result/${gidStr}/home.json`);
      if (!homeCheck) {
        await new Promise(r => setTimeout(r, 50)); // 不存在的 ID 短暫等待
        continue;
      }

      // 5b. Yahoo score 頁取日期＋球隊名
      const meta = await fetchYahooGameMeta(gidStr, currentYear);
      await new Promise(r => setTimeout(r, 300));
      if (!meta || !pendingDates.has(meta.gameDate)) continue;

      const key1 = `${meta.gameDate}_${meta.homeTeam}_${meta.awayTeam}`;
      const key2 = `${meta.gameDate}_${meta.awayTeam}_${meta.homeTeam}`;
      const dbGame = pendingMap.get(key1) ?? pendingMap.get(key2);
      if (!dbGame) continue;

      // 5c. 配對成功 → 儲存 yahoo_game_id 並補完逐回成績
      try {
        await pool.query(`UPDATE games SET yahoo_game_id = $1 WHERE id = $2`, [gidStr, dbGame.id]);
        await scrapeYahooFarmBatterStats(gidStr, dbGame.id);
        await new Promise(r => setTimeout(r, 500));
        matched++;
        batchYahooBackfillStatus.done++;
        // 從 Map 移除已配對的比賽
        pendingMap.delete(key1);
        pendingMap.delete(key2);
        batchYahooBackfillStatus.message = `進行中 ${matched}/${pending.length}（${meta.gameDate} ${meta.awayTeam} vs ${meta.homeTeam}）`;
        console.log(`[Yahoo Batch] ✓ ${meta.gameDate} ${meta.awayTeam} vs ${meta.homeTeam} (gid=${gidStr}, dbId=${dbGame.id})`);
      } catch (e) {
        batchYahooBackfillStatus.failed++;
        console.warn(`[Yahoo Batch] ✗ ${gidStr}:`, (e as Error).message);
      }
    }

    const msg = `✅ 批量補完完成：${matched} 場配對成功，${batchYahooBackfillStatus.failed} 場失敗，共 ${pending.length} 場待補`;
    batchYahooBackfillStatus.message = msg;
    console.log(`[Yahoo Batch] ${msg}`);
  } catch (err) {
    batchYahooBackfillStatus.message = `❌ 錯誤: ${(err as Error).message}`;
  } finally {
    batchYahooBackfillStatus.isRunning = false;
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
