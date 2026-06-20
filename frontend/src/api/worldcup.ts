import apiClient from './client';

export interface WcFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null; long: string };
    venue: { name: string; city: string };
  };
  league: { round: string };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
}

export interface WcStandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

export interface WcTopScorer {
  player: { id: number; name: string; nationality: string; photo: string };
  statistics: Array<{
    team: { name: string; logo: string };
    goals: { total: number | null; assists: number | null };
  }>;
}

export const getWcFixtures = async (): Promise<WcFixture[]> => {
  const res = await apiClient.get('/worldcup/fixtures');
  return res.data?.response ?? [];
};

export const getWcLive = async (): Promise<WcFixture[]> => {
  const res = await apiClient.get('/worldcup/fixtures/live');
  return res.data?.response ?? [];
};

export const getWcStandings = async (): Promise<WcStandingEntry[][]> => {
  const res = await apiClient.get('/worldcup/standings');
  // API returns: response[0].league.standings (array of groups)
  return res.data?.response?.[0]?.league?.standings ?? [];
};

export const getWcTopScorers = async (): Promise<WcTopScorer[]> => {
  const res = await apiClient.get('/worldcup/topscorers');
  return res.data?.response ?? [];
};
