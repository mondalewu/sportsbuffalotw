/**
 * NPB 球員名冊爬蟲 + 球隊資訊初始化
 * 名冊頁面: https://npb.jp/bis/teams/rst_{code}.html
 * Logo URL:  //p.npb.jp/img/common/logo/2026/logo_{code}_{size}.gif
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const NPB_BASE = 'https://npb.jp';
const NPB_LOGO_BASE = 'https://p.npb.jp/img/common/logo/2026';

// 12 支 NPB 球隊靜態資料
export const NPB_TEAMS = [
  // Central League
  { code: 'g',  name: '巨人',       name_full: '読売ジャイアンツ',          npb_league: 'Central', official_url: 'https://www.giants.jp/' },
  { code: 'db', name: 'DeNA',       name_full: '横浜DeNAベイスターズ',        npb_league: 'Central', official_url: 'https://www.baystars.co.jp/' },
  { code: 't',  name: '阪神',       name_full: '阪神タイガース',              npb_league: 'Central', official_url: 'https://hanshintigers.jp/' },
  { code: 'c',  name: '広島',       name_full: '広島東洋カープ',              npb_league: 'Central', official_url: 'https://www.carp.co.jp/' },
  { code: 'd',  name: '中日',       name_full: '中日ドラゴンズ',              npb_league: 'Central', official_url: 'https://dragons.jp/' },
  { code: 's',  name: 'ヤクルト',   name_full: '東京ヤクルトスワローズ',      npb_league: 'Central', official_url: 'https://www.yakult-swallows.co.jp/' },
  // Pacific League
  { code: 'h',  name: 'ソフトバンク', name_full: '福岡ソフトバンクホークス',  npb_league: 'Pacific', official_url: 'https://www.softbankhawks.co.jp/' },
  { code: 'f',  name: '日本ハム',   name_full: '北海道日本ハムファイターズ',  npb_league: 'Pacific', official_url: 'https://www.fighters.co.jp/' },
  { code: 'b',  name: 'オリックス', name_full: 'オリックス・バファローズ',    npb_league: 'Pacific', official_url: 'https://www.buffaloes.co.jp/' },
  { code: 'e',  name: '楽天',       name_full: '東北楽天ゴールデンイーグルス', npb_league: 'Pacific', official_url: 'https://www.rakuteneagles.jp/' },
  { code: 'l',  name: '西武',       name_full: '埼玉西武ライオンズ',          npb_league: 'Pacific', official_url: 'https://www.seibulions.jp/' },
  { code: 'm',  name: 'ロッテ',     name_full: '千葉ロッテマリーンズ',        npb_league: 'Pacific', official_url: 'https://www.marines.co.jp/' },
];

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://npb.jp/',
};

interface NpbPlayer {
  teamCode: string;
  number: string;
  nameJp: string;
  nameKana: string;
  position: string;
  batting: string;
  throwing: string;
  birthDate: string | null;
  height: string;
  weight: string;
}

async function fetchTeamRoster(teamCode: string): Promise<NpbPlayer[]> {
  const url = `${NPB_BASE}/bis/teams/rst_${teamCode}.html`;
  try {
    const res = await axios.get(url, { timeout: 20000, headers: COMMON_HEADERS });
    const $ = cheerio.load(res.data as string);
    const players: NpbPlayer[] = [];

    // NPB roster page: table with columns:
    // 背番号 | 選手名 | ふりがな | 投打 | 身長 | 体重 | 生年月日 | 出身地 | ...
    $('table tr').each((rowIdx, tr) => {
      if (rowIdx === 0) return; // skip header
      const tds = $(tr).find('td');
      if (tds.length < 4) return;

      const number = tds.eq(0).text().trim();
      const nameJp = tds.eq(1).text().trim();
      const nameKana = tds.eq(2).text().trim();

      // Position is often in column 3 or derived from page section
      // 投打 column: 右右, 右左, 左左, etc. or 右/左
      let batting = '';
      let throwing = '';
      const battingThrowingText = tds.eq(3).text().trim();
      // format: 右右 or 右左 or 左右 or 両右
      if (battingThrowingText.length >= 2) {
        throwing = battingThrowingText[0] ?? '';
        batting = battingThrowingText[1] ?? '';
      } else {
        throwing = battingThrowingText;
      }

      const height = tds.eq(4).text().trim();
      const weight = tds.eq(5).text().trim();
      const birthDateRaw = tds.eq(6).text().trim();

      // Parse birth date: format "YYYY年MM月DD日" or "YYYY/MM/DD"
      let birthDate: string | null = null;
      const bdMatch = birthDateRaw.match(/(\d{4})[年\/](\d{1,2})[月\/](\d{1,2})/);
      if (bdMatch) {
        birthDate = `${bdMatch[1]}-${String(bdMatch[2]).padStart(2, '0')}-${String(bdMatch[3]).padStart(2, '0')}`;
      }

      if (!nameJp || nameJp.length < 2) return;

      // Determine position from page context or section header
      // For now, position is determined per section (投手/捕手/内野手/外野手)
      players.push({
        teamCode,
        number,
        nameJp,
        nameKana,
        position: '', // will be filled from section below
        batting,
        throwing,
        birthDate,
        height,
        weight,
      });
    });

    // Also try to extract position from section headers (投手, 捕手, 内野手, 外野手)
    let currentPosition = '';
    const playersWithPosition: NpbPlayer[] = [];
    let playerIdx = 0;

    $('*').each((_, el) => {
      const text = $(el).text().trim();
      if (['投手', '捕手', '内野手', '外野手', '育成投手', '育成捕手', '育成内野手', '育成外野手'].includes(text)) {
        currentPosition = text.replace('育成', '育成 ');
      }
    });

    // Re-parse with position context
    const playersWithPos: NpbPlayer[] = [];
    let pos = '';

    $('tr, h3, h4, .section-title, .position-title').each((_, el) => {
      const tagName = (el as any).tagName?.toLowerCase();
      const text = $(el).text().trim();

      // Check if this is a position header
      if (['投手', '捕手', '内野手', '外野手'].includes(text)) {
        pos = text;
        return;
      }
      if (text.includes('投手')) pos = '投手';
      else if (text.includes('捕手')) pos = '捕手';
      else if (text.includes('内野')) pos = '内野手';
      else if (text.includes('外野')) pos = '外野手';

      if (tagName === 'tr') {
        const tds = $(el).find('td');
        if (tds.length < 4) return;

        const number = tds.eq(0).text().trim();
        const nameJp = tds.eq(1).text().trim();
        if (!nameJp || nameJp.length < 2 || nameJp === '選手名') return;

        const nameKana = tds.eq(2).text().trim();
        const battingThrowingText = tds.eq(3).text().trim();
        let batting2 = '', throwing2 = '';
        if (battingThrowingText.length >= 2) {
          throwing2 = battingThrowingText[0];
          batting2 = battingThrowingText[1];
        }
        const height = tds.eq(4).text().trim();
        const weight = tds.eq(5).text().trim();
        const birthDateRaw = tds.eq(6).text().trim();
        let birthDate: string | null = null;
        const bdMatch = birthDateRaw.match(/(\d{4})[年\/](\d{1,2})[月\/](\d{1,2})/);
        if (bdMatch) {
          birthDate = `${bdMatch[1]}-${String(bdMatch[2]).padStart(2, '0')}-${String(bdMatch[3]).padStart(2, '0')}`;
        }

        // Check not duplicate
        if (!playersWithPos.some(p => p.nameJp === nameJp && p.number === number)) {
          playersWithPos.push({
            teamCode,
            number,
            nameJp,
            nameKana,
            position: pos,
            batting: batting2,
            throwing: throwing2,
            birthDate,
            height,
            weight,
          });
        }
      }
    });

    return playersWithPos.length > 0 ? playersWithPos : players;
  } catch (err: any) {
    console.warn(`[NPB Roster] 無法取得 ${teamCode} 名冊:`, (err as Error).message);
    return [];
  }
}

// 初始化 npb_teams 資料（靜態）
async function seedNpbTeams(): Promise<void> {
  for (const team of NPB_TEAMS) {
    const logoUrl = `${NPB_LOGO_BASE}/logo_${team.code}_m.gif`;
    await pool.query(
      `INSERT INTO npb_teams (name, name_full, code, npb_league, logo_url, official_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             name_full = EXCLUDED.name_full,
             logo_url = EXCLUDED.logo_url,
             official_url = EXCLUDED.official_url`,
      [team.name, team.name_full, team.code, team.npb_league, logoUrl, team.official_url]
    );
  }
  console.log('[NPB Teams] 12 支球隊資料已初始化');
}

async function saveRosterToDB(players: NpbPlayer[]): Promise<number> {
  let saved = 0;
  for (const p of players) {
    try {
      await pool.query(
        `INSERT INTO npb_players
           (team_code, number, name_jp, name_kana, position, batting, throwing, birth_date, height, weight, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (team_code, number, name_jp) DO UPDATE
           SET name_kana = EXCLUDED.name_kana,
               position  = EXCLUDED.position,
               batting   = EXCLUDED.batting,
               throwing  = EXCLUDED.throwing,
               birth_date= EXCLUDED.birth_date,
               height    = EXCLUDED.height,
               weight    = EXCLUDED.weight,
               updated_at= NOW()`,
        [p.teamCode, p.number, p.nameJp, p.nameKana, p.position,
         p.batting, p.throwing, p.birthDate, p.height, p.weight]
      );
      saved++;
    } catch (e) {
      // unique constraint issue for player with no number
    }
  }
  return saved;
}

export interface NpbRosterScraperStatus {
  lastRun: string | null;
  lastResult: string;
  playersUpdated: number;
  isRunning: boolean;
}

export const npbRosterScraperStatus: NpbRosterScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  playersUpdated: 0,
  isRunning: false,
};

export async function runNpbRosterScraper(): Promise<{ updated: number; message: string }> {
  if (npbRosterScraperStatus.isRunning) {
    return { updated: 0, message: 'NPB 名冊爬蟲正在執行中' };
  }

  npbRosterScraperStatus.isRunning = true;
  npbRosterScraperStatus.lastRun = new Date().toISOString();

  try {
    // First ensure team data is seeded
    await seedNpbTeams();

    let totalPlayers = 0;

    for (const team of NPB_TEAMS) {
      console.log(`[NPB Roster] 爬取 ${team.name} 名冊...`);
      const players = await fetchTeamRoster(team.code);
      console.log(`[NPB Roster] ${team.name}: ${players.length} 位球員`);

      if (players.length > 0) {
        const saved = await saveRosterToDB(players);
        totalPlayers += saved;
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    npbRosterScraperStatus.lastResult = `✅ 更新 ${totalPlayers} 位球員資料`;
    npbRosterScraperStatus.playersUpdated = totalPlayers;
    npbRosterScraperStatus.isRunning = false;
    return { updated: totalPlayers, message: `NPB 名冊更新完成，共 ${totalPlayers} 位球員` };

  } catch (err) {
    const msg = (err as Error).message;
    npbRosterScraperStatus.lastResult = `❌ 錯誤：${msg}`;
    npbRosterScraperStatus.isRunning = false;
    return { updated: 0, message: msg };
  }
}

// 只初始化球隊（不爬名冊）
export async function initNpbTeams(): Promise<void> {
  try {
    await seedNpbTeams();
  } catch (e) {
    console.warn('[NPB Teams] 初始化失敗:', (e as Error).message);
  }
}
