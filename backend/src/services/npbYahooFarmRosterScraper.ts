/**
 * Yahoo Baseball 二軍獨立チーム名冊爬蟲
 * ハヤテベンチャーズ静岡: https://baseball.yahoo.co.jp/npb/teams/23879/players
 * オイシックス新潟アルビレックスBC: https://baseball.yahoo.co.jp/npb/teams/806/players
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const YAHOO_BASE = 'https://baseball.yahoo.co.jp';

const FARM_TEAMS = [
  {
    code: 'v',
    name: 'くふうハヤテ',
    name_full: 'くふうハヤテベンチャーズ静岡',
    yahoo_team_id: '23879',
    npb_league: 'Farm',
  },
  {
    code: 'o',
    name: 'オイシックス',
    name_full: 'オイシックス新潟アルビレックスBC',
    yahoo_team_id: '806',
    npb_league: 'Farm',
  },
] as const;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://baseball.yahoo.co.jp/',
};

export interface FarmRosterScraperStatus {
  lastRun: string | null;
  lastResult: string;
  isRunning: boolean;
  lastError: string | null;
}

export const farmRosterScraperStatus: FarmRosterScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  isRunning: false,
  lastError: null,
};

async function ensureFarmTeam(team: typeof FARM_TEAMS[number]): Promise<void> {
  const logoUrl = `${YAHOO_BASE}/npb/photo/team/50/${team.yahoo_team_id}.png`;
  await pool.query(
    `INSERT INTO npb_teams (code, name, name_full, npb_league, logo_url, official_url)
     VALUES ($1, $2, $3, $4, $5, '')
     ON CONFLICT (code) DO UPDATE SET
       name       = EXCLUDED.name,
       name_full  = EXCLUDED.name_full,
       npb_league = EXCLUDED.npb_league,
       logo_url   = EXCLUDED.logo_url`,
    [team.code, team.name, team.name_full, team.npb_league, logoUrl],
  );
}

async function scrapeYahooTeamRoster(teamCode: string, yahooTeamId: string): Promise<number> {
  const url = `${YAHOO_BASE}/npb/teams/${yahooTeamId}/players`;
  try {
    const res = await axios.get(url, { timeout: 20000, headers: HEADERS });
    const $ = cheerio.load(res.data as string);

    await pool.query('DELETE FROM npb_players WHERE team_code = $1', [teamCode]);

    let count = 0;
    $('table tr').each((_rowIdx, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 3) return;

      const number = tds.eq(0).text().trim();
      if (!number || /背番/.test(number)) return;

      const nameLink = tds.eq(1).find('a').first();
      const nameJp = nameLink.text().trim() || tds.eq(1).text().trim();
      if (!nameJp) return;

      const playerHref = nameLink.attr('href') ?? '';
      const playerIdMatch = playerHref.match(/\/player\/(\d+)\//);
      const playerId = playerIdMatch?.[1] ?? null;
      const photoUrl = playerId
        ? `${YAHOO_BASE}/npb/photo/player/100/${playerId}.jpg`
        : null;

      const position = tds.eq(2).text().trim();

      let throwing = '';
      let batting = '';
      if (tds.length > 3) {
        const battingText = tds.eq(3).text().trim();
        if (battingText.length >= 2) {
          throwing = battingText[0] ?? '';
          batting = battingText[1] ?? '';
        }
      }

      const height = tds.length > 4 ? parseInt(tds.eq(4).text()) || null : null;
      const weight = tds.length > 5 ? parseInt(tds.eq(5).text()) || null : null;

      pool.query(
        `INSERT INTO npb_players
           (team_code, number, name_jp, name_kana, position, throwing, batting, height, weight, photo_url)
         VALUES ($1,$2,$3,'',$4,$5,$6,$7,$8,$9)`,
        [teamCode, number, nameJp, position, throwing, batting, height, weight, photoUrl],
      ).catch(() => {});
      count++;
    });

    await new Promise(r => setTimeout(r, 500));
    console.log(`[Farm Roster] ${teamCode}: ${count} 選手`);
    return count;
  } catch (err) {
    console.warn(`[Farm Roster] ${teamCode} 爬取失敗:`, (err as Error).message);
    return 0;
  }
}

export async function runYahooFarmRosterScraper(): Promise<{ message: string }> {
  if (farmRosterScraperStatus.isRunning) {
    return { message: '名冊爬蟲正在執行中' };
  }
  farmRosterScraperStatus.isRunning = true;
  farmRosterScraperStatus.lastRun = new Date().toISOString();
  farmRosterScraperStatus.lastError = null;

  try {
    let total = 0;
    for (const team of FARM_TEAMS) {
      await ensureFarmTeam(team);
      const count = await scrapeYahooTeamRoster(team.code, team.yahoo_team_id);
      total += count;
      await new Promise(r => setTimeout(r, 1000));
    }
    const msg = `✅ 二軍獨立球隊名冊完成：共 ${total} 名選手`;
    farmRosterScraperStatus.lastResult = msg;
    farmRosterScraperStatus.isRunning = false;
    return { message: msg };
  } catch (err) {
    const msg = (err as Error).message;
    farmRosterScraperStatus.lastResult = `❌ 名冊爬蟲錯誤：${msg}`;
    farmRosterScraperStatus.lastError = msg;
    farmRosterScraperStatus.isRunning = false;
    return { message: msg };
  }
}
