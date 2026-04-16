/**
 * NPB 一軍 順位表爬蟲
 * Central: https://npb.jp/bis/2026/stats/std_c.html
 * Pacific: https://npb.jp/bis/2026/stats/std_p.html
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const NPB_STANDINGS_PAGES = [
  { url: 'https://npb.jp/bis/2026/stats/std_c.html', division: 'セントラル', league: 'NPB-Central' },
  { url: 'https://npb.jp/bis/2026/stats/std_p.html', division: 'パシフィック', league: 'NPB-Pacific' },
] as const;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://npb.jp/',
};

const FULL_TO_SHORT: Record<string, string> = {
  '北海道日本ハムファイターズ': '日本ハム',
  '千葉ロッテマリーンズ': 'ロッテ',
  '東北楽天ゴールデンイーグルス': '楽天',
  '埼玉西武ライオンズ': '西武',
  'オリックス・バファローズ': 'オリックス',
  '福岡ソフトバンクホークス': 'ソフトバンク',
  '読売ジャイアンツ': '巨人',
  '横浜DeNAベイスターズ': 'DeNA',
  '横浜ＤｅＮＡベイスターズ': 'DeNA',
  '阪神タイガース': '阪神',
  '広島東洋カープ': '広島',
  '中日ドラゴンズ': '中日',
  '東京ヤクルトスワローズ': 'ヤクルト',
};

function normalizeTeamName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  if (FULL_TO_SHORT[t]) return FULL_TO_SHORT[t];
  for (const [k, v] of Object.entries(FULL_TO_SHORT)) {
    if (t.includes(k)) return v;
  }
  return t;
}

export interface NpbStanding {
  league: string;
  division: string;
  team: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  games_behind: number | null;
  rank: number;
  runs_scored?: number;
  runs_allowed?: number;
}

export interface NpbStandingsScraperStatus {
  lastRun: string | null;
  lastResult: string;
  isRunning: boolean;
  lastError: string | null;
}

export const npbStandingsScraperStatus: NpbStandingsScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  isRunning: false,
  lastError: null,
};

export async function fetchNpbStandings(): Promise<NpbStanding[]> {
  const all: NpbStanding[] = [];

  for (const page of NPB_STANDINGS_PAGES) {
    try {
      const res = await axios.get(page.url, {
        timeout: 15000,
        headers: HEADERS,
        validateStatus: s => s === 200,
      });
      const $ = cheerio.load(res.data as string);

      let rank = 0;
      $('table.tablefix2').first().find('tbody tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 6) return;

        const rawName = cells.eq(0).text().trim();
        if (!rawName || /^\d/.test(rawName)) return;

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

        all.push({
          league: page.league,
          division: page.division,
          team: teamName,
          games, wins, losses, draws,
          win_rate: winRate,
          games_behind: gb,
          rank,
        });
      });

      console.log(`[NPB Standings] ${page.division}: ${rank} 支球隊`);
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.warn(`[NPB Standings] 無法取得 ${page.division}:`, (e as Error).message);
    }
  }
  return all;
}

async function saveNpbStandings(standings: NpbStanding[]): Promise<void> {
  // 從 games 表計算各隊得失分
  const runsRes = await pool.query<{ team: string; runs_scored: number; runs_allowed: number }>(`
    SELECT team, SUM(scored) AS runs_scored, SUM(allowed) AS runs_allowed
    FROM (
      SELECT team_home AS team, COALESCE(score_home,0) AS scored, COALESCE(score_away,0) AS allowed
      FROM games WHERE league='NPB' AND status='final'
        AND EXTRACT(YEAR FROM game_date AT TIME ZONE 'Asia/Tokyo') = 2026
      UNION ALL
      SELECT team_away, COALESCE(score_away,0), COALESCE(score_home,0)
      FROM games WHERE league='NPB' AND status='final'
        AND EXTRACT(YEAR FROM game_date AT TIME ZONE 'Asia/Tokyo') = 2026
    ) t GROUP BY team`);
  const runsMap: Record<string, { runs_scored: number; runs_allowed: number }> = {};
  for (const row of runsRes.rows) {
    runsMap[row.team] = { runs_scored: Number(row.runs_scored), runs_allowed: Number(row.runs_allowed) };
  }

  await pool.query(`DELETE FROM standings WHERE league IN ('NPB-Central','NPB-Pacific') AND season = '2026'`);
  for (const s of standings) {
    const runs = runsMap[s.team] ?? { runs_scored: 0, runs_allowed: 0 };
    await pool.query(
      `INSERT INTO standings
         (league, team_name, wins, losses, draws, win_rate, games_behind, rank, season, runs_scored, runs_allowed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'2026',$9,$10)`,
      [s.league, s.team, s.wins, s.losses, s.draws, s.win_rate, s.games_behind, s.rank,
       runs.runs_scored, runs.runs_allowed],
    );
  }
}

export async function runNpbStandingsScraper(): Promise<{ message: string }> {
  if (npbStandingsScraperStatus.isRunning) {
    return { message: '順位表爬蟲正在執行中' };
  }
  npbStandingsScraperStatus.isRunning = true;
  npbStandingsScraperStatus.lastRun = new Date().toISOString();
  npbStandingsScraperStatus.lastError = null;

  try {
    const standings = await fetchNpbStandings();
    if (standings.length > 0) {
      await saveNpbStandings(standings);
    }
    const msg = `✅ NPB 一軍順位表更新完成：${standings.length} 條`;
    npbStandingsScraperStatus.lastResult = msg;
    npbStandingsScraperStatus.isRunning = false;
    return { message: msg };
  } catch (err) {
    const msg = (err as Error).message;
    npbStandingsScraperStatus.lastResult = `❌ 順位表爬蟲錯誤：${msg}`;
    npbStandingsScraperStatus.lastError = msg;
    npbStandingsScraperStatus.isRunning = false;
    return { message: msg };
  }
}
