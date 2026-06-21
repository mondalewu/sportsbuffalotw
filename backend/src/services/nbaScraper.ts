import axios from 'axios';

const TEAM_ZH: Record<string, string> = {
  ATL: '老鷹', BOS: '塞爾提克', BKN: '籃網', CHA: '黃蜂', CHI: '公牛',
  CLE: '騎士', DAL: '獨行俠', DEN: '金塊', DET: '活塞', GS: '勇士',
  HOU: '火箭', IND: '溜馬', LAC: '快艇', LAL: '湖人', MEM: '灰熊',
  MIA: '熱火', MIL: '公鹿', MIN: '灰狼', NO: '鵜鶘', NY: '尼克',
  OKC: '雷霆', ORL: '魔術', PHI: '76人', PHX: '太陽', POR: '拓荒者',
  SAC: '國王', SA: '馬刺', TOR: '暴龍', UTAH: '爵士', WSH: '巫師',
  // 舊 tricode 別名（用於比分頁）
  GSW: '勇士', NYK: '尼克', NOP: '鵜鶘', SAS: '馬刺', UTA: '爵士', WAS: '巫師',
};

// ESPN 積分榜實際使用縮寫 → division
const TEAM_DIV: Record<string, { conference: string; division: string; divisionZh: string }> = {
  BOS:  { conference: 'East', division: 'Atlantic',  divisionZh: '大西洋' },
  BKN:  { conference: 'East', division: 'Atlantic',  divisionZh: '大西洋' },
  NY:   { conference: 'East', division: 'Atlantic',  divisionZh: '大西洋' },
  PHI:  { conference: 'East', division: 'Atlantic',  divisionZh: '大西洋' },
  TOR:  { conference: 'East', division: 'Atlantic',  divisionZh: '大西洋' },
  CHI:  { conference: 'East', division: 'Central',   divisionZh: '中部' },
  CLE:  { conference: 'East', division: 'Central',   divisionZh: '中部' },
  DET:  { conference: 'East', division: 'Central',   divisionZh: '中部' },
  IND:  { conference: 'East', division: 'Central',   divisionZh: '中部' },
  MIL:  { conference: 'East', division: 'Central',   divisionZh: '中部' },
  ATL:  { conference: 'East', division: 'Southeast', divisionZh: '東南' },
  CHA:  { conference: 'East', division: 'Southeast', divisionZh: '東南' },
  MIA:  { conference: 'East', division: 'Southeast', divisionZh: '東南' },
  ORL:  { conference: 'East', division: 'Southeast', divisionZh: '東南' },
  WSH:  { conference: 'East', division: 'Southeast', divisionZh: '東南' },
  DEN:  { conference: 'West', division: 'Northwest', divisionZh: '西北' },
  MIN:  { conference: 'West', division: 'Northwest', divisionZh: '西北' },
  OKC:  { conference: 'West', division: 'Northwest', divisionZh: '西北' },
  POR:  { conference: 'West', division: 'Northwest', divisionZh: '西北' },
  UTAH: { conference: 'West', division: 'Northwest', divisionZh: '西北' },
  GS:   { conference: 'West', division: 'Pacific',   divisionZh: '太平洋' },
  LAC:  { conference: 'West', division: 'Pacific',   divisionZh: '太平洋' },
  LAL:  { conference: 'West', division: 'Pacific',   divisionZh: '太平洋' },
  PHX:  { conference: 'West', division: 'Pacific',   divisionZh: '太平洋' },
  SAC:  { conference: 'West', division: 'Pacific',   divisionZh: '太平洋' },
  DAL:  { conference: 'West', division: 'Southwest', divisionZh: '西南' },
  HOU:  { conference: 'West', division: 'Southwest', divisionZh: '西南' },
  MEM:  { conference: 'West', division: 'Southwest', divisionZh: '西南' },
  NO:   { conference: 'West', division: 'Southwest', divisionZh: '西南' },
  SA:   { conference: 'West', division: 'Southwest', divisionZh: '西南' },
};

export interface NbaGame {
  gameId: string;
  gameStatus: number;  // 1=未開始 2=進行中 3=結束
  gameStatusText: string;
  period: number;
  gameClock: string;
  gameTimeUTC: string;
  homeTeam: { tricode: string; nameZh: string; score: number };
  awayTeam: { tricode: string; nameZh: string; score: number };
}

export interface NbaStanding {
  tricode: string;
  nameZh: string;
  conference: string;
  division: string;
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

const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

let scoreboardCache: { data: NbaGame[]; ts: number } | null = null;
let standingsCache: { data: NbaStanding[]; ts: number } | null = null;
const TTL = 5 * 60 * 1000;

export async function fetchNbaScoreboard(): Promise<NbaGame[]> {
  if (scoreboardCache && Date.now() - scoreboardCache.ts < TTL) return scoreboardCache.data;

  const { data } = await axios.get(
    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    { headers: ESPN_HEADERS, timeout: 10000 }
  );

  const games: NbaGame[] = (data.events ?? []).map((ev: any) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
    const status = ev.status?.type;

    const gameStatus = status?.state === 'pre' ? 1 : status?.state === 'in' ? 2 : 3;
    const abbr = (t: any) => t?.team?.abbreviation ?? '';

    return {
      gameId: ev.id,
      gameStatus,
      gameStatusText: status?.shortDetail ?? '',
      period: ev.status?.period ?? 0,
      gameClock: status?.state === 'in' ? (ev.status?.displayClock ?? '') : '',
      gameTimeUTC: ev.date ?? '',
      homeTeam: {
        tricode: abbr(home),
        nameZh: TEAM_ZH[abbr(home)] ?? home?.team?.displayName ?? abbr(home),
        score: parseInt(home?.score ?? '0', 10),
      },
      awayTeam: {
        tricode: abbr(away),
        nameZh: TEAM_ZH[abbr(away)] ?? away?.team?.displayName ?? abbr(away),
        score: parseInt(away?.score ?? '0', 10),
      },
    };
  });

  scoreboardCache = { data: games, ts: Date.now() };
  return games;
}

export async function fetchNbaStandings(): Promise<NbaStanding[]> {
  if (standingsCache && Date.now() - standingsCache.ts < TTL) return standingsCache.data;

  const { data } = await axios.get(
    'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
    { headers: ESPN_HEADERS, timeout: 10000 }
  );

  const result: NbaStanding[] = [];

  for (const conf of data.children ?? []) {
    const entries: any[] = conf.standings?.entries ?? [];
    const confName = conf.abbreviation === 'east' || conf.name?.includes('Eastern') ? 'East' : 'West';

    // sort by playoffSeed to get confRank
    const sorted = [...entries].sort((a, b) => {
      const seedA = a.stats?.find((s: any) => s.name === 'playoffSeed')?.value ?? 99;
      const seedB = b.stats?.find((s: any) => s.name === 'playoffSeed')?.value ?? 99;
      return seedA - seedB;
    });

    sorted.forEach((entry, idx) => {
      const stat = (name: string) => entry.stats?.find((s: any) => s.name === name);
      const abbr: string = entry.team?.abbreviation ?? '';
      const divInfo = TEAM_DIV[abbr] ?? { conference: confName, division: '', divisionZh: '' };

      result.push({
        tricode: abbr,
        nameZh: TEAM_ZH[abbr] ?? entry.team?.displayName ?? abbr,
        conference: confName,
        division: divInfo.division,
        divisionZh: divInfo.divisionZh,
        wins: stat('wins')?.value ?? 0,
        losses: stat('losses')?.value ?? 0,
        winPct: stat('winPercent')?.value ?? 0,
        confRank: idx + 1,
        divRank: 0, // computed later
        gamesBehind: stat('gamesBehind')?.value ?? 0,
        homeRecord: stat('Home')?.displayValue ?? '',
        roadRecord: stat('Road')?.displayValue ?? '',
        streak: (() => {
          const s = stat('streak')?.value ?? 0;
          return s > 0 ? `W${s}` : s < 0 ? `L${Math.abs(s)}` : '-';
        })(),
        last10: stat('Last Ten Games')?.displayValue ?? '',
      });
    });
  }

  // calculate division rank
  const divGroups: Record<string, NbaStanding[]> = {};
  for (const t of result) {
    if (!divGroups[t.division]) divGroups[t.division] = [];
    divGroups[t.division].push(t);
  }
  for (const div of Object.values(divGroups)) {
    const sorted = [...div].sort((a, b) => a.confRank - b.confRank);
    sorted.forEach((t, i) => { t.divRank = i + 1; });
  }

  standingsCache = { data: result, ts: Date.now() };
  return result;
}

// ─── Game Summary (Box Score) ─────────────────────────────────────────────────

export interface NbaPlayerStat {
  displayName: string;
  jerseyNumber: string;
  starter: boolean;
  stats: string[]; // MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-
}

export interface NbaTeamBoxScore {
  tricode: string;
  nameZh: string;
  score: number;
  linescores: number[];
  players: NbaPlayerStat[];
  totals: string[]; // team total row (same labels)
}

export interface NbaGameSummary {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  period: number;
  gameClock: string;
  gameTimeUTC: string;
  venue: string;
  attendance: number | null;
  homeTeam: NbaTeamBoxScore;
  awayTeam: NbaTeamBoxScore;
  labels: string[];
}

const gameCache = new Map<string, { data: NbaGameSummary; ts: number }>();
const GAME_TTL_LIVE = 30 * 1000;      // 30s for live
const GAME_TTL_FINAL = 60 * 60 * 1000; // 1hr for final

export async function fetchNbaGameSummary(gameId: string): Promise<NbaGameSummary> {
  const cached = gameCache.get(gameId);
  if (cached) {
    const ttl = cached.data.gameStatus === 3 ? GAME_TTL_FINAL : GAME_TTL_LIVE;
    if (Date.now() - cached.ts < ttl) return cached.data;
  }

  const { data } = await axios.get(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
    { headers: ESPN_HEADERS, timeout: 10000 },
  );

  const header = data.header?.competitions?.[0];
  const statusState = header?.status?.type?.state ?? 'post';
  const gameStatus = statusState === 'pre' ? 1 : statusState === 'in' ? 2 : 3;

  const buildTeam = (competitor: any, playerGroups: any[]): NbaTeamBoxScore => {
    const abbr: string = competitor?.team?.abbreviation ?? '';
    const statGroup = playerGroups?.[0]?.statistics?.[0];
    const labels: string[] = statGroup?.labels ?? [];

    const players: NbaPlayerStat[] = (statGroup?.athletes ?? []).map((a: any) => ({
      displayName: a.athlete?.displayName ?? '',
      jerseyNumber: a.athlete?.jersey ?? '',
      starter: a.starter ?? false,
      stats: a.stats ?? [],
    }));

    return {
      tricode: abbr,
      nameZh: TEAM_ZH[abbr] ?? competitor?.team?.displayName ?? abbr,
      score: parseInt(competitor?.score ?? '0', 10),
      linescores: (competitor?.linescores ?? []).map((l: any) => l.value ?? 0),
      players,
      totals: statGroup?.totals ?? [],
    };
  };

  const homeComp = header?.competitors?.find((c: any) => c.homeAway === 'home');
  const awayComp = header?.competitors?.find((c: any) => c.homeAway === 'away');

  const bsPlayers = data.boxscore?.players ?? [];
  const homePlayerGroup = bsPlayers.find((p: any) => p.team?.abbreviation === homeComp?.team?.abbreviation);
  const awayPlayerGroup = bsPlayers.find((p: any) => p.team?.abbreviation === awayComp?.team?.abbreviation);

  const labels: string[] = (homePlayerGroup?.statistics?.[0]?.labels ?? awayPlayerGroup?.statistics?.[0]?.labels ?? []);

  const gi = data.gameInfo;

  const summary: NbaGameSummary = {
    gameId,
    gameStatus,
    gameStatusText: header?.status?.type?.shortDetail ?? '',
    period: header?.status?.period ?? 0,
    gameClock: statusState === 'in' ? (header?.status?.displayClock ?? '') : '',
    gameTimeUTC: header?.date ?? '',
    venue: gi?.venue?.fullName ?? '',
    attendance: gi?.attendance ?? null,
    homeTeam: buildTeam(homeComp, homePlayerGroup ? [homePlayerGroup] : []),
    awayTeam: buildTeam(awayComp, awayPlayerGroup ? [awayPlayerGroup] : []),
    labels,
  };

  gameCache.set(gameId, { data: summary, ts: Date.now() });
  return summary;
}
