import apiClient from './client';

export interface NpbTeam {
  id: number;
  name: string;
  name_full: string;
  code: string;
  npb_league: 'Central' | 'Pacific';
  logo_url: string;
  official_url: string;
}

export interface NpbPlayer {
  id: number;
  number: string;
  name_jp: string;
  name_kana: string;
  position: string;
  batting: string;
  throwing: string;
  birth_date: string | null;
  height: string;
  weight: string;
}

export interface GameInning {
  inning: number;
  score_away: number | null;
  score_home: number | null;
}

export interface GameStats {
  hits_away: number;
  hits_home: number;
  errors_away: number;
  errors_home: number;
  win_pitcher: string;
  loss_pitcher: string;
  save_pitcher: string;
  attendance: number | null;
  game_time: string;
}

export interface BatterStat {
  team_code: string;
  batting_order: number;
  position: string;
  player_name: string;
  at_bats: number;
  hits: number;
  rbi: number;
  runs: number;
  home_runs: number;
  strikeouts: number;
  walks: number;
  stolen_bases: number;
  hit_by_pitch: number;
  sacrifice_hits: number;
  at_bat_results: string[];
}

export interface PitcherStat {
  team_code: string;
  pitcher_order: number;
  player_name: string;
  innings_pitched: string;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  result: string;
  pitch_count: number;
  batters_faced: number;
  home_runs_allowed: number;
  hit_by_pitch: number;
  balk: number;
}

export interface PlayByPlayEvent {
  inning: number;
  is_top: boolean;
  play_order: number;
  description: string;
}

export const getNpbTeams = async (): Promise<NpbTeam[]> => {
  const res = await apiClient.get('/npb/teams');
  return res.data;
};

export const getNpbRoster = async (code: string): Promise<NpbPlayer[]> => {
  const res = await apiClient.get(`/npb/teams/${code}/roster`);
  return res.data;
};

export const getGameInnings = async (gameId: number): Promise<GameInning[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/innings`);
  return res.data;
};

export const getGameStats = async (gameId: number): Promise<GameStats | null> => {
  const res = await apiClient.get(`/npb/games/${gameId}/stats`);
  return res.data;
};

export const getGameBatters = async (gameId: number): Promise<BatterStat[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/batters`);
  return res.data;
};

export const getGamePitchers = async (gameId: number): Promise<PitcherStat[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/pitchers`);
  return res.data;
};

export const getGamePlayByPlay = async (gameId: number): Promise<PlayByPlayEvent[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/playbyplay`);
  return res.data;
};

export interface PitchData {
  at_bat_key: string;
  pitch_num: number;
  inning: number;
  is_top: boolean;
  pitcher_name: string;
  batter_name: string;
  ball_kind: string;
  ball_kind_id: string;
  x: number;
  y: number;
  speed: number | null;
  result: string;
  result_id: string;
  is_strike: boolean;
}

export const getGamePitchData = async (gameId: number): Promise<PitchData[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/pitch-data`);
  return res.data;
};

// ── 一球速報（Phase 1: 基本資料；Phase 2: 球路資料）──────────────────────

export interface NpbGame {
  id: number;
  league: string;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: 'scheduled' | 'live' | 'final';
  game_detail: string | null;
  venue: string | null;
  game_date: string;
  yahoo_game_id: string | null;
}

export interface AtBat {
  id: number;
  inning: number;
  is_top: boolean;
  at_bat_order: number;
  pitcher_name: string | null;
  batter_name: string | null;
  result: string | null;
  rbi: number;
  description: string | null;
  bases_before: number;
  bases_after: number;
  outs_before: number;
  outs_after: number;
}

export interface Pitch {
  id: number;
  pitch_number: number;
  pitch_type: string | null;
  velocity_kmh: number | null;
  zone_x: number | null;
  zone_y: number | null;
  result: string | null;
  balls_after: number;
  strikes_after: number;
}

export const getGame = async (gameId: number): Promise<NpbGame> => {
  const res = await apiClient.get(`/npb/games/${gameId}`);
  return res.data;
};

export const getGameAtBats = async (gameId: number): Promise<AtBat[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/at-bats`);
  return res.data;
};

export const getAtBatPitches = async (gameId: number, atBatId: number): Promise<Pitch[]> => {
  const res = await apiClient.get(`/npb/games/${gameId}/at-bats/${atBatId}/pitches`);
  return res.data;
};

// ── NPB 二軍 ──────────────────────────────────────────────────────────────────

export interface FarmStandingEntry {
  team_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  games_behind: number | null;
  games: number;
  rank: number;
}

export interface FarmStandings {
  east:    FarmStandingEntry[];
  central: FarmStandingEntry[];
  west:    FarmStandingEntry[];
}

export interface FarmGame {
  id: number;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: 'scheduled' | 'live' | 'final';
  game_detail: string | null;
  venue: string | null;
  game_date: string;
  npb_url: string | null;
}

export const getFarmStandings = async (): Promise<FarmStandings> => {
  const res = await apiClient.get('/npb/farm/standings');
  return res.data;
};

export const getFarmGames = async (date?: string): Promise<FarmGame[]> => {
  const params = date ? `?date=${date}` : '';
  const res = await apiClient.get(`/npb/farm/games${params}`);
  return res.data;
};

export const getFarmRecentGames = async (): Promise<FarmGame[]> => {
  const res = await apiClient.get('/npb/farm/recent');
  return res.data;
};

export interface NpbStandingEntry {
  league: string;
  team_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  games_behind: number | null;
  rank: number;
  games: number;
}

export interface NpbOneStandings {
  central: NpbStandingEntry[];
  pacific: NpbStandingEntry[];
}

export interface PreseasonTeam {
  team: string;
  league_group: string | null;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;
  games_behind: number | null;
  runs_scored: number | null;
  runs_allowed: number | null;
}

export interface PreseasonStandings {
  central: PreseasonTeam[];
  pacific: PreseasonTeam[];
  unknown: PreseasonTeam[];
}

export const getNpbOneStandings = async (): Promise<NpbOneStandings> => {
  const res = await apiClient.get('/npb/standings');
  return res.data;
};

export const getNpbPreseasonStandings = async (): Promise<PreseasonStandings> => {
  const res = await apiClient.get('/npb/preseason-standings');
  return res.data;
};

export const getNpbRecentGames = async (): Promise<FarmGame[]> => {
  const res = await apiClient.get('/npb/recent');
  return res.data;
};
