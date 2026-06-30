/**
 * NPB 路由
 * GET  /api/v1/npb/teams                         — 12 支球隊 + logo
 * GET  /api/v1/npb/teams/:code/roster             — 單隊名冊
 * GET  /api/v1/npb/games/:id                      — 單場比賽基本資料
 * GET  /api/v1/npb/games/:id/innings              — 各局比分
 * GET  /api/v1/npb/games/:id/stats                — 比賽詳細數據 (R/H/E、勝敗投)
 * GET  /api/v1/npb/games/:id/batters              — 打者成績（含盗塁/死球/犠打/各回結果）
 * GET  /api/v1/npb/games/:id/pitchers             — 投手成績（含投球数/打者/被本塁打/ボーク）
 * GET  /api/v1/npb/games/:id/playbyplay           — 逐球速報 (Yahoo Baseball)
 * GET  /api/v1/npb/games/:id/at-bats              — 打席列表（Phase 2 一球速報）
 * GET  /api/v1/npb/games/:id/at-bats/:abId/pitches — 單打席投球列表
 */
import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/v1/npb/games/:id — 單場比賽基本資料（必須在 /games/:id/* 之前宣告）
router.get('/games/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, league, team_home, team_away, score_home, score_away,
              status, game_detail, venue, game_date, yahoo_game_id
       FROM games WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '找不到比賽' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: '無法取得比賽資料' });
  }
});

// GET /api/v1/npb/games/:id/at-bats — 打席列表
router.get('/games/:id/at-bats', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, inning, is_top, at_bat_order, pitcher_name, batter_name,
              result, rbi, description, bases_before, bases_after, outs_before, outs_after
       FROM game_at_bats WHERE game_id = $1
       ORDER BY inning, is_top DESC, at_bat_order`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得打席資料' });
  }
});

// GET /api/v1/npb/games/:id/at-bats/:abId/pitches — 單打席投球列表
router.get('/games/:id/at-bats/:abId/pitches', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, pitch_number, pitch_type, velocity_kmh, zone_x, zone_y,
              result, balls_after, strikes_after
       FROM game_pitches WHERE at_bat_id = $1
       ORDER BY pitch_number`,
      [req.params.abId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得球路資料' });
  }
});

// GET /api/v1/npb/teams
router.get('/teams', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, name, name_full, code, npb_league, logo_url, official_url
       FROM npb_teams ORDER BY npb_league, id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get NPB teams error:', err);
    res.status(500).json({ message: '無法取得球隊資料' });
  }
});

// GET /api/v1/npb/teams/:code/roster
router.get('/teams/:code/roster', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, number, name_jp, name_kana, position, batting, throwing,
              birth_date, height, weight
       FROM npb_players
       WHERE team_code = $1
       ORDER BY
         CASE position
           WHEN '投手'   THEN 1
           WHEN '捕手'   THEN 2
           WHEN '内野手' THEN 3
           WHEN '外野手' THEN 4
           ELSE 5
         END,
         CAST(NULLIF(REGEXP_REPLACE(number, '[^0-9]', '', 'g'), '') AS INT) NULLS LAST`,
      [req.params.code]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get roster error:', err);
    res.status(500).json({ message: '無法取得名冊資料' });
  }
});

// GET /api/v1/npb/games/:id/innings
router.get('/games/:id/innings', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT inning, score_away, score_home
       FROM game_innings WHERE game_id = $1 ORDER BY inning`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get innings error:', err);
    res.status(500).json({ message: '無法取得局數資料' });
  }
});

// GET /api/v1/npb/games/:id/stats
router.get('/games/:id/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT hits_away, hits_home, errors_away, errors_home,
              win_pitcher, loss_pitcher, save_pitcher, attendance, game_time
       FROM game_stats WHERE game_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.json(null);
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get game stats error:', err);
    res.status(500).json({ message: '無法取得比賽數據' });
  }
});

// GET /api/v1/npb/games/:id/batters
router.get('/games/:id/batters', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT team_code, batting_order, position, player_name,
              at_bats, hits, rbi, runs, home_runs, strikeouts, walks,
              stolen_bases, hit_by_pitch, sacrifice_hits, at_bat_results, box_avg
       FROM game_batter_stats WHERE game_id = $1
       ORDER BY team_code, batting_order`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get batter stats error:', err);
    res.status(500).json({ message: '無法取得打者成績' });
  }
});

// GET /api/v1/npb/games/:id/pitchers
router.get('/games/:id/pitchers', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT team_code, pitcher_order, player_name, innings_pitched,
              hits_allowed, runs_allowed, earned_runs, walks, strikeouts, result,
              pitch_count, batters_faced, home_runs_allowed, hit_by_pitch, balk
       FROM game_pitcher_stats WHERE game_id = $1
       ORDER BY team_code, pitcher_order`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get pitcher stats error:', err);
    res.status(500).json({ message: '無法取得投手成績' });
  }
});

// GET /api/v1/npb/games/:id/playbyplay
router.get('/games/:id/playbyplay', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT inning, is_top, play_order, description,
              COALESCE(balls, 0) AS balls,
              COALESCE(strikes, 0) AS strikes,
              COALESCE(outs_before, 0) AS outs_before
       FROM game_play_by_play WHERE game_id = $1
       ORDER BY inning, is_top DESC, play_order`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get play-by-play error:', err);
    res.status(500).json({ message: '無法取得速報資料' });
  }
});

// GET /api/v1/npb/standings — NPB 一軍積分榜 (Central + Pacific)
router.get('/standings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT league, team_name, wins, losses, draws,
              win_rate::float AS win_rate,
              games_behind::float AS games_behind,
              rank,
              (wins + losses + draws) AS games,
              COALESCE(runs_scored, 0) AS runs_scored,
              COALESCE(runs_allowed, 0) AS runs_allowed
       FROM standings
       WHERE league IN ('NPB-Central','NPB-Pacific') AND season = '2026'
       ORDER BY league, rank`,
    );
    const grouped: Record<string, typeof result.rows> = {};
    for (const row of result.rows) {
      if (!grouped[row.league]) grouped[row.league] = [];
      grouped[row.league].push(row);
    }
    res.json({
      central: grouped['NPB-Central'] ?? [],
      pacific: grouped['NPB-Pacific'] ?? [],
    });
  } catch (err) {
    res.status(500).json({ message: '無法取得一軍順位表' });
  }
});

// GET /api/v1/npb/farm/standings — 東/中/西 地区順位表
router.get('/farm/standings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT league, team_name, wins, losses, draws,
              win_rate::float AS win_rate,
              games_behind::float AS games_behind,
              rank,
              (wins + losses + draws) AS games
       FROM standings
       WHERE league IN ('NPB2-East','NPB2-Central','NPB2-West') AND season = '2026'
       ORDER BY league, rank`,
    );
    const grouped: Record<string, typeof result.rows> = {};
    for (const row of result.rows) {
      if (!grouped[row.league]) grouped[row.league] = [];
      grouped[row.league].push(row);
    }
    res.json({
      east:    grouped['NPB2-East']    ?? [],
      central: grouped['NPB2-Central'] ?? [],
      west:    grouped['NPB2-West']    ?? [],
    });
  } catch (err) {
    res.status(500).json({ message: '無法取得二軍順位表' });
  }
});

// GET /api/v1/npb/farm/games?date=YYYY-MM-DD — 二軍試合一覧（指定日 or 今日）
router.get('/farm/games', async (req: Request, res: Response): Promise<void> => {
  try {
    const date = (req.query.date as string) || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT id, team_home, team_away, score_home, score_away,
              status, game_detail, venue, game_date, npb_url
       FROM games
       WHERE league = 'NPB2'
         AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
       ORDER BY game_date`,
      [date],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得二軍賽程' });
  }
});

// GET /api/v1/npb/farm/recent — 當週二軍試合
router.get('/farm/recent', async (_req: Request, res: Response): Promise<void> => {
  try {
    // 當週 Mon–Sun (Asia/Tokyo)
    const result = await pool.query(
      `SELECT id, team_home, team_away, score_home, score_away,
              status, game_detail, venue, game_date, npb_url
       FROM games
       WHERE league = 'NPB2'
         AND DATE(game_date AT TIME ZONE 'Asia/Tokyo')
             BETWEEN date_trunc('week', NOW() AT TIME ZONE 'Asia/Tokyo')::date
                 AND date_trunc('week', NOW() AT TIME ZONE 'Asia/Tokyo')::date + 6
       ORDER BY game_date ASC`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得二軍近期賽程' });
  }
});

// GET /api/v1/npb/recent — 當週一軍試合 (NPB oープン戦 + 例行賽)
router.get('/recent', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, league, team_home, team_away, score_home, score_away,
              status, game_detail, venue, game_date
       FROM games
       WHERE league = 'NPB'
         AND DATE(game_date AT TIME ZONE 'Asia/Tokyo')
             BETWEEN date_trunc('week', NOW() AT TIME ZONE 'Asia/Tokyo')::date
                 AND date_trunc('week', NOW() AT TIME ZONE 'Asia/Tokyo')::date + 6
       ORDER BY game_date ASC`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得一軍近期賽程' });
  }
});

// GET /api/v1/npb/preseason-standings — 熱身賽勝敗計算（從 games 表）
router.get('/preseason-standings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT team, league_group,
              COUNT(*) AS games,
              COUNT(*) FILTER (WHERE won)  AS wins,
              COUNT(*) FILTER (WHERE lost) AS losses,
              COUNT(*) FILTER (WHERE drew) AS draws,
              ROUND(
                COUNT(*) FILTER (WHERE won)::numeric /
                NULLIF(COUNT(*) FILTER (WHERE won) + COUNT(*) FILTER (WHERE lost), 0),
                3
              ) AS win_rate,
              SUM(team_score) AS runs_scored,
              SUM(opp_score)  AS runs_allowed
       FROM (
         SELECT team_home AS team,
                CASE WHEN score_home > score_away THEN TRUE ELSE FALSE END AS won,
                CASE WHEN score_home < score_away THEN TRUE ELSE FALSE END AS lost,
                CASE WHEN score_home = score_away THEN TRUE ELSE FALSE END AS drew,
                score_home AS team_score,
                score_away AS opp_score
         FROM games WHERE league='NPB' AND status='final' AND score_home IS NOT NULL
         UNION ALL
         SELECT team_away AS team,
                CASE WHEN score_away > score_home THEN TRUE ELSE FALSE END AS won,
                CASE WHEN score_away < score_home THEN TRUE ELSE FALSE END AS lost,
                CASE WHEN score_away = score_home THEN TRUE ELSE FALSE END AS drew,
                score_away AS team_score,
                score_home AS opp_score
         FROM games WHERE league='NPB' AND status='final' AND score_away IS NOT NULL
       ) t
       LEFT JOIN (
         SELECT DISTINCT ON (name) name, npb_league AS league_group
         FROM npb_teams
       ) nt ON nt.name = t.team
       GROUP BY team, league_group
       ORDER BY wins DESC, losses ASC`,
    );

    // 計算勝差
    const addGamesBehind = (rows: typeof result.rows) => {
      if (rows.length === 0) return rows;
      const leader = rows[0];
      return rows.map(r => ({
        ...r,
        games_behind: r === leader ? null :
          ((Number(leader.wins) - Number(r.wins)) + (Number(r.losses) - Number(leader.losses))) / 2,
      }));
    };

    const central: typeof result.rows = [];
    const pacific: typeof result.rows = [];
    const unknown: typeof result.rows = [];
    for (const row of result.rows) {
      if (row.league_group === 'Central') central.push(row);
      else if (row.league_group === 'Pacific') pacific.push(row);
      else unknown.push(row);
    }
    res.json({
      central: addGamesBehind(central),
      pacific: addGamesBehind(pacific),
      unknown: addGamesBehind(unknown),
    });
  } catch (err) {
    res.status(500).json({ message: '無法計算熱身賽順位' });
  }
});

// GET /api/v1/npb/games/:id/pitch-data — 逐球投球位置 + 球種（Docomo）
router.get('/games/:id/pitch-data', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT at_bat_key, pitch_num, inning, is_top, pitcher_name, batter_name,
              ball_kind, ball_kind_id, x, y, speed, result, result_id, is_strike
       FROM game_pitch_data
       WHERE game_id = $1
       ORDER BY inning ASC, is_top DESC, at_bat_key ASC, pitch_num ASC`,
      [req.params.id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得投球資料' });
  }
});

// GET /api/v1/npb/games/:id/youtube-highlight
const ytCache = new Map<string, { data: object; at: number }>();

// 一軍：主場球隊 → YouTube channel ID
const TEAM_YT_CHANNEL: Record<string, string> = {
  // 太平洋聯盟 → PacificLeagueTV 官方頻道
  'ソフトバンク': 'UCFLlVBMqvBRVKQFa3vxl2oA',
  '日本ハム':     'UCFLlVBMqvBRVKQFa3vxl2oA',
  '楽天':         'UCFLlVBMqvBRVKQFa3vxl2oA',
  'ロッテ':       'UCFLlVBMqvBRVKQFa3vxl2oA',
  '西武':         'UCFLlVBMqvBRVKQFa3vxl2oA',
  'オリックス':   'UCFLlVBMqvBRVKQFa3vxl2oA',
  // 中央聯盟
  '巨人':   'UCWmpFBbHOphUFBymCkBT6vA', // ntv_baseball
  '阪神':   'UCJlRHDvGMt0FeSEEOKBJB2g', // hanshintigers_official
  'DeNA':   'UChJI9KrjSgPzv_kfX6yuqhA', // baystarsofficial
  'ヤクルト': 'UCt7cNctKXoKece38M9gJV7A', // Yakult-swallowsCoJp
  // 中日・広島 → fallback 全域搜尋
};

// 二軍：主場球隊 → YouTube channel ID
const FARM_TEAM_YT_CHANNEL: Record<string, string> = {
  'ヤクルト':     'UCt7cNctKXoKece38M9gJV7A', // @Yakult-swallowsCoJp
  '阪神':         'UCJlRHDvGMt0FeSEEOKBJB2g', // @hanshintigers_official
  'DeNA':         'UChJI9KrjSgPzv_kfX6yuqhA', // @baystarsofficial
  '巨人':         'UCWmpFBbHOphUFBymCkBT6vA', // ntv_baseball
  'ソフトバンク': 'UCbDAmhyRx9bakv-0Gucglgg', // @SBHawksOfficial
  '日本ハム':     'UCc8GvFE9z3j6vphwhGpyjMQ', // @GAORATV
  'オリックス':   'UCE_pCd9bB79Tf8eC_QZHkpA', // @buffaloestv
  '楽天':         'UCFLlVBMqvBRVKQFa3vxl2oA', // PacificLeagueTV（個別頻道未確認）
  'ロッテ':       'UCFLlVBMqvBRVKQFa3vxl2oA',
  '西武':         'UCFLlVBMqvBRVKQFa3vxl2oA',
};

router.get('/games/:id/youtube-highlight', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(503).json({ message: 'YOUTUBE_API_KEY 未設定' });
    return;
  }

  // 快取：60 分鐘
  const cached = ytCache.get(req.params.id);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) {
    res.json(cached.data);
    return;
  }

  try {
    const gameRes = await pool.query(
      `SELECT team_away, team_home, game_date, status FROM games WHERE id = $1`,
      [req.params.id],
    );
    if (!gameRes.rows.length) { res.status(404).json({ message: '找不到比賽' }); return; }
    const { team_away, team_home, game_date, status } = gameRes.rows[0];

    const gameDay = new Date(game_date);
    const dateStr = gameDay.toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric',
    });

    // DeNA 官方頻道影片標題格式為「YYYY.M.DD ハイライト【DeNA vs 相手】」
    // 主場名稱在前，故搜尋時也以主場優先，並縮小日期範圍避免誤抓其他日期影片
    const isDeNAHome = team_home === 'DeNA';
    const query = isDeNAHome
      ? `DeNA ハイライト ${dateStr}`
      : `${team_away} ${team_home} ハイライト ${dateStr}`;

    const afterDate = new Date(gameDay);
    afterDate.setDate(afterDate.getDate() - 1);
    const beforeDate = new Date(gameDay);
    // DeNA 頻道通常隔天上傳，給 3 天緩衝；其他隊維持寬鬆範圍
    beforeDate.setDate(beforeDate.getDate() + (isDeNAHome ? 3 : 14));

    const buildUrl = (channelId?: string) => {
      const u = new URL('https://www.googleapis.com/youtube/v3/search');
      u.searchParams.set('part', 'snippet');
      u.searchParams.set('q', query);
      u.searchParams.set('type', 'video');
      u.searchParams.set('maxResults', '3');
      u.searchParams.set('order', 'relevance');
      u.searchParams.set('key', apiKey);
      u.searchParams.set('publishedAfter', afterDate.toISOString());
      u.searchParams.set('publishedBefore', beforeDate.toISOString());
      if (channelId) u.searchParams.set('channelId', channelId);
      return u;
    };

    const channelId = TEAM_YT_CHANNEL[team_home];
    let ytRes = await fetch(buildUrl(channelId).toString());
    // 若指定頻道找不到影片，fallback 全域搜尋
    if (ytRes.ok) {
      const peek = await ytRes.clone().json() as { items?: unknown[] };
      if (channelId && (!peek.items || peek.items.length === 0)) {
        console.log(`[NPB YT] ${team_home} channel search empty, fallback to global`);
        ytRes = await fetch(buildUrl().toString());
      }
    }
    if (!ytRes.ok) {
      res.status(502).json({ message: 'YouTube API 錯誤', detail: await ytRes.text() });
      return;
    }
    const ytJson = await ytRes.json() as {
      items?: { id: { videoId: string }; snippet: { title: string; thumbnails: { medium: { url: string } } } }[];
    };

    const items = (ytJson.items ?? []).map(v => ({
      videoId: v.id.videoId,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails?.medium?.url ?? '',
    }));

    const data = { query, items, status };
    ytCache.set(req.params.id, { data, at: Date.now() });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: '無法取得 YouTube 精華', detail: (err as Error).message });
  }
});

// GET /api/v1/npb/games/:id/youtube-farm-highlight — 二軍賽後精華
const ytFarmCache = new Map<string, { data: object; at: number }>();

router.get('/games/:id/youtube-farm-highlight', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { res.status(503).json({ message: 'YOUTUBE_API_KEY 未設定' }); return; }

  const cached = ytFarmCache.get(req.params.id);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) { res.json(cached.data); return; }

  try {
    const gameRes = await pool.query(
      `SELECT team_away, team_home, game_date, status FROM games WHERE id = $1`,
      [req.params.id],
    );
    if (!gameRes.rows.length) { res.status(404).json({ message: '找不到比賽' }); return; }
    const { team_away, team_home, game_date, status } = gameRes.rows[0];

    const gameDay = new Date(game_date);
    const mm = String(gameDay.getMonth() + 1);
    const dd = String(gameDay.getDate());
    const query = `ファームハイライト ${mm}月${dd}日 ${team_away} ${team_home}`;

    const afterDate = new Date(gameDay); afterDate.setDate(afterDate.getDate() - 1);
    const beforeDate = new Date(gameDay); beforeDate.setDate(beforeDate.getDate() + 5);

    const buildUrl = (channelId?: string) => {
      const u = new URL('https://www.googleapis.com/youtube/v3/search');
      u.searchParams.set('part', 'snippet');
      u.searchParams.set('q', query);
      u.searchParams.set('type', 'video');
      u.searchParams.set('maxResults', '3');
      u.searchParams.set('order', 'relevance');
      u.searchParams.set('key', apiKey);
      u.searchParams.set('publishedAfter', afterDate.toISOString());
      u.searchParams.set('publishedBefore', beforeDate.toISOString());
      if (channelId) u.searchParams.set('channelId', channelId);
      return u;
    };

    const channelId = FARM_TEAM_YT_CHANNEL[team_home];
    let ytRes = await fetch(buildUrl(channelId).toString());
    if (ytRes.ok) {
      const peek = await ytRes.clone().json() as { items?: unknown[] };
      if (channelId && (!peek.items || peek.items.length === 0)) {
        ytRes = await fetch(buildUrl().toString());
      }
    }
    if (!ytRes.ok) { res.status(502).json({ message: 'YouTube API 錯誤' }); return; }

    const ytJson = await ytRes.json() as {
      items?: { id: { videoId: string }; snippet: { title: string; thumbnails: { medium: { url: string } } } }[];
    };
    const items = (ytJson.items ?? []).map(v => ({
      videoId: v.id.videoId,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails?.medium?.url ?? '',
    }));

    const data = { query, items, status };
    ytFarmCache.set(req.params.id, { data, at: Date.now() });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: '無法取得 YouTube 精華', detail: (err as Error).message });
  }
});

export default router;
