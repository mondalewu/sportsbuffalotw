import apiClient from './client';

export interface NbaGame {
  gameId: string;
  gameStatus: number;
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

export const getNbaScoreboard = async (): Promise<NbaGame[]> => {
  const res = await apiClient.get('/nba/scoreboard');
  return res.data;
};

export const getNbaStandings = async (): Promise<NbaStanding[]> => {
  const res = await apiClient.get('/nba/standings');
  return res.data;
};
