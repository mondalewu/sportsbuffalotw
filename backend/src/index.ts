import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

import pool from './db/pool';
import authRoutes from './routes/auth';
import articleRoutes from './routes/articles';
import gameRoutes from './routes/games';
import standingRoutes from './routes/standings';
import adRoutes from './routes/ads';
import pollRoutes from './routes/polls';
import scraperRoutes from './routes/scraper';
import npbRoutes from './routes/npb';
import cpblRoutes from './routes/cpbl';
import storiesRoutes from './routes/stories';
import videosRoutes from './routes/videos';
import { runScraper, runCpblFullScheduleScraper, runCpblFarmScheduleScraper, runFarmScoreScraper, runCpblStandingsScraper } from './services/cpblScraper';
import { runNpbScraper, runLiveBoxScoreUpdate, populateNpbUrls } from './services/npbScraper';
import { runNpbFarmScraperMonth } from './services/npbFarmScraper';
import { runYahooFarmScraper, runYahooFarmScheduleScraper } from './services/yahooFarmScraper';
import { runDocomoFarmScraper, runDocomoLiveUpdate } from './services/docomoFarmScraper';
import { initNpbTeams } from './services/npbRosterScraper';
import { runCpblWikiRosterScraper } from './services/cpblRosterScraper';
import { verifyToken, requireRole } from './middleware/auth';

dotenv.config();

// Auto-migrate: ensure all tables exist (safe with IF NOT EXISTS)
async function autoMigrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
    await pool.query(sql);
    console.log('✓ DB 結構同步完成');
  } catch (err) {
    console.warn('⚠ 自動遷移警告:', (err as Error).message);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/articles', articleRoutes);
app.use('/api/v1/games', gameRoutes);
app.use('/api/v1/standings', standingRoutes);
app.use('/api/v1/ads', adRoutes);
app.use('/api/v1/polls', pollRoutes);
app.use('/api/v1/scraper', scraperRoutes);
app.use('/api/v1/npb', npbRoutes);
app.use('/api/v1/cpbl', cpblRoutes);
app.use('/api/v1/stories', storiesRoutes);
app.use('/api/v1/videos', videosRoutes);

// Analytics endpoint (editor+)
app.get('/api/v1/admin/analytics', verifyToken, requireRole('editor', 'admin'), async (_req: any, res: any) => {
  try {
    const [articles, users, games, polls, votes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::INT AS count FROM articles`),
      pool.query(`SELECT COUNT(*)::INT AS count FROM users`),
      pool.query(`SELECT COUNT(*)::INT AS count FROM games WHERE league = 'CPBL'`),
      pool.query(`SELECT COUNT(*)::INT AS count FROM polls`),
      pool.query(`SELECT COUNT(*)::INT AS count FROM poll_votes`),
    ]);
    const topPolls = await pool.query(
      `SELECT p.id, p.question, p.is_active,
              COUNT(v.id)::INT AS total_votes
       FROM polls p LEFT JOIN poll_votes v ON v.poll_id = p.id
       GROUP BY p.id ORDER BY total_votes DESC LIMIT 5`
    );
    const votesByDay = await pool.query(
      `SELECT DATE(created_at AT TIME ZONE 'Asia/Taipei') AS day,
              COUNT(*)::INT AS count
       FROM poll_votes
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY day ORDER BY day ASC`
    );
    res.json({
      articles: articles.rows[0].count,
      users: users.rows[0].count,
      cpbl_games: games.rows[0].count,
      polls: polls.rows[0].count,
      total_votes: votes.rows[0].count,
      top_polls: topPolls.rows,
      votes_by_day: votesByDay.rows,
    });
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: '找不到該路由' });
});

// 自動修復：將過去日期卡住的 live 遊戲標記為 final
async function fixStuckLiveGames() {
  try {
    const r = await pool.query(`
      UPDATE games SET status = 'final'
      WHERE status = 'live'
        AND (
          -- CPBL (台灣 UTC+8)：比賽日期 < 今天（台灣時間）
          (league LIKE 'CPBL%'
           AND DATE(game_date AT TIME ZONE 'Asia/Taipei')
               < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date)
          OR
          -- NPB / NPB2 (日本 UTC+9)：比賽日期 < 今天（東京時間）
          (league LIKE 'NPB%'
           AND DATE(game_date AT TIME ZONE 'Asia/Tokyo')
               < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date)
        )
    `);
    if (r.rowCount && r.rowCount > 0)
      console.log(`[Cron] 自動修復 ${r.rowCount} 個卡住的 live 遊戲 → final`);
  } catch (e) {
    console.warn('[Cron] fixStuckLiveGames 失敗:', (e as Error).message);
  }
}

// 啟動爬蟲定時任務
function startScraperCron() {
  // ── 每 1 分鐘：比分更新（依時段分流）──────────────────────────────────────
  cron.schedule('*/1 * * * *', async () => {
    const utcHour = new Date().getUTCHours();

    // CPBL：台灣時間 14:00–00:00（UTC 06:00–16:00，延長至深夜場結束）
    if (utcHour >= 6 && utcHour <= 16) {
      console.log('[Cron] 執行 CPBL 比分更新...');
      await runScraper();
    }

    // CPBL 二軍：台灣時間 11:00–20:00（UTC 03:00–12:00）
    if (utcHour >= 3 && utcHour <= 12) {
      await runFarmScoreScraper();
    }

    // NPB 一軍：日本時間 13:00–00:00（UTC 04:00–15:00，延長至深夜場結束）
    if (utcHour >= 4 && utcHour <= 15) {
      console.log('[Cron] 執行 NPB 一軍比分更新...');
      await runNpbScraper();
    }

    // NPB 二軍：日本時間 11:00–22:00（UTC 02:00–13:00，使用 Docomo API）
    if (utcHour >= 2 && utcHour <= 13) {
      console.log('[Cron] 執行 NPB 二軍比分更新（Docomo）...');
      await runDocomoFarmScraper();
    }

    // NPB URL 同步（NPB 比賽時段 UTC 04:00–14:00）
    if (utcHour >= 4 && utcHour <= 14) await populateNpbUrls();

    // 比賽結束後時段修復卡住的 live（UTC 13:00–20:00 = TWN 21:00–04:00）
    if (utcHour >= 13 && utcHour <= 20) await fixStuckLiveGames();
  });

  // ── 每 30 秒：NPB 進行中試合即時更新（含防重入旗標）────────────────────
  let isLiveUpdating = false;
  let isDocomoLiveUpdating = false;
  setInterval(async () => {
    const utcHour = new Date().getUTCHours();
    if (utcHour >= 4 && utcHour <= 15) {
      if (!isLiveUpdating) {
        isLiveUpdating = true;
        try { await runLiveBoxScoreUpdate(); } finally { isLiveUpdating = false; }
      }
    }
    if (utcHour >= 2 && utcHour <= 10) {
      if (!isDocomoLiveUpdating) {
        isDocomoLiveUpdating = true;
        try { await runDocomoLiveUpdate(); } finally { isDocomoLiveUpdating = false; }
      }
    }
  }, 30 * 1000);

  // ── 每天 02:00 UTC（10:00 TWN）：CPBL 賽程更新（當月 + 下月）───────────
  cron.schedule('0 2 * * *', async () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;           // 當月
    const nextMonth = month === 12 ? 1 : month + 1; // 下月
    const nextYear  = month === 12 ? year + 1 : year;
    console.log(`[Cron] 執行 CPBL 賽程更新 ${year}/${month}–${nextMonth}...`);
    await runCpblFullScheduleScraper(year, month, month);
    if (nextYear === year) await runCpblFullScheduleScraper(year, nextMonth, nextMonth);
    await runCpblFarmScheduleScraper(year, month, month);
    if (nextYear === year) await runCpblFarmScheduleScraper(year, nextMonth, nextMonth);
    // NPB 二軍賽程（當月 + 下月）— 使用 npb.jp 正確來源
    await runNpbFarmScraperMonth(year, month);
    if (nextYear === year) await runNpbFarmScraperMonth(year, nextMonth);
    // CPBL 例行賽 + 熱身賽順位表
    console.log('[Cron] 更新 CPBL 順位表...');
    await runCpblStandingsScraper(year);
    await fixStuckLiveGames();
  });

  // ── 每天 18:00 UTC（02:00 TWN）：自動修復卡住的 live 遊戲 ──────────────
  cron.schedule('0 18 * * *', fixStuckLiveGames);

  // ── 每週一 00:00 UTC（08:00 TWN）：CPBL 球員名冊更新 ───────────────────
  cron.schedule('0 0 * * 1', async () => {
    console.log('[Cron] 執行 CPBL Wiki 球員名冊更新...');
    await runCpblWikiRosterScraper();
  });

  console.log('✓ 爬蟲排程已啟動：比分每1分鐘 | 賽程每日02:00 | 名冊每週一 | stuck-live每日修復');
}

autoMigrate().then(async () => {
  await initNpbTeams();
  app.listen(PORT, () => {
    console.log(`🐃 水牛體育 API 已啟動: http://localhost:${PORT}`);
    startScraperCron();
  });
});

export default app;
