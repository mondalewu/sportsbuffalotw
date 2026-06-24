-- 文章草稿狀態
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
