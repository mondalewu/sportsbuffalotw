/**
 * NPB 二軍爬蟲 — npb.jp/farm/2026/
 *
 * 抓取目標:
 *  ① 賽程 / 比分    : https://npb.jp/farm/2026/
 *  ② 選手成績       : 各場 /scores/YYYY/MMDD/home-away-NN/box.html
 *  ③ 分區順位表     : 東地区 / 中地区 / 西地区
 *  ④ 全季賽程       : https://npb.jp/farm/2026/schedule_detail.html
 *
 * farm games 與一軍共用 /scores/YYYY/MMDD/home-away-NN/ URL 格式，
 * 因此直接 reuse npbScraper 的 fetchGameDetail / scrapeNpbBoxScore。
 * DB 中以 league = 'NPB2' 區分。
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';
import { fetchGameDetail } from './npbScraper';

const NPB_BASE = 'https://npb.jp';
const FARM_MAIN_URL = 'https://npb.jp/farm/2026/';

// 3 separate standings pages — one per division
const FARM_STANDINGS_PAGES = [
  { url: 'https://npb.jp/bis/2026/stats/std_2e.html', division: '東地区', league: 'NPB2-East' },
  { url: 'https://npb.jp/bis/2026/stats/std_2c.html', division: '中地区', league: 'NPB2-Central' },
  { url: 'https://npb.jp/bis/2026/stats/std_2w.html', division: '西地区', league: 'NPB2-West' },
] as const;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://npb.jp/',
};

// 二軍コード → 短縮名（一軍 12 球団 + 農場専用チーム）
const FARM_CODE_TO_NAME: Record<string, string> = {
  'g': '巨人', 'db': 'DeNA', 't': '阪神', 'c': '広島',
  'd': '中日', 's': 'ヤクルト', 'l': '西武', 'e': '楽天',
  'h': 'ソフトバンク', 'f': '日本ハム', 'm': 'ロッテ', 'b': 'オリックス',
  // 農場専用
  'v': 'くふうハヤテ', 'o': 'オイシックス', 'a': '阪神', // 'a' sometimes alternate
};

// 長い正式名 → 短縮名
const FULL_TO_SHORT: Record<string, string> = {
  '北海道日本ハムファイターズ': '日本ハム',
  '千葉ロッテマリーンズ': 'ロッテ',
  '東北楽天ゴールデンイーグルス': '楽天',
  '埼玉西武ライオンズ': '西武',
  'オリックス・バファローズ': 'オリックス',
  'オリックスバファローズ': 'オリックス',
  '福岡ソフトバンクホークス': 'ソフトバンク',
  '読売ジャイアンツ': '巨人',
  '横浜ＤｅＮＡベイスターズ': 'DeNA',
  '横浜DeNAベイスターズ': 'DeNA',
  '阪神タイガース': '阪神',
  '広島東洋カープ': '広島',
  '中日ドラゴンズ': '中日',
  '東京ヤクルトスワローズ': 'ヤクルト',
  'ヤクルトスワローズ': 'ヤクルト',
  'くふうハヤテベンチャーズ静岡': 'くふうハヤテ',
  'くふうハヤテ': 'くふうハヤテ',
  'ハヤテ': 'くふうハヤテ',
  'オイシックスOE': 'オイシックス',
  'オイシックス': 'オイシックス',
};

function normalizeTeamName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  if (FULL_TO_SHORT[t]) return FULL_TO_SHORT[t];
  for (const [k, v] of Object.entries(FULL_TO_SHORT)) {
    if (t.includes(k)) return v;
  }
  return t;
}

// ─── 型別 ─────────────────────────────────────────────────────────────────────

export interface FarmStanding {
  division: string;  // '東地区' | '中地区' | '西地区'
  team: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  games_behind: number | null;
  rank: number;
}

export interface NpbFarmScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesUpdated: number;
  isRunning: boolean;
  lastError: string | null;
}

export const npbFarmScraperStatus: NpbFarmScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  gamesUpdated: 0,
  isRunning: false,
  lastError: null,
};

// ─── Step 1: 月別賽程 + 比賽連結 ──────────────────────────────────────────────

interface FarmGameRow {
  dateStr: string;      // YYYY-MM-DD (JST)
  awayTeam: string;
  homeTeam: string;
  scoreAway: number | null;
  scoreHome: number | null;
  status: 'scheduled' | 'final';
  venue: string | null;
  startTime: string | null;
  winPitcher: string | null;
  lossPitcher: string | null;
  scoresUrl: string | null;  // /scores/... URL for fetchGameDetail
}

/**
 * npb.jp/farm/2026/schedule_MM_detail.html から月別賽程を取得
 * 対戦カード列から away-home を抽出し、/scores/ リンクがあれば URL も保存
 */
async function fetchFarmScheduleMonth(year: number, month: number): Promise<FarmGameRow[]> {
  const mm = String(month).padStart(2, '0');
  const url = `${NPB_BASE}/farm/${year}/schedule_${mm}_detail.html`;

  try {
    const res = await axios.get(url, {
      timeout: 20000,
      headers: HEADERS,
      validateStatus: s => s < 500,
    });
    if (res.status === 404) return [];

    const $ = cheerio.load(res.data as string);
    const rows: FarmGameRow[] = [];

    // HTML structure for npb.jp/farm/YYYY/schedule_MM_detail.html:
    // - Date: <th class="saturday|sunday|..." rowspan="N">M/D（曜）</th>
    //         appears only on the first <tr> of each date group
    // - Team away: <div class="team1">チーム名</div>
    // - Team home: <div class="team2">チーム名</div>
    // - Scores:    <div class="score1">X</div> <div class="score2">Y</div>
    // - Game link: <a href="/bis/YYYY/games/fsNNNN.html">
    // - Venue:     <div class="place">球場</div>
    // - Time:      <div class="time">HH:MM</div>
    // - Pitchers:  <div class="pit">勝：名前</div> <div class="pit">敗：名前</div>

    let currentDate = '';

    $('table tbody tr').each((_, tr) => {
      const trEl = $(tr);

      // Check if this row has a <th> with a date (first row of a date group)
      const thDate = trEl.find('th').first();
      if (thDate.length) {
        const dateText = thDate.text().trim();
        const dateMatch = dateText.match(/(\d+)\/(\d+)/);
        if (dateMatch) {
          const gMonth = parseInt(dateMatch[1]);
          const gDay   = parseInt(dateMatch[2]);
          currentDate = `${year}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
        }
      }

      if (!currentDate) return;

      // ─ Teams ──────────────────────────────────────────────────────────
      const awayTeamRaw = trEl.find('.team1').first().text().trim();
      const homeTeamRaw = trEl.find('.team2').first().text().trim();

      if (!awayTeamRaw || !homeTeamRaw) return;

      const awayTeam = normalizeTeamName(awayTeamRaw);
      const homeTeam = normalizeTeamName(homeTeamRaw);

      // ─ Scores ─────────────────────────────────────────────────────────
      const score1Text = trEl.find('.score1').first().text().trim();
      const score2Text = trEl.find('.score2').first().text().trim();
      const scoreAway = score1Text !== '' && /^\d+$/.test(score1Text) ? parseInt(score1Text) : null;
      const scoreHome = score2Text !== '' && /^\d+$/.test(score2Text) ? parseInt(score2Text) : null;
      const status: 'scheduled' | 'final' = scoreAway !== null ? 'final' : 'scheduled';

      // ─ Game link: /bis/YYYY/games/fsNNNN.html ─────────────────────────
      let scoresUrl: string | null = null;
      const gameHref = trEl.find('a[href*="/bis/"][href*="/games/"]').first().attr('href')
        ?? trEl.find('a[href*="/scores/"]').first().attr('href')
        ?? null;
      if (gameHref) scoresUrl = gameHref;

      // ─ Venue + start time ─────────────────────────────────────────────
      const venueText = trEl.find('.place').first().text().trim() || null;
      const timeText  = trEl.find('.time').first().text().trim();
      const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
      const startTime = timeMatch?.[1] ?? null;

      // ─ Pitchers ───────────────────────────────────────────────────────
      let winPitcher: string | null = null;
      let lossPitcher: string | null = null;
      trEl.find('.pit').each((_, pit) => {
        const t = $(pit).text().trim();
        const wm = t.match(/勝[：:]\s*(\S+)/);
        const lm = t.match(/[負敗][：:]\s*(\S+)/);
        if (wm) winPitcher = wm[1];
        if (lm) lossPitcher = lm[1];
      });

      rows.push({
        dateStr: currentDate, awayTeam, homeTeam, scoreAway, scoreHome, status,
        venue: venueText, startTime,
        winPitcher, lossPitcher,
        scoresUrl,
      });
    });

    console.log(`[NPB Farm] schedule_${mm}: ${rows.length} 行`);
    return rows;
  } catch (e) {
    console.warn(`[NPB Farm] schedule_${mm}_detail 取得失敗:`, (e as Error).message);
    return [];
  }
}

// Today-only game link collector — farm games use /bis/YYYY/games/fsNNNN.html
async function fetchFarmGameLinksToday(): Promise<string[]> {
  const seen = new Set<string>();
  const links: string[] = [];
  try {
    const res = await axios.get(FARM_MAIN_URL, { timeout: 15000, headers: HEADERS });
    const $ = cheerio.load(res.data as string);
    // Farm box score links (/bis/.../games/fs*.html)
    $('a[href*="/bis/"][href*="/games/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const full = href.startsWith('http') ? href : `${NPB_BASE}${href}`;
      if (!seen.has(full)) { seen.add(full); links.push(full); }
    });
    // Note: Do NOT include /scores/ fallback here — those are 一軍 URLs and would
    // pollute NPB2 with first-team games.
  } catch (e) {
    console.warn('[NPB Farm] fetchFarmGameLinksToday 失敗:', (e as Error).message);
  }
  return links;
}

// ─── Step 2: 分區順位表 ────────────────────────────────────────────────────────

export async function fetchFarmStandings(): Promise<FarmStanding[]> {
  const all: FarmStanding[] = [];

  for (const page of FARM_STANDINGS_PAGES) {
    try {
      const res = await axios.get(page.url, {
        timeout: 15000,
        headers: HEADERS,
        validateStatus: s => s === 200,
      });
      const $ = cheerio.load(res.data as string);

      // std_2e/c/w.html: page has 3 tablefix2 tables (standings, home/road, interleague)
      // Only the FIRST table has actual standings; subsequent tables would overwrite with zeros
      // Columns: 球団 | 試合 | 勝 | 敗 | 分 | 勝率 | 差 | ホーム | ...
      let rank = 0;
      $('table.tablefix2').first().find('tbody tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 6) return;

        const rawName = cells.eq(0).text().trim();
        if (!rawName || /^\d/.test(rawName)) return; // skip rank-only or empty rows

        const teamName = normalizeTeamName(rawName);
        if (!teamName) return;

        rank++;
        const games   = parseInt(cells.eq(1).text().trim()) || 0;
        const wins    = parseInt(cells.eq(2).text().trim()) || 0;
        const losses  = parseInt(cells.eq(3).text().trim()) || 0;
        const draws   = parseInt(cells.eq(4).text().trim()) || 0;
        const winRate = parseFloat(cells.eq(5).text().trim()) || 0;
        const gbRaw   = cells.eq(6)?.text().trim() ?? '--';
        const gb      = /^[\-–]+$/.test(gbRaw) || gbRaw === '' ? null : parseFloat(gbRaw);

        all.push({ division: page.division, team: teamName, games, wins, losses, draws, win_rate: winRate, games_behind: gb, rank });
      });

      console.log(`[NPB Farm] ${page.division} 順位表: ${rank} 支球隊`);
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.warn(`[NPB Farm] 無法取得 ${page.division} 順位表:`, (e as Error).message);
    }
  }

  return all;
}

// ─── Step 2b: 月別賽程から DB に upsert ───────────────────────────────────────

async function upsertFarmGameFromSchedule(row: FarmGameRow): Promise<number | null> {
  const timePart = row.startTime ?? '12:00';
  const gameTs = `${row.dateStr}T${timePart}:00+09:00`;

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO games
         (league, team_home, team_away, score_home, score_away, status, game_detail, venue, game_date, npb_url)
       VALUES ('NPB2', $1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo')) DO UPDATE
         SET score_home  = COALESCE(EXCLUDED.score_home, games.score_home),
             score_away  = COALESCE(EXCLUDED.score_away, games.score_away),
             status      = CASE WHEN EXCLUDED.status = 'final' THEN 'final'::text ELSE games.status END,
             game_detail = COALESCE(NULLIF(EXCLUDED.game_detail, '試合開始前'), games.game_detail),
             venue       = COALESCE(EXCLUDED.venue, games.venue),
             npb_url     = COALESCE(EXCLUDED.npb_url, games.npb_url)
       RETURNING id`,
      [
        row.homeTeam, row.awayTeam,
        row.scoreHome, row.scoreAway,
        row.status,
        row.status === 'final' ? '試合終了' : '試合開始前',
        row.venue, gameTs,
        row.scoresUrl ?? null,
      ],
    );
    const gameId = result.rows[0]?.id ?? null;

    // 勝敗投手を game_stats に保存（Docomo が提供しない情報はスケジュールページから取得）
    if (gameId && (row.winPitcher || row.lossPitcher)) {
      await pool.query(
        `INSERT INTO game_stats (game_id, win_pitcher, loss_pitcher)
         VALUES ($1, $2, $3)
         ON CONFLICT (game_id) DO UPDATE
           SET win_pitcher  = COALESCE(EXCLUDED.win_pitcher,  game_stats.win_pitcher),
               loss_pitcher = COALESCE(EXCLUDED.loss_pitcher, game_stats.loss_pitcher),
               updated_at   = NOW()`,
        [gameId, row.winPitcher ?? null, row.lossPitcher ?? null],
      ).catch(() => {});
    }

    return gameId;
  } catch (e) {
    console.warn(`[NPB Farm Schedule] upsert失敗 ${row.dateStr} ${row.awayTeam}@${row.homeTeam}:`, (e as Error).message);
    return null;
  }
}

// ─── Step 3: 保存 farm game to DB as 'NPB2' ──────────────────────────────────

async function upsertFarmGame(gameUrl: string): Promise<number | null> {
  const detail = await fetchGameDetail(gameUrl);
  if (!detail) return null;

  const timeStr = detail.startTime ?? '12:00';
  const gameDateJST = `${detail.gameDate}T${timeStr}:00+09:00`;

  try {
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM games
       WHERE league = 'NPB2'
         AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
         AND team_home = $2 AND team_away = $3
       LIMIT 1`,
      [detail.gameDate, detail.homeTeam, detail.awayTeam],
    );

    let gameId: number;

    if (existing.rows.length > 0) {
      gameId = existing.rows[0].id;
      await pool.query(
        `UPDATE games SET
           score_home  = COALESCE($1, score_home),
           score_away  = COALESCE($2, score_away),
           status      = $3,
           game_detail = $4,
           venue       = COALESCE($5, venue)
         WHERE id = $6`,
        [detail.scoreHome, detail.scoreAway, detail.status, detail.gameDetail, detail.venue, gameId],
      );
    } else {
      const ins = await pool.query<{ id: number }>(
        `INSERT INTO games
           (league, team_home, team_away, score_home, score_away,
            status, game_detail, venue, game_date, npb_url)
         VALUES ('NPB2', $1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo')) DO UPDATE
           SET score_home  = EXCLUDED.score_home,
               score_away  = EXCLUDED.score_away,
               status      = EXCLUDED.status,
               game_detail = EXCLUDED.game_detail,
               venue       = COALESCE(EXCLUDED.venue, games.venue),
               npb_url     = COALESCE(EXCLUDED.npb_url, games.npb_url)
         RETURNING id`,
        [detail.homeTeam, detail.awayTeam, detail.scoreHome, detail.scoreAway,
         detail.status, detail.gameDetail, detail.venue, gameDateJST, detail.urlPath],
      );
      gameId = ins.rows[0]?.id;
      if (!gameId) return null;
    }

    // 各局比分
    for (const inn of detail.innings) {
      if (inn.scoreAway === null && inn.scoreHome === null) continue;
      await pool.query(
        `INSERT INTO game_innings (game_id, inning, score_away, score_home)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, inning) DO UPDATE
           SET score_away = EXCLUDED.score_away, score_home = EXCLUDED.score_home`,
        [gameId, inn.inning, inn.scoreAway, inn.scoreHome],
      );
    }

    return gameId;
  } catch (err) {
    console.warn('[NPB Farm] upsertFarmGame 失敗:', (err as Error).message,
      detail.homeTeam, 'vs', detail.awayTeam, detail.gameDate);
    return null;
  }
}

// ─── Step 4: 保存順位表 ───────────────────────────────────────────────────────

async function saveFarmStandings(standings: FarmStanding[]): Promise<void> {
  const DIVISION_LEAGUE: Record<string, string> = {
    '東地区': 'NPB2-East', '東': 'NPB2-East',
    '中地区': 'NPB2-Central', '中': 'NPB2-Central',
    '西地区': 'NPB2-West', '西': 'NPB2-West',
  };

  for (const s of standings) {
    const league = DIVISION_LEAGUE[s.division] ?? 'NPB2';
    try {
      await pool.query(
        `INSERT INTO standings (league, season, team_name, wins, losses, draws, win_rate, games_behind, rank)
         VALUES ($1, '2026', $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (league, season, team_name) DO UPDATE
           SET wins = EXCLUDED.wins, losses = EXCLUDED.losses, draws = EXCLUDED.draws,
               win_rate = EXCLUDED.win_rate, games_behind = EXCLUDED.games_behind,
               rank = EXCLUDED.rank, updated_at = NOW()`,
        [league, s.team, s.wins, s.losses, s.draws, s.win_rate, s.games_behind ?? 0, s.rank],
      );
    } catch (err) {
      console.warn('[NPB Farm] 順位保存失敗:', s.team, (err as Error).message);
    }
  }
}

// ─── 指定月份爬蟲 ─────────────────────────────────────────────────────────────

export async function runNpbFarmScraperMonth(year: number, month: number): Promise<{ updated: number; message: string }> {
  if (npbFarmScraperStatus.isRunning) {
    return { updated: 0, message: 'NPB 二軍爬蟲正在執行中' };
  }
  npbFarmScraperStatus.isRunning = true;
  npbFarmScraperStatus.lastRun = new Date().toISOString();
  npbFarmScraperStatus.lastError = null;

  try {
    const rows = await fetchFarmScheduleMonth(year, month);
    let updated = 0;
    for (const row of rows) {
      const gameId = await upsertFarmGameFromSchedule(row);
      if (gameId) updated++;
      // 二軍の成績（打者/投手成績・球種・速報）は Docomo API が唯一のソース。
      // npb.jp の box score で上書きしない。
      await new Promise(r => setTimeout(r, 100));
    }
    const msg = `✅ 二軍 ${year}年${month}月：更新 ${updated} 場`;
    npbFarmScraperStatus.lastResult = msg;
    npbFarmScraperStatus.gamesUpdated = updated;
    npbFarmScraperStatus.isRunning = false;
    return { updated, message: msg };
  } catch (err) {
    const msg = (err as Error).message;
    npbFarmScraperStatus.lastResult = `❌ ${msg}`;
    npbFarmScraperStatus.lastError = msg;
    npbFarmScraperStatus.isRunning = false;
    return { updated: 0, message: msg };
  }
}

// ─── Main: runNpbFarmScraper ──────────────────────────────────────────────────

/**
 * 主要エントリーポイント
 * - 当日の二軍試合を更新
 * - 分区順位表を更新
 * @param fullBackfill  true の場合は全季賽程を対象（全件補抓）
 */
/**
 * @param days     未來幾天範圍（0 = 只抓今天，≥30 = 全季）
 * @param pastDays 過去幾天範圍（只影響 fullBackfill 判定）
 */
export async function runNpbFarmScraper(days = 14, pastDays = 7): Promise<{ updated: number; message: string }> {
  if (npbFarmScraperStatus.isRunning) {
    return { updated: 0, message: 'NPB 二軍爬蟲正在執行中' };
  }

  npbFarmScraperStatus.isRunning = true;
  npbFarmScraperStatus.lastRun = new Date().toISOString();
  npbFarmScraperStatus.lastError = null;

  // days ≥ 30 → full season backfill (all game links); otherwise fetch today only
  const fullBackfill = days >= 30;

  try {
    // ① 順位表
    const standings = await fetchFarmStandings();
    if (standings.length > 0) {
      await saveFarmStandings(standings);
      console.log(`[NPB Farm] 順位表更新：${standings.length} 條`);
    } else {
      console.warn('[NPB Farm] 順位表無資料（可能賽季尚未開始）');
    }

    // ② 賽程 — parse monthly schedule pages
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
    const currentMonth = jstNow.getUTCMonth() + 1;
    const year = jstNow.getUTCFullYear();

    // Months to scrape: full backfill = 3-11, daily = current + next month
    const monthsToFetch = fullBackfill
      ? Array.from({ length: 9 }, (_, i) => i + 3) // [3,4,...,11]
      : [currentMonth, currentMonth + 1].filter(m => m <= 11);

    let updated = 0;
    for (const month of monthsToFetch) {
      const rows = await fetchFarmScheduleMonth(year, month);
      for (const row of rows) {
        const gameId = await upsertFarmGameFromSchedule(row);
        if (gameId) updated++;

        // 成績（打者/投手/球種）は Docomo API が唯一のソース。npb.jp box score は使わない。
        await new Promise(r => setTimeout(r, 100));
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // 今日の試合リンクから試合レコードのみ確保（成績は Docomo API に任せる）
    if (!fullBackfill) {
      const liveLinks = await fetchFarmGameLinksToday();
      for (const link of liveLinks) {
        await upsertFarmGame(link);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    const msg = `✅ NPB 二軍更新：${updated} 場，順位表 ${standings.length} 條`;
    npbFarmScraperStatus.lastResult = msg;
    npbFarmScraperStatus.gamesUpdated = updated;
    npbFarmScraperStatus.isRunning = false;
    console.log(`[NPB Farm] ${msg}`);
    return { updated, message: msg };

  } catch (err) {
    const msg = (err as Error).message;
    npbFarmScraperStatus.lastResult = `❌ 二軍爬蟲錯誤：${msg}`;
    npbFarmScraperStatus.lastError = msg;
    npbFarmScraperStatus.isRunning = false;
    return { updated: 0, message: msg };
  }
}

// ─── 30 秒更新：進行中の二軍試合 ─────────────────────────────────────────────

export async function runFarmLiveUpdate(): Promise<void> {
  try {
    // Include today's scheduled games with npb_url — farm games skip 'live' state
    const liveGames = await pool.query<{ id: number; npb_url: string | null; team_home: string; team_away: string }>(
      `SELECT id, npb_url, team_home, team_away FROM games
       WHERE league = 'NPB2'
         AND (status = 'live'
           OR (status = 'scheduled'
               AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = CURRENT_DATE AT TIME ZONE 'Asia/Tokyo'
               AND npb_url IS NOT NULL))`,
    );

    for (const row of liveGames.rows) {
      if (!row.npb_url) continue;

      // Yahoo Farm URLs (/npb/game/...) must use Yahoo API — skip here, handled by runYahooFarmScraper
      if (row.npb_url.startsWith('/npb/game/')) continue;

      const detail = await fetchGameDetail(`${NPB_BASE}${row.npb_url}`);
      if (!detail) continue;

      await pool.query(
        `UPDATE games SET score_home = $1, score_away = $2, status = $3, game_detail = $4
         WHERE id = $5`,
        [detail.scoreHome, detail.scoreAway, detail.status, detail.gameDetail, row.id],
      );

      // 各局比分同步
      for (const inn of detail.innings) {
        if (inn.scoreAway === null && inn.scoreHome === null) continue;
        await pool.query(
          `INSERT INTO game_innings (game_id, inning, score_away, score_home)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (game_id, inning) DO UPDATE
             SET score_away = EXCLUDED.score_away, score_home = EXCLUDED.score_home`,
          [row.id, inn.inning, inn.scoreAway, inn.scoreHome],
        );
      }

      // 成績（打者/投手/球種）は Docomo API が唯一のソース。box score 補抓しない。
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (err) {
    console.warn('[NPB Farm Live] 更新失敗:', (err as Error).message);
  }
}
