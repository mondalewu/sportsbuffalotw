/**
 * CPBL 球隊資訊 + 球員名冊爬蟲
 *
 * 資料來源：cpbl.com.tw
 *   - 球隊列表 + Logo: GET /team/index
 *   - 球員名冊:        POST /team/getlistplayer (JSON API)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const CPBL_BASE = 'https://www.cpbl.com.tw';

const HTML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.cpbl.com.tw/',
};

const POST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Origin': 'https://www.cpbl.com.tw',
  'Referer': 'https://www.cpbl.com.tw/team/index',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'Accept': '*/*',
};

// ─── 已知的 6 支 CPBL 球隊（備用靜態資料）────────────────────────────────────
// Codes verified from cpbl.com.tw API responses
const CPBL_TEAM_FALLBACK = [
  { code: 'AJL011', name: '樂天桃猿', short_name: '桃猿', official_url: 'https://www.rakutenmonkeys.com.tw/' },
  { code: 'AEO011', name: '富邦悍將', short_name: '悍將', official_url: 'https://www.fubonguardians.com/' },
  { code: 'ACN011', name: '中信兄弟', short_name: '兄弟', official_url: 'https://www.brotherselephants.com/' },
  { code: 'AKP011', name: '台鋼雄鷹', short_name: '雄鷹', official_url: 'https://www.tsghawks.com/' },
  { code: 'AAA011', name: '味全龍',   short_name: '龍',   official_url: 'https://www.weichuandragons.com/' },
  { code: 'AJD011', name: '統一獅',   short_name: '獅',   official_url: 'https://www.7-11lions.com.tw/' },
];

interface CpblTeam {
  code: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  official_url: string | null;
}

interface CpblPlayerApiItem {
  Acnt: string;
  UniformNo: string;
  PlayerName: string;
  Position: string;
  Height: string;
  Weight: string;
  BirthDate: string;
  BatType: string;   // 打擊習慣（左/右/兩）
  ThrowType: string; // 投球習慣
  TeamCode: string;
  TeamName: string;
}

// ─── Step 1: 爬取球隊列表 + Logo ──────────────────────────────────────────────

async function scrapeTeamList(): Promise<CpblTeam[]> {
  try {
    const res = await axios.get(`${CPBL_BASE}/team/index`, { headers: HTML_HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data as string);
    const teams: CpblTeam[] = [];

    // CPBL team cards typically have class like .team-card or similar
    // Try multiple selectors to find team entries
    $('a[href*="teamCode"]').each((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/teamCode=([A-Z0-9]+)/i);
      if (!match) return;

      const code = match[1];
      const name = $(el).find('.team-name, .name, h3, h4').first().text().trim()
        || $(el).text().trim();
      const imgEl = $(el).find('img');
      let logoUrl = imgEl.attr('src') ?? imgEl.attr('data-src') ?? null;

      if (logoUrl && !logoUrl.startsWith('http')) {
        logoUrl = CPBL_BASE + logoUrl;
      }

      if (code && name && name.length < 20) {
        const fallback = CPBL_TEAM_FALLBACK.find(t => t.code === code);
        teams.push({
          code,
          name: fallback?.name || name,
          short_name: fallback?.short_name || name.slice(0, 4),
          logo_url: logoUrl,
          official_url: fallback?.official_url || null,
        });
      }
    });

    if (teams.length >= 4) {
      console.log(`[CPBL Roster] 從頁面取得 ${teams.length} 支球隊`);
      return teams;
    }
  } catch (e) {
    console.warn('[CPBL Roster] 爬取球隊頁面失敗，嘗試備用 logo 路徑:', (e as Error).message);
  }

  // 備用：使用靜態資料 + 嘗試直接構造 logo URL
  console.log('[CPBL Roster] 使用靜態球隊資料');
  const teams: CpblTeam[] = [];
  for (const t of CPBL_TEAM_FALLBACK) {
    let logoUrl: string | null = null;
    try {
      // 嘗試常見的 CPBL logo 路徑
      const url = `${CPBL_BASE}/images/team/${t.code}/logo.png`;
      const r = await axios.head(url, { headers: HTML_HEADERS, timeout: 5000 });
      if (r.status === 200) logoUrl = url;
    } catch {
      // ignore
    }
    teams.push({ ...t, logo_url: logoUrl });
    await new Promise(r => setTimeout(r, 200));
  }
  return teams;
}

// ─── Step 2: 爬取球員名冊（via JSON API）─────────────────────────────────────

async function fetchTeamRoster(teamCode: string, year: number): Promise<CpblPlayerApiItem[]> {
  // 嘗試 POST JSON API
  const params = new URLSearchParams({
    TeamCode: teamCode,
    Year: String(year),
    KindCode: 'A',
  });

  try {
    const res = await axios.post(
      `${CPBL_BASE}/team/getlistplayer`,
      params.toString(),
      { headers: POST_HEADERS, timeout: 15000 },
    );
    const data = res.data as { Success?: boolean; PlayerListJson?: string | null } | CpblPlayerApiItem[];

    // 直接回傳陣列
    if (Array.isArray(data)) return data;

    // 包在 Success/PlayerListJson 結構裡
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const d = data as { Success?: boolean; PlayerListJson?: string | null };
      if (d.Success && d.PlayerListJson) {
        return JSON.parse(d.PlayerListJson) as CpblPlayerApiItem[];
      }
    }
  } catch (e) {
    console.warn(`[CPBL Roster] API 取得 ${teamCode} 名冊失敗:`, (e as Error).message);
  }

  // 備用：爬 HTML 名冊頁
  return scrapeTeamRosterHtml(teamCode, year);
}

async function scrapeTeamRosterHtml(teamCode: string, year: number): Promise<CpblPlayerApiItem[]> {
  try {
    const url = `${CPBL_BASE}/team/player?teamCode=${teamCode}&year=${year}`;
    const res = await axios.get(url, { headers: HTML_HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data as string);
    const players: CpblPlayerApiItem[] = [];

    // 抓取名冊表格
    $('table tbody tr, .player-item, .roster-row').each((_i, el) => {
      const tds = $(el).find('td');
      if (tds.length < 4) return;

      const uniformNo = $(tds[0]).text().trim();
      const name = $(tds[1]).text().trim() || $(tds[2]).text().trim();
      const position = $(tds[2]).text().trim() || $(tds[3]).text().trim();

      if (!name || name.length > 20) return;

      players.push({
        Acnt: '',
        UniformNo: uniformNo,
        PlayerName: name,
        Position: position,
        Height: '',
        Weight: '',
        BirthDate: '',
        BatType: '',
        ThrowType: '',
        TeamCode: teamCode,
        TeamName: '',
      });
    });

    return players;
  } catch (e) {
    console.warn(`[CPBL Roster] HTML 爬取 ${teamCode} 失敗:`, (e as Error).message);
    return [];
  }
}

// ─── Step 3: 儲存球隊資料 ─────────────────────────────────────────────────────

async function saveTeam(team: CpblTeam): Promise<void> {
  await pool.query(
    `INSERT INTO cpbl_teams (code, name, short_name, logo_url, official_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (code) DO UPDATE
       SET name         = EXCLUDED.name,
           short_name   = EXCLUDED.short_name,
           logo_url     = COALESCE(EXCLUDED.logo_url, cpbl_teams.logo_url),
           official_url = COALESCE(EXCLUDED.official_url, cpbl_teams.official_url),
           updated_at   = NOW()`,
    [team.code, team.name, team.short_name, team.logo_url, team.official_url],
  );
}

// ─── Step 4: 儲存球員資料 ─────────────────────────────────────────────────────

async function savePlayer(p: CpblPlayerApiItem, teamName: string): Promise<void> {
  const acnt = p.Acnt || null;
  const birthDate = p.BirthDate ? p.BirthDate.slice(0, 10) || null : null;
  const height = p.Height ? parseInt(p.Height) || null : null;
  const weight = p.Weight ? parseInt(p.Weight) || null : null;

  if (acnt) {
    // 有唯一帳號 → 完整 upsert
    await pool.query(
      `INSERT INTO cpbl_players
         (acnt, team_code, team_name, uniform_no, name, position, height, weight, birth_date, bats, throws, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (acnt) DO UPDATE
         SET team_code  = EXCLUDED.team_code,
             team_name  = EXCLUDED.team_name,
             uniform_no = EXCLUDED.uniform_no,
             name       = EXCLUDED.name,
             position   = EXCLUDED.position,
             height     = COALESCE(EXCLUDED.height, cpbl_players.height),
             weight     = COALESCE(EXCLUDED.weight, cpbl_players.weight),
             birth_date = COALESCE(EXCLUDED.birth_date, cpbl_players.birth_date),
             bats       = COALESCE(NULLIF(EXCLUDED.bats,''), cpbl_players.bats),
             throws     = COALESCE(NULLIF(EXCLUDED.throws,''), cpbl_players.throws),
             updated_at = NOW()`,
      [acnt, p.TeamCode, teamName, p.UniformNo, p.PlayerName,
       p.Position, height, weight, birthDate, p.BatType || null, p.ThrowType || null],
    );
  } else {
    // 沒有 acnt → 依 team_code + uniform_no + name upsert
    await pool.query(
      `INSERT INTO cpbl_players
         (acnt, team_code, team_name, uniform_no, name, position, height, weight, birth_date, bats, throws, updated_at)
       VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT DO NOTHING`,
      [p.TeamCode, teamName, p.UniformNo, p.PlayerName,
       p.Position, height, weight, birthDate, p.BatType || null, p.ThrowType || null],
    );
  }
}

// ─── Wiki 爬蟲（主要來源）─────────────────────────────────────────────────────
// 資料來源: https://twbsball.dils.tku.edu.tw
// 好處: 無防爬、有位置、有背號、有 2026 名單

const WIKI_BASE = 'https://twbsball.dils.tku.edu.tw';

const WIKI_TEAMS: Array<{ code: string; name: string; slug: string }> = [
  { code: 'ACN011', name: '中信兄弟', slug: '%E4%B8%AD%E4%BF%A1%E5%85%84%E5%BC%9F%E9%9A%8A' },
  { code: 'AEO011', name: '富邦悍將', slug: '%E5%AF%8C%E9%82%A6%E6%82%8D%E5%B0%87%E9%9A%8A' },
  { code: 'AJL011', name: '樂天桃猿', slug: '%E6%A8%82%E5%A4%A9%E6%A1%83%E7%8C%BF%E9%9A%8A' },
  { code: 'AAA011', name: '味全龍',   slug: '%E5%91%B3%E5%85%A8%E9%BE%8D%E9%9A%8A' },
  { code: 'AJD011', name: '統一獅',   slug: '%E7%B5%B1%E4%B8%80%E7%8D%85%E9%9A%8A' },
  { code: 'AKP011', name: '台鋼雄鷹', slug: '%E5%8F%B0%E9%8B%BC%E9%9B%84%E9%B7%B9%E9%9A%8A' },
];

interface WikiPlayer { jersey: string; name: string; position: string; bats?: string; throws?: string; }

async function fetchPlayerBatsThrows(playerName: string): Promise<{ bats: string | null; throws: string | null }> {
  try {
    const url = `${WIKI_BASE}/index.php?title=${encodeURIComponent(playerName)}`;
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      responseType: 'text',
    });
    const $ = cheerio.load(res.data as string);
    let bats: string | null = null;
    let throws: string | null = null;

    // Look in infobox table rows for 慣用手/打擊 and 投球
    $('table tr, .infobox tr').each((_i, row) => {
      const th = $(row).find('th').text().trim();
      const td = $(row).find('td').text().trim();
      if (!td) return;
      if (/慣用|打擊/.test(th)) bats = td.replace(/\s+/g, '');
      if (/投球/.test(th)) throws = td.replace(/\s+/g, '');
    });

    // Also try definition list format: dt=label, dd=value
    $('dl').each((_i, dl) => {
      const dts = $(dl).find('dt');
      const dds = $(dl).find('dd');
      dts.each((j, dt) => {
        const label = $(dt).text().trim();
        const val = $(dds[j])?.text().trim() ?? '';
        if (/慣用|打擊/.test(label)) bats = val.replace(/\s+/g, '');
        if (/投球/.test(label)) throws = val.replace(/\s+/g, '');
      });
    });

    return { bats, throws };
  } catch {
    return { bats: null, throws: null };
  }
}

async function fetchRosterFromWiki(team: typeof WIKI_TEAMS[number]): Promise<WikiPlayer[]> {
  const url = `${WIKI_BASE}/index.php?title=${team.slug}`;
  const res = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    responseType: 'text',
  });
  const html = res.data as string;

  // 找各守位的 <td> 標頭
  const posPattern = /<td[^>]*>\s*([\u6295\u6355][\s\S]{0,10}\u624b|[\u5167\u5916][\s\S]{0,10}\u624b)<\/td>/g;
  const sections: Array<{ name: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = posPattern.exec(html)) !== null) {
    sections.push({ name: m[1].replace(/\s/g, ''), idx: m.index });
  }
  if (!sections.length) return [];
  sections.push({ name: 'END', idx: html.length });

  const posMap: Record<string, string> = {
    '投手': '投手', '捕手': '捕手', '內野手': '內野手', '外野手': '外野手', '指定打擊': '指定打擊',
  };

  const players: WikiPlayer[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const chunk = html.slice(sections[i].idx, sections[i + 1].idx);
    const posLabel = posMap[sections[i].name] ?? sections[i].name;
    const pr = /DGPK-BN[^>]*>(\d+)<\/div><a [^>]*title="([^"]+)"/g;
    let pm: RegExpExecArray | null;
    while ((pm = pr.exec(chunk)) !== null) {
      // 清理名稱：去括號（出生年、說明）、去 "頁面不存在"
      const rawName = pm[2];
      const name = rawName
        .replace(/\(\d{4}\)/g, '')              // (1997) 出生年
        .replace(/\(頁面不存在\)/g, '')          // wiki 特殊標記
        .replace(/\s*\([^)]*\)\s*/g, '')         // 其他括號
        .trim();
      if (!name) continue;
      players.push({ jersey: pm[1], name, position: posLabel });
    }
  }
  return players;
}

async function saveWikiPlayer(
  p: WikiPlayer,
  teamCode: string,
  teamName: string,
): Promise<void> {
  // 用 team_code + uniform_no + name 做衝突判斷（無 acnt 來源）
  await pool.query(
    `INSERT INTO cpbl_players
       (acnt, team_code, team_name, uniform_no, name, position, bats, throws, updated_at)
     VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT DO NOTHING`,
    [teamCode, teamName, p.jersey, p.name, p.position, p.bats ?? null, p.throws ?? null],
  );
  // 若同隊同背號已存在則更新名稱、位置與打投習慣
  await pool.query(
    `UPDATE cpbl_players
       SET name     = $1,
           position = $2,
           team_name = $3,
           bats     = COALESCE($6, bats),
           throws   = COALESCE($7, throws),
           updated_at = NOW()
     WHERE team_code = $4 AND uniform_no = $5 AND acnt IS NULL`,
    [p.name, p.position, teamName, teamCode, p.jersey, p.bats ?? null, p.throws ?? null],
  );
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

export interface RosterScraperStatus {
  lastRun: string | null;
  lastResult: string;
  teamsUpdated: number;
  playersUpdated: number;
  isRunning: boolean;
  lastError: string | null;
}

export const cpblRosterScraperStatus: RosterScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  teamsUpdated: 0,
  playersUpdated: 0,
  isRunning: false,
  lastError: null,
};

export async function runCpblWikiRosterScraper(): Promise<{ teams: number; players: number; message: string }> {
  if (cpblRosterScraperStatus.isRunning) {
    return { teams: 0, players: 0, message: '爬蟲正在執行中，請稍後再試' };
  }
  cpblRosterScraperStatus.isRunning = true;
  cpblRosterScraperStatus.lastRun = new Date().toISOString();
  cpblRosterScraperStatus.lastError = null;

  let teamsUpdated = 0;
  let playersUpdated = 0;

  try {
    for (const team of WIKI_TEAMS) {
      // 確保 cpbl_teams 存在
      await pool.query(
        `INSERT INTO cpbl_teams (code, name, short_name, updated_at)
         VALUES ($1, $2, $2, NOW())
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
        [team.code, team.name],
      ).catch(() => {/* 略 */});
      teamsUpdated++;

      await new Promise(r => setTimeout(r, 600));
      let players: WikiPlayer[];
      try {
        players = await fetchRosterFromWiki(team);
        console.log(`[CPBL Wiki] ${team.name} 取得 ${players.length} 名球員`);
      } catch (e) {
        console.warn(`[CPBL Wiki] ${team.name} 爬取失敗:`, (e as Error).message);
        continue;
      }

      // 先清除該隊無 acnt 的舊資料再重新插入
      await pool.query(
        `DELETE FROM cpbl_players WHERE team_code = $1 AND acnt IS NULL`,
        [team.code],
      );

      for (const p of players) {
        try {
          // 逐一爬取球員個人頁取得打/投習慣
          await new Promise(r => setTimeout(r, 300));
          const { bats, throws } = await fetchPlayerBatsThrows(p.name);
          p.bats = bats ?? undefined;
          p.throws = throws ?? undefined;
          await saveWikiPlayer(p, team.code, team.name);
          playersUpdated++;
        } catch (e) {
          console.warn(`[CPBL Wiki] 儲存 ${p.name} 失敗:`, (e as Error).message);
        }
      }
    }

    cpblRosterScraperStatus.teamsUpdated = teamsUpdated;
    cpblRosterScraperStatus.playersUpdated = playersUpdated;
    cpblRosterScraperStatus.lastResult = `✅ Wiki 球隊 ${teamsUpdated}，球員 ${playersUpdated} 人`;
    cpblRosterScraperStatus.isRunning = false;
    return { teams: teamsUpdated, players: playersUpdated, message: cpblRosterScraperStatus.lastResult };

  } catch (err) {
    const msg = (err as Error).message;
    cpblRosterScraperStatus.lastError = msg;
    cpblRosterScraperStatus.lastResult = `❌ Wiki 名冊爬蟲錯誤：${msg}`;
    cpblRosterScraperStatus.isRunning = false;
    return { teams: teamsUpdated, players: playersUpdated, message: cpblRosterScraperStatus.lastResult };
  }
}

export async function runCpblRosterScraper(year = 2026): Promise<{ teams: number; players: number; message: string }> {
  if (cpblRosterScraperStatus.isRunning) {
    return { teams: 0, players: 0, message: '爬蟲正在執行中，請稍後再試' };
  }
  cpblRosterScraperStatus.isRunning = true;
  cpblRosterScraperStatus.lastRun = new Date().toISOString();
  cpblRosterScraperStatus.lastError = null;

  let teamsUpdated = 0;
  let playersUpdated = 0;

  try {
    const teams = await scrapeTeamList();
    console.log(`[CPBL Roster] 取得 ${teams.length} 支球隊`);

    for (const team of teams) {
      await saveTeam(team);
      teamsUpdated++;
      console.log(`[CPBL Roster] 儲存球隊: ${team.name} (${team.code}) logo=${team.logo_url ?? 'none'}`);

      // 爬取名冊
      await new Promise(r => setTimeout(r, 500));
      const players = await fetchTeamRoster(team.code, year);
      console.log(`[CPBL Roster] ${team.name} 取得 ${players.length} 名球員`);

      for (const p of players) {
        try {
          if (!p.TeamCode) p.TeamCode = team.code;
          await savePlayer(p, team.name);
          playersUpdated++;
        } catch (e) {
          console.warn(`[CPBL Roster] 儲存球員 ${p.PlayerName} 失敗:`, (e as Error).message);
        }
      }

      await new Promise(r => setTimeout(r, 800));
    }

    cpblRosterScraperStatus.teamsUpdated = teamsUpdated;
    cpblRosterScraperStatus.playersUpdated = playersUpdated;
    cpblRosterScraperStatus.lastResult = `✅ 球隊 ${teamsUpdated} 支，球員 ${playersUpdated} 人`;
    cpblRosterScraperStatus.isRunning = false;

    return { teams: teamsUpdated, players: playersUpdated, message: cpblRosterScraperStatus.lastResult };

  } catch (err) {
    const msg = (err as Error).message;
    cpblRosterScraperStatus.lastError = msg;
    cpblRosterScraperStatus.lastResult = `❌ CPBL 名冊爬蟲錯誤：${msg}`;
    cpblRosterScraperStatus.isRunning = false;
    console.error('[CPBL Roster] 錯誤:', msg);
    return { teams: teamsUpdated, players: playersUpdated, message: cpblRosterScraperStatus.lastResult };
  }
}
