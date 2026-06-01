-- 更新 articles.category CHECK 約束，新增「田徑」分類
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_category_check;
ALTER TABLE articles ADD CONSTRAINT articles_category_check
  CHECK (category IN ('WBC','CPBL','NPB','MLB','NBA','田徑','其他'));
