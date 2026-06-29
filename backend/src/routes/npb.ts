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
// 主場球隊對應官方 YouTube 頻道，在該頻道內搜尋賽後精華
const ytCache = new Map<string, { data: object; at: number }>();

// 主場球隊 → YouTube handle 對照表
const TEAM_YT_HANDLE: Record<string, string> = {
  // 太平洋聯盟
  'ソフトバンク': 'PacificLeagueTVofficial',
  '日本ハム':     'PacificLeagueTVofficial',
  '楽天':         'PacificLeagueTVofficial',
  'ロッテ':       'PacificLeagueTVofficial',
  '西武':         'PacificLeagueTVofficial',
  'オリックス':   'PacificLeagueTVofficial',
  // 中央聯盟
  '巨人':   'ntv_baseball',
  '阪神':   'hanshintigers_official',
  '中日':   'jsports_yakyu',
  '広島':   'jsports_yakyu',
  'DeNA':   'baystarsofficial',
  // ヤクルト 無官方頻道，fallback 全域搜尋
};

// handle → channelId 快取（啟動後只 fetch 一次）
const handleToChannelId = new Map<string, string>();

async function getChannelId(handle: string, apiKey: string): Promise<string | null> {
  if (handleToChannelId.has(handle)) return handleToChannelId.get(handle)!;
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'id');
    url.searchParams.set('forHandle', handle);
    url.searchParams.set('key', apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = await res.json() as { items?: { id: string }[] };
    const id = json.items?.[0]?.id ?? null;
    if (id) handleToChannelId.set(handle, id);
    return id;
  } catch { return null; }
}

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

    const dateStr = new Date(game_date).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric',
    });
    const query = `${team_away} ${team_home} ハイライト ${dateStr}`;

    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '3');
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('key', apiKey);

    // 限制只搜尋比賽日期前後 3 天內的影片，避免出現舊年度影片
    const gameDay = new Date(game_date);
    const afterDate = new Date(gameDay);
    afterDate.setDate(afterDate.getDate() - 1);
    const beforeDate = new Date(gameDay);
    beforeDate.setDate(beforeDate.getDate() + 3);
    url.searchParams.set('publishedAfter', afterDate.toISOString());
    url.searchParams.set('publishedBefore', beforeDate.toISOString());

    // 依主場球隊查對應官方頻道
    const handle = TEAM_YT_HANDLE[team_home];
    if (handle) {
      const chId = await getChannelId(handle, apiKey);
      if (chId) url.searchParams.set('channelId', chId);
    }

    const ytRes = await fetch(url.toString());
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

export default router;
