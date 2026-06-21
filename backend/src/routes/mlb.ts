/**
 * MLB Stats API Proxy — 使用官方 statsapi.mlb.com（公開、免費、無需 API Key）
 *
 * 所有端點加入記憶體快取，減少對 MLB 伺服器的請求。
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const UA = 'Mozilla/5.0 (compatible; SportsBuffalo/1.0)';

// ── 記憶體快取 ────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; at: number }>();
function ttl(key: string, ms: number): unknown | null {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ms) return c.data;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, at: Date.now() });
}

async function mlbGet(path: string): Promise<unknown> {
  const res = await axios.get(`${MLB_API}${path}`, {
    headers: { 'User-Agent': UA },
    timeout: 12000,
  });
  return res.data;
}

// ── GET /api/v1/mlb/schedule?date=YYYY-MM-DD ─────────────────────────────────
// 今日或指定日期賽程（含即時比分/局分）
router.get('/schedule', async (req: Request, res: Response): Promise<void> => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const key = `schedule:${date}`;
  const cached = ttl(key, 60_000); // 1 分鐘快取
  if (cached) { res.json(cached); return; }

  try {
    const data = await mlbGet(
      `/schedule?sportId=1&date=${date}&hydrate=linescore(matchup),team,game(content(summary)),decisions`
    ) as any;

    const games = (data.dates?.[0]?.games ?? []).map((g: any) => ({
      gamePk: g.gamePk,
      gameDate: g.gameDate,
      status: {
        detailedState: g.status.detailedState,
        abstractGameState: g.status.abstractGameState,
        codedGameState: g.status.codedGameState,
      },
      teams: {
        away: {
          team: { id: g.teams.away.team.id, name: g.teams.away.team.name, abbreviation: g.teams.away.team.abbreviation },
          score: g.teams.away.score,
          isWinner: g.teams.away.isWinner,
        },
        home: {
          team: { id: g.teams.home.team.id, name: g.teams.home.team.name, abbreviation: g.teams.home.team.abbreviation },
          score: g.teams.home.score,
          isWinner: g.teams.home.isWinner,
        },
      },
      linescore: g.linescore ? {
        currentInning: g.linescore.currentInning,
        currentInningOrdinal: g.linescore.currentInningOrdinal,
        inningHalf: g.linescore.inningHalf,
        outs: g.linescore.outs,
        balls: g.linescore.balls,
        strikes: g.linescore.strikes,
        innings: g.linescore.innings,
        teams: g.linescore.teams,
      } : null,
      venue: g.venue?.name,
      decisions: g.decisions ?? null,
    }));

    setCache(key, games);
    res.json(games);
  } catch (err) {
    console.error('[MLB schedule]', (err as Error).message);
    res.status(502).json({ message: '無法取得 MLB 賽程' });
  }
});

// ── GET /api/v1/mlb/standings ─────────────────────────────────────────────────
// AL/NL 積分榜
router.get('/standings', async (_req: Request, res: Response): Promise<void> => {
  const key = 'standings';
  const cached = ttl(key, 10 * 60_000); // 10 分鐘快取
  if (cached) { res.json(cached); return; }

  try {
    const season = new Date().getFullYear();
    const data = await mlbGet(
      `/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,division,league`
    ) as any;

    const result = data.records.map((rec: any) => ({
      division: {
        id: rec.division.id,
        name: rec.division.name,
        nameShort: rec.division.nameShort,
      },
      league: rec.league?.name,
      teams: rec.teamRecords.map((t: any) => ({
        teamId: t.team.id,
        teamName: t.team.name,
        teamAbbrev: t.team.abbreviation,
        wins: t.wins,
        losses: t.losses,
        pct: t.winningPercentage,
        gb: t.gamesBack,
        wcGb: t.wildCardGamesBack,
        divisionRank: parseInt(t.divisionRank),
        streak: t.streak?.streakCode,
        runsScored: t.runsScored,
        runsAllowed: t.runsAllowed,
        last10: t.records?.splitRecords?.find((s: any) => s.type === 'lastTen')?.wins + '-' +
                t.records?.splitRecords?.find((s: any) => s.type === 'lastTen')?.losses ?? '',
      })),
    }));

    setCache(key, result);
    res.json(result);
  } catch (err) {
    console.error('[MLB standings]', (err as Error).message);
    res.status(502).json({ message: '無法取得 MLB 積分榜' });
  }
});

// ── GET /api/v1/mlb/game/:gamePk/linescore ──────────────────────────────────
router.get('/game/:gamePk/linescore', async (req: Request, res: Response): Promise<void> => {
  const { gamePk } = req.params;
  const key = `linescore:${gamePk}`;
  const cached = ttl(key, 30_000); // 30 秒快取（進行中比賽）
  if (cached) { res.json(cached); return; }

  try {
    const data = await mlbGet(`/game/${gamePk}/linescore`);
    setCache(key, data);
    res.json(data);
  } catch (err) {
    console.error('[MLB linescore]', (err as Error).message);
    res.status(502).json({ message: '無法取得局分資料' });
  }
});

// ── GET /api/v1/mlb/game/:gamePk/boxscore ───────────────────────────────────
router.get('/game/:gamePk/boxscore', async (req: Request, res: Response): Promise<void> => {
  const { gamePk } = req.params;
  const key = `boxscore:${gamePk}`;
  const cached = ttl(key, 60_000); // 1 分鐘快取
  if (cached) { res.json(cached); return; }

  try {
    const raw = await mlbGet(`/game/${gamePk}/boxscore`) as any;

    // 整理打者成績
    const formatBatters = (side: any) =>
      (side.batters ?? []).map((id: number) => {
        const p = side.players?.[`ID${id}`];
        if (!p) return null;
        const s = p.stats?.batting ?? {};
        return {
          id,
          name: p.person?.fullName,
          position: p.position?.abbreviation,
          battingOrder: p.battingOrder,
          ab: s.atBats ?? 0,
          r: s.runs ?? 0,
          h: s.hits ?? 0,
          rbi: s.rbi ?? 0,
          bb: s.baseOnBalls ?? 0,
          so: s.strikeOuts ?? 0,
          avg: s.avg ?? '',
          hr: s.homeRuns ?? 0,
        };
      }).filter(Boolean);

    // 整理投手成績
    const formatPitchers = (side: any) =>
      (side.pitchers ?? []).map((id: number) => {
        const p = side.players?.[`ID${id}`];
        if (!p) return null;
        const s = p.stats?.pitching ?? {};
        return {
          id,
          name: p.person?.fullName,
          ip: s.inningsPitched ?? '0.0',
          h: s.hits ?? 0,
          r: s.runs ?? 0,
          er: s.earnedRuns ?? 0,
          bb: s.baseOnBalls ?? 0,
          so: s.strikeOuts ?? 0,
          hr: s.homeRuns ?? 0,
          era: s.era ?? '',
          note: p.stats?.pitching?.note ?? '',
        };
      }).filter(Boolean);

    const result = {
      gamePk,
      away: {
        team: { id: raw.teams?.away?.team?.id, name: raw.teams?.away?.team?.name, abbreviation: raw.teams?.away?.team?.abbreviation },
        teamStats: raw.teams?.away?.teamStats,
        batters: formatBatters(raw.teams?.away ?? {}),
        pitchers: formatPitchers(raw.teams?.away ?? {}),
        note: raw.teams?.away?.note,
      },
      home: {
        team: { id: raw.teams?.home?.team?.id, name: raw.teams?.home?.team?.name, abbreviation: raw.teams?.home?.team?.abbreviation },
        teamStats: raw.teams?.home?.teamStats,
        batters: formatBatters(raw.teams?.home ?? {}),
        pitchers: formatPitchers(raw.teams?.home ?? {}),
        note: raw.teams?.home?.note,
      },
      info: raw.info,
      officials: raw.officials,
    };

    setCache(key, result);
    res.json(result);
  } catch (err) {
    console.error('[MLB boxscore]', (err as Error).message);
    res.status(502).json({ message: '無法取得 Box Score' });
  }
});

// ── GET /api/v1/mlb/players/taiwan ──────────────────────────────────────────
// 台灣/旅美選手當前賽季數據
router.get('/players/taiwan', async (_req: Request, res: Response): Promise<void> => {
  const key = 'tw_players';
  const cached = ttl(key, 30 * 60_000); // 30 分鐘快取
  if (cached) { res.json(cached); return; }

  // 已知台灣/相關選手 MLB ID（可擴充）
  const TAIWAN_PLAYER_IDS = [
    { id: 606945, nameZh: '陳偉殷', retired: true },
    { id: 518774, nameZh: '王建民', retired: true },
    { id: 543105, nameZh: '林子偉', retired: false },
  ];

  try {
    const season = new Date().getFullYear();
    const ids = TAIWAN_PLAYER_IDS.filter(p => !p.retired).map(p => p.id);

    if (ids.length === 0) { res.json([]); return; }

    const data = await mlbGet(
      `/people?personIds=${ids.join(',')}&hydrate=currentTeam,stats(type=season,season=${season})`
    ) as any;

    const result = (data.people ?? []).map((p: any) => {
      const tw = TAIWAN_PLAYER_IDS.find(t => t.id === p.id);
      const batting = p.stats?.find((s: any) => s.type?.displayName === 'season')?.splits?.[0]?.stat;
      const pitching = p.stats?.find((s: any) => s.type?.displayName === 'season' && s.group?.displayName === 'pitching')?.splits?.[0]?.stat;
      return {
        id: p.id,
        fullName: p.fullName,
        nameZh: tw?.nameZh ?? '',
        currentTeam: p.currentTeam?.name ?? '自由球員',
        currentTeamAbbrev: p.currentTeam?.abbreviation ?? '',
        primaryPosition: p.primaryPosition?.abbreviation,
        jerseyNumber: p.primaryNumber,
        batting: batting ?? null,
        pitching: pitching ?? null,
      };
    });

    setCache(key, result);
    res.json(result);
  } catch (err) {
    console.error('[MLB TW players]', (err as Error).message);
    res.status(502).json({ message: '無法取得選手資料' });
  }
});

export default router;
