/**
 * NBA 資料爬蟲 — 來源: NBA.com 官方 API（同 nba_api Python 套件使用的端點）
 *
 * 端點：
 *   CDN  https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json
 *   STATS https://stats.nba.com/stats/leaguestandingsv3
 */

import axios from 'axios';

const STATS_HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
};

const CDN_HEADERS = {
  'Accept': 'application/json',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export const TEAM_ZH: Record<string, string> = {
  ATL: '亞特蘭大老鷹', BOS: '波士頓塞爾提克', BKN: '布魯克林籃網',
  CHA: '夏洛特黃蜂',   CHI: '芝加哥公牛',     CLE: '克里夫蘭騎士',
  DAL: '達拉斯獨行俠', DEN: '丹佛金塊',       DET: '底特律活塞',
  GSW: '金州勇士',     HOU: '休士頓火箭',     IND: '印第安那溜馬',
  LAC: '洛杉磯快艇',   LAL: '洛杉磯湖人',     MEM: '曼菲斯灰熊',
  MIA: '邁阿密熱火',   MIL: '密爾瓦基公鹿',   MIN: '明尼蘇達灰狼',
  NOP: '紐奧良鵜鶘',   NYK: '紐約尼克',       OKC: '奧克拉荷馬雷霆',
  ORL: '奧蘭多魔術',   PHI: '費城76人',       PHX: '菲尼克斯太陽',
  POR: '波特蘭拓荒者', SAC: '沙加緬度國王',   SAS: '聖安東尼奧馬刺',
  TOR: '多倫多暖龍',   UTA: '猶他爵士',       WAS: '華盛頓巫師',
};

const DIV_ZH: Record<string, string> = {
  Atlantic: '大西洋組', Central: '中央組', Southeast: '東南組',
  Northwest: '西北組',  Pacific: '太平洋組', Southwest: '西南組',
};

// ── 記憶體快取（5 分鐘 TTL）──────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number }
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const e = cache.get(key) as CacheEntry<T> | undefined;
  return e && Date.now() - e.ts < TTL_MS ? e.data : null;
}
function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// ── 今日比賽 ─────────────────────────────────────────────────────────────────

export interface NbaGame {
  gameId: string;
  gameStatus: number;      // 1=未開打 2=進行中 3=終場
  gameStatusText: string;
  period: number;
  gameClock: string;
  gameTimeUTC: string;
  homeTeam: { tricode: string; nameZh: string; score: number };
  awayTeam: { tricode: string; nameZh: string; score: number };
}

export async function fetchNbaScoreboard(): Promise<NbaGame[]> {
  const cached = getCached<NbaGame[]>('nba_scoreboard');
  if (cached) return cached;

  try {
    const res = await axios.get(
      'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',
      { timeout: 10000, headers: CDN_HEADERS },
    );
    const games: any[] = res.data?.scoreboard?.games ?? [];
    const result: NbaGame[] = games.map(g => ({
      gameId:         g.gameId,
      gameStatus:     g.gameStatus,
      gameStatusText: g.gameStatusText ?? '',
      period:         g.period ?? 0,
      gameClock:      g.gameClock ?? '',
      gameTimeUTC:    g.gameTimeUTC ?? '',
      homeTeam: {
        tricode: g.homeTeam.teamTricode,
        nameZh:  TEAM_ZH[g.homeTeam.teamTricode] ?? g.homeTeam.teamName,
        score:   g.homeTeam.score ?? 0,
      },
      awayTeam: {
        tricode: g.awayTeam.teamTricode,
        nameZh:  TEAM_ZH[g.awayTeam.teamTricode] ?? g.awayTeam.teamName,
        score:   g.awayTeam.score ?? 0,
      },
    }));
    setCached('nba_scoreboard', result);
    return result;
  } catch (e) {
    console.warn('[NBA] scoreboard 失敗:', (e as Error).message);
    return [];
  }
}

// ── 積分榜 ───────────────────────────────────────────────────────────────────

export interface NbaStanding {
  tricode: string;
  nameZh: string;
  conference: string;    // 'East' | 'West'
  division: string;      // English (Atlantic…)
  divisionZh: string;
  wins: number;
  losses: number;
  winPct: number;
  confRank: number;
  divRank: number;
  gamesBehind: number;
  homeRecord: string;
  roadRecord: string;
  streak: string;
  last10: string;
}

export async function fetchNbaStandings(): Promise<NbaStanding[]> {
  const cached = getCached<NbaStanding[]>('nba_standings');
  if (cached) return cached;

  try {
    const res = await axios.get('https://stats.nba.com/stats/leaguestandingsv3', {
      timeout: 15000,
      headers: STATS_HEADERS,
      params: { LeagueID: '00', Season: '2025-26', SeasonType: 'Regular Season' },
    });

    const rs = res.data?.resultSets?.[0];
    if (!rs) return [];

    const h: string[] = rs.headers;
    const col = (name: string) => h.indexOf(name);

    const result: NbaStanding[] = rs.rowSet.map((row: any[]) => {
      const tricode = row[col('TeamAbbreviation')] ?? '';
      const division = row[col('Division')] ?? '';
      return {
        tricode,
        nameZh:      TEAM_ZH[tricode] ?? `${row[col('TeamCity')]} ${row[col('TeamName')]}`,
        conference:  row[col('Conference')] ?? '',
        division,
        divisionZh:  DIV_ZH[division] ?? division,
        wins:        row[col('WINS')] ?? 0,
        losses:      row[col('LOSSES')] ?? 0,
        winPct:      parseFloat(row[col('WinPCT')] ?? '0'),
        confRank:    row[col('PlayoffRank')] ?? 0,
        divRank:     row[col('DivisionRank')] ?? 0,
        gamesBehind: parseFloat(row[col('ConferenceGamesBack')] ?? '0'),
        homeRecord:  row[col('HOME')] ?? '',
        roadRecord:  row[col('ROAD')] ?? '',
        streak:      row[col('strCurrentStreak')] ?? '',
        last10:      row[col('L10')] ?? '',
      };
    });

    setCached('nba_standings', result);
    return result;
  } catch (e) {
    console.warn('[NBA] standings 失敗:', (e as Error).message);
    return [];
  }
}
