-- 台灣三級棒球 — 選手名單資料表

CREATE TABLE IF NOT EXISTS tw_baseball_rosters (
  id SERIAL PRIMARY KEY,
  tournament_id INT REFERENCES tw_baseball_tournaments(id) ON DELETE CASCADE,
  team_name VARCHAR(100) NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  jersey_number VARCHAR(10),
  position VARCHAR(50),
  school VARCHAR(100),
  notes VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tw_rosters_tournament ON tw_baseball_rosters(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tw_rosters_team ON tw_baseball_rosters(tournament_id, team_name);

-- 賽事名稱唯一性（避免重複插入種子資料）
ALTER TABLE tw_baseball_tournaments
  ADD CONSTRAINT IF NOT EXISTS uq_tw_tournament_name_year UNIQUE (name, year);

-- 比賽唯一性
ALTER TABLE tw_baseball_games
  ADD CONSTRAINT IF NOT EXISTS uq_tw_game UNIQUE (tournament_id, round, team_away, team_home);

-- 選手唯一性
ALTER TABLE tw_baseball_rosters
  ADD CONSTRAINT IF NOT EXISTS uq_tw_roster_player UNIQUE (tournament_id, team_name, player_name);
