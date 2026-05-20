/**
 * Docomo NPB 一軍直播爬蟲
 *
 * API: https://sports-api.smt.docomo.ne.jp/data/baseball/npb/
 *
 * 功能：
 *   ✅ 逐球投球資料（index.json pitch_info → game_pitch_data）  ← 好球帶
 *   ✅ 文字速報（index_text.json → game_play_by_play + BSO）    ← 主要來源
 *   ✅ 自動日排程爬蟲（top_today_schedule.json → 自動比對 DB）
 *
 * 使用方式：
 *   自動: runDocomoNpbDailyScraper() — 每次 NPB 主爬蟲觸發時自動執行
 *   手動: Admin 頁 → 輸入 Docomo game_id → rescrape-npb-docomo-game-auto
 */

import axios from 'axios';
import pool from '../db/pool';

const DOCOMO_NPB_API = 'https://sports-api.smt.docomo.ne.jp/data/baseball/npb';
const BALL_RESULT_ID = '18';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
  'Referer': 'https://service.smt.docomo.ne.jp/',
};

// ── 型別定義（Docomo NPB 一軍 / 二軍共通フォーマット）────────────────────────

type PitchEntry = {
  ball_kind_id: string;
  ball_kind_name: string;
  ball_kind: string;
  x: string;
  y: string;
  speed: string;
  result_id: string;
  result: string;
  course_no?: string;
};
type PitchInfo = Record<string, PitchEntry>;

interface IndexEntry {
  file_name: string;
  inning: string;
  tb: string;
  pitcher: { name?: string; name_l?: string; name_s?: string };
  batter:  { name?: string; name_l?: string; name_s?: string };
  pitch_info?: PitchInfo;
}

interface PbpEntry {
  bat_num: string;
  team_name_s: string;
  name_s: string;
  text: string;
  option: number;
  ball_kind: string;
  result_id: string;
  result_flg: string;
  ball_num: string;
  // NPB 一軍 index_text.json 可能含有 inning_text 子結構（賽前資訊區塊）
  inning_text?: Record<string, Omit<PbpEntry, 'inning_text'>>;
}

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
    console.warn('[DocomoNPB] fetch失敗:', url, (e as Error).message);
    return null;
  }
}

function isOutResult(result: string): boolean {
  if (/三振/.test(result)) return true;
  if (/ゴロ/.test(result) && !/ヒット|安打|内野安打|野手選択/.test(result)) return true;
  if (/フライ/.test(result) && !/ヒット|安打|失策/.test(result)) return true;
  if (/ライナー/.test(result) && !/ヒット|安打/.test(result)) return true;
  if (/犠打|犠飛/.test(result)) return true;
  return false;
}

// ── 逐球資料 →  game_pitch_data ───────────────────────────────────────────────

async function savePitchData(
  dbGameId: number,
  indexData: Record<string, IndexEntry>,
  docomoGameId: string,
  fetchIndividual = false,
): Promise<number> {
  let saved = 0;

  for (const [atBatKey, atBat] of Object.entries(indexData)) {
    const inning = parseInt(atBat.inning ?? '1', 10);
    const isTop  = (atBat.tb ?? '1') === '1';
    const pitcherName = atBat.pitcher?.name ?? atBat.pitcher?.name_l ?? atBat.pitcher?.name_s ?? '';
    const batterName  = atBat.batter?.name  ?? atBat.batter?.name_l  ?? atBat.batter?.name_s  ?? '';

    const inlinePitchInfo = atBat.pitch_info ?? null;
    const inlineCount = inlinePitchInfo ? Object.keys(inlinePitchInfo).length : 0;

    let pitchInfo: PitchInfo | null = inlineCount > 0 ? inlinePitchInfo : null;

    if (!pitchInfo && fetchIndividual && atBat.file_name) {
      const raw = await fetchJson<Record<string, unknown>>(
        `${DOCOMO_NPB_API}/result/${docomoGameId}/${atBat.file_name}`,
      );
      if (raw && typeof raw === 'object') {
        if (raw.pitch_info && typeof raw.pitch_info === 'object') {
          pitchInfo = raw.pitch_info as PitchInfo;
        } else {
          const keys = Object.keys(raw);
          if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
            pitchInfo = raw as PitchInfo;
          }
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }

    if (!pitchInfo) continue;

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
      saved++;
    }
  }

  return saved;
}

// ── 文字速報（index.json 高品質版）→ game_play_by_play ───────────────────────

async function savePlayByPlayFromIndex(
  dbGameId: number,
  indexData: Record<string, IndexEntry>,
): Promise<number> {
  await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [dbGameId]);

  const entries = Object.entries(indexData)
    .filter(([, e]) => {
      const name = e.batter?.name_l || e.batter?.name || e.batter?.name_s || '';
      return name && e.pitch_info && Object.keys(e.pitch_info).length > 0;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  let playOrder = 0;
  let curInning = -1, curIsTop = true, runningOuts = 0;

  for (const [, entry] of entries) {
    const inning = parseInt(entry.inning ?? '1', 10);
    const isTop  = (entry.tb ?? '1') === '1';
    const batterName = entry.batter.name_l || entry.batter.name || entry.batter.name_s || '';
    if (!batterName) continue;

    if (inning !== curInning || isTop !== curIsTop) {
      curInning = inning; curIsTop = isTop; runningOuts = 0;
    }
    const outsBefore = runningOuts;

    const pitches = Object.entries(entry.pitch_info!)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .map(([, p]) => p);

    if (pitches.length === 0) continue;

    let balls = 0, strikes = 0;
    for (let i = 0; i < pitches.length - 1; i++) {
      const rid    = pitches[i].result_id ?? '';
      const result = pitches[i].result    ?? '';
      if (rid === BALL_RESULT_ID || result.includes('ボール')) {
        if (balls < 3) balls++;
      } else {
        if (result.includes('ファウル')) {
          if (strikes < 2) strikes++;
        } else {
          if (strikes < 2) strikes++;
        }
      }
    }

    const lastResult = pitches[pitches.length - 1].result ?? '';
    const desc = `${batterName} ${balls}-${strikes}より ${lastResult}`;

    await pool.query(
      `INSERT INTO game_play_by_play
         (game_id, inning, is_top, play_order, description, balls, strikes, outs_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [dbGameId, inning, isTop, ++playOrder, desc, balls, strikes, outsBefore],
    ).catch(() => {});

    if (isOutResult(lastResult) && runningOuts < 3) runningOuts++;
  }

  return playOrder;
}

// ── 文字速報（index_text.json）→ game_play_by_play（rich JSON format）────────

async function savePlayByPlayFromText(
  dbGameId: number,
  pbpData: Record<string, PbpEntry>,
): Promise<number> {
  await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [dbGameId]);

  const entries = Object.entries(pbpData)
    .filter(([key, e]) => {
      const inning = parseInt(key.substring(0, 2), 10);
      return inning > 0 && e.text;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  let playOrder = 0;
  let curInning = -1, curIsTop = true, runningOuts = 0;

  for (const [key, pbp] of entries) {
    const inning = parseInt(key.substring(0, 2), 10);
    const isTop  = key.charAt(2) === '1';

    if (inning !== curInning || isTop !== curIsTop) {
      curInning = inning; curIsTop = isTop; runningOuts = 0;
    }

    if (!pbp.ball_num) {
      // 半イニング告知・投手交代などのプレーンテキスト
      await pool.query(
        `INSERT INTO game_play_by_play
           (game_id, inning, is_top, play_order, description, balls, strikes, outs_before)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6)
         ON CONFLICT DO NOTHING`,
        [dbGameId, inning, isTop, ++playOrder, pbp.text, runningOuts],
      ).catch(() => {});
      continue;
    }

    // 打席エントリ：rich JSON として保存
    const outsB4 = runningOuts;
    const batterName = pbp.name_s ?? '';

    const pitches: { num: string; text: string }[] = [];
    if (pbp.inning_text) {
      for (const [num, pitch] of Object.entries(pbp.inning_text)
        .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))) {
        if (pitch.text) pitches.push({ num, text: pitch.text });
      }
    }

    // 最終 BSO を最後の投球テキスト末尾の "B-S" から抽出
    let finalBalls = 0, finalStrikes = 0;
    const lastPitch = pitches[pitches.length - 1];
    if (lastPitch) {
      const m = lastPitch.text.match(/(\d+)-(\d+)\s*$/);
      if (m) { finalBalls = parseInt(m[1], 10); finalStrikes = parseInt(m[2], 10); }
    }

    const desc = JSON.stringify({
      batNum: pbp.bat_num ?? '',
      batterName,
      outsB4,
      result: pbp.text,
      balls: finalBalls,
      strikes: finalStrikes,
      pitches,
    });

    await pool.query(
      `INSERT INTO game_play_by_play
         (game_id, inning, is_top, play_order, description, balls, strikes, outs_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [dbGameId, inning, isTop, ++playOrder, desc, finalBalls, finalStrikes, outsB4],
    ).catch(() => {});

    if (isOutResult(pbp.text) && runningOuts < 3) runningOuts++;
  }

  return playOrder;
}

// ── 球隊名稱正規化（與 DB 儲存格式對齊）────────────────────────────────────────

const TEAM_NORM: Record<string, string> = {
  'ＤｅＮＡ': 'DeNA',
  '読売': '巨人',
  'Ｄｅ': 'DeNA',
};
function normalizeTeam(name: string): string {
  return TEAM_NORM[name] ?? name;
}

// ── Docomo schedule 型別 ───────────────────────────────────────────────────────

interface DocomoNpbScheduleEntry {
  game_id: number;
  game_state: number;   // 0=scheduled, 1=live, 2=rain, 4=final
  game_date: string;    // "2026/05/17"
  home_team_name_s: string;
  visit_team_name_s: string;
  home_score: number | null;
  visit_score: number | null;
  stadium_name_s: string;
}

interface DocomoNpbSchedule {
  today: DocomoNpbScheduleEntry[];
}

export interface DocomoNpbDailyStatus {
  isRunning: boolean;
  lastRun: string | null;
  lastResult: string;
  gamesProcessed: number;
  pitchesSaved: number;
  playsSaved: number;
}

export const docomoNpbDailyStatus: DocomoNpbDailyStatus = {
  isRunning: false,
  lastRun: null,
  lastResult: '尚未執行',
  gamesProcessed: 0,
  pitchesSaved: 0,
  playsSaved: 0,
};

// ── 由 Docomo game_id 自動尋找 DB games.id ──────────────────────────────────

interface DocomoTeamResult {
  team_name_s?: string;
  team_id?: string;
}

async function lookupDbGameFromDocomo(docomoGameId: string): Promise<number | null> {
  // 1. docomo_game_id 欄位已有記錄 → 直接回傳
  const cached = await pool.query<{ id: number }>(
    `SELECT id FROM games WHERE docomo_game_id = $1 AND league = 'NPB' LIMIT 1`,
    [docomoGameId],
  ).catch(() => ({ rows: [] as { id: number }[] }));
  if (cached.rows[0]) return cached.rows[0].id;

  // 2. 從 Docomo result API 取得主客隊名稱
  const [homeData, visitData] = await Promise.all([
    fetchJson<DocomoTeamResult>(`${DOCOMO_NPB_API}/result/${docomoGameId}/home.json`),
    fetchJson<DocomoTeamResult>(`${DOCOMO_NPB_API}/result/${docomoGameId}/visit.json`),
  ]);
  if (!homeData?.team_name_s || !visitData?.team_name_s) return null;

  const homeTeam  = normalizeTeam(homeData.team_name_s);
  const visitTeam = normalizeTeam(visitData.team_name_s);

  // 3. DB 查詢：主客隊相符的最近 NPB 比賽
  const res = await pool.query<{ id: number }>(
    `SELECT g.id FROM games g
     WHERE g.league = 'NPB'
       AND (g.team_home = $1 OR g.team_home ILIKE $3)
       AND (g.team_away = $2 OR g.team_away ILIKE $4)
     ORDER BY g.game_date DESC
     LIMIT 1`,
    [homeTeam, visitTeam, `%${homeTeam}%`, `%${visitTeam}%`],
  ).catch(() => ({ rows: [] as { id: number }[] }));

  return res.rows[0]?.id ?? null;
}

// ── 主要爬蟲函式 ──────────────────────────────────────────────────────────────

export interface NpbDocomoScrapeResult {
  success: boolean;
  message: string;
  pitches: number;
  plays: number;
  dbGameId?: number;
}

/**
 * 指定 Docomo 一軍 game_id + DB game_id，爬取並儲存投球 + 文字速報資料。
 * isFinal=true 時才補抓個別打席文件（正式賽 → 完整資料）。
 */
export async function scrapeDocomoNpbGame(
  docomoGameId: string,
  dbGameId: number,
  isFinal = false,
): Promise<NpbDocomoScrapeResult> {
  try {
    // 0. 儲存 docomo_game_id 對應
    await pool.query(
      `UPDATE games SET docomo_game_id = $1 WHERE id = $2`,
      [docomoGameId, dbGameId],
    ).catch(() => {});

    // 1. 抓 index.json（含 pitch_info）
    const indexData = await fetchJson<Record<string, IndexEntry>>(
      `${DOCOMO_NPB_API}/result/${docomoGameId}/index.json`,
    );

    // 2. 抓 index_text.json（PBP 文字 fallback）
    const pbpData = await fetchJson<Record<string, PbpEntry>>(
      `${DOCOMO_NPB_API}/result/${docomoGameId}/index_text.json`,
    );

    let pitchCount = 0;
    let playCount  = 0;

    if (indexData && typeof indexData === 'object' && !Array.isArray(indexData)) {
      // 逐球資料
      pitchCount = await savePitchData(dbGameId, indexData, docomoGameId, isFinal);

      // 文字速報：index.json 的打席數夠多（≥10）才用高品質版；
      // 否則優先用完整的 index_text.json
      const validAtBats = Object.values(indexData).filter(
        e => (e.batter?.name_l || e.batter?.name || e.batter?.name_s) &&
             e.pitch_info && Object.keys(e.pitch_info).length > 0,
      ).length;

      if (validAtBats >= 10) {
        playCount = await savePlayByPlayFromIndex(dbGameId, indexData);
      } else if (pbpData && typeof pbpData === 'object' && !Array.isArray(pbpData)) {
        playCount = await savePlayByPlayFromText(dbGameId, pbpData);
      } else if (validAtBats > 0) {
        playCount = await savePlayByPlayFromIndex(dbGameId, indexData);
      }
    } else if (pbpData && typeof pbpData === 'object' && !Array.isArray(pbpData)) {
      playCount = await savePlayByPlayFromText(dbGameId, pbpData);
    }

    return {
      success: true,
      message: `儲存成功：${pitchCount} 球、${playCount} 打席`,
      pitches: pitchCount,
      plays:   playCount,
      dbGameId,
    };
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[DocomoNPB] 爬蟲失敗:', docomoGameId, msg);
    return { success: false, message: msg, pitches: 0, plays: 0 };
  }
}

/**
 * 只需 Docomo game_id，自動查找對應 DB games.id 後執行爬蟲。
 */
export async function scrapeDocomoNpbGameAuto(
  docomoGameId: string,
  isFinal = false,
): Promise<NpbDocomoScrapeResult> {
  const dbGameId = await lookupDbGameFromDocomo(docomoGameId);
  if (!dbGameId) {
    return {
      success: false,
      message: `找不到對應的 DB 比賽（Docomo game_id=${docomoGameId}）。請手動輸入 DB game_id。`,
      pitches: 0,
      plays: 0,
    };
  }
  return scrapeDocomoNpbGame(docomoGameId, dbGameId, isFinal);
}

// ── 自動日排程爬蟲：從 top_today_schedule 抓取所有一軍比賽 ─────────────────────

/**
 * 自動抓取今日所有 NPB 一軍比賽的文字速報 + 好球帶資料。
 * 由主 NPB 爬蟲呼叫，不需手動輸入 game_id。
 */
export async function runDocomoNpbDailyScraper(): Promise<DocomoNpbDailyStatus> {
  if (docomoNpbDailyStatus.isRunning) return docomoNpbDailyStatus;

  docomoNpbDailyStatus.isRunning = true;
  docomoNpbDailyStatus.lastRun   = new Date().toISOString();
  docomoNpbDailyStatus.gamesProcessed = 0;
  docomoNpbDailyStatus.pitchesSaved   = 0;
  docomoNpbDailyStatus.playsSaved     = 0;

  try {
    // 1. 取得今日賽程
    const schedule = await fetchJson<DocomoNpbSchedule>(
      `${DOCOMO_NPB_API}/top_today_schedule.json`,
    );
    if (!schedule?.today?.length) {
      docomoNpbDailyStatus.lastResult = '今日無 NPB 一軍比賽';
      docomoNpbDailyStatus.isRunning  = false;
      return docomoNpbDailyStatus;
    }

    // 2. 只處理進行中（state=1）或已完賽（state=4）
    const targets = schedule.today.filter(g => g.game_state === 1 || g.game_state === 4);
    console.log(`[DocomoNPB Daily] 今日 ${schedule.today.length} 場，處理 ${targets.length} 場`);

    for (const entry of targets) {
      const docomoGameId = String(entry.game_id);
      const homeTeam  = normalizeTeam(entry.home_team_name_s);
      const visitTeam = normalizeTeam(entry.visit_team_name_s);
      const gameDate  = entry.game_date.replace(/\//g, '-'); // "2026-05-17"
      const isFinal   = entry.game_state === 4;

      // 3. 比對 DB games
      let dbGameId: number | null = null;

      // 先查 docomo_game_id 快取
      const cached = await pool.query<{ id: number }>(
        `SELECT id FROM games WHERE docomo_game_id = $1 AND league = 'NPB' LIMIT 1`,
        [docomoGameId],
      ).catch(() => ({ rows: [] as { id: number }[] }));
      if (cached.rows[0]) {
        dbGameId = cached.rows[0].id;
      } else {
        // 用日期 + 主客隊名稱查找
        const res = await pool.query<{ id: number }>(
          `SELECT id FROM games
           WHERE league = 'NPB'
             AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
             AND (team_home = $2 OR team_home ILIKE $4)
             AND (team_away = $3 OR team_away ILIKE $5)
           LIMIT 1`,
          [gameDate, homeTeam, visitTeam, `%${homeTeam}%`, `%${visitTeam}%`],
        ).catch(() => ({ rows: [] as { id: number }[] }));
        dbGameId = res.rows[0]?.id ?? null;
      }

      if (!dbGameId) {
        console.warn(`[DocomoNPB Daily] 找不到 DB 比賽: ${homeTeam} vs ${visitTeam} ${gameDate}`);
        continue;
      }

      // 4. 儲存 docomo_game_id
      await pool.query(
        `UPDATE games SET docomo_game_id = $1 WHERE id = $2`,
        [docomoGameId, dbGameId],
      ).catch(() => {});

      // 5. 抓取文字速報 + 好球帶
      const result = await scrapeDocomoNpbGame(docomoGameId, dbGameId, isFinal);
      if (result.success) {
        docomoNpbDailyStatus.gamesProcessed++;
        docomoNpbDailyStatus.pitchesSaved += result.pitches;
        docomoNpbDailyStatus.playsSaved   += result.plays;
        console.log(`[DocomoNPB Daily] game#${dbGameId} (${homeTeam} vs ${visitTeam}) → ${result.message}`);
      } else {
        console.warn(`[DocomoNPB Daily] game#${dbGameId} 失敗: ${result.message}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    docomoNpbDailyStatus.lastResult =
      `✅ 完成：${docomoNpbDailyStatus.gamesProcessed} 場，` +
      `${docomoNpbDailyStatus.pitchesSaved} 球，${docomoNpbDailyStatus.playsSaved} 打席`;
    console.log(`[DocomoNPB Daily] ${docomoNpbDailyStatus.lastResult}`);

  } catch (e) {
    const msg = (e as Error).message;
    docomoNpbDailyStatus.lastResult = `❌ 錯誤：${msg}`;
    console.error('[DocomoNPB Daily] 爬蟲失敗:', msg);
  }

  docomoNpbDailyStatus.isRunning = false;
  return docomoNpbDailyStatus;
}
