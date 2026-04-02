/**
 * NPB 整季賽程爬蟲 — 來源: baseball.yahoo.co.jp (週次賽程，SSR)
 *
 * URL: https://baseball.yahoo.co.jp/npb/schedule/first/all?date=YYYY-MM-DD
 * 每次請求返回該日期所在「週」(Mon-Sun) 的賽程
 *
 * HTML 結構 (SSR，Cheerio 可直接解析):
 *   .bb-scheduleTable                整體賽程表
 *   .bb-scheduleTable__head          日期標頭 "3月17日（火）"
 *   .bb-scheduleTable__row           一場比賽的行
 *   [class*=scheduleTable__home] a   主隊名稱
 *   [class*=scheduleTable__away] a   客隊名稱
 *   .bb-scheduleTable__data--stadium 球場名
 *   [class*=scheduleTable__status] a 狀態文字
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const YAHOO_BASE = 'https://baseball.yahoo.co.jp';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://baseball.yahoo.co.jp/npb/',
};

const YAHOO_TEAM_MAP: Record<string, string> = {
  '巨人': '巨人', 'ジャイアンツ': '巨人', '読売': '巨人',
  'DeNA': 'DeNA', 'ベイスターズ': 'DeNA', '横浜': 'DeNA',
  '阪神': '阪神', 'タイガース': '阪神',
  '広島': '広島', 'カープ': '広島',
  '中日': '中日', 'ドラゴンズ': '中日',
  'ヤクルト': 'ヤクルト', 'スワローズ': 'ヤクルト',
  'ソフトバンク': 'ソフトバンク', 'ホークス': 'ソフトバンク', '福岡': 'ソフトバンク',
  '日本ハム': '日本ハム', 'ファイターズ': '日本ハム', '北海道': '日本ハム',
  'オリックス': 'オリックス', 'バファローズ': 'オリックス',
  '楽天': '楽天', 'イーグルス': '楽天',
  '西武': '西武', 'ライオンズ': '西武',
  'ロッテ': 'ロッテ', 'マリーンズ': 'ロッテ',
};

function normalizeTeam(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  if (YAHOO_TEAM_MAP[t]) return YAHOO_TEAM_MAP[t];
  for (const [key, val] of Object.entries(YAHOO_TEAM_MAP)) {
    if (t.includes(key)) return val;
  }
  return t;
}

interface ScheduleGame {
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  gameType: string;
  startTime: string | null;
}

async function fetchWeekSchedule(date: string): Promise<ScheduleGame[]> {
  const url = `${YAHOO_BASE}/npb/schedule/first/all?date=${date}`;

  try {
    const res = await axios.get(url, { timeout: 20000, headers: HEADERS });
    const $ = cheerio.load(res.data as string);
    const games: ScheduleGame[] = [];
    const yearMatch = date.match(/^(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    let currentDate = '';

    $('.bb-scheduleTable tbody').each((_, tbody) => {
      const headText = $(tbody).find('.bb-scheduleTable__head').first().text().trim();
      const dateMatch = headText.match(/(\d+)月(\d+)日/);
      if (dateMatch) {
        const mm = String(parseInt(dateMatch[1])).padStart(2, '0');
        const dd = String(parseInt(dateMatch[2])).padStart(2, '0');
        currentDate = `${year}-${mm}-${dd}`;
      }

      if (!currentDate) return;

      $(tbody).find('.bb-scheduleTable__row').each((_, tr) => {
        if ($(tr).find('.bb-scheduleTable__data--nogame').length) return;

        // 主客隊名: homeName / awayName (または --preGame クラス)
        const homeRaw = $(tr)
          .find('[class*="scheduleTable__homeName"] a')
          .first().text().trim();
        const awayRaw = $(tr)
          .find('[class*="scheduleTable__awayName"] a')
          .first().text().trim();

        const homeTeam = normalizeTeam(homeRaw);
        const awayTeam = normalizeTeam(awayRaw);
        if (!homeTeam || !awayTeam) return;

        const venue = $(tr).find('.bb-scheduleTable__data--stadium').text().trim() || null;

        // 開始時間: テキスト内の HH:MM パターン
        const rowText = $(tr).text();
        const timeMatch = rowText.match(/(\d{2}):(\d{2})/);
        const startTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : null;

        // 試合種類
        const mm = parseInt(currentDate.slice(5, 7));
        const dd = parseInt(currentDate.slice(8, 10));
        let gameType = '例行賽';
        if (mm === 3) {
          gameType = dd < 27 ? 'オープン戦' : dd === 27 ? '開幕戦' : '例行賽';
        } else if (mm >= 10) {
          gameType = 'ポストシーズン';
        }
        const statusText = $(tr).find('[class*="scheduleTable__status"]').text();
        if (statusText.includes('オープン') || statusText.includes('練習')) {
          gameType = 'オープン戦';
        }

        games.push({ date: currentDate, homeTeam, awayTeam, venue, gameType, startTime });
      });
    });

    const seen = new Set<string>();
    return games.filter(g => {
      const key = `${g.date}|${g.homeTeam}|${g.awayTeam}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  } catch (err: unknown) {
    const e = err as { response?: { status: number } };
    if (e.response?.status === 404) return [];
    console.error(`[NPB Schedule] 無法取得 ${date}:`, (err as Error).message);
    return [];
  }
}

async function saveScheduleToDB(games: ScheduleGame[]): Promise<number> {
  let saved = 0;
  for (const g of games) {
    const timeStr = g.startTime ?? '18:00';
    const gameDateJST = `${g.date}T${timeStr}:00+09:00`;
    try {
      const result = await pool.query(
        `INSERT INTO games (league, team_home, team_away, status, game_detail, venue, game_date)
         VALUES ('NPB', $1, $2, 'scheduled', $3, $4, $5)
         ON CONFLICT (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo')) DO NOTHING
         RETURNING id`,
        [g.homeTeam, g.awayTeam, g.gameType, g.venue, gameDateJST]
      );
      if (result.rows.length > 0) saved++;
    } catch (e) {
      console.warn('[NPB Schedule] 儲存失敗:', (e as Error).message,
        `${g.homeTeam} vs ${g.awayTeam} (${g.date})`);
    }
  }
  return saved;
}

export interface NpbScheduleScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesAdded: number;
  isRunning: boolean;
}

export const npbScheduleScraperStatus: NpbScheduleScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  gamesAdded: 0,
  isRunning: false,
};

export async function runNpbScheduleScraper(year = 2026): Promise<{ added: number; message: string }> {
  if (npbScheduleScraperStatus.isRunning) {
    return { added: 0, message: 'NPB 賽程爬蟲正在執行中' };
  }

  npbScheduleScraperStatus.isRunning = true;
  npbScheduleScraperStatus.lastRun = new Date().toISOString();

  try {
    let totalAdded = 0;

    // 各月 7日おきに週次賽程をフェッチ (3月〜11月)
    for (let month = 3; month <= 11; month++) {
      const mm = String(month).padStart(2, '0');
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day += 7) {
        const dd = String(day).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;

        console.log(`[NPB Schedule] 取得中: ${dateStr} 週`);
        const games = await fetchWeekSchedule(dateStr);
        console.log(`[NPB Schedule] ${dateStr}: ${games.length} 場`);

        if (games.length > 0) {
          const added = await saveScheduleToDB(games);
          totalAdded += added;
        }

        await new Promise(r => setTimeout(r, 1200));
      }
    }

    npbScheduleScraperStatus.lastResult = `✅ 成功新增 ${totalAdded} 場 NPB 賽程`;
    npbScheduleScraperStatus.gamesAdded = totalAdded;
    npbScheduleScraperStatus.isRunning = false;
    console.log(`[NPB Schedule] 共新增 ${totalAdded} 場`);
    return { added: totalAdded, message: `NPB 整季賽程爬取完成，新增 ${totalAdded} 場` };

  } catch (err) {
    const msg = (err as Error).message;
    npbScheduleScraperStatus.lastResult = `❌ NPB 賽程爬蟲錯誤：${msg}`;
    npbScheduleScraperStatus.isRunning = false;
    console.error('[NPB Schedule] 錯誤:', msg);
    return { added: 0, message: msg };
  }
}
