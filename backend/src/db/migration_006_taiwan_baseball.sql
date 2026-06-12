-- 台灣三級棒球 — 賽事資料表

CREATE TABLE IF NOT EXISTS tw_baseball_tournaments (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20) NOT NULL CHECK (level IN ('senior', 'junior', 'youth')),
  name VARCHAR(200) NOT NULL,
  year INT NOT NULL,
  start_date DATE,
  end_date DATE,
  format VARCHAR(50),
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tw_baseball_games (
  id SERIAL PRIMARY KEY,
  tournament_id INT REFERENCES tw_baseball_tournaments(id) ON DELETE CASCADE,
  team_home VARCHAR(100) NOT NULL,
  team_away VARCHAR(100) NOT NULL,
  score_home INT,
  score_away INT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final', 'cancelled')),
  game_date TIMESTAMPTZ,
  venue VARCHAR(200),
  round VARCHAR(100),
  game_detail VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tw_tournaments_level_year ON tw_baseball_tournaments(level, year);
CREATE INDEX IF NOT EXISTS idx_tw_games_tournament ON tw_baseball_games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tw_games_date ON tw_baseball_games(game_date);
