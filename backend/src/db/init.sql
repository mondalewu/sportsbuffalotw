-- 水牛體育 SPORTS BUFFALO — Database Schema
-- PostgreSQL 16

-- 會員資料表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新聞文章資料表
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('WBC','CPBL','NPB','MLB','NBA','其他')),
  summary TEXT,
  content TEXT NOT NULL,
  image_url VARCHAR(1000),
  author_id INT REFERENCES users(id) ON DELETE SET NULL,
  is_hot BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 賽程 / 比分資料表
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  league VARCHAR(50) NOT NULL,
  team_home VARCHAR(100) NOT NULL,
  team_away VARCHAR(100) NOT NULL,
  score_home INT,
  score_away INT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','final')),
  game_detail VARCHAR(100),
  venue VARCHAR(200),
  game_date TIMESTAMPTZ NOT NULL,
  yahoo_game_id VARCHAR(20),
  npb_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 積分榜資料表
CREATE TABLE IF NOT EXISTS standings (
  id SERIAL PRIMARY KEY,
  league VARCHAR(50) NOT NULL,
  season VARCHAR(20) NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0,
  win_rate DECIMAL(5,3) DEFAULT 0,
  games_behind DECIMAL(5,1) DEFAULT 0,
  rank INT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league, season, team_name)
);

-- 廣告版位資料表
CREATE TABLE IF NOT EXISTS ad_placements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('CPD','CPM')),
  position VARCHAR(100) NOT NULL,
  ad_code TEXT,
  image_url VARCHAR(1000),
  link_url VARCHAR(1000),
  client_name VARCHAR(200),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 賽事事件 (文本速報)
CREATE TABLE IF NOT EXISTS play_by_play (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  inning INT NOT NULL,                  -- 第幾局
  is_top BOOLEAN NOT NULL,              -- TRUE=上, FALSE=下
  batter_name VARCHAR(100),             -- 打者姓名
  pitcher_name VARCHAR(100),            -- 投手姓名
  situation VARCHAR(100),               -- 局面 (例: 二死走者なし)
  result_text TEXT NOT NULL,            -- 動作描述 (例: 空振りの三振)
  score_home INT DEFAULT 0,             -- 當時主隊得分
  score_away INT DEFAULT 0,             -- 當時客隊得分
  sequence_num SERIAL,                  -- 事件順序
  hitter_acnt VARCHAR(20),              -- CPBL 打者 acnt（用於大頭照）
  batting_order INT,                    -- 棒次
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投票主題
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  question VARCHAR(500) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  allow_multiple BOOLEAN DEFAULT FALSE,
  ends_at TIMESTAMPTZ,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投票選項
CREATE TABLE IF NOT EXISTS poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INT REFERENCES polls(id) ON DELETE CASCADE,
  option_text VARCHAR(300) NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投票紀錄
CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INT REFERENCES polls(id) ON DELETE CASCADE,
  option_id INT REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  voter_ip VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- Unique constraint to prevent duplicate games (date-only, JST-aware)
ALTER TABLE games DROP CONSTRAINT IF EXISTS uq_games_league_teams_date;
DROP INDEX IF EXISTS uq_games_league_teams_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_games_league_teams_date
  ON games (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo'));

-- NPB 球隊資訊（logo、所屬聯盟）
CREATE TABLE IF NOT EXISTS npb_teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  name_full VARCHAR(100),
  code VARCHAR(5) NOT NULL UNIQUE,
  npb_league VARCHAR(20) NOT NULL CHECK (npb_league IN ('Central','Pacific')),
  logo_url VARCHAR(500),
  official_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NPB 球員名冊
CREATE TABLE IF NOT EXISTS npb_players (
  id SERIAL PRIMARY KEY,
  team_code VARCHAR(5) NOT NULL,
  number VARCHAR(5),
  name_jp VARCHAR(100) NOT NULL,
  name_kana VARCHAR(100),
  position VARCHAR(20),
  batting VARCHAR(5),
  throwing VARCHAR(5),
  birth_date DATE,
  height VARCHAR(10),
  weight VARCHAR(10),
  photo_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_code, number, name_jp)
);

-- 各局比分（速報核心）
CREATE TABLE IF NOT EXISTS game_innings (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  inning INT NOT NULL,
  score_away INT,
  score_home INT,
  UNIQUE(game_id, inning)
);

-- 比賽詳細數據（R/H/E、勝敗投手、觀眾人數）
CREATE TABLE IF NOT EXISTS game_stats (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE UNIQUE,
  hits_away INT DEFAULT 0,
  hits_home INT DEFAULT 0,
  errors_away INT DEFAULT 0,
  errors_home INT DEFAULT 0,
  win_pitcher VARCHAR(100),
  loss_pitcher VARCHAR(100),
  save_pitcher VARCHAR(100),
  attendance INT,
  game_time VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 打者成績 per game
CREATE TABLE IF NOT EXISTS game_batter_stats (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  team_code VARCHAR(5) NOT NULL,
  batting_order INT,
  position VARCHAR(10),
  player_name VARCHAR(100) NOT NULL,
  at_bats INT DEFAULT 0,
  hits INT DEFAULT 0,
  rbi INT DEFAULT 0,
  runs INT DEFAULT 0,
  home_runs INT DEFAULT 0,
  strikeouts INT DEFAULT 0,
  walks INT DEFAULT 0,
  stolen_bases INT DEFAULT 0,
  hit_by_pitch INT DEFAULT 0,
  sacrifice_hits INT DEFAULT 0,
  at_bat_results TEXT[] DEFAULT '{}',
  box_avg NUMERIC(5,3)
);

-- 投手成績 per game
CREATE TABLE IF NOT EXISTS game_pitcher_stats (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  team_code VARCHAR(5) NOT NULL,
  pitcher_order INT,
  player_name VARCHAR(100) NOT NULL,
  innings_pitched VARCHAR(10),
  hits_allowed INT DEFAULT 0,
  runs_allowed INT DEFAULT 0,
  earned_runs INT DEFAULT 0,
  walks INT DEFAULT 0,
  strikeouts INT DEFAULT 0,
  result VARCHAR(5),
  pitch_count INT DEFAULT 0,
  batters_faced INT DEFAULT 0,
  home_runs_allowed INT DEFAULT 0,
  hit_by_pitch INT DEFAULT 0,
  balk INT DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pitcher_stats_game_team_player
  ON game_pitcher_stats (game_id, team_code, player_name);

-- 逐球速報 (Yahoo Baseball play-by-play)
CREATE TABLE IF NOT EXISTS game_play_by_play (
  id SERIAL PRIMARY KEY,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  inning INT NOT NULL,
  is_top BOOLEAN NOT NULL,
  play_order INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CPBL 球隊基本資料（含 logo）
CREATE TABLE IF NOT EXISTS cpbl_teams (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,   -- CPBL 內部代碼，如 AJL011
  name VARCHAR(30) NOT NULL,          -- 樂天桃猿
  short_name VARCHAR(10),             -- 桃猿
  logo_url TEXT,
  official_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CPBL 球員資料（基本資料）
CREATE TABLE IF NOT EXISTS cpbl_players (
  id SERIAL PRIMARY KEY,
  acnt VARCHAR(20) UNIQUE,           -- CPBL 內部帳號 (e.g. 0000007790)
  team_code VARCHAR(10) NOT NULL,    -- AJL011 等
  team_name VARCHAR(20) NOT NULL,    -- 樂天桃猿
  uniform_no VARCHAR(5),
  name VARCHAR(50) NOT NULL,
  position VARCHAR(20),              -- 投/捕/一/二/三/遊/左/中/右/DH
  height INT,                        -- cm
  weight INT,                        -- kg
  birth_date DATE,
  bats VARCHAR(5),                   -- 左/右/兩
  throws VARCHAR(5),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CPBL 球員賽季打擊數據（逐日累計）
CREATE TABLE IF NOT EXISTS cpbl_player_stats (
  id SERIAL PRIMARY KEY,
  acnt VARCHAR(20) REFERENCES cpbl_players(acnt) ON DELETE CASCADE,
  year INT NOT NULL,
  kind_code VARCHAR(5) NOT NULL DEFAULT 'G',  -- G=熱身 A=例行
  games INT DEFAULT 0,
  plate_appearances INT DEFAULT 0,
  at_bats INT DEFAULT 0,
  hits INT DEFAULT 0,
  doubles INT DEFAULT 0,
  triples INT DEFAULT 0,
  home_runs INT DEFAULT 0,
  rbi INT DEFAULT 0,
  runs INT DEFAULT 0,
  walks INT DEFAULT 0,
  strikeouts INT DEFAULT 0,
  stolen_bases INT DEFAULT 0,
  avg DECIMAL(5,3) DEFAULT 0,        -- 打擊率
  obp DECIMAL(5,3) DEFAULT 0,        -- 上壘率
  slg DECIMAL(5,3) DEFAULT 0,        -- 長打率
  ops DECIMAL(5,3) DEFAULT 0,        -- OPS
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(acnt, year, kind_code)
);

-- CPBL 投手賽季成績（逐日累計）
CREATE TABLE IF NOT EXISTS cpbl_pitcher_stats (
  id SERIAL PRIMARY KEY,
  acnt VARCHAR(20) REFERENCES cpbl_players(acnt) ON DELETE CASCADE,
  year INT NOT NULL,
  kind_code VARCHAR(5) NOT NULL DEFAULT 'A',
  games INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  saves INT DEFAULT 0,
  innings_pitched_num DECIMAL(6,2) DEFAULT 0,  -- 投球局（含1/3換算）
  hits_allowed INT DEFAULT 0,
  home_runs_allowed INT DEFAULT 0,
  walks INT DEFAULT 0,
  strikeouts INT DEFAULT 0,
  earned_runs INT DEFAULT 0,
  era DECIMAL(5,2) DEFAULT 0,                  -- 防禦率
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(acnt, year, kind_code)
);

-- 先發名單（スタメン）
CREATE TABLE IF NOT EXISTS game_lineups (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  team_code VARCHAR(5) NOT NULL,
  is_home BOOLEAN NOT NULL,
  batting_order INT NOT NULL,
  position VARCHAR(20),
  player_name VARCHAR(100) NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_league ON games(league);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_standings_league_season ON standings(league, season);
CREATE INDEX IF NOT EXISTS idx_ads_position_active ON ad_placements(position, is_active);
CREATE INDEX IF NOT EXISTS idx_play_by_play_game_id ON play_by_play(game_id);
CREATE INDEX IF NOT EXISTS idx_polls_active ON polls(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_npb_players_team ON npb_players(team_code);
CREATE INDEX IF NOT EXISTS idx_game_innings_game ON game_innings(game_id);
CREATE INDEX IF NOT EXISTS idx_batter_stats_game ON game_batter_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_pitcher_stats_game ON game_pitcher_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_game_lineups_game ON game_lineups(game_id);
CREATE INDEX IF NOT EXISTS idx_cpbl_players_team ON cpbl_players(team_code);
CREATE INDEX IF NOT EXISTS idx_cpbl_player_stats_acnt ON cpbl_player_stats(acnt, year);
CREATE INDEX IF NOT EXISTS idx_cpbl_pitcher_stats_acnt ON cpbl_pitcher_stats(acnt, year);
CREATE INDEX IF NOT EXISTS idx_pbp_game_id ON game_play_by_play (game_id, inning, is_top, play_order);

-- ── Live Stories ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stories (
  id           SERIAL PRIMARY KEY,
  home_team    VARCHAR(30) NOT NULL,
  away_team    VARCHAR(30) NOT NULL,
  home_abbr    VARCHAR(10) NOT NULL,
  away_abbr    VARCHAR(10) NOT NULL,
  home_color   VARCHAR(10) NOT NULL DEFAULT '#333333',
  away_color   VARCHAR(10) NOT NULL DEFAULT '#666666',
  league       VARCHAR(20) NOT NULL DEFAULT 'CPBL',
  is_live      BOOLEAN     NOT NULL DEFAULT false,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_clips (
  id                   SERIAL PRIMARY KEY,
  story_id             INT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  background_image_url TEXT NOT NULL,
  score                VARCHAR(20) NOT NULL DEFAULT '',
  situation            VARCHAR(60) NOT NULL DEFAULT '',
  key_play             VARCHAR(200) NOT NULL DEFAULT '',
  ai_insight           TEXT,
  video_url            TEXT,
  duration_ms          INT NOT NULL DEFAULT 6000,
  clip_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_story_clips_story ON story_clips(story_id, clip_order);

-- 首頁影片資料表
CREATE TABLE IF NOT EXISTS home_videos (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(300) NOT NULL DEFAULT '',
  type          VARCHAR(20)  NOT NULL DEFAULT 'youtube',
  url           VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  category      VARCHAR(100) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 文章多圖表
CREATE TABLE IF NOT EXISTS article_images (
  id         SERIAL PRIMARY KEY,
  article_id INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  image_url  VARCHAR(1000) NOT NULL,
  caption    VARCHAR(300)  DEFAULT '',
  sort_order INT           NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_images_article ON article_images(article_id);

-- 逐球投球資料（好球帶位置 + 球種）
CREATE TABLE IF NOT EXISTS game_pitch_data (
  id           SERIAL PRIMARY KEY,
  game_id      INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  at_bat_key   VARCHAR(20) NOT NULL,   -- Docomo key e.g. "0510401"
  pitch_num    INT NOT NULL DEFAULT 1, -- 打席内投球番号
  inning       INT NOT NULL,
  is_top       BOOLEAN NOT NULL,
  pitcher_name VARCHAR(100),
  batter_name  VARCHAR(100),
  ball_kind    VARCHAR(50),            -- 球種（日文） e.g. "カーブ"
  ball_kind_id VARCHAR(10),
  x            INT,                    -- 水平位置 (0~200, 100=center)
  y            INT,                    -- 垂直位置 (0~200, 低=大)
  speed        INT,                    -- 球速 km/h
  result       VARCHAR(50),            -- 結果 e.g. "見逃し"
  result_id    VARCHAR(10),
  is_strike    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game_id, at_bat_key, pitch_num)
);
CREATE INDEX IF NOT EXISTS idx_pitch_data_game ON game_pitch_data(game_id, inning, is_top);

-- 補欄位遷移（舊 DB 上線時需 ALTER TABLE）
ALTER TABLE game_batter_stats ADD COLUMN IF NOT EXISTS box_avg NUMERIC(5,3);

-- game_batter_stats 唯一性索引（支援 Docomo 先插先發再 UPSERT 實績的流程）
CREATE UNIQUE INDEX IF NOT EXISTS uq_batter_stats_game_team_player
  ON game_batter_stats (game_id, team_code, player_name);

-- 確保賽程唯一性索引（用 expression index，支援 ON CONFLICT 子句）
CREATE UNIQUE INDEX IF NOT EXISTS uq_games_league_teams_date
  ON games (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo'));
