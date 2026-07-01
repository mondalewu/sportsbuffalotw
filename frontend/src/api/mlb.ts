import apiClient from './client';

export interface MLBGame {
  gamePk: number;
  gameDate: string;
  status: {
    detailedState: string;
    abstractGameState: string; // 'Preview' | 'Live' | 'Final'
    codedGameState: string;
  };
  teams: {
    away: { team: { id: number; name: string; abbreviation: string }; score?: number; isWinner?: boolean };
    home: { team: { id: number; name: string; abbreviation: string }; score?: number; isWinner?: boolean };
  };
  linescore: {
    currentInning?: number;
    currentInningOrdinal?: string;
    inningHalf?: string;
    outs?: number;
    balls?: number;
    strikes?: number;
    innings: { num: number; away: { runs?: number }; home: { runs?: number } }[];
    teams: { away: { runs?: number; hits?: number; errors?: number }; home: { runs?: number; hits?: number; errors?: number } };
  } | null;
  venue?: string;
  decisions?: {
    winner?: { fullName: string };
    loser?: { fullName: string };
    save?: { fullName: string };
  };
}

export interface MLBStandingDivision {
  division: { id: number; name: string; nameShort?: string };
  league?: string;
  teams: {
    teamId: number;
    teamName: string;
    teamAbbrev: string;
    wins: number;
    losses: number;
    pct: string;
    gb: string;
    wcGb?: string;
    divisionRank: number;
    streak?: string;
    runsScored?: number;
    runsAllowed?: number;
    last10?: string;
  }[];
}

export interface MLBBoxscore {
  gamePk: string;
  away: {
    team: { id: number; name: string; abbreviation: string };
    batters: { id: number; name: string; position: string; battingOrder?: string; ab: number; r: number; h: number; rbi: number; bb: number; so: number; avg: string; hr: number }[];
    pitchers: { id: number; name: string; ip: string; h: number; r: number; er: number; bb: number; so: number; hr: number; era: string; note?: string }[];
    teamStats?: any;
  };
  home: {
    team: { id: number; name: string; abbreviation: string };
    batters: { id: number; name: string; position: string; battingOrder?: string; ab: number; r: number; h: number; rbi: number; bb: number; so: number; avg: string; hr: number }[];
    pitchers: { id: number; name: string; ip: string; h: number; r: number; er: number; bb: number; so: number; hr: number; era: string; note?: string }[];
    teamStats?: any;
  };
}

export interface MLBTWPlayer {
  id: number;
  fullName: string;
  nameZh: string;
  currentTeam: string;
  currentTeamAbbrev: string;
  primaryPosition: string;
  jerseyNumber?: string;
  batting?: { avg?: string; homeRuns?: number; rbi?: number; gamesPlayed?: number; hits?: number };
  pitching?: { era?: string; wins?: number; losses?: number; strikeOuts?: number; inningsPitched?: string };
}

export const getMLBSchedule = async (date?: string): Promise<MLBGame[]> => {
  const params = date ? { date } : {};
  const res = await apiClient.get('/mlb/schedule', { params });
  return res.data;
};

export const getMLBStandings = async (): Promise<MLBStandingDivision[]> => {
  const res = await apiClient.get('/mlb/standings');
  return res.data;
};

export const getMLBLinescore = async (gamePk: number) => {
  const res = await apiClient.get(`/mlb/game/${gamePk}/linescore`);
  return res.data;
};

export interface MLBPlay {
  inning: number;
  halfInning: 'top' | 'bottom';
  event: string;
  description: string;
  isOut: boolean;
  rbi: number;
  awayScore: number;
  homeScore: number;
  outs: number;
  pitcher: string;
  batter: string;
}
export interface MLBContent {
  recap: { headline: string; subhead: string; blurb: string } | null;
  highlights: { title: string; duration: string; videoUrl: string; thumbnail: string }[];
}

export const getMLBPlayByPlay = async (gamePk: number): Promise<{ allPlays: MLBPlay[]; scoringPlays: MLBPlay[] }> => {
  const res = await apiClient.get(`/mlb/game/${gamePk}/playbyplay`);
  return res.data;
};

export const getMLBContent = async (gamePk: number): Promise<MLBContent> => {
  const res = await apiClient.get(`/mlb/game/${gamePk}/content`);
  return res.data;
};

export const getMLBBoxscore = async (gamePk: number): Promise<MLBBoxscore> => {
  const res = await apiClient.get(`/mlb/game/${gamePk}/boxscore`);
  return res.data;
};

export const getMLBTaiwanPlayers = async (): Promise<MLBTWPlayer[]> => {
  const res = await apiClient.get('/mlb/players/taiwan');
  return res.data;
};

export interface MLBTWMinorPlayer {
  id: number;
  fullName: string;
  nameZh: string | null;
  currentTeam: string;
  level: string;
  levelOrder: number;
  primaryPosition: string;
  jerseyNumber: string | null;
  batting?: { avg?: string; homeRuns?: number; rbi?: number; gamesPlayed?: number; hits?: number } | null;
  pitching?: { era?: string; wins?: number; losses?: number; strikeOuts?: number; inningsPitched?: string } | null;
}

export const getMLBTaiwanMinors = async (): Promise<MLBTWMinorPlayer[]> => {
  const res = await apiClient.get('/mlb/players/taiwan/minors');
  return res.data;
};

// MLB 球隊代碼 → 中文名稱
export const MLB_TEAM_ZH: Record<string, string> = {
  NYY: '紐約洋基', BOS: '波士頓紅襪', TOR: '多倫多藍鳥', TB: '坦帕灣光芒', BAL: '巴爾的摩金鶯',
  CLE: '克里夫蘭守護者', MIN: '明尼蘇達雙城', DET: '底特律老虎', CWS: '芝加哥白襪', KC: '堪薩斯皇家',
  HOU: '休士頓太空人', LAA: '洛杉磯天使', SEA: '西雅圖水手', ATH: '奧克蘭運動家', TEX: '德州遊騎兵',
  ATL: '亞特蘭大勇士', NYM: '紐約大都會', PHI: '費城費城人', MIA: '邁阿密馬林魚', WSH: '華盛頓國民',
  MIL: '密爾瓦基釀酒人', CHC: '芝加哥小熊', CIN: '辛辛那提紅人', STL: '聖路易紅雀', PIT: '匹茲堡海盜',
  LAD: '洛杉磯道奇', SF: '舊金山巨人', SD: '聖地牙哥教士', AZ: '亞利桑那響尾蛇', COL: '科羅拉多洛磯',
};

// 球隊分區（用於積分榜分組標籤）
export const MLB_DIVISION_ORDER = [
  'American League East', 'American League Central', 'American League West',
  'National League East', 'National League Central', 'National League West',
];
