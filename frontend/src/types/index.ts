export interface Article {
  id: number;
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string;
  image_url: string;
  author_id?: number;
  is_hot: boolean;
  published_at: string;
}

export interface Game {
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
}

export interface Standing {
  id: number;
  league: string;
  season: string;
  team_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_rate: string;
  games_behind: string;
  rank: number;
}

export interface AdPlacement {
  id: number;
  name: string;
  type: 'CPD' | 'CPM';
  position: string;
  ad_code: string | null;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  image_url?: string;
  link_url?: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  role: 'member' | 'editor' | 'admin';
}

export type PageType = 'home' | 'wbsc' | 'players' | 'npb' | 'cpbl' | 'admin' | 'poll' | 'article';
