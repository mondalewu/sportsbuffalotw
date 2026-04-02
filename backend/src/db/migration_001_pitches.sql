-- Migration 001: Add pitch-by-pitch tracking tables
-- Run: docker exec -i cloudecode-db-1 psql -U postgres -d sportsdb < migration_001_pitches.sql

-- 打席資料（一球速報的打席單位）
CREATE TABLE IF NOT EXISTS game_at_bats (
  id SERIAL PRIMARY KEY,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  inning INT NOT NULL,
  is_top BOOLEAN NOT NULL,             -- TRUE=上半(客隊打), FALSE=下半(主隊打)
  at_bat_order INT NOT NULL,           -- 打席順序（該半局內的第幾打席）
  pitcher_name VARCHAR(100),
  batter_name VARCHAR(100),
  result VARCHAR(30),                  -- 'single','double','triple','hr','so','bb','hbp','out','sac','dp','error','fc'
  rbi INT DEFAULT 0,
  description TEXT,
  bases_before SMALLINT DEFAULT 0,    -- 進壘前壘包狀態（位元遮罩：bit0=1B, bit1=2B, bit2=3B）
  bases_after SMALLINT DEFAULT 0,     -- 進壘後壘包狀態
  outs_before INT DEFAULT 0,          -- 打席前出局數 (0,1,2)
  outs_after INT DEFAULT 0,           -- 打席後出局數
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_at_bats_game ON game_at_bats(game_id, inning, is_top, at_bat_order);

-- 一球速報（每一球的詳細資料）
CREATE TABLE IF NOT EXISTS game_pitches (
  id SERIAL PRIMARY KEY,
  at_bat_id INT NOT NULL REFERENCES game_at_bats(id) ON DELETE CASCADE,
  pitch_number INT NOT NULL,           -- 打席內的第幾球（1, 2, 3...）
  pitch_type VARCHAR(20),              -- 'FASTBALL','SLIDER','CURVE','CHANGEUP','CUTTER','SINKER','SPLITTER','OTHER'
  velocity_kmh INT,                    -- 球速（公里/小時）
  zone_x DECIMAL(4,2),                -- 水平位置（-1.0=最左 ~ 1.0=最右，打者視角）
  zone_y DECIMAL(4,2),                -- 垂直位置（1.0=最低 ~ 4.0=最高）
  result VARCHAR(20),                  -- 'ball','called_strike','swinging_strike','foul','in_play','hbp'
  balls_after INT DEFAULT 0,           -- 投球後壞球數
  strikes_after INT DEFAULT 0,         -- 投球後好球數
  UNIQUE(at_bat_id, pitch_number)
);

CREATE INDEX IF NOT EXISTS idx_pitches_at_bat ON game_pitches(at_bat_id);
