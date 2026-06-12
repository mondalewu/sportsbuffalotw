-- 新增「籃球」文章分類
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_category_check;
ALTER TABLE articles ADD CONSTRAINT articles_category_check
  CHECK (category IN ('WBC','CPBL','NPB','MLB','NBA','田徑','三級棒球','足球','籃球','其他'));
