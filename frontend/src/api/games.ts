import apiClient from './client';
import type { Game, Standing } from '../types';

export const getGames = async (params?: { league?: string; status?: string; date?: string }): Promise<Game[]> => {
  const res = await apiClient.get('/games', { params });
  return res.data;
};

export interface CreateGamePayload {
  league: string;
  team_home: string;
  team_away: string;
  score_home?: number | null;
  score_away?: number | null;
  status?: 'scheduled' | 'live' | 'final';
  game_detail?: string;
  venue?: string;
  game_date: string;
}

export const createGame = async (payload: CreateGamePayload): Promise<Game> => {
  const res = await apiClient.post('/games', payload);
  return res.data;
};

export const updateGame = async (id: number, payload: Partial<Game>): Promise<Game> => {
  const res = await apiClient.put(`/games/${id}`, payload);
  return res.data;
};

export const deleteGame = async (id: number): Promise<void> => {
  await apiClient.delete(`/games/${id}`);
};

export const getStandings = async (params?: { league?: string; season?: string }): Promise<Standing[]> => {
  const res = await apiClient.get('/standings', { params });
  return res.data;
};

export interface PlayByPlayEvent {
  id: number;
  game_id: number;
  inning: number;
  is_top: boolean;
  batter_name: string;
  pitcher_name: string;
  situation: string;
  result_text: string;
  score_home: number;
  score_away: number;
  sequence_num: number;
  created_at: string;
}

export const getPlayByPlay = async (gameId: number): Promise<PlayByPlayEvent[]> => {
  const res = await apiClient.get(`/games/${gameId}/play-by-play`);
  return res.data;
};

export const addPlayByPlay = async (gameId: number, payload: {
  inning: number;
  is_top: boolean;
  batter_name?: string;
  pitcher_name?: string;
  situation?: string;
  result_text: string;
  score_home: number;
  score_away: number;
}): Promise<PlayByPlayEvent> => {
  const res = await apiClient.post(`/games/${gameId}/play-by-play`, payload);
  return res.data;
};

export const deletePlayByPlay = async (gameId: number, pbpId: number): Promise<void> => {
  await apiClient.delete(`/games/${gameId}/play-by-play/${pbpId}`);
};
