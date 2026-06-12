-- 115年玉山盃全國青棒錦標賽 種子資料（冪等，可重複執行）

DO $$
DECLARE
  t_id INT;
BEGIN

-- ── 賽事 ────────────────────────────────────────────────────────────────────
INSERT INTO tw_baseball_tournaments (level, name, year, start_date, end_date, format, status)
VALUES ('senior', '115年玉山盃全國青棒錦標賽', 2026, '2026-06-11', '2026-06-20', '分組循環賽制', 'ongoing')
ON CONFLICT (name, year) DO UPDATE SET status = EXCLUDED.status;

SELECT id INTO t_id FROM tw_baseball_tournaments
WHERE name = '115年玉山盃全國青棒錦標賽' AND year = 2026;

-- ── 比賽結果 ─────────────────────────────────────────────────────────────────
-- 6月11日 分組賽
INSERT INTO tw_baseball_games (tournament_id, team_away, team_home, score_away, score_home, status, game_date, round)
VALUES
  (t_id, '臺南市', '屏東縣', 4, 3, 'final', '2026-06-11 13:00:00+08', '分組賽'),
  (t_id, '桃園市', '金門縣', 21, 0, 'final', '2026-06-11 13:00:00+08', '分組賽'),
  (t_id, '臺東縣', '苗栗縣', 12, 1, 'final', '2026-06-11 13:00:00+08', '分組賽'),
  (t_id, '高雄市', '南投縣', 17, 4, 'final', '2026-06-11 13:00:00+08', '分組賽'),
  (t_id, '花蓮縣', '彰化縣', 10, 0, 'final', '2026-06-11 13:00:00+08', '分組賽')
ON CONFLICT (tournament_id, round, team_away, team_home) DO UPDATE
  SET score_away = EXCLUDED.score_away,
      score_home = EXCLUDED.score_home,
      status = EXCLUDED.status;

-- 6月12日 分組賽（含 6/11 延賽補播）
INSERT INTO tw_baseball_games (tournament_id, team_away, team_home, score_away, score_home, status, game_date, round)
VALUES
  (t_id, '雲林縣', '臺北市', 3, 2, 'final', '2026-06-12 09:00:00+08', '分組賽'),
  (t_id, '臺北市', '金門縣', 23, 2, 'final', '2026-06-12 13:00:00+08', '分組賽'),
  (t_id, '屏東縣', '苗栗縣', 7, 0, 'final', '2026-06-12 13:00:00+08', '分組賽'),
  (t_id, '新北市', '新竹市', 9, 0, 'final', '2026-06-12 13:00:00+08', '分組賽'),
  (t_id, '嘉義縣', '臺中市', NULL, NULL, 'scheduled', '2026-06-12 13:00:00+08', '分組賽'),
  (t_id, '嘉義市', '雲林縣', NULL, NULL, 'scheduled', '2026-06-12 16:00:00+08', '分組賽'),
  (t_id, '宜蘭縣', '臺南市', NULL, NULL, 'scheduled', '2026-06-12 16:00:00+08', '分組賽')
ON CONFLICT (tournament_id, round, team_away, team_home) DO UPDATE
  SET score_away = EXCLUDED.score_away,
      score_home = EXCLUDED.score_home,
      status = EXCLUDED.status;

-- ── 選手名單 ──────────────────────────────────────────────────────────────────

-- 台中市（衛冕軍）
INSERT INTO tw_baseball_rosters (tournament_id, team_name, player_name, position, notes) VALUES
  (t_id, '臺中市', '林承俊', '投手', NULL),
  (t_id, '臺中市', '賴承鍇', '投手', NULL),
  (t_id, '臺中市', '張凱祥', '投手', NULL),
  (t_id, '臺中市', '范書維', '投手', NULL),
  (t_id, '臺中市', '游承翰', '投手', NULL),
  (t_id, '臺中市', '李楷棋', '野手', NULL),
  (t_id, '臺中市', '吳承皓', '野手', NULL),
  (t_id, '臺中市', '焦子杰', '野手', NULL),
  (t_id, '臺中市', '劉家穎', '野手', NULL),
  (t_id, '臺中市', '楊子沁', '野手', NULL),
  (t_id, '臺中市', '莊辰安逸', '野手', NULL),
  (t_id, '臺中市', '楊才鋒', '野手', NULL),
  (t_id, '臺中市', '阮宥瑋', '野手', NULL),
  (t_id, '臺中市', '吳宣', '野手', NULL)
ON CONFLICT (tournament_id, team_name, player_name) DO NOTHING;

-- 新北市（穀保家商為主）
INSERT INTO tw_baseball_rosters (tournament_id, team_name, player_name, position, school) VALUES
  (t_id, '新北市', '張乙安', '野手/終結者', '穀保家商'),
  (t_id, '新北市', '胡辰睿', '外野手', '穀保家商'),
  (t_id, '新北市', '帕蘇拉·塔基斯利尼安', '野手', '穀保家商'),
  (t_id, '新北市', '黃世堯', '捕手', '穀保家商'),
  (t_id, '新北市', '饒又語', '投手', '穀保家商'),
  (t_id, '新北市', '吳昊翔', '投手', '穀保家商'),
  (t_id, '新北市', '楊曜丞', '投手', '穀保家商'),
  (t_id, '新北市', '林鎮羽', '投手', '穀保家商'),
  (t_id, '新北市', '許宸緯', '投手', '秀峰高中'),
  (t_id, '新北市', '鄧羽翔', '二壘/三壘/游擊', '穀保家商'),
  (t_id, '新北市', '吳彥緯', '野手/捕手', '穀保家商'),
  (t_id, '新北市', '柯邵捷', '野手', '穀保家商'),
  (t_id, '新北市', '吉路·少瑪', '野手', '穀保家商'),
  (t_id, '新北市', '杜翊澤', '野手', '穀保家商'),
  (t_id, '新北市', '石主恩', '野手', '穀保家商')
ON CONFLICT (tournament_id, team_name, player_name) DO NOTHING;

-- 桃園市
INSERT INTO tw_baseball_rosters (tournament_id, team_name, player_name, position, school) VALUES
  (t_id, '桃園市', '劉任右', '投手(左投)', '平鎮高中'),
  (t_id, '桃園市', '何樺', '投手', '平鎮高中'),
  (t_id, '桃園市', '賴謙凡', '投手', '大溪高中'),
  (t_id, '桃園市', '林珺希', '投手', '大溪高中'),
  (t_id, '桃園市', '黃宥儒', '投手', '北科附工'),
  (t_id, '桃園市', '李承濬', '投手(左投)', NULL),
  (t_id, '桃園市', '蔡辰瀧', '投手', NULL),
  (t_id, '桃園市', '林昀樂', '捕手', '北科附工'),
  (t_id, '桃園市', '吳柏承', '捕手', NULL),
  (t_id, '桃園市', '陳柏凱', '游擊手', NULL),
  (t_id, '桃園市', '幸世賢', '外野手', NULL),
  (t_id, '桃園市', '高宥軒', '中外野', NULL),
  (t_id, '桃園市', '劉桓宇', '野手', NULL),
  (t_id, '桃園市', '邱聖安', '野手', NULL),
  (t_id, '桃園市', '曾乙喆', '野手', NULL)
ON CONFLICT (tournament_id, team_name, player_name) DO NOTHING;

-- 高雄市（普門高中為主）
INSERT INTO tw_baseball_rosters (tournament_id, team_name, player_name, position, school) VALUES
  (t_id, '高雄市', '鄭品紳', '投手', '普門'),
  (t_id, '高雄市', '陳昱勛', '投手', '高苑工商'),
  (t_id, '高雄市', '黃子芫', '投手', '高苑工商'),
  (t_id, '高雄市', '葉韋辰', '投手(側投)', '普門'),
  (t_id, '高雄市', '傅振閎', '投手(中繼)', '普門'),
  (t_id, '高雄市', '陳宥銘', '投手(終結者)', '普門'),
  (t_id, '高雄市', '邱孝佑', '投手(左投)', '普門'),
  (t_id, '高雄市', '張耀斌', '投手/野手', '三民高中'),
  (t_id, '高雄市', '陳韋帆', '外野手', '普門'),
  (t_id, '高雄市', '羅暐捷', '外野手', '高苑工商'),
  (t_id, '高雄市', '胡誠恩', '捕手', '普門'),
  (t_id, '高雄市', '顏浩恩', '捕手', '普門'),
  (t_id, '高雄市', '江陳廷偉', '野手', '普門'),
  (t_id, '高雄市', '馬佑嘉', '野手', '普門'),
  (t_id, '高雄市', '全永樂', '游擊手', '普門')
ON CONFLICT (tournament_id, team_name, player_name) DO NOTHING;

-- 台南市（台南海事為主）
INSERT INTO tw_baseball_rosters (tournament_id, team_name, player_name, position, school) VALUES
  (t_id, '臺南市', '吳杰叡', '投手', '台南海事'),
  (t_id, '臺南市', '陳品睿', '投手', '台南海事'),
  (t_id, '臺南市', '劉顓瑜', '投手', '台南海事'),
  (t_id, '臺南市', '邱丞軒', '投手', '台南海事'),
  (t_id, '臺南市', '蔡學孟', '投手', '台南海事'),
  (t_id, '臺南市', '陳品全', '投手/野手', '台南海事'),
  (t_id, '臺南市', '姜晉錫', '投手', '南英商工'),
  (t_id, '臺南市', '邱宥潔', '捕手', '台南海事'),
  (t_id, '臺南市', '曾翊瑋', '捕手', '台南海事'),
  (t_id, '臺南市', '陳鑫安', '一壘/指定打擊', '台南海事'),
  (t_id, '臺南市', '張仲凱', '中外野', '台南海事'),
  (t_id, '臺南市', '徐可杰', '左外野', '台南海事'),
  (t_id, '臺南市', '吳家宇', '一壘手', '南英商工'),
  (t_id, '臺南市', '翁辰峰', '內外野', '善化高中'),
  (t_id, '臺南市', '林軒藙', '野手', '善化高中'),
  (t_id, '臺南市', '潘鏡臣', '野手', '台南海事')
ON CONFLICT (tournament_id, team_name, player_name) DO NOTHING;

-- 花蓮縣（花蓮體中）
INSERT INTO tw_baseball_rosters (tournament_id, team_name, player_name, position, school) VALUES
  (t_id, '花蓮縣', '黃畯邵', '投手/打者', '花蓮體中'),
  (t_id, '花蓮縣', '黃泓燁', '投手', '花蓮體中'),
  (t_id, '花蓮縣', '羅維倫', '內野手', '花蓮體中'),
  (t_id, '花蓮縣', '曾奕澄', '捕手/投手', '花蓮體中')
ON CONFLICT (tournament_id, team_name, player_name) DO NOTHING;

END $$;
