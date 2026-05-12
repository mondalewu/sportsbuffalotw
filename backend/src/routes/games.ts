import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element as CheerioElement } from 'domhandler';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';
import { scrapeYahooFarmStats } from '../services/yahooFarmScraper';

const NPB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
};

const router = Router();

// GET /api/v1/games
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { league, status, date, from, to } = req.query;

  try {
    let query = 'SELECT id, league, team_home, team_away, score_home, score_away, status, game_detail, venue, game_date, npb_url FROM games';
    const params: string[] = [];
    const conditions: string[] = [];

    if (league) {
      params.push(league as string);
      conditions.push(`league = $${params.length}`);
    }
    if (status) {
      params.push(status as string);
      conditions.push(`status = $${params.length}`);
    }
    if (date) {
      params.push(date as string);
      conditions.push(`DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $${params.length}::date`);
    }
    if (from) {
      params.push(from as string);
      conditions.push(`DATE(game_date AT TIME ZONE 'Asia/Tokyo') >= $${params.length}::date`);
    }
    if (to) {
      params.push(to as string);
      conditions.push(`DATE(game_date AT TIME ZONE 'Asia/Tokyo') <= $${params.length}::date`);
    }
    // デフォルト: from/to/date 未指定なら直近 60 日 + 今後 30 日に限定
    if (!date && !from && !to) {
      conditions.push(`game_date >= NOW() - INTERVAL '60 days'`);
      conditions.push(`game_date <= NOW() + INTERVAL '30 days'`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY game_date ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get games error:', err);
    res.status(500).json({ message: '無法取得賽程資料' });
  }
});

// POST /api/v1/games  [editor+] — 新增比賽
router.post('/', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { league, team_home, team_away, score_home, score_away, status, game_detail, venue, game_date } = req.body;

  if (!league || !team_home || !team_away || !game_date) {
    res.status(400).json({ message: '必填欄位：league, team_home, team_away, game_date' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO games (league, team_home, team_away, score_home, score_away, status, game_detail, venue, game_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [league, team_home, team_away, score_home ?? null, score_away ?? null,
       status ?? 'scheduled', game_detail ?? null, venue ?? null, game_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create game error:', err);
    res.status(500).json({ message: '新增比賽失敗' });
  }
});

// PUT /api/v1/games/:id  [editor+] — 更新比分/狀態
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { score_home, score_away, status, game_detail, venue, game_date } = req.body;

  try {
    const result = await pool.query(
      `UPDATE games
       SET score_home  = COALESCE($1, score_home),
           score_away  = COALESCE($2, score_away),
           status      = COALESCE($3, status),
           game_detail = COALESCE($4, game_detail),
           venue       = COALESCE($5, venue),
           game_date   = COALESCE($6, game_date)
       WHERE id = $7
       RETURNING *`,
      [score_home ?? null, score_away ?? null, status ?? null,
       game_detail ?? null, venue ?? null, game_date ?? null, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: '比賽資料不存在' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update game error:', err);
    res.status(500).json({ message: '更新比分失敗' });
  }
});

// DELETE /api/v1/games/:id  [admin]
router.delete('/:id', verifyToken, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM games WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: '比賽資料不存在' });
      return;
    }
    res.json({ message: '已刪除', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete game error:', err);
    res.status(500).json({ message: '刪除比賽失敗' });
  }
});

// GET /api/v1/games/:id — 單場比賽基本資料
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, league, team_home, team_away, score_home, score_away, status, game_detail, venue, game_date FROM games WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '比賽資料不存在' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get game error:', err);
    res.status(500).json({ message: '無法取得比賽資料' });
  }
});

// GET /api/v1/games/:id/innings
router.get('/:id/innings', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT inning, score_away, score_home FROM game_innings WHERE game_id = $1 ORDER BY inning ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得局分資料' });
  }
});

// GET /api/v1/games/:id/stats
router.get('/:id/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM game_stats WHERE game_id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ message: '無法取得比賽統計' });
  }
});

// GET /api/v1/games/:id/batters
router.get('/:id/batters', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT gbs.team_code, gbs.player_name, gbs.position, gbs.at_bats, gbs.hits,
              gbs.rbi, gbs.runs, gbs.home_runs, gbs.strikeouts, gbs.walks,
              gbs.hit_by_pitch, gbs.sacrifice_hits, gbs.stolen_bases, gbs.at_bat_results,
              -- 優先用先發名單棒次；代打/代走等先發名單無記錄者保留原始 batting_order
              COALESCE(lu.batting_order, gbs.batting_order) AS batting_order,
              CASE WHEN gbs.at_bats > 0 THEN ROUND(gbs.hits::numeric / gbs.at_bats, 3) ELSE 0 END as avg,
              -- 賽季打率：僅用 cpbl_player_stats（≥10打數），不使用 box_avg（公式錯誤）
              CASE WHEN cps.at_bats >= 10 THEN cps.avg ELSE NULL END AS season_avg,
              cps.at_bats AS season_ab
       FROM game_batter_stats gbs
       LEFT JOIN LATERAL (
         SELECT batting_order FROM game_lineups
         WHERE game_id = $1 AND player_name = gbs.player_name
         LIMIT 1
       ) lu ON true
       LEFT JOIN LATERAL (
         SELECT acnt FROM cpbl_players
         WHERE name = gbs.player_name AND team_code = gbs.team_code AND acnt IS NOT NULL
         ORDER BY id ASC LIMIT 1
       ) cp ON true
       LEFT JOIN cpbl_player_stats cps
         ON cps.acnt = cp.acnt
        AND cps.year = EXTRACT(YEAR FROM NOW())::int
        AND cps.kind_code = 'A'
       WHERE gbs.game_id = $1
       ORDER BY gbs.team_code,
         CASE
           WHEN COALESCE(lu.batting_order, gbs.batting_order) IS NULL THEN 999
           WHEN COALESCE(lu.batting_order, gbs.batting_order) = 0 THEN 998
           ELSE COALESCE(lu.batting_order, gbs.batting_order)
         END,
         gbs.id`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得打者成績' });
  }
});

// GET /api/v1/games/:id/pitchers
router.get('/:id/pitchers', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (gps.team_code, gps.player_name)
              gps.team_code, gps.pitcher_order, gps.player_name, gps.innings_pitched,
              gps.hits_allowed, gps.runs_allowed, gps.earned_runs, gps.walks,
              gps.strikeouts, gps.pitch_count, gps.batters_faced,
              gps.home_runs_allowed, gps.hit_by_pitch, gps.balk, gps.result,
              -- 賽季防禦率：僅在投球局數≥3時才回傳（避免小樣本失真）
              CASE WHEN cpts.innings_pitched_num >= 3 THEN cpts.era ELSE NULL END AS season_era,
              cpts.innings_pitched_num AS season_ip
       FROM game_pitcher_stats gps
       LEFT JOIN LATERAL (
         SELECT acnt FROM cpbl_players
         WHERE name = gps.player_name AND team_code = gps.team_code AND acnt IS NOT NULL
         ORDER BY id ASC LIMIT 1
       ) cp ON true
       LEFT JOIN cpbl_pitcher_stats cpts
         ON cpts.acnt = cp.acnt
        AND cpts.year = EXTRACT(YEAR FROM NOW())::int
        AND cpts.kind_code = 'A'
       WHERE gps.game_id = $1
       ORDER BY gps.team_code, gps.player_name, gps.id DESC
       ) sub
       ORDER BY sub.team_code, COALESCE(sub.pitcher_order, 999)`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得投手成績' });
  }
});

// GET /api/v1/games/:id/lineups
router.get('/:id/lineups', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT team_code, is_home, batting_order, position, player_name
       FROM game_lineups WHERE game_id = $1
       ORDER BY is_home, batting_order, id`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: '無法取得先發名單' });
  }
});

// GET /api/v1/games/:id/play-by-play
router.get('/:id/play-by-play', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, game_id, inning, is_top, batter_name, pitcher_name, situation, result_text, score_home, score_away, sequence_num, hitter_acnt, batting_order FROM play_by_play WHERE game_id = $1 ORDER BY sequence_num ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get play-by-play error:', err);
    res.status(500).json({ message: '無法取得文本速報資料' });
  }
});

// POST /api/v1/games/:id/play-by-play [editor+]
router.post('/:id/play-by-play', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { inning, is_top, batter_name, pitcher_name, situation, result_text, score_home, score_away } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO play_by_play
       (game_id, inning, is_top, batter_name, pitcher_name, situation, result_text, score_home, score_away)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.params.id, inning, is_top, batter_name, pitcher_name, situation, result_text, score_home, score_away]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add play-by-play error:', err);
    res.status(500).json({ message: '新增速報事件失敗' });
  }
});

// DELETE /api/v1/games/:id/play-by-play/:pbpId [editor+]
router.delete('/:id/play-by-play/:pbpId', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'DELETE FROM play_by_play WHERE id = $1 AND game_id = $2 RETURNING id',
      [req.params.pbpId, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '速報事件不存在' });
      return;
    }
    res.json({ message: '已刪除', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete play-by-play error:', err);
    res.status(500).json({ message: '刪除速報事件失敗' });
  }
});

// GET /api/v1/games/:id/pitch-data — 逐球投球位置 + 球種
router.get('/:id/pitch-data', async (req: Request, res: Response): Promise<void> => {
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

// GET /api/v1/games/:id/farm-box — 二軍比賽打者/投手成績
// 自動偵測來源：npb_url 以 /npb/game/ 開頭 → Yahoo；否則 → npb.jp
router.get('/:id/farm-box', async (req: Request, res: Response): Promise<void> => {
  try {
    const gameRow = await pool.query<{ npb_url: string | null; team_home: string; team_away: string; score_home: number | null; score_away: number | null; status: string; venue: string | null; game_date: string }>(
      'SELECT npb_url, team_home, team_away, score_home, score_away, status, venue, game_date FROM games WHERE id = $1',
      [req.params.id],
    );
    if (!gameRow.rows.length || !gameRow.rows[0].npb_url) {
      res.status(404).json({ message: '找不到比賽或缺少詳情連結' });
      return;
    }

    const { npb_url, team_home, team_away } = gameRow.rows[0];

    // ── Yahoo Baseball 路徑（/npb/game/XXXXXXXX）────────────────────────────
    if (npb_url.startsWith('/npb/game/')) {
      const yahooGameId = npb_url.replace('/npb/game/', '');
      const stats = await scrapeYahooFarmStats(yahooGameId);

      if (!stats) {
        res.status(503).json({ message: '比賽詳情尚未開放或目前無法取得' });
        return;
      }

      // Map batting/pitching to away/home using team names
      const awayNorm = team_away.slice(0, 2);
      const homeNorm = team_home.slice(0, 2);

      // Determine which batting table is away/home by checking if away team name matches first table's context
      // Yahoo returns tables in order: away batting, home batting, away pitching, home pitching
      res.json({
        game: gameRow.rows[0],
        innings: [],       // inning data is already in game_innings table
        winPitcher:  stats.winPitcher,
        lossPitcher: stats.lossPitcher,
        savePitcher: stats.savePitcher,
        hrText: null,
        teams: [
          {
            name:     team_away,
            dbName:   team_away,
            isHome:   false,
            batters:  stats.awayBatters.map(b => ({
              position: b.position, name: b.player_name,
              ab: b.ab, h: b.hits, rbi: b.rbi, bb: b.bb, hbp: b.hbp, k: b.so,
            })),
            pitchers: stats.awayPitchers.map(p => ({
              result: p.result, name: p.player_name, ip: p.ip,
              batters: p.batters, h: p.hits_allowed, bb: p.bb, hbp: p.hbp, k: p.so, er: p.er,
            })),
          },
          {
            name:     team_home,
            dbName:   team_home,
            isHome:   true,
            batters:  stats.homeBatters.map(b => ({
              position: b.position, name: b.player_name,
              ab: b.ab, h: b.hits, rbi: b.rbi, bb: b.bb, hbp: b.hbp, k: b.so,
            })),
            pitchers: stats.homePitchers.map(p => ({
              result: p.result, name: p.player_name, ip: p.ip,
              batters: p.batters, h: p.hits_allowed, bb: p.bb, hbp: p.hbp, k: p.so, er: p.er,
            })),
          },
        ],
      });
      // suppress unused variable warning
      void awayNorm; void homeNorm;
      return;
    }

    // ── npb.jp 路徑（舊格式，保留向下相容）────────────────────────────────────
    const url = `https://npb.jp${npb_url}`;

    const fetchRes = await axios.get(url, { headers: NPB_HEADERS, timeout: 15000, validateStatus: s => s < 500 });
    if (fetchRes.status === 404) {
      res.status(404).json({ message: '二軍比賽詳情頁面尚不可用' });
      return;
    }

    const $ = cheerio.load(fetchRes.data as string);
    const gmtbltops = $('table.gmtbltop');

    // Team names from header tables (eq 0 and 1)
    const pageTeam1 = gmtbltops.eq(0).find('.gmtblteam').first().text().trim();
    const pageTeam2 = gmtbltops.eq(1).find('.gmtblteam').first().text().trim();

    // Inning scores — table index 5 (RHE table)
    const innings: { team: string; scores: (number | null)[]; r: number; h: number; e: number }[] = [];
    $('table').eq(5).find('tr').each((i, tr) => {
      if (i === 0) return; // header
      const cells = $(tr).find('td').map((_, el) => $(el).text().trim()).get();
      if (!cells[0]) return;
      const name = cells[0];
      const last3 = cells.slice(-3).map(c => parseInt(c) || 0);
      const innScores = cells.slice(1, -4).filter(c => c !== '').map(c => (c === '-' || c === '') ? null : parseInt(c));
      innings.push({ team: name, scores: innScores, r: last3[0], h: last3[1], e: last3[2] });
    });

    // Win / loss pitcher
    const pitcherSummary = $('table').eq(6).text().replace(/\s+/g, ' ').trim();
    const winMatch  = pitcherSummary.match(/勝投手\s*[：:]\s*(\S+)/);
    const lossMatch = pitcherSummary.match(/敗投手\s*[：:]\s*(\S+)/);
    const saveMatch = pitcherSummary.match(/セーブ\s*[：:]\s*(\S+)/);

    // Home runs
    const hrText = $('table').eq(7).text().replace(/\s+/g, ' ').trim();

    // Parse batting table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function parseBatters(tbl: ReturnType<typeof $>) {
      const rows: { position: string; name: string; ab: number; h: number; rbi: number; bb: number; hbp: number; k: number }[] = [];
      tbl.find('tr').each((_i: number, tr: CheerioElement) => {
        const cells = $(tr).find('td').map((_, el) => $(el).text().trim()).get();
        if (cells.length < 7 || !cells[1]) return;
        rows.push({
          position: cells[0],
          name: cells[1],
          ab:  parseInt(cells[2]) || 0,
          h:   parseInt(cells[3]) || 0,
          rbi: parseInt(cells[4]) || 0,
          bb:  parseInt(cells[5]) || 0,
          hbp: parseInt(cells[6]) || 0,
          k:   parseInt(cells[7]) || 0,
        });
      });
      return rows;
    }

    // Parse pitching table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function parsePitchers(tbl: ReturnType<typeof $>) {
      const rows: { result: string; name: string; ip: string; batters: number; h: number; bb: number; hbp: number; k: number; er: number }[] = [];
      tbl.find('tr').each((_i: number, tr: CheerioElement) => {
        const cells = $(tr).find('td').map((_, el) => $(el).text().trim()).get();
        if (cells.length < 9 || !cells[1]) return;
        // Columns: result | name | ip | (empty) | batters | h | bb | hbp | k | er
        rows.push({
          result:  cells[0], // ○=win, ●=loss, S=save
          name:    cells[1],
          ip:      cells[2],
          batters: parseInt(cells[4]) || 0,
          h:       parseInt(cells[5]) || 0,
          bb:      parseInt(cells[6]) || 0,
          hbp:     parseInt(cells[7]) || 0,
          k:       parseInt(cells[8]) || 0,
          er:      parseInt(cells[9]) || 0,
        });
      });
      return rows;
    }

    const team1Batters  = parseBatters(gmtbltops.eq(2));
    const team2Batters  = parseBatters(gmtbltops.eq(3));
    const team1Pitchers = parsePitchers(gmtbltops.eq(4));
    const team2Pitchers = parsePitchers(gmtbltops.eq(5));

    // Match page teams to DB home/away
    // The page lists pageTeam1 (eq0) then pageTeam2 (eq1)
    // We need to map them to team_home / team_away in DB
    const normalize = (s: string) => s.replace(/\s/g, '');
    const isTeam1Home = normalize(pageTeam1).includes(normalize(team_home).slice(0, 3))
      || normalize(team_home).includes(normalize(pageTeam1).slice(0, 3));

    res.json({
      game: gameRow.rows[0],
      innings,
      winPitcher:  winMatch?.[1]  ?? null,
      lossPitcher: lossMatch?.[1] ?? null,
      savePitcher: saveMatch?.[1] ?? null,
      hrText: hrText.includes('本塁打') ? hrText : null,
      teams: [
        {
          name:     pageTeam1,
          dbName:   isTeam1Home ? team_home : team_away,
          isHome:   isTeam1Home,
          batters:  team1Batters,
          pitchers: team1Pitchers,
        },
        {
          name:     pageTeam2,
          dbName:   isTeam1Home ? team_away : team_home,
          isHome:   !isTeam1Home,
          batters:  team2Batters,
          pitchers: team2Pitchers,
        },
      ],
    });
  } catch (err) {
    console.error('[Farm Box] 爬取失敗:', (err as Error).message);
    res.status(500).json({ message: `無法取得二軍比賽詳情: ${(err as Error).message}` });
  }
});

export default router;
