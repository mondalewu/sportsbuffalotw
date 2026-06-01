-- 注目選手資料表
CREATE TABLE IF NOT EXISTS athletes (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  country    VARCHAR(50)  NOT NULL DEFAULT 'TW 台灣',
  event      VARCHAR(200) NOT NULL,
  pb         VARCHAR(50),
  note       VARCHAR(300),
  image_url  VARCHAR(1000),
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
