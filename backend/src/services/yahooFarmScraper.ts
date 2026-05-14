/**
 * Yahoo Baseball 二軍完整爬蟲
 *
 * 資料來源：
 *   賽程  https://baseball.yahoo.co.jp/npb/schedule/?type=farm&ym=YYYYMM
 *   比分  https://baseball.yahoo.co.jp/npb/game/{gameId}/score
 *   成績  https://baseball.yahoo.co.jp/npb/game/{gameId}/stats
 *
 * 可取得：
 *   ✅ 賽程（月別）
 *   ✅ 各局比分、總分、安打、失策
 *   ✅ 打者成績（打席/打數/安打/打點/三振/四球/死球）
 *   ✅ 投手成績（投球回/自責點/三振/四球）
 *   ❌ 文字速報（Yahoo farm livecenter 不可用）
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const YAHOO_BASE = 'https://baseball.yahoo.co.jp';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,zh-TW;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
};

const FULL_TO_SHORT: Record<string, string> = {
  '北海道日本ハムファイターズ': '日本ハム', '日本ハム': '日本ハム',
  '千葉ロッテマリーンズ': 'ロッテ',      'ロッテ': 'ロッテ',
  '東北楽天ゴールデンイーグルス': '楽天', '楽天': '楽天',
  '埼玉西武ライオンズ': '西武',           '西武': '西武',
  'オリックス・バファローズ': 'オリックス','オリックス': 'オリックス',
  'オリックスバファローズ': 'オリックス',
  '福岡ソフトバンクホークス': 'ソフトバンク','ソフトバンク': 'ソフトバンク',
  '読売ジャイアンツ': '巨人',             '巨人': '巨人',
  '横浜ＤｅＮＡベイスターズ': 'DeNA',    'DeNA': 'DeNA',
  '横浜DeNAベイスターズ': 'DeNA',
  '阪神タイガース': '阪神',               '阪神': '阪神',
  '広島東洋カープ': '広島',               '広島': '広島',
  '中日ドラゴンズ': '中日',               '中日': '中日',
  '東京ヤクルトスワローズ': 'ヤクルト',   'ヤクルト': 'ヤクルト',
  'くふうハヤテベンチャーズ静岡': 'くふうハヤテ', 'くふうハヤテ': 'くふうハヤテ',
  'オイシックス新潟アルビレックスBC': 'オイシックス', 'オイシックス': 'オイシックス',
};

function normalizeTeam(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  return FULL_TO_SHORT[t] ?? t;
}

interface InningScore {
  inning: number;
  score_away: number | null;
  score_home: number | null;
}

interface YahooFarmGameData {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  totalAway: number | null;
  totalHome: number | null;
  hitsAway: number | null;
  hitsHome: number | null;
  errorsAway: number | null;
  errorsHome: number | null;
  innings: InningScore[];
  status: 'final' | 'live' | 'scheduled';
  gameDate: string; // YYYY-MM-DD in JST
  venue: string | null;
  startTime: string | null;
}

export interface YahooFarmBatter {
  position: string;
  player_name: string;
  ab: number;
  hits: number;
  hr: number;
  rbi: number;
  bb: number;
  hbp: number;
  so: number;
}

export interface YahooFarmPitcher {
  player_name: string;
  result: string; // ○勝 ●負 Ｓ or empty
  ip: string;
  batters: number;
  hits_allowed: number;
  bb: number;
  hbp: number;
  so: number;
  er: number;
}

export interface YahooFarmStatsData {
  winPitcher: string | null;
  lossPitcher: string | null;
  savePitcher: string | null;
  awayBatters: YahooFarmBatter[];
  homeBatters: YahooFarmBatter[];
  awayPitchers: YahooFarmPitcher[];
  homePitchers: YahooFarmPitcher[];
}

// ─── 取今日二軍比賽 ID ─────────────────────────────────────────────────────────

async function fetchTodayFarmGameIds(): Promise<string[]> {
  const nowJST = new Date(Date.now() + 9 * 3600_000);
  const todayJST = `${nowJST.getUTCFullYear()}-${String(nowJST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowJST.getUTCDate()).padStart(2, '0')}`;

  // 1. 直接從二軍賽程頁取今日比賽 ID（日期格式 YYYYMMDD）
  const y = nowJST.getUTCFullYear();
  const mo = String(nowJST.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(nowJST.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}${mo}${d}`;

  const farmIds = new Set<string>();

  // 嘗試日期指定賽程頁
  const scheduleUrls = [
    `${YAHOO_BASE}/npb/schedule/farm/${dateStr}`,
    `${YAHOO_BASE}/npb/schedule/?type=farm&date=${dateStr}`,
    `${YAHOO_BASE}/npb/schedule/farm/all`,
  ];

  for (const url of scheduleUrls) {
    try {
      const r = await axios.get(url, { headers: HEADERS, timeout: 10000 });
      const $s = cheerio.load(r.data);
      $s('a').each((_, el) => {
        const href = $s(el).attr('href');
        const m = href?.match(/\/npb\/game\/(\d+)\//);
        if (m) farmIds.add(m[1]);
      });
      if (farmIds.size > 0) {
        console.log(`[Yahoo Farm] 賽程頁 ${url} 取得 ${farmIds.size} 個候選 ID`);
        break;
      }
    } catch { /* try next */ }
  }

  // 2. 若賽程頁也取不到，從一軍主頁掃描（熱身賽期間一軍可能沒比賽，擴大至 30 個）
  if (farmIds.size === 0) {
    try {
      const home = await axios.get('https://baseball.yahoo.co.jp/npb/', { headers: HEADERS, timeout: 10000 });
      const $h = cheerio.load(home.data);
      const regularIds: number[] = [];
      $h('a').each((_, el) => {
        const href = $h(el).attr('href');
        const m = href?.match(/\/npb\/game\/(\d+)\//);
        if (m) regularIds.push(Number(m[1]));
      });
      if (regularIds.length > 0) {
        const minRegular = Math.min(...regularIds);
        Array.from({ length: 30 }, (_, i) => minRegular - 1 - i).forEach(id => farmIds.add(String(id)));
      }
    } catch { /* skip */ }
  }

  if (farmIds.size === 0) return [];

  // 3. 逐一確認：是二軍且是今日比賽
  const todayFarmIds: string[] = [];
  await Promise.all([...farmIds].map(async (id) => {
    try {
      const r = await axios.get(`${YAHOO_BASE}/npb/game/${id}/score`, {
        headers: HEADERS, timeout: 8000,
      });
      const isFarm = r.data.includes('ファーム');
      const dateM = r.data.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (!dateM) return;
      const gy = dateM[1], gmo = dateM[2].padStart(2, '0'), gd = dateM[3].padStart(2, '0');
      const gameDate = `${gy}-${gmo}-${gd}`;
      if (isFarm && gameDate === todayJST) todayFarmIds.push(id);
    } catch { /* skip */ }
  }));

  console.log(`[Yahoo Farm] 今日 farm games: ${todayFarmIds.sort().join(', ')}`);
  return todayFarmIds;
}

// ─── 抓單場比分（/score 頁面）────────────────────────────────────────────────

async function scrapeYahooFarmGame(gameId: string, anyDate = false): Promise<YahooFarmGameData | null> {
  try {
    const r = await axios.get(`${YAHOO_BASE}/npb/game/${gameId}/score`, {
      headers: HEADERS, timeout: 12000,
    });
    const $ = cheerio.load(r.data);

    // 日期（從頁面 title 取，優先處理）
    const title = $('title').text();
    const dateMatch = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    let gameDate = '';
    if (dateMatch) {
      const y = dateMatch[1];
      const m = dateMatch[2].padStart(2, '0');
      const d = dateMatch[3].padStart(2, '0');
      gameDate = `${y}-${m}-${d}`;
    }

    // 非指定模式下只處理今日
    if (!anyDate) {
      const nowJST = new Date(Date.now() + 9 * 3600_000);
      const todayJST = `${nowJST.getUTCFullYear()}-${String(nowJST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowJST.getUTCDate()).padStart(2, '0')}`;
      if (gameDate && gameDate !== todayJST) return null;
    }

    // 開始時間（格式 HH:MM）
    const timeText = $('.bb-gameRound--startTime, .bb-gameInfo__time').first().text().trim();
    const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
    const startTime = timeMatch ? timeMatch[1] : null;

    // 隊名：優先從 score table，否則從 title 解析
    let awayTeam = '';
    let homeTeam = '';
    const teamEls = $('.bb-gameScoreTable__team');
    if (teamEls.length >= 2) {
      // Yahoo 二軍頁面：第一行 = 主場（後攻），第二行 = 客場（先攻）
      homeTeam = normalizeTeam(teamEls.eq(0).text().trim());
      awayTeam = normalizeTeam(teamEls.eq(1).text().trim());
    } else {
      // title 格式: "YYYY年M月D日 HOME vs.AWAY 一球速報..."
      const teamMatch = title.match(/日\s+(.+?)vs\.(.+?)\s+一球速報/);
      if (teamMatch) {
        homeTeam = normalizeTeam(teamMatch[1].trim());
        awayTeam = normalizeTeam(teamMatch[2].trim());
      }
    }
    if (!awayTeam || !homeTeam) return null;

    // 比賽狀態 — check multiple selectors for robustness
    const pageText = $('body').text();
    let status: 'final' | 'live' | 'scheduled';
    const statusText = [
      $('h4.live').text(),
      $('.bb-gameRound__status').text(),
      $('.bb-gameStatus').text(),
      $('[class*="status"]').first().text(),
    ].join(' ').trim();

    if (statusText.includes('試合終了') || statusText.includes('終了') || pageText.includes('試合終了')) {
      status = 'final';
    } else if (statusText.includes('LIVE') || statusText.includes('試合中') || pageText.includes('LIVE')) {
      status = 'live';
    } else {
      status = 'scheduled';
    }

    // 球場
    const venue = $('.bb-gameRound--stadium').text().trim() || null;

    // 局分表
    const innings: InningScore[] = [];
    let totalAway: number | null = null;
    let totalHome: number | null = null;
    let hitsAway: number | null = null;
    let hitsHome: number | null = null;
    let errorsAway: number | null = null;
    let errorsHome: number | null = null;

    const table = $('.bb-gameScoreTable');
    // headers: ['', '1','2',...,'9','計','安','失']
    const headers = table.find('thead th').map((_, el) => $(el).text().trim()).get();
    const totalIdx   = headers.indexOf('計');
    const hitsIdx    = headers.indexOf('安');
    const errorsIdx  = headers.indexOf('失');

    table.find('tbody tr').each((rowIdx, row) => {
      const cells = $(row).find('td').map((_, el) => $(el).text().trim()).get();
      // cells[0] = 隊名縮寫, cells[1..9] = 各局, cells[totalIdx-1] = 計 (offset by 1 because th is first col)
      // 實際 index 要減 1（因為第一列是 th 隊名）
      const isAway = rowIdx === 0;

      if (totalIdx > 0) {
        const val = parseInt(cells[totalIdx - 1]);
        if (!isNaN(val)) { if (isAway) totalAway = val; else totalHome = val; }
      }
      if (hitsIdx > 0) {
        const val = parseInt(cells[hitsIdx - 1]);
        if (!isNaN(val)) { if (isAway) hitsAway = val; else hitsHome = val; }
      }
      if (errorsIdx > 0) {
        const val = parseInt(cells[errorsIdx - 1]);
        if (!isNaN(val)) { if (isAway) errorsAway = val; else errorsHome = val; }
      }

      // 各局 (index 1 ~ 9, header index 1~9)
      for (let i = 1; i <= 9; i++) {
        const cellVal = cells[i]; // cells[0]=隊名, cells[i]=第 i 局
        if (!cellVal) continue;
        const score = cellVal === 'X' ? 0 : parseInt(cellVal);
        if (isNaN(score)) continue;
        const existing = innings.find(x => x.inning === i);
        if (existing) {
          if (!isAway) existing.score_home = score;
        } else {
          innings.push({
            inning: i,
            score_away: isAway ? score : null,
            score_home: !isAway ? score : null,
          });
        }
      }
    });

    return { gameId, awayTeam, homeTeam, totalAway, totalHome, hitsAway, hitsHome, errorsAway, errorsHome, innings, status, gameDate, venue, startTime };
  } catch (err) {
    console.warn(`[Yahoo Farm] 抓取 ${gameId} 失敗:`, (err as Error).message);
    return null;
  }
}

const TEAM_CODES: Record<string, string> = {
  '日本ハム': 'F', 'ロッテ': 'M', '楽天': 'E', '西武': 'L',
  'オリックス': 'B', 'ソフトバンク': 'H', '巨人': 'G', 'DeNA': 'DB',
  '阪神': 'T', '広島': 'C', '中日': 'D', 'ヤクルト': 'S',
  'くふうハヤテ': 'KH', 'オイシックス': 'ON',
};

// ─── 寫入 DB ──────────────────────────────────────────────────────────────────

// allowScheduled = true 時允許建立 scheduled 狀態的比賽（賽程爬蟲用）
// 獨立聯盟球隊（くふうハヤテ・オイシックス）：只有這兩隊才允許 Yahoo 新增場次
const INDEPENDENT_TEAMS = new Set(['くふうハヤテ', 'オイシックス']);

async function upsertFarmGame(data: YahooFarmGameData, allowScheduled = false): Promise<number | null> {
  const yahooPath = `/npb/game/${data.gameId}`;

  // 找現有比賽（by date + teams，允許 home/away 互換）
  const existing = await pool.query<{ id: number }>(
    `SELECT id FROM games
     WHERE league = 'NPB2'
       AND ((team_away = $1 AND team_home = $2) OR (team_away = $2 AND team_home = $1))
       AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $3::date
     LIMIT 1`,
    [data.awayTeam, data.homeTeam, data.gameDate],
  );

  let gameId: number;

  if (existing.rows.length > 0) {
    gameId = existing.rows[0].id;
    await pool.query(
      `UPDATE games
       SET score_away = $1, score_home = $2, status = $3,
           venue = COALESCE($4, venue),
           npb_url = COALESCE(npb_url, $5)
       WHERE id = $6`,
      [data.totalAway, data.totalHome, data.status, data.venue, yahooPath, gameId],
    );
  } else {
    if (!allowScheduled && data.status === 'scheduled') return null;

    const isIndependent = INDEPENDENT_TEAMS.has(data.homeTeam) || INDEPENDENT_TEAMS.has(data.awayTeam);
    if (!isIndependent) {
      // 若這兩支球隊當天在 NPB 一軍對戰（league='NPB'），代表 Yahoo 抓到的是一軍比賽，跳過
      const npbMatch = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM games
         WHERE league = 'NPB'
           AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
           AND ((team_home = $2 AND team_away = $3) OR (team_home = $3 AND team_away = $2))`,
        [data.gameDate, data.homeTeam, data.awayTeam],
      );
      if (parseInt(npbMatch.rows[0].count, 10) > 0) {
        console.log(`[Yahoo Farm] 跳過一軍重複場次: ${data.awayTeam}@${data.homeTeam} ${data.gameDate}`);
        return null;
      }

      // 若該球隊當日已有非 Yahoo 來源的二軍場次（npb.jp），也跳過
      const farmExists = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM games
         WHERE league = 'NPB2'
           AND npb_url NOT LIKE '/npb/game/%'
           AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
           AND (team_home = $2 OR team_home = $3 OR team_away = $2 OR team_away = $3)`,
        [data.gameDate, data.homeTeam, data.awayTeam],
      );
      if (parseInt(farmExists.rows[0].count, 10) > 0) {
        return null;
      }
    }
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO games (league, team_away, team_home, score_away, score_home, status, game_date, venue, npb_url)
       VALUES ('NPB2', $1, $2, $3, $4, $5, ($6 || 'T' || $9 || ':00+09:00')::timestamptz, $7, $8)
       RETURNING id`,
      [data.awayTeam, data.homeTeam, data.totalAway, data.totalHome, data.status,
       data.gameDate, data.venue, yahooPath, data.startTime ?? '12:00'],
    );
    gameId = ins.rows[0].id;
  }

  // 更新 game_stats (安打/失策)
  if (data.hitsAway !== null || data.hitsHome !== null) {
    await pool.query(
      `INSERT INTO game_stats (game_id, hits_away, hits_home, errors_away, errors_home)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (game_id) DO UPDATE
         SET hits_away   = COALESCE(EXCLUDED.hits_away, game_stats.hits_away),
             hits_home   = COALESCE(EXCLUDED.hits_home, game_stats.hits_home),
             errors_away = COALESCE(EXCLUDED.errors_away, game_stats.errors_away),
             errors_home = COALESCE(EXCLUDED.errors_home, game_stats.errors_home)`,
      [gameId, data.hitsAway, data.hitsHome, data.errorsAway, data.errorsHome],
    );
  }

  // 更新各局比分
  for (const inn of data.innings) {
    if (inn.score_away === null && inn.score_home === null) continue;
    await pool.query(
      `INSERT INTO game_innings (game_id, inning, score_away, score_home)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, inning) DO UPDATE
         SET score_away = COALESCE(EXCLUDED.score_away, game_innings.score_away),
             score_home = COALESCE(EXCLUDED.score_home, game_innings.score_home)`,
      [gameId, inn.inning, inn.score_away, inn.score_home],
    );
  }

  return gameId;
}

// ─── 抓單場成績（/stats 頁面）────────────────────────────────────────────────

export async function scrapeYahooFarmStats(gameId: string): Promise<YahooFarmStatsData | null> {
  try {
    const r = await axios.get(`${YAHOO_BASE}/npb/game/${gameId}/stats`, {
      headers: HEADERS, timeout: 15000,
    });
    const $ = cheerio.load(r.data);

    // ── Helper: find column index by name ──────────────────────────────────────
    function colIdx(headers: string[], ...names: string[]): number {
      return headers.findIndex(h => names.some(n => h.includes(n)));
    }

    // ── Parse batting table ────────────────────────────────────────────────────
    function parseBatters(tbl: ReturnType<typeof $>): YahooFarmBatter[] {
      const hdrs = tbl.find('thead th').map((_, el) => $(el).text().trim()).get();
      const pos  = colIdx(hdrs, '守備', '守');
      const name = colIdx(hdrs, '選手名', '名前');
      const ab   = colIdx(hdrs, '打数', 'AB');
      const hit  = colIdx(hdrs, '安打', '安');
      const hr   = colIdx(hdrs, '本塁打', 'HR');
      const rbi  = colIdx(hdrs, '打点');
      const bb   = colIdx(hdrs, '四球', '四');
      const hbp  = colIdx(hdrs, '死球', '死');
      const so   = colIdx(hdrs, '三振', '振');

      const rows: YahooFarmBatter[] = [];
      tbl.find('tbody tr').each((_, tr) => {
        const cells = $(tr).find('td').map((_, el) => $(el).text().trim()).get();
        if (cells.length < 3) return;
        const playerName = name >= 0 ? cells[name] : cells[cells.length > 3 ? 2 : 1];
        if (!playerName || playerName === '計' || playerName === '合計') return;
        rows.push({
          position:    pos >= 0  ? cells[pos]  : '',
          player_name: playerName,
          ab:   ab  >= 0 ? (parseInt(cells[ab])  || 0) : 0,
          hits: hit >= 0 ? (parseInt(cells[hit]) || 0) : 0,
          hr:   hr  >= 0 ? (parseInt(cells[hr])  || 0) : 0,
          rbi:  rbi >= 0 ? (parseInt(cells[rbi]) || 0) : 0,
          bb:   bb  >= 0 ? (parseInt(cells[bb])  || 0) : 0,
          hbp:  hbp >= 0 ? (parseInt(cells[hbp]) || 0) : 0,
          so:   so  >= 0 ? (parseInt(cells[so])  || 0) : 0,
        });
      });
      return rows;
    }

    // ── Parse pitching table ───────────────────────────────────────────────────
    function parsePitchers(tbl: ReturnType<typeof $>): YahooFarmPitcher[] {
      const hdrs = tbl.find('thead th').map((_, el) => $(el).text().trim()).get();
      const name    = colIdx(hdrs, '選手名', '名前');
      const result  = colIdx(hdrs, '結果', '勝敗');
      const ip      = colIdx(hdrs, '投球回', 'IP', '回');
      const batters = colIdx(hdrs, '打者');
      const hit     = colIdx(hdrs, '被安打', '安');
      const bb      = colIdx(hdrs, '与四球', '四');
      const hbp     = colIdx(hdrs, '与死球', '死');
      const so      = colIdx(hdrs, '奪三振', '振');
      const er      = colIdx(hdrs, '自責点', '自責');

      const rows: YahooFarmPitcher[] = [];
      tbl.find('tbody tr').each((_, tr) => {
        const cells = $(tr).find('td').map((_, el) => $(el).text().trim()).get();
        if (cells.length < 3) return;
        const playerName = name >= 0 ? cells[name] : cells[0];
        if (!playerName) return;
        rows.push({
          player_name:  playerName,
          result:       result >= 0 ? cells[result] : '',
          ip:           ip >= 0 ? cells[ip] : '',
          batters:      batters >= 0 ? (parseInt(cells[batters]) || 0) : 0,
          hits_allowed: hit >= 0 ? (parseInt(cells[hit]) || 0) : 0,
          bb:           bb  >= 0 ? (parseInt(cells[bb])  || 0) : 0,
          hbp:          hbp >= 0 ? (parseInt(cells[hbp]) || 0) : 0,
          so:           so  >= 0 ? (parseInt(cells[so])  || 0) : 0,
          er:           er  >= 0 ? (parseInt(cells[er])  || 0) : 0,
        });
      });
      return rows;
    }

    // ── Classify tables by header content ─────────────────────────────────────
    const battingTables:  ReturnType<typeof $>[] = [];
    const pitchingTables: ReturnType<typeof $>[] = [];

    $('.bb-statsTable').each((_, tbl) => {
      const tblEl = $(tbl);
      const hdrText = tblEl.find('thead').text();
      if (hdrText.includes('投球回') || hdrText.includes('奪三振') || hdrText.includes('与四球')) {
        pitchingTables.push(tblEl);
      } else if (hdrText.includes('打数') || hdrText.includes('安打') || hdrText.includes('打点')) {
        battingTables.push(tblEl);
      }
    });

    // ── Win/loss pitcher from page text ───────────────────────────────────────
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const winM  = bodyText.match(/勝利投手[：:\s]*([^\s,　]+)/);
    const lossM = bodyText.match(/敗戦投手[：:\s]*([^\s,　]+)/);
    const saveM = bodyText.match(/セーブ投手[：:\s]*([^\s,　]+)/);

    return {
      winPitcher:   winM?.[1]  ?? null,
      lossPitcher:  lossM?.[1] ?? null,
      savePitcher:  saveM?.[1] ?? null,
      awayBatters:  battingTables[0]  ? parseBatters(battingTables[0])  : [],
      homeBatters:  battingTables[1]  ? parseBatters(battingTables[1])  : [],
      awayPitchers: pitchingTables[0] ? parsePitchers(pitchingTables[0]) : [],
      homePitchers: pitchingTables[1] ? parsePitchers(pitchingTables[1]) : [],
    };
  } catch (err) {
    console.warn(`[Yahoo Farm Stats] 抓取 ${gameId} 失敗:`, (err as Error).message);
    return null;
  }
}

// ─── 抓文字速報（/text 頁面）────────────────────────────────────────────────

async function scrapeYahooFarmText(gameId: string, dbGameId: number): Promise<number> {
  try {
    const r = await axios.get(`${YAHOO_BASE}/npb/game/${gameId}/text`, {
      headers: HEADERS, timeout: 15000,
    });
    const $ = cheerio.load(r.data);

    // Clear existing PBP for this game then re-insert
    await pool.query(`DELETE FROM game_play_by_play WHERE game_id = $1`, [dbGameId]);

    let playOrder = 0;
    let currentInning = 1;
    let currentIsTop = true;

    // Strategy 1: structured sections with inning headers
    const sections = $('.bb-liveText__section, .bb-gameText__section');
    if (sections.length > 0) {
      sections.each((_, section) => {
        const sectionEl = $(section);
        const headerText = sectionEl.find('h2,h3,h4,[class*="heading"],[class*="inning"]').first().text().trim();
        const inningMatch = headerText.match(/(\d+)回(表|裏)/);
        if (inningMatch) {
          currentInning = parseInt(inningMatch[1]);
          currentIsTop = inningMatch[2] === '表';
        }
        sectionEl.find('[class*="item"],[class*="play"],li,p').each((_, item) => {
          const text = $(item).text().trim().replace(/\s+/g, ' ');
          if (text.length < 4) return;
          pool.query(
            `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description) VALUES ($1,$2,$3,$4,$5)`,
            [dbGameId, currentInning, currentIsTop, playOrder++, text],
          ).catch(() => {});
        });
      });
    }

    // Strategy 2: flat list — parse inning from items that look like "N回表" headers
    if (playOrder === 0) {
      $('.bb-liveText li, .bb-liveText__item, [class*="liveText"] li').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 4) return;
        const inningM = text.match(/^(\d+)回(表|裏)/);
        if (inningM && text.length < 15) {
          currentInning = parseInt(inningM[1]);
          currentIsTop = inningM[2] === '表';
          return; // header row, not a play
        }
        pool.query(
          `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description) VALUES ($1,$2,$3,$4,$5)`,
          [dbGameId, currentInning, currentIsTop, playOrder++, text],
        ).catch(() => {});
      });
    }

    // Strategy 3: any element with play-like text (>10 chars, not pure navigation)
    if (playOrder === 0) {
      $('[class*="play"],[class*="text"] li, article li').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length < 8 || text.length > 300) return;
        pool.query(
          `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description) VALUES ($1,$2,$3,$4,$5)`,
          [dbGameId, currentInning, currentIsTop, playOrder++, text],
        ).catch(() => {});
      });
    }

    console.log(`[Yahoo Farm Text] game ${gameId} → ${playOrder} 個速報事件`);
    return playOrder;
  } catch (err) {
    console.warn(`[Yahoo Farm Text] 抓取 ${gameId} 失敗:`, (err as Error).message);
    return 0;
  }
}

// ─── 儲存打者/投手成績 ────────────────────────────────────────────────────────

async function saveYahooFarmStats(
  dbGameId: number,
  stats: YahooFarmStatsData,
  awayTeam: string,
  homeTeam: string,
): Promise<void> {
  const awayCode = TEAM_CODES[awayTeam] ?? awayTeam.slice(0, 5);
  const homeCode = TEAM_CODES[homeTeam] ?? homeTeam.slice(0, 5);

  // Clear existing stats for this game
  await pool.query(`DELETE FROM game_batter_stats WHERE game_id = $1`, [dbGameId]);
  await pool.query(`DELETE FROM game_pitcher_stats WHERE game_id = $1`, [dbGameId]);

  // Insert batter stats
  const insertBatter = async (b: YahooFarmBatter, teamCode: string, order: number) => {
    await pool.query(
      `INSERT INTO game_batter_stats
         (game_id, team_code, batting_order, position, player_name, at_bats, hits, rbi, home_runs, strikeouts, walks, hit_by_pitch)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [dbGameId, teamCode, order, b.position, b.player_name, b.ab, b.hits, b.rbi, b.hr, b.so, b.bb, b.hbp],
    );
  };

  for (let i = 0; i < stats.awayBatters.length; i++) {
    await insertBatter(stats.awayBatters[i], awayCode, i + 1).catch(() => {});
  }
  for (let i = 0; i < stats.homeBatters.length; i++) {
    await insertBatter(stats.homeBatters[i], homeCode, i + 1).catch(() => {});
  }

  // Insert pitcher stats
  const insertPitcher = async (p: YahooFarmPitcher, teamCode: string, order: number) => {
    await pool.query(
      `INSERT INTO game_pitcher_stats
         (game_id, team_code, pitcher_order, player_name, innings_pitched, hits_allowed, earned_runs, walks, strikeouts, result, hit_by_pitch)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [dbGameId, teamCode, order, p.player_name, p.ip, p.hits_allowed, p.er, p.bb, p.so, p.result, p.hbp],
    );
  };

  for (let i = 0; i < stats.awayPitchers.length; i++) {
    await insertPitcher(stats.awayPitchers[i], awayCode, i + 1).catch(() => {});
  }
  for (let i = 0; i < stats.homePitchers.length; i++) {
    await insertPitcher(stats.homePitchers[i], homeCode, i + 1).catch(() => {});
  }

  // Update win/loss/save pitcher in game_stats
  if (stats.winPitcher || stats.lossPitcher || stats.savePitcher) {
    await pool.query(
      `INSERT INTO game_stats (game_id, win_pitcher, loss_pitcher, save_pitcher)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (game_id) DO UPDATE
         SET win_pitcher  = COALESCE(EXCLUDED.win_pitcher, game_stats.win_pitcher),
             loss_pitcher = COALESCE(EXCLUDED.loss_pitcher, game_stats.loss_pitcher),
             save_pitcher = COALESCE(EXCLUDED.save_pitcher, game_stats.save_pitcher)`,
      [dbGameId, stats.winPitcher, stats.lossPitcher, stats.savePitcher],
    );
  }

  console.log(`[Yahoo Farm Stats] game ${dbGameId} → away ${stats.awayBatters.length}打/${stats.awayPitchers.length}投, home ${stats.homeBatters.length}打/${stats.homePitchers.length}投`);
}

// ─── 單場手動爬取（供 API 呼叫）──────────────────────────────────────────────

export async function scrapeYahooGameById(gameId: string): Promise<{
  gameDbId: number | null;
  status: string;
  pbpCount: number;
  battersAway: number;
  battersHome: number;
  message: string;
}> {
  const data = await scrapeYahooFarmGame(gameId, true /* anyDate */);
  if (!data) {
    return { gameDbId: null, status: 'error', pbpCount: 0, battersAway: 0, battersHome: 0, message: `無法取得 gameId=${gameId} 的比賽資料` };
  }

  const dbId = await upsertFarmGame(data, true);
  if (!dbId) {
    return { gameDbId: null, status: data.status, pbpCount: 0, battersAway: 0, battersHome: 0, message: '找不到或無法建立比賽記錄' };
  }

  const pbpCount = await scrapeYahooFarmText(gameId, dbId);

  let battersAway = 0;
  let battersHome = 0;
  if (data.status === 'final' || data.status === 'live') {
    const statsData = await scrapeYahooFarmStats(gameId);
    if (statsData) {
      await saveYahooFarmStats(dbId, statsData, data.awayTeam, data.homeTeam);
      battersAway = statsData.awayBatters.length;
      battersHome = statsData.homeBatters.length;
    }
  }

  return {
    gameDbId: dbId,
    status: data.status,
    pbpCount,
    battersAway,
    battersHome,
    message: `✅ ${data.awayTeam} vs ${data.homeTeam} (${data.gameDate}) 已更新`,
  };
}

// ─── 月別賽程爬蟲 ─────────────────────────────────────────────────────────────

async function fetchFarmScheduleForMonth(year: number, month: number): Promise<number> {
  const ym = `${year}${String(month).padStart(2, '0')}`;
  let inserted = 0;

  // 嘗試 Yahoo farm 月別賽程（?type=farm&ym=YYYYMM）
  for (const url of [
    `${YAHOO_BASE}/npb/schedule/?type=farm&ym=${ym}`,
    `${YAHOO_BASE}/npb/schedule/?type=farm`,
  ]) {
    try {
      const r = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const $ = cheerio.load(r.data);

      // 收集該月所有二軍比賽 ID（從 /npb/game/{id}/ 連結）
      const gameIds = new Set<string>();
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        const m = href?.match(/\/npb\/game\/(\d+)\//);
        if (m) gameIds.add(m[1]);
      });

      if (gameIds.size === 0) continue;
      console.log(`[Yahoo Farm Sched] ${year}/${month} 發現 ${gameIds.size} 個比賽 ID`);

      // 逐一確認並寫入 DB（含預定賽）
      for (const gid of gameIds) {
        try {
          const data = await scrapeYahooFarmGame(gid, true);
          if (!data) continue;
          await upsertFarmGame(data, true); // allowScheduled = true
          inserted++;
          await new Promise(res => setTimeout(res, 400));
        } catch { /* skip */ }
      }
      break; // 成功後不再嘗試下一個 URL
    } catch { /* try next */ }
  }

  return inserted;
}

// ─── 主函式 ───────────────────────────────────────────────────────────────────

export interface YahooFarmScraperStatus {
  isRunning: boolean;
  lastRun: string | null;
  lastResult: string | null;
  gamesUpdated: number;
}

export const yahooFarmScraperStatus: YahooFarmScraperStatus = {
  isRunning: false,
  lastRun: null,
  lastResult: null,
  gamesUpdated: 0,
};

export async function runYahooFarmScraper(): Promise<{ updated: number; message: string }> {
  if (yahooFarmScraperStatus.isRunning) {
    return { updated: 0, message: '爬蟲正在執行中' };
  }
  yahooFarmScraperStatus.isRunning = true;
  yahooFarmScraperStatus.lastRun = new Date().toISOString();

  try {
    const gameIds = await fetchTodayFarmGameIds();
    console.log(`[Yahoo Farm] 找到 ${gameIds.length} 場今日二軍比賽`);

    let updated = 0;
    for (const gid of gameIds) {
      const data = await scrapeYahooFarmGame(gid);
      if (!data) continue;
      if (data.status === 'scheduled') {
        // Only register npb_url on existing records — don't create new rows for scheduled games
        await pool.query(
          `UPDATE games SET npb_url = COALESCE(npb_url, $1)
           WHERE league = 'NPB2'
             AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $2::date
             AND ((team_away = $3 AND team_home = $4) OR (team_away = $4 AND team_home = $3))`,
          [`/npb/game/${data.gameId}`, data.gameDate, data.awayTeam, data.homeTeam],
        );
        continue;
      }
      const dbId = await upsertFarmGame(data);
      if (dbId) {
        updated++;
        // Scrape text play-by-play
        await scrapeYahooFarmText(gid, dbId);
        await new Promise(r => setTimeout(r, 400));
        // Scrape batting/pitching stats (final games only to avoid incomplete data)
        if (data.status === 'final') {
          const statsData = await scrapeYahooFarmStats(gid);
          if (statsData) await saveYahooFarmStats(dbId, statsData, data.awayTeam, data.homeTeam);
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    const msg = `✅ Yahoo 二軍爬蟲：更新 ${updated} 場`;
    yahooFarmScraperStatus.lastResult = msg;
    yahooFarmScraperStatus.gamesUpdated = updated;
    yahooFarmScraperStatus.isRunning = false;
    console.log(`[Yahoo Farm] ${msg}`);
    return { updated, message: msg };

  } catch (err) {
    const msg = `❌ Yahoo 二軍爬蟲錯誤：${(err as Error).message}`;
    yahooFarmScraperStatus.lastResult = msg;
    yahooFarmScraperStatus.isRunning = false;
    return { updated: 0, message: msg };
  }
}

// ─── 月別賽程更新主函式 ────────────────────────────────────────────────────────

export interface YahooFarmScheduleScraperStatus {
  isRunning: boolean;
  lastRun: string | null;
  lastResult: string | null;
  gamesInserted: number;
}

export const yahooFarmScheduleStatus: YahooFarmScheduleScraperStatus = {
  isRunning: false,
  lastRun: null,
  lastResult: null,
  gamesInserted: 0,
};

export async function runYahooFarmScheduleScraper(
  year?: number, month?: number,
): Promise<{ inserted: number; message: string }> {
  if (yahooFarmScheduleStatus.isRunning) {
    return { inserted: 0, message: '賽程爬蟲正在執行中' };
  }
  yahooFarmScheduleStatus.isRunning = true;
  yahooFarmScheduleStatus.lastRun = new Date().toISOString();

  try {
    const now = new Date(Date.now() + 9 * 3600_000); // JST
    const y = year  ?? now.getUTCFullYear();
    const m = month ?? (now.getUTCMonth() + 1);

    console.log(`[Yahoo Farm Sched] 開始更新 ${y}/${m} 二軍賽程...`);
    let inserted = await fetchFarmScheduleForMonth(y, m);

    // 同時更新下個月
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    inserted += await fetchFarmScheduleForMonth(nextY, nextM);

    const msg = `✅ Yahoo 二軍賽程：新增/更新 ${inserted} 筆`;
    yahooFarmScheduleStatus.lastResult = msg;
    yahooFarmScheduleStatus.gamesInserted = inserted;
    yahooFarmScheduleStatus.isRunning = false;
    console.log(`[Yahoo Farm Sched] ${msg}`);
    return { inserted, message: msg };

  } catch (err) {
    const msg = `❌ Yahoo 二軍賽程錯誤：${(err as Error).message}`;
    yahooFarmScheduleStatus.lastResult = msg;
    yahooFarmScheduleStatus.isRunning = false;
    return { inserted: 0, message: msg };
  }
}
