import client from './client';

export interface TwTournament {
  id: number;
  level: 'senior' | 'junior' | 'youth';
  name: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  format: string | null;
  status: 'upcoming' | 'ongoing' | 'completed';
}

export interface TwGame {
  id: number;
  tournament_id: number;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: 'scheduled' | 'live' | 'final' | 'cancelled';
  game_date: string | null;
  venue: string | null;
  round: string | null;
  game_detail: string | null;
}

export const getTournaments = (params: { level?: string; year?: number }) =>
  client.get<TwTournament[]>('/taiwan-baseball/tournaments', { params }).then(r => r.data);

export const getTournamentGames = (id: number) =>
  client.get<TwGame[]>(`/taiwan-baseball/tournaments/${id}/games`).then(r => r.data);

export const createTournament = (data: Partial<TwTournament>) =>
  client.post<TwTournament>('/taiwan-baseball/tournaments', data).then(r => r.data);

export const updateTournament = (id: number, data: Partial<TwTournament>) =>
  client.patch<TwTournament>(`/taiwan-baseball/tournaments/${id}`, data).then(r => r.data);

export const deleteTournament = (id: number) =>
  client.delete(`/taiwan-baseball/tournaments/${id}`);

export const createGame = (tournamentId: number, data: Partial<TwGame>) =>
  client.post<TwGame>(`/taiwan-baseball/tournaments/${tournamentId}/games`, data).then(r => r.data);

export const updateGame = (id: number, data: Partial<TwGame>) =>
  client.patch<TwGame>(`/taiwan-baseball/games/${id}`, data).then(r => r.data);

export const deleteGame = (id: number) =>
  client.delete(`/taiwan-baseball/games/${id}`);
