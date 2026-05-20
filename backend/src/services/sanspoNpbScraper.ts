/**
 * Sanspo NPB 一軍 一球速報爬蟲
 *
 * 資料來源：sports-digican.com (Sanspo 棒球 API)
 *   今日賽程：https://npb.sports-digican.com/api/kdjson/gamelist.json
 *   逐球速報：https://npb.sports-digican.com/api/kdjson/pbp_{globalId}_{inning}_{tob}.json
 *             tob: 1=top(away攻), 2=bottom(home攻)
 *
 * 可取得：
 *   ✅ 全場逐球資料（球種、球速、座標、BSO、壘上）
 *   ✅ 打席結果（安打、出局、四死球等）
 *   ✅ 得分事件
 *   ✅ 所有打席完整 pitch sequence
 */

import axios from 'axios';
import pool from '../db/pool';

const SANSPO_API = 'https://npb.sports-digican.com/api/kdjson';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
  'Referer': 'https://www.sanspo.com/',
};

// Sanspo チーム名 → DB チーム名
const TEAM_MAP: Record<string, string> = {
  'ロッテ': 'ロッテ',             '日本ハム': '日本ハム',
  '楽天': '楽天',                 '西武': '西武',
  'オリックス': 'オリックス',       'ソフトバンク': 'ソフトバンク',
  '巨人': '巨人',                 'ＤｅＮＡ': 'DeNA', 'DeNA': 'DeNA',
  '阪神': '阪神',                 '広島': '広島',
  '中日': '中日',                 'ヤクルト': 'ヤクルト',
};

export function normalizeSanspoTeam(name: string): string {
  return TEAM_MAP[name?.trim()] ?? name?.trim() ?? '';
}

// ── Sanspo API 型別 ────────────────────────────────────────────────────────────

interface SanspoTeam {
  globalId: number;
  nickname: string;          // team name e.g. "日本ハム"
  aliasName?: string;
  startingPitcher?: string;  // starting pitcher name
  pitcher?: string;          // current pitcher name
  score?: string | number | null;
}

interface SanspoGameListItem {
  gameGlobalId: number;
  gameDate: string;          // "2026-05-19" (YYYY-MM-DD)
  gameStatus?: number;       // 4=finished
  startTime?: string;
  venueNickName?: string;
  home: SanspoTeam;
  visitor: SanspoTeam;
}

interface SanspoGameListResponse {
  gameDate: string;
  gameList: SanspoGameListItem[];
}

interface SanspoPbpResponse {
  gameDate: string;
  gameInfo: Record<string, unknown>;
  event: SanspoEvent[];
}

interface SanspoBase {
  onBase: boolean;
  playerId: number;
}

interface SanspoBso {
  b: string;  // balls
  s: string;  // strikes
  o: string;  // outs
}

interface SanspoPitchType {
  draw: string;   // abbreviated
  str: string;    // full name e.g. "ストレート"
}

interface SanspoPitchResult {
  text: string;   // e.g. "ストライク(見逃し)"
  color: string;  // "stk" | "bal" | "hit" etc.
}

interface SanspoPitch {
  ballX: string;   // horizontal zone position
  ballY: string;   // vertical zone position (letter code)
  speed: number;
  type: SanspoPitchType;
  count: number;
  result: SanspoPitchResult;
  globalId: number;   // pitcher globalId
  teamGlobalId: number;
  hand: string;       // "R"|"L"
}

interface SanspoPlayer {
  globalId: number;
  teamGlobalId: number;
  hand: string;
  slot?: string;      // batting order
}

interface SanspoEvent {
  type: 'PIT' | 'BATTER' | 'PLAYER' | 'GAME_START' | 'INNING_START' | 'INNING_END' | 'GAME_END' | 'SUB' | string;
  code?: number;
  scored: boolean;
  result: string | null;
  description?: string;
  score: { home: number; visitor: number };
  base: { b1: SanspoBase; b2: SanspoBase; b3: SanspoBase };
  beforeBso: SanspoBso;
  bso: SanspoBso;
  batter: SanspoPlayer;
  pitch: SanspoPitch;
}

// ── Status ────────────────────────────────────────────────────────────────────

export const sanspoNpbScraperStatus = {
  isRunning: false,
  lastRun: null as string | null,
  lastResult: '未執行',
  lastError: null as string | null,
  total: 0,
  done: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseSanspoDate(dateStr: string): string {
  // Handle "20260517" → "2026-05-17" and "2026-05-17" → "2026-05-17"
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  return dateStr;
}

// Convert ballY letter to numeric coordinate (A=top zone, G=bottom zone)
function ballYToNum(y: string): number | null {
  const map: Record<string, number> = {
    'A': 180, 'B': 155, 'C': 130, 'D': 105, 'E': 80, 'F': 55, 'G': 30,
    'H': 10,  'I': 5,
  };
  return map[y?.toUpperCase()] ?? null;
}

// Convert ballX string to numeric (1~9 horizontal, 5=center)
function ballXToNum(x: string): number | null {
  const n = parseInt(x, 10);
  if (isNaN(n)) return null;
  // Map 1-9 to 0-200 scale (center=100)
  return Math.round(((n - 1) / 8) * 200);
}

function isStrikeResult(resultText: string): boolean {
  if (!resultText) return false;
  return resultText.includes('ストライク') || resultText.includes('空振') || resultText.includes('ファウル');
}

// Parse batter batting order and name from BATTER description
// "1番 佐藤 直樹 カウント1-2から..." → { batNum: "1", batterName: "佐藤 直樹" }
function parseBatterFromDesc(desc: string): { batNum: string; batterName: string } {
  const m = desc?.match(/^(\d+)番\s+(\S+)\s+(\S+)/);
  if (m) return { batNum: m[1], batterName: `${m[2]} ${m[3]}` };
  return { batNum: '', batterName: '' };
}

// Parse new pitcher name from PLAYER substitution description
// "投手交代：田中 正義 に代わって 柳川 大晟" → "柳川 大晟"
function parseNewPitcherFromDesc(desc: string): string | null {
  const m = desc?.match(/に代わって\s+(\S+)\s+(\S+)/);
  if (m) return `${m[1]} ${m[2]}`;
  return null;
}

// ── Fetch gamelist ────────────────────────────────────────────────────────────

export async function fetchGameList(): Promise<SanspoGameListItem[]> {
  const url = `${SANSPO_API}/gamelist.json`;
  const res = await axios.get<SanspoGameListResponse>(url, { headers: HEADERS, timeout: 10000 });
  return res.data?.gameList ?? [];
}

// ── Fetch one inning PBP ──────────────────────────────────────────────────────

async function fetchInningPbp(globalId: number, inning: number, tob: 1 | 2): Promise<SanspoEvent[]> {
  const url = `${SANSPO_API}/pbp_${globalId}_${inning}_${tob}.json`;
  try {
    const res = await axios.get<SanspoPbpResponse>(url, { headers: HEADERS, timeout: 8000 });
    return res.data?.event ?? [];
  } catch {
    return [];
  }
}

// ── Match Sanspo game to DB ───────────────────────────────────────────────────

export async function findDbGameId(
  dateStr: string,          // "2026-05-17"
  homeTeam: string,
  awayTeam: string,
): Promise<number | null> {
  const r = await pool.query<{ id: number }>(
    `SELECT id FROM games
     WHERE league = 'NPB'
       AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
       AND (team_home ILIKE $2 OR team_home ILIKE $3)
       AND (team_away ILIKE $4 OR team_away ILIKE $5)
     LIMIT 1`,
    [dateStr, `%${homeTeam}%`, `%${homeTeam.substring(0, 3)}%`,
               `%${awayTeam}%`, `%${awayTeam.substring(0, 3)}%`],
  );
  return r.rows[0]?.id ?? null;
}

// ── Save pitch events to DB ───────────────────────────────────────────────────

async function savePitchEvents(
  dbGameId: number,
  globalId: number,
  inning: number,
  isTop: boolean,
  events: SanspoEvent[],
  initialPitcher: string | null = null,
): Promise<{ saved: number; currentPitcher: string | null }> {
  let saved = 0;
  let pitchSeq = 0;
  let abSeq = 0;
  let playOrder = 0;
  let currentPitcher = initialPitcher;

  // Replace existing PBP for this inning half so Sanspo data cleanly overwrites Docomo
  await pool.query(
    `DELETE FROM game_play_by_play WHERE game_id = $1 AND inning = $2 AND is_top = $3`,
    [dbGameId, inning, isTop],
  );

  for (const ev of events) {
    // Handle player change events (substitutions, position changes)
    if (ev.type === 'PLAYER') {
      const desc = ev.description ?? ev.result ?? '';
      if (desc) {
        if (desc.includes('投手交代')) {
          const newPitcher = parseNewPitcherFromDesc(desc);
          if (newPitcher) currentPitcher = newPitcher;
        }
        playOrder++;
        await pool.query(
          `INSERT INTO game_play_by_play
             (game_id, inning, is_top, play_order, description)
           VALUES ($1,$2,$3,$4,$5)`,
          [dbGameId, inning, isTop, playOrder, desc],
        ).catch(() => {});
      }
      continue;
    }

    if (ev.type !== 'PIT' && ev.type !== 'BATTER') continue;
    if (!ev.pitch) continue;

    if (ev.type === 'BATTER') {
      abSeq++;
      pitchSeq = 0;
    }
    pitchSeq++;

    const pitch = ev.pitch;
    const atBatKey = `s${globalId}_${inning}_${isTop ? 1 : 2}_${abSeq}`;
    const x = ballXToNum(pitch.ballX);
    const y = ballYToNum(pitch.ballY);
    const speed = pitch.speed > 0 ? pitch.speed : null;
    const ballKind = pitch.type?.str ?? null;
    const result = pitch.result?.text ?? null;
    const isStrike = isStrikeResult(result ?? '');

    const batterId = ev.batter?.globalId ?? null;
    const pitcherId = pitch.globalId ?? null;

    // Parse real batter name from description (e.g. "1番 佐藤 直樹 カウント...")
    const { batNum, batterName: realBatterName } = ev.type === 'BATTER' && ev.description
      ? parseBatterFromDesc(ev.description)
      : { batNum: '', batterName: '' };

    const outsBefore = parseInt(ev.beforeBso?.o ?? '0', 10);

    try {
      await pool.query(
        `INSERT INTO game_pitch_data
           (game_id, at_bat_key, pitch_num, inning, is_top,
            pitcher_name, batter_name, ball_kind, ball_kind_id,
            x, y, speed, result, result_id, is_strike)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (game_id, at_bat_key, pitch_num) DO UPDATE
           SET ball_kind=$8, x=$10, y=$11, speed=$12, result=$13, is_strike=$15,
               pitcher_name=COALESCE(EXCLUDED.pitcher_name, game_pitch_data.pitcher_name),
               batter_name=COALESCE(EXCLUDED.batter_name, game_pitch_data.batter_name)`,
        [
          dbGameId,
          atBatKey,
          pitchSeq,
          inning,
          isTop,
          currentPitcher ?? (pitcherId ? `P#${pitcherId}` : null),
          realBatterName || (batterId ? `B#${batterId}` : null),
          ballKind,
          null,
          x,
          y,
          speed,
          result,
          null,
          isStrike,
        ],
      );
      saved++;
    } catch {
      // skip constraint errors
    }

    // Save at-bat result to game_play_by_play with real batter name
    if (ev.type === 'BATTER' && ev.result) {
      playOrder++;
      const balls   = parseInt(ev.bso?.b ?? '0', 10);
      const strikes = parseInt(ev.bso?.s ?? '0', 10);
      await pool.query(
        `INSERT INTO game_play_by_play
           (game_id, inning, is_top, play_order, description, balls, strikes, outs_before)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          dbGameId,
          inning,
          isTop,
          playOrder,
          JSON.stringify({
            batNum,
            batterName: realBatterName || (batterId ? `#${batterId}` : ''),
            outsB4: outsBefore,
            result: ev.result,
            balls,
            strikes,
            pitches: [],
          }),
          balls,
          strikes,
          outsBefore,
        ],
      ).catch(() => {});
    }
  }
  return { saved, currentPitcher };
}

// ── Scrape one game ───────────────────────────────────────────────────────────

export async function scrapeSanspoGame(
  globalId: number,
  dbGameId: number,
  maxInnings = 12,
  initialHomePitcher: string | null = null,
  initialAwayPitcher: string | null = null,
): Promise<{ pitchCount: number; innings: number }> {
  let totalPitches = 0;
  let inningsScraped = 0;
  // Home team pitches in top half (away batting); away team pitches in bottom half (home batting)
  let topPitcher: string | null = initialHomePitcher;
  let bottomPitcher: string | null = initialAwayPitcher;

  for (let inning = 1; inning <= maxInnings; inning++) {
    for (const tob of [1, 2] as const) {
      const isTop = tob === 1;
      const events = await fetchInningPbp(globalId, inning, tob);
      if (events.length === 0) {
        if (inning > 9) break;
        continue;
      }
      const { saved, currentPitcher } = await savePitchEvents(
        dbGameId, globalId, inning, isTop, events,
        isTop ? topPitcher : bottomPitcher,
      );
      if (currentPitcher) {
        if (isTop) topPitcher = currentPitcher;
        else bottomPitcher = currentPitcher;
      }
      totalPitches += saved;
      inningsScraped++;
    }
  }

  return { pitchCount: totalPitches, innings: inningsScraped };
}

// ── Scrape a game by Sanspo globalId, auto-finding DB ID ──────────────────────

export async function scrapeSanspoGameAuto(globalId: number): Promise<{
  success: boolean;
  message: string;
  dbGameId?: number;
  pitchCount?: number;
}> {
  // Find today's game in gamelist
  const games = await fetchGameList();
  const found = games.find(g => g.gameGlobalId === globalId);
  if (!found) {
    return { success: false, message: `gameGlobalId ${globalId} 不在今日賽程中` };
  }

  const dateStr = parseSanspoDate(found.gameDate);
  const homeTeam = normalizeSanspoTeam(found.home?.nickname ?? '');
  const awayTeam = normalizeSanspoTeam(found.visitor?.nickname ?? '');

  const dbGameId = await findDbGameId(dateStr, homeTeam, awayTeam);
  if (!dbGameId) {
    return { success: false, message: `找不到對應的 DB 比賽：${dateStr} ${awayTeam}@${homeTeam}` };
  }

  // Pass starting pitchers from gamelist so inning 1 has correct pitcher names
  const homePitcher = found.home?.startingPitcher ?? null;
  const awayPitcher = found.visitor?.startingPitcher ?? null;
  const result = await scrapeSanspoGame(globalId, dbGameId, 12, homePitcher, awayPitcher);
  return {
    success: true,
    message: `爬取完成：${result.pitchCount} 球，${result.innings} 局半`,
    dbGameId,
    pitchCount: result.pitchCount,
  };
}

// ── 姓名補完：將 Docomo 文字速報的打者名稱填入 Sanspo 逐球資料 ─────────────────

/**
 * 比對 game_play_by_play（Docomo text PBP，有真實姓名）
 * 與 game_pitch_data（Sanspo，只有 B#xxxxx 佔位符）
 * 依「同局同上下半第 N 打席」對應，將打者姓名寫入逐球資料。
 */
export async function mergeNamesIntoSanspoPitchData(dbGameId: number): Promise<{
  battersUpdated: number;
  pitchersUpdated: number;
}> {
  // ── 1. 取 Docomo text PBP 的打者姓名，依 (inning, is_top) 分組排序 ──────────
  const pbpRows = await pool.query<{
    inning: number; is_top: boolean; play_order: number; description: string;
  }>(
    `SELECT inning, is_top, play_order, description
     FROM game_play_by_play
     WHERE game_id = $1 AND description LIKE '{%'
     ORDER BY inning ASC, is_top DESC, play_order ASC`,
    [dbGameId],
  );

  // (inning)_(is_top) → ['山田', '青木', ...]（依打席順序）
  const docomoNames = new Map<string, string[]>();
  for (const row of pbpRows.rows) {
    try {
      const desc = JSON.parse(row.description) as { batterName?: string };
      const name = desc.batterName?.trim();
      if (!name || name.startsWith('#') || name === '') continue;
      const k = `${row.inning}_${row.is_top}`;
      if (!docomoNames.has(k)) docomoNames.set(k, []);
      docomoNames.get(k)!.push(name);
    } catch { continue; }
  }

  if (docomoNames.size === 0) return { battersUpdated: 0, pitchersUpdated: 0 };

  // ── 2. 取 Sanspo pitch data 的打席 key，依 (inning, is_top, abSeq) 排序 ─────
  const pitchRows = await pool.query<{
    at_bat_key: string; inning: number; is_top: boolean; ab_seq: number;
  }>(
    `SELECT DISTINCT at_bat_key, inning, is_top,
       CAST(split_part(at_bat_key, '_', 4) AS INT) AS ab_seq
     FROM game_pitch_data
     WHERE game_id = $1 AND at_bat_key LIKE 's%'
     ORDER BY inning ASC, is_top DESC, ab_seq ASC`,
    [dbGameId],
  );

  // (inning)_(is_top) → ['s20260855_3_1_1', 's20260855_3_1_2', ...]
  const sanspoKeys = new Map<string, string[]>();
  for (const row of pitchRows.rows) {
    const k = `${row.inning}_${row.is_top}`;
    if (!sanspoKeys.has(k)) sanspoKeys.set(k, []);
    sanspoKeys.get(k)!.push(row.at_bat_key);
  }

  // ── 3. 依序對應，更新 batter_name ─────────────────────────────────────────
  let battersUpdated = 0;
  for (const [k, names] of docomoNames.entries()) {
    const keys = sanspoKeys.get(k);
    if (!keys) continue;
    for (let i = 0; i < Math.min(names.length, keys.length); i++) {
      const res = await pool.query(
        `UPDATE game_pitch_data
         SET batter_name = $1
         WHERE game_id = $2 AND at_bat_key = $3
           AND (batter_name IS NULL OR batter_name LIKE 'B#%' OR batter_name = '')`,
        [names[i], dbGameId, keys[i]],
      );
      battersUpdated += res.rowCount ?? 0;
    }
  }

  // ── 4. 投手姓名：從 game_pitcher_stats 依局數補完 ───────────────────────────
  // game_pitcher_stats 記錄投手負責的各局，以此對應 Sanspo 逐球資料的投手欄位
  const pitcherRows = await pool.query<{
    player_name: string; team_code: string;
    inning_1: number | null; inning_2: number | null; inning_3: number | null;
    inning_4: number | null; inning_5: number | null; inning_6: number | null;
    inning_7: number | null; inning_8: number | null; inning_9: number | null;
  }>(
    `SELECT player_name, team_code,
       inning_1, inning_2, inning_3, inning_4, inning_5,
       inning_6, inning_7, inning_8, inning_9
     FROM game_pitcher_stats
     WHERE game_id = $1`,
    [dbGameId],
  ).catch(() => ({ rows: [] as never[] }));

  // 識別主隊（is_top=false 時主隊投手上場）
  const gameRow = await pool.query<{ team_home: string; team_away: string }>(
    `SELECT team_home, team_away FROM games WHERE id = $1`, [dbGameId],
  );
  const homeTeam = gameRow.rows[0]?.team_home ?? '';
  const awayTeam = gameRow.rows[0]?.team_away ?? '';

  // 建立 (inning, is_top) → 投手姓名的對應
  // is_top=true：客隊攻，主隊投手登場
  // is_top=false：主隊攻，客隊投手登場
  const pitcherByInningTop = new Map<string, string>(); // `${inning}_${isTop}` → name

  for (const ps of pitcherRows.rows) {
    const isHomeTeam = ps.team_code === homeTeam ||
      homeTeam.includes(ps.team_code) || ps.team_code.includes(homeTeam.substring(0, 2));

    for (let inn = 1; inn <= 9; inn++) {
      const innings = [
        ps.inning_1, ps.inning_2, ps.inning_3, ps.inning_4, ps.inning_5,
        ps.inning_6, ps.inning_7, ps.inning_8, ps.inning_9,
      ];
      if ((innings[inn - 1] ?? 0) > 0) {
        // 主隊投手：在上半局（is_top=true）登場
        // 客隊投手：在下半局（is_top=false）登場
        const isTop = isHomeTeam;
        const k = `${inn}_${isTop}`;
        if (!pitcherByInningTop.has(k)) {
          pitcherByInningTop.set(k, ps.player_name);
        }
      }
    }
  }

  let pitchersUpdated = 0;
  for (const [k, pitcherName] of pitcherByInningTop.entries()) {
    const [innStr, isTopStr] = k.split('_');
    const res = await pool.query(
      `UPDATE game_pitch_data
       SET pitcher_name = $1
       WHERE game_id = $2 AND inning = $3 AND is_top = $4
         AND at_bat_key LIKE 's%'
         AND (pitcher_name IS NULL OR pitcher_name LIKE 'P#%' OR pitcher_name = '')`,
      [pitcherName, dbGameId, parseInt(innStr, 10), isTopStr === 'true'],
    );
    pitchersUpdated += res.rowCount ?? 0;
  }

  return { battersUpdated, pitchersUpdated };
}

// ── Daily runner ──────────────────────────────────────────────────────────────

export async function runSanspoNpbDailyScraper(): Promise<void> {
  if (sanspoNpbScraperStatus.isRunning) {
    console.log('[SanspoNPB] 爬蟲正在執行中，跳過');
    return;
  }

  sanspoNpbScraperStatus.isRunning = true;
  sanspoNpbScraperStatus.lastRun = new Date().toISOString();
  sanspoNpbScraperStatus.lastError = null;
  sanspoNpbScraperStatus.done = 0;

  try {
    const games = await fetchGameList();
    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    // Filter to today's games
    const todayGames = games.filter(g => g.gameDate === todayStr);
    sanspoNpbScraperStatus.total = todayGames.length;

    console.log(`[SanspoNPB] 今日 ${todayGames.length} 場比賽`);

    let totalPitches = 0;
    for (const game of todayGames) {
      try {
        const dateStr = parseSanspoDate(game.gameDate);
        const homeTeam = normalizeSanspoTeam(game.home?.nickname ?? '');
        const awayTeam = normalizeSanspoTeam(game.visitor?.nickname ?? '');

        const dbGameId = await findDbGameId(dateStr, homeTeam, awayTeam);
        if (!dbGameId) {
          console.warn(`[SanspoNPB] 找不到 DB 比賽：${dateStr} ${awayTeam}@${homeTeam}`);
          sanspoNpbScraperStatus.done++;
          continue;
        }

        const homePitcher = game.home?.startingPitcher ?? null;
        const awayPitcher = game.visitor?.startingPitcher ?? null;
        const result = await scrapeSanspoGame(game.gameGlobalId, dbGameId, 12, homePitcher, awayPitcher);
        totalPitches += result.pitchCount;
        console.log(`[SanspoNPB] ${awayTeam}@${homeTeam}: ${result.pitchCount} 球`);
      } catch (err) {
        console.warn(`[SanspoNPB] 比賽 ${game.gameGlobalId} 失敗:`, (err as Error).message);
      }
      sanspoNpbScraperStatus.done++;
    }

    sanspoNpbScraperStatus.lastResult = `完成：${todayGames.length} 場，共 ${totalPitches} 球`;
  } catch (err) {
    sanspoNpbScraperStatus.lastError = (err as Error).message;
    sanspoNpbScraperStatus.lastResult = '執行失敗';
    console.error('[SanspoNPB] 爬蟲失敗:', err);
  } finally {
    sanspoNpbScraperStatus.isRunning = false;
  }
}
