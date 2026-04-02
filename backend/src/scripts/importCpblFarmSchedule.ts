/**
 * 一次性腳本：從 CPBL 官網抓取 2026 年二軍賽程並寫入 DB
 * 執行方式：npx ts-node src/scripts/importCpblFarmSchedule.ts
 */

import axios from 'axios';
import pool from '../db/pool';

const CPBL_BASE = 'https://www.cpbl.com.tw';

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.cpbl.com.tw/schedule?kindCode=B&year=2026&month=3',
  'Origin': 'https://www.cpbl.com.tw',
  'Accept-Language': 'zh-TW,zh;q=0.9',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
};

const TEAM_MAP: Record<string, string> = {
  '中信兄弟': '中信兄弟',
  '統一7-ELEVEn獅': '統一獅', '統一獅': '統一獅',
  '統一7-ELEVEN獅': '統一獅',
  '富邦悍將': '富邦悍將',
  '樂天桃猿': '樂天桃猿',
  '台鋼雄鷹': '台鋼雄鷹',
  '味全龍': '味全龍',
};

function normTeam(name: string): string {
  const t = name?.trim() ?? '';
  return TEAM_MAP[t] ?? t;
}

interface GameData {
  GameSno: number;
  GameDate: string;        // e.g. "2026-03-26T00:00:00"
  PreExeDate: string;      // e.g. "2026-03-26T14:05:00"
  HomeTeamName: string;
  VisitingTeamName: string;
  FieldAbbe: string;
  GameResult: string;      // "" = scheduled, "0" = final
  KindCode: string;
  HomeTotalScore: number;
  VisitingTotalScore: number;
}

async function fetchFarmSchedule(): Promise<GameData[]> {
  // Step 1: GET the schedule page to obtain a fresh CSRF token + session cookie
  console.log('正在取得 CPBL 網頁 CSRF token...');
  const pageRes = await axios.get(
    `${CPBL_BASE}/schedule?kindCode=B&year=2026&month=3`,
    { headers: { ...COMMON_HEADERS, Accept: 'text/html' }, timeout: 15000 }
  );

  // Extract CSRF token from page HTML
  const tokenMatch = pageRes.data.match(/RequestVerificationToken['":\s]+([A-Za-z0-9_\-]+:[A-Za-z0-9_\-]+)/);
  if (!tokenMatch) throw new Error('無法取得 CSRF token');
  const token = tokenMatch[1];

  // Extract session cookie (__RequestVerificationToken cookie)
  const setCookieHeader = pageRes.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookieHeader)
    ? setCookieHeader.map(c => c.split(';')[0]).join('; ')
    : (setCookieHeader ?? '');

  console.log(`取得 token: ${token.slice(0, 20)}...`);
  console.log(`取得 cookie: ${cookieStr.slice(0, 40)}...`);

  // Step 2: First call getoptsaction (may be required to initialize session state)
  const optsToken = pageRes.data.match(/getoptsaction[\s\S]{0,500}RequestVerificationToken['":\s]+([A-Za-z0-9_\-]+:[A-Za-z0-9_\-]+)/)?.[1] ?? token;
  await axios.post(
    `${CPBL_BASE}/schedule/getoptsaction`,
    new URLSearchParams({ kindCode: 'B', year: '2026' }).toString(),
    {
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'RequestVerificationToken': optsToken,
        'Cookie': cookieStr,
      },
      timeout: 15000,
    }
  ).catch(() => {/* ignore opts errors */});

  // Step 3: POST to /schedule/getgamedatas with both cookie + CSRF header
  console.log('正在抓取二軍賽程資料...');
  const dataRes = await axios.post(
    `${CPBL_BASE}/schedule/getgamedatas`,
    new URLSearchParams({ calendar: '2026/01/01', location: '', kindCode: 'B' }).toString(),
    {
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'RequestVerificationToken': token,
        'Cookie': cookieStr,
      },
      timeout: 30000,
    }
  );

  console.log('API 原始回應:', JSON.stringify(dataRes.data).slice(0, 300));
  const result = dataRes.data as { Success: boolean; GameDatas: string };
  if (!result.Success) throw new Error(`API 回傳失敗: ${JSON.stringify(result)}`);
  if (!result.GameDatas || result.GameDatas === '[]') {
    throw new Error('API 回傳空資料 (GameDatas 為空)');
  }

  return JSON.parse(result.GameDatas) as GameData[];
}

async function importGames(games: GameData[]): Promise<void> {
  let inserted = 0;
  let skipped = 0;

  for (const g of games) {
    const home = normTeam(g.HomeTeamName);
    const away = normTeam(g.VisitingTeamName);
    const gameDateTW = g.GameDate.slice(0, 10); // "YYYY-MM-DD"

    // Determine time from PreExeDate
    let timeStr = '14:05:00';
    if (g.PreExeDate) {
      const tm = g.PreExeDate.match(/T(\d{2}:\d{2})/);
      if (tm) timeStr = `${tm[1]}:00`;
    }
    const gameTs = `${gameDateTW}T${timeStr}+08:00`;

    // Determine status
    let status: 'scheduled' | 'final' = 'scheduled';
    if (g.GameResult === '0') status = 'final';

    // Check if game already exists
    const existing = await pool.query(
      `SELECT id FROM games
       WHERE league = 'CPBL-B'
         AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $1::date
         AND team_home ILIKE $2 AND team_away ILIKE $3
       LIMIT 1`,
      [gameDateTW, `%${home}%`, `%${away}%`]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO games (league, team_home, team_away, venue, game_date, status, game_detail)
       VALUES ('CPBL-B', $1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [home, away, g.FieldAbbe || null, gameTs, status, String(g.GameSno)]
    );
    inserted++;

    if (inserted % 20 === 0) console.log(`已寫入 ${inserted} 場...`);
  }

  console.log(`完成：新增 ${inserted} 場，跳過 ${skipped} 場（已存在）`);
}

async function main() {
  try {
    const games = await fetchFarmSchedule();
    console.log(`取得 ${games.length} 場二軍賽程`);
    await importGames(games);
  } catch (err) {
    console.error('錯誤:', (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
