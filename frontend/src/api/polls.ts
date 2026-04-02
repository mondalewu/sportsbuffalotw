import apiClient from './client';

export interface PollOption {
  id: number;
  poll_id: number;
  option_text: string;
  display_order: number;
  vote_count: number;
  percentage: number;
}

export interface Poll {
  id: number;
  question: string;
  category: string;
  is_active: boolean;
  allow_multiple: boolean;
  ends_at: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  options: PollOption[];
  total_votes: number;
}

export const getPolls = async (): Promise<Poll[]> => {
  const res = await apiClient.get('/polls');
  return res.data;
};

export const getAllPolls = async (): Promise<Poll[]> => {
  const res = await apiClient.get('/polls/all');
  return res.data;
};

export const getPoll = async (id: number): Promise<Poll> => {
  const res = await apiClient.get(`/polls/${id}`);
  return res.data;
};

export const createPoll = async (payload: {
  question: string;
  category?: string;
  allow_multiple?: boolean;
  ends_at?: string;
  options: string[];
}): Promise<Poll> => {
  const res = await apiClient.post('/polls', payload);
  return res.data;
};

export const updatePoll = async (id: number, payload: {
  question?: string;
  category?: string;
  is_active?: boolean;
  ends_at?: string;
}): Promise<Poll> => {
  const res = await apiClient.put(`/polls/${id}`, payload);
  return res.data;
};

export const addPollOption = async (pollId: number, option_text: string): Promise<Poll> => {
  const res = await apiClient.post(`/polls/${pollId}/options`, { option_text });
  return res.data;
};

export const deletePollOption = async (pollId: number, optionId: number): Promise<void> => {
  await apiClient.delete(`/polls/${pollId}/options/${optionId}`);
};

export const votePoll = async (pollId: number, option_id: number): Promise<Poll> => {
  const res = await apiClient.post(`/polls/${pollId}/vote`, { option_id });
  return res.data;
};

export const deletePoll = async (id: number): Promise<void> => {
  await apiClient.delete(`/polls/${id}`);
};

export interface AdminAnalytics {
  articles: number;
  users: number;
  cpbl_games: number;
  polls: number;
  total_votes: number;
  top_polls: { id: number; question: string; is_active: boolean; total_votes: number }[];
  votes_by_day: { day: string; count: number }[];
}

export const getAdminAnalytics = async (): Promise<AdminAnalytics> => {
  const res = await apiClient.get('/admin/analytics');
  return res.data;
};
