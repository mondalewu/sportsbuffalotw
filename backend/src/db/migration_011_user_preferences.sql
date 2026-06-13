CREATE TABLE IF NOT EXISTS user_preferences (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sports      TEXT[]  NOT NULL DEFAULT '{}',
  fav_teams   JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
