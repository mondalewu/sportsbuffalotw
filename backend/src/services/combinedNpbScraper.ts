/**
 * NPB 一軍雙來源合併爬蟲（Docomo + Sanspo）
 *
 * 執行順序：
 *   1. Docomo text PBP → game_play_by_play（取得真實球員姓名）
 *   2. Sanspo 逐球速報 → game_pitch_data（取得完整逐球座標、球速、球種）
 *   3. 姓名補完 → 將步驟 1 的打者/投手姓名填入步驟 2 的逐球資料
 *
 * 效果：好球帶顯示真實姓名 + 完整全場逐球座標
 */

import pool from '../db/pool';
import { runDocomoNpbDailyScraper, docomoNpbDailyStatus } from './docomoNpbScraper';
import {
  fetchGameList,
  parseSanspoDate,
  normalizeSanspoTeam,
  findDbGameId,
  scrapeSanspoGame,
  mergeNamesIntoSanspoPitchData,
  sanspoNpbScraperStatus,
} from './sanspoNpbScraper';

// ── Status ────────────────────────────────────────────────────────────────────

export const combinedNpbScraperStatus = {
  isRunning: false,
  lastRun: null as string | null,
  lastResult: '尚未執行',
  lastError: null as string | null,
  gamesProcessed: 0,
  pitchesSaved: 0,
  playsSaved: 0,
  namesUpdated: 0,
};

// ── Combined daily scraper ────────────────────────────────────────────────────

export async function runCombinedNpbDailyScraper(): Promise<void> {
  if (combinedNpbScraperStatus.isRunning) {
    console.log('[CombinedNPB] 爬蟲正在執行中，跳過');
    return;
  }

  combinedNpbScraperStatus.isRunning = true;
  combinedNpbScraperStatus.lastRun = new Date().toISOString();
  combinedNpbScraperStatus.lastError = null;
  combinedNpbScraperStatus.gamesProcessed = 0;
  combinedNpbScraperStatus.pitchesSaved = 0;
  combinedNpbScraperStatus.playsSaved = 0;
  combinedNpbScraperStatus.namesUpdated = 0;

  try {
    // ── Step 1: Docomo text PBP（取得打者姓名 + 打席結果文字）─────────────────
    console.log('[CombinedNPB] Step 1: Docomo 文字速報...');
    if (!docomoNpbDailyStatus.isRunning) {
      const docResult = await runDocomoNpbDailyScraper();
      combinedNpbScraperStatus.playsSaved = docResult.playsSaved;
      console.log(`[CombinedNPB] Docomo 完成：${docResult.playsSaved} 打席`);
    } else {
      console.log('[CombinedNPB] Docomo 爬蟲正在執行中，等待完成...');
      // Wait for Docomo to finish (max 120s)
      let waited = 0;
      while (docomoNpbDailyStatus.isRunning && waited < 120000) {
        await new Promise(r => setTimeout(r, 2000));
        waited += 2000;
      }
    }

    // ── Step 2: Sanspo 逐球（取得座標、球速、球種）──────────────────────────────
    console.log('[CombinedNPB] Step 2: Sanspo 逐球資料...');

    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const games = await fetchGameList();
    const todayGames = games.filter(g => g.gameDate === todayStr);

    console.log(`[CombinedNPB] Sanspo 今日 ${todayGames.length} 場比賽`);

    const processedDbIds: number[] = [];

    for (const game of todayGames) {
      const dateStr  = parseSanspoDate(game.gameDate);
      const homeTeam = normalizeSanspoTeam(game.home?.nickname ?? '');
      const awayTeam = normalizeSanspoTeam(game.visitor?.nickname ?? '');

      const dbGameId = await findDbGameId(dateStr, homeTeam, awayTeam);
      if (!dbGameId) {
        console.warn(`[CombinedNPB] 找不到 DB 比賽：${dateStr} ${awayTeam}@${homeTeam}`);
        continue;
      }

      try {
        const result = await scrapeSanspoGame(game.gameGlobalId, dbGameId);
        combinedNpbScraperStatus.pitchesSaved += result.pitchCount;
        combinedNpbScraperStatus.gamesProcessed++;
        processedDbIds.push(dbGameId);
        console.log(`[CombinedNPB] Sanspo ${awayTeam}@${homeTeam}: ${result.pitchCount} 球`);
      } catch (err) {
        console.warn(`[CombinedNPB] Sanspo 比賽 ${game.gameGlobalId} 失敗:`, (err as Error).message);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // ── Step 3: 姓名補完（Docomo 名稱 → Sanspo 逐球資料）────────────────────────
    console.log(`[CombinedNPB] Step 3: 姓名補完 (${processedDbIds.length} 場)...`);

    for (const dbGameId of processedDbIds) {
      try {
        const merged = await mergeNamesIntoSanspoPitchData(dbGameId);
        combinedNpbScraperStatus.namesUpdated += merged.battersUpdated + merged.pitchersUpdated;
        console.log(`[CombinedNPB] game#${dbGameId} 補完：打者 ${merged.battersUpdated} 筆，投手 ${merged.pitchersUpdated} 筆`);
      } catch (err) {
        console.warn(`[CombinedNPB] game#${dbGameId} 姓名補完失敗:`, (err as Error).message);
      }
    }

    combinedNpbScraperStatus.lastResult =
      `✅ 完成：${combinedNpbScraperStatus.gamesProcessed} 場，` +
      `${combinedNpbScraperStatus.pitchesSaved} 球，` +
      `${combinedNpbScraperStatus.namesUpdated} 筆姓名補完`;

    console.log(`[CombinedNPB] ${combinedNpbScraperStatus.lastResult}`);

  } catch (err) {
    combinedNpbScraperStatus.lastError = (err as Error).message;
    combinedNpbScraperStatus.lastResult = `❌ 錯誤：${(err as Error).message}`;
    console.error('[CombinedNPB] 爬蟲失敗:', err);
  } finally {
    combinedNpbScraperStatus.isRunning = false;
  }
}

// ── 單場補完（指定 Sanspo globalId + DB game_id）──────────────────────────────

export async function runCombinedScrapeForGame(
  sanspoGlobalId: number,
  dbGameId: number,
): Promise<{
  success: boolean;
  message: string;
  pitchCount: number;
  battersUpdated: number;
  pitchersUpdated: number;
}> {
  try {
    // 1. 確保 Docomo 文字速報已抓（如果 play_by_play 已有資料就跳過）
    const existingPbp = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM game_play_by_play
       WHERE game_id = $1 AND description LIKE '{%'`,
      [dbGameId],
    );
    const hasPbp = parseInt(existingPbp.rows[0]?.cnt ?? '0', 10) > 0;

    if (!hasPbp) {
      // 嘗試用 docomo_game_id 觸發 Docomo text PBP
      const docomoRow = await pool.query<{ docomo_game_id: string | null }>(
        `SELECT docomo_game_id FROM games WHERE id = $1`, [dbGameId],
      );
      const docomoGameId = docomoRow.rows[0]?.docomo_game_id;
      if (docomoGameId) {
        const { scrapeDocomoNpbGame } = await import('./docomoNpbScraper');
        await scrapeDocomoNpbGame(docomoGameId, dbGameId, false);
      }
    }

    // 2. Sanspo 逐球資料
    const sanspoResult = await scrapeSanspoGame(sanspoGlobalId, dbGameId);

    // 3. 姓名補完
    const merged = await mergeNamesIntoSanspoPitchData(dbGameId);

    return {
      success: true,
      message: `完成：${sanspoResult.pitchCount} 球，打者補完 ${merged.battersUpdated} 筆，投手補完 ${merged.pitchersUpdated} 筆`,
      pitchCount: sanspoResult.pitchCount,
      battersUpdated: merged.battersUpdated,
      pitchersUpdated: merged.pitchersUpdated,
    };
  } catch (err) {
    return {
      success: false,
      message: (err as Error).message,
      pitchCount: 0, battersUpdated: 0, pitchersUpdated: 0,
    };
  }
}

// ── 僅執行姓名補完（已有 Sanspo 資料但缺姓名時使用）─────────────────────────────

export async function runMergeNamesForTodayGames(): Promise<{
  gamesProcessed: number;
  totalNamesUpdated: number;
}> {
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const gamesWithSanspo = await pool.query<{ game_id: number }>(
    `SELECT DISTINCT pd.game_id
     FROM game_pitch_data pd
     JOIN games g ON g.id = pd.game_id
     WHERE g.league = 'NPB'
       AND DATE(g.game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
       AND pd.at_bat_key LIKE 's%'`,
    [todayDate],
  );

  let totalNamesUpdated = 0;
  for (const row of gamesWithSanspo.rows) {
    const merged = await mergeNamesIntoSanspoPitchData(row.game_id);
    totalNamesUpdated += merged.battersUpdated + merged.pitchersUpdated;
  }

  return {
    gamesProcessed: gamesWithSanspo.rows.length,
    totalNamesUpdated,
  };
}
