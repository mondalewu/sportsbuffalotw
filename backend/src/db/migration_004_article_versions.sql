-- 文章版本歷史紀錄表
CREATE TABLE IF NOT EXISTS article_versions (
  id           SERIAL PRIMARY KEY,
  article_id   INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  category     VARCHAR(50) NOT NULL,
  summary      TEXT,
  content      TEXT NOT NULL,
  image_url    VARCHAR(1000),
  saved_by     INT REFERENCES users(id) ON DELETE SET NULL,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_versions_article_id ON article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_article_versions_saved_at ON article_versions(saved_at DESC);
