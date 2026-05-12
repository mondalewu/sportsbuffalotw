/**
 * NPB 比分爬蟲 — 主要來源: npb.jp (SSR，可用 Cheerio 靜態解析)
 *
 * ① 賽程清單:  https://npb.jp/preseason/2026/  (オープン戦全日程)
 *    選擇器: a.link_block[href*="/scores/"]
 *    URL 格式: /scores/YYYY/MMDD/homeCode-awayCode-NN/
 *    日期過濾: 從 href 的 MMDD 段抽出，與 JST 今日比對
 *
 * ② 單場詳細頁:  https://npb.jp/scores/YYYY/MMDD/homeCode-awayCode-NN/index.html
 *    比賽時間:  .game_info  → /◇開始\s+(\d{1,2}:\d{2})/
 *    比賽狀態:  .game_info  → 試合終了 / 試合中 X回表裏 / 試合開始前
 *    球場:      .game_tit .place
 *    比賽種類:  .game_tit h3  → 【オープン戦】/【公式戦】etc.
 *    イニング:  #tablefix_ls tr.top  (away) / tr.bottom (home)
 *               td.total-1 = 総得点, td.total-2:first = H, td.total-2:last = E
 *    先発オーダー: #player-order .half_left table (away) / .half_right table (home)
 *               tr: th:1 = 打順, th:2 = 守備位置, td a = 選手名
 *    バッテリー: .game_result_info table tr  th=チーム, td=投手-捕手
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import pool from '../db/pool';

const NPB_BASE = 'https://npb.jp';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://npb.jp/',
};

// npb.jp URL コード → 中文表示名
const CODE_TO_NAME: Record<string, string> = {
  'g': '巨人', 'db': 'DeNA', 't': '阪神', 'c': '広島',
  'd': '中日', 's': 'ヤクルト', 'l': '西武', 'e': '楽天',
  'h': 'ソフトバンク', 'f': '日本ハム', 'm': 'ロッテ', 'b': 'オリックス',
};

const NAME_TO_CODE: Record<string, string> = {
  '巨人': 'g', '読売': 'g',
  'DeNA': 'db', 'ＤｅＮＡ': 'db', '横浜': 'db',
  '阪神': 't', '広島': 'c', '中日': 'd',
  'ヤクルト': 's', '東京ヤ': 's',
  '西武': 'l', '埼玉西武': 'l',
  '楽天': 'e', '東北楽天': 'e',
  'ソフトバンク': 'h', '福岡': 'h',
  '日本ハム': 'f', '北海道': 'f',
  'ロッテ': 'm', '千葉ロッテ': 'm',
  'オリックス': 'b',
};

function guessCode(name: string): string {
  const t = name.trim();
  for (const [key, code] of Object.entries(NAME_TO_CODE)) {
    if (t.includes(key)) return code;
  }
  return '';
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMmdd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}${d}`;
}

// ─── 型別定義 ────────────────────────────────────────────────────────────────

interface InningScore {
  inning: number;
  scoreAway: number | null;
  scoreHome: number | null;
}

interface BatterStat {
  teamCode: string;
  battingOrder: number;
  position: string;
  playerName: string;
  atBats: number;
  hits: number;
  rbi: number;
  runs: number;
  homeRuns: number;
  strikeouts: number;
  walks: number;
  stolenBases: number;
  hitByPitch: number;
  sacrificeHits: number;
  atBatResults: string[];
}

interface PitcherStat {
  teamCode: string;
  pitcherOrder: number;
  playerName: string;
  inningsPitched: string;
  hitsAllowed: number;
  runsAllowed: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  result: string;
  pitchCount: number;
  battersFaced: number;
  homeRunsAllowed: number;
  hitByPitch: number;
  balk: number;
}

interface LineupPlayer {
  battingOrder: number;   // 1–9, 0 = 投手
  position: string;       // 投/捕/一/二/三/遊/左/中/右/DH
  name: string;
}

interface Battery {
  pitchers: string;       // "髙橋光成、佐藤隼"
  catchers: string;       // "古賀悠"
}

interface GameDetail {
  urlPath: string;        // /scores/2026/0317/l-e-01/
  homeCode: string;
  awayCode: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;       // YYYY-MM-DD
  startTime: string | null;   // "18:00"
  venue: string | null;
  gameType: string;       // オープン戦/例行賽/etc.
  status: 'scheduled' | 'live' | 'final';
  gameDetail: string;     // "試合終了" / "7回裏" / "試合開始前"
  scoreHome: number | null;
  scoreAway: number | null;
  hitsHome: number | null;
  hitsAway: number | null;
  errorsHome: number | null;
  errorsAway: number | null;
  innings: InningScore[];
  lineupHome: LineupPlayer[];
  lineupAway: LineupPlayer[];
  batteryHome: Battery | null;
  batteryAway: Battery | null;
  winPitcher: string;
  lossPitcher: string;
  savePitcher: string;
}

// ─── Step 1: 賽程 URL 取得 ────────────────────────────────────────────────────

// 熱身賽結束日（2026-03-26 JST 以降は例行賽）
const PRESEASON_END = new Date('2026-03-27T00:00:00+09:00'); // JST 2026-03-27
const PRESEASON_URL = 'https://npb.jp/preseason/2026/schedule_detail.html';

/** 例行賽月別賽程 URL */
function getRegularScheduleUrl(date: Date): string {
  const jstDate = new Date(date.getTime() + 9 * 3600_000);
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  return `https://npb.jp/games/${jstDate.getUTCFullYear()}/schedule_${mm}_detail.html`;
}

/**
 * npb.jp の賽程ページを解析してスコアURL一覧を返す
 * URLパターン: /scores/2026/MMDD/homeCode-awayCode-NN/
 * filterDate を渡すと当日の試合のみ返す
 */
async function fetchGameLinksFromUrl(scheduleUrl: string, filterDate: Date | null): Promise<string[]> {
  try {
    const res = await axios.get(scheduleUrl, {
      timeout: 15000,
      headers: HEADERS,
      validateStatus: (s) => s === 200 || s === 403,
    });
    const $ = cheerio.load(res.data as string);
    const links: string[] = [];
    const seen = new Set<string>();

    const targetMmdd = filterDate ? toMmdd(filterDate) : null;

    $('a[href*="/scores/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/\/scores\/(\d{4})\/(\d{4})\/([\w]+-[\w]+-\d+)\/?/);
      if (!m) return;
      const [, , mmdd] = m;
      if (targetMmdd && mmdd !== targetMmdd) return;
      const fullUrl = `${NPB_BASE}${href.endsWith('/') ? href : href + '/'}`;
      if (!seen.has(fullUrl)) { seen.add(fullUrl); links.push(fullUrl); }
    });

    return links;
  } catch (err: unknown) {
    console.warn('[NPB Scraper] 無法取得賽程:', (err as Error).message);
    return [];
  }
}

/** 以日期取得當日比賽連結（自動判斷熱身賽 or 例行賽） */
async function fetchDailyGameLinks(date: Date): Promise<string[]> {
  const isRegular = date >= PRESEASON_END;
  if (isRegular) {
    const url = getRegularScheduleUrl(date);
    const mmdd = toMmdd(date);
    console.log(`[NPB Scraper] 例行賽 ${mmdd} 使用 ${url}`);
    const links = await fetchGameLinksFromUrl(url, date);
    console.log(`[NPB Scraper] 例行賽/${mmdd} 找到 ${links.length} 場試合`);
    return links;
  } else {
    const mmdd = toMmdd(date);
    const links = await fetchGameLinksFromUrl(PRESEASON_URL, date);
    console.log(`[NPB Scraper] preseason/${mmdd} 找到 ${links.length} 場試合`);
    return links;
  }
}

// ─── Step 2: 単場詳細ページを解析 ─────────────────────────────────────────────

/**
 * npb.jp 試合詳細ページのセレクタ一覧:
 *
 * 日付:     .game_tit time          → "2026年3月17日（火）"
 * 球場:     .game_tit .place        → "ベルーナドーム"
 * 種類:     .game_tit h3            → "【オープン戦】 西武 vs 楽天 1回戦"
 * 状態+時間: .game_info             → "【試合中 7回裏】◇開始 18:00"
 * スコア行:  #tablefix_ls tr.top    (away) / tr.bottom (home)
 *   各回:   td (テキスト = 得点 or "x" or "")
 *   合計:   td.total-1              → 総得点
 *   安打:   td.total-2:eq(0)        → H
 *   失策:   td.total-2:eq(1)        → E
 * チーム名: tr.top th span.hide_sp / tr.bottom th span.hide_sp
 * オーダー: #player-order .half_left table  (away)
 *           #player-order .half_right table (home)
 *   行:     th:eq(0)=打順, th:eq(1)=守備, td a=選手名
 * バッテリー: .game_result_info table tr  th=チーム, td=投手-捕手テキスト
 */
export async function fetchGameDetail(gameUrl: string): Promise<GameDetail | null> {
  const indexUrl = gameUrl.endsWith('/') ? `${gameUrl}index.html` : `${gameUrl}/index.html`;

  // URL から homeCode, awayCode, 日付を抽出
  // パターン: /scores/YYYY/MMDD/homeCode-awayCode-NN/
  const urlMatch = gameUrl.match(/\/scores\/(\d{4})\/(\d{2})(\d{2})\/([\w]+)-([\w]+)-\d+/);
  if (!urlMatch) return null;

  const [, yr, mo, dy, homeCode, awayCode] = urlMatch;
  const gameDate = `${yr}-${mo}-${dy}`;
  const homeTeam = CODE_TO_NAME[homeCode] ?? homeCode;
  const awayTeam = CODE_TO_NAME[awayCode] ?? awayCode;

  try {
    const res = await axios.get(indexUrl, {
      timeout: 15000,
      headers: HEADERS,
      validateStatus: (s) => s === 200 || s === 403,
    });
    const $ = cheerio.load(res.data as string);

    // ── 1. 比賽時間、球場、種類 ──────────────────────────────────────────
    const gameInfoText = $('.game_info').text().replace(/\s+/g, ' ').trim();

    // ◇開始 HH:MM
    const startTimeMatch = gameInfoText.match(/◇開始\s+(\d{1,2}:\d{2})/);
    const startTime = startTimeMatch ? startTimeMatch[1] : null;

    // 球場
    const venue = $('.game_tit .place').text().trim() || null;

    // 種類: 【オープン戦】/【公式戦】/【交流戦】
    const h3Text = $('.game_tit h3').text().trim();
    const gameTypeMatch = h3Text.match(/【(.+?)】/);
    let gameType = gameTypeMatch ? gameTypeMatch[1] : '例行賽';
    if (gameType === 'オープン戦') gameType = 'オープン戦';
    else if (gameType.includes('交流')) gameType = '交流戦';
    else if (gameType.includes('日本シリーズ') || gameType.includes('CS')) gameType = 'ポストシーズン';
    else gameType = '例行賽';

    // ── 2. 比賽狀態 (status + gameDetail) ──────────────────────────────────
    let status: 'scheduled' | 'live' | 'final' = 'scheduled';
    let gameDetail = '試合開始前';

    if (gameInfoText.includes('雨天中止') || gameInfoText.includes('降雨中止') || gameInfoText.includes('天候中止') || gameInfoText.includes('中止')) {
      status = 'final';
      gameDetail = '雨天延賽';
    } else if (gameInfoText.includes('試合終了') || gameInfoText.includes('終了')) {
      status = 'final';
      gameDetail = '試合終了';
    } else if (gameInfoText.includes('試合開始前') || gameInfoText.includes('開始前')) {
      status = 'scheduled';
      gameDetail = '試合開始前';
    } else {
      // 【試合中 X回表】 or 【試合中 X回裏】
      const inningMatch = gameInfoText.match(/【試合中\s*(.*?)】/) || gameInfoText.match(/(\d+)回(表|裏)/);
      if (inningMatch) {
        status = 'live';
        gameDetail = inningMatch[1] || `${inningMatch[1]}回${inningMatch[2]}`;
      }
    }

    // ── 3. イニングスコア ──────────────────────────────────────────────────
    // セレクタ: #tablefix_ls tr.top (away) / tr.bottom (home)
    const innings: InningScore[] = [];
    let scoreAway: number | null = null;
    let scoreHome: number | null = null;
    let hitsAway: number | null = null;
    let hitsHome: number | null = null;
    let errorsAway: number | null = null;
    let errorsHome: number | null = null;

    const parseRow = (rowSel: string, isAway: boolean) => {
      const row = $(`#tablefix_ls ${rowSel}`);
      if (!row.length) return;

      // td (イニング得点) — th が先にある場合、td.total-1 以外の td が各回
      let inningIdx = 0;
      row.find('td').each((_, td) => {
        const cls = $(td).attr('class') ?? '';
        const text = $(td).text().trim();

        if (cls.includes('total-1')) {
          // 合計得点
          const total = parseInt(text, 10);
          if (!isNaN(total)) {
            if (isAway) scoreAway = total;
            else scoreHome = total;
          }
        } else if (cls.includes('total-2')) {
          // H または E (順番通り)
          const val = parseInt(text, 10);
          if (!isNaN(val)) {
            if (isAway) {
              if (hitsAway === null) hitsAway = val;
              else errorsAway = val;
            } else {
              if (hitsHome === null) hitsHome = val;
              else errorsHome = val;
            }
          }
        } else {
          // 各回の得点
          inningIdx++;
          const score = text === 'x' ? 0 : parseInt(text, 10);
          const validScore = isNaN(score) ? null : score;
          while (innings.length < inningIdx) {
            innings.push({ inning: innings.length + 1, scoreAway: null, scoreHome: null });
          }
          if (isAway) innings[inningIdx - 1].scoreAway = validScore;
          else innings[inningIdx - 1].scoreHome = validScore;
        }
      });
    };

    parseRow('tr.top', true);   // away チーム
    parseRow('tr.bottom', false); // home チーム

    // スコアがある → final/live 判定強化
    if ((scoreAway !== null || scoreHome !== null) && status === 'scheduled') {
      status = 'final';
      gameDetail = '試合終了';
    }

    // ── 4. 先発オーダー (スタメン) ─────────────────────────────────────────
    // セレクタ:
    //   away: #player-order .half_left table tr
    //   home: #player-order .half_right table tr
    // 各行: th:eq(0)=打順(数字 or "&nbsp;"), th:eq(1)=守備位置, td a=選手名

    function parseLineup(selector: string): LineupPlayer[] {
      const players: LineupPlayer[] = [];
      $(`#player-order ${selector} table tr`).each((_, tr) => {
        const ths = $(tr).find('th');
        const playerLink = $(tr).find('td a').first();
        if (!playerLink.length) return;

        const orderText = ths.eq(0).text().trim();
        const order = parseInt(orderText, 10);
        const position = ths.eq(1).text().trim();
        const name = playerLink.text().trim();

        if (name) {
          players.push({
            battingOrder: isNaN(order) ? 0 : order,
            position,
            name,
          });
        }
      });
      return players;
    }

    const lineupAway = parseLineup('.half_left');
    const lineupHome = parseLineup('.half_right');

    // ── 5. バッテリー ────────────────────────────────────────────────────────
    // セレクタ: .game_result_info table tr
    // th=【チーム名】, td = "投手名、投手名 ‐ 捕手名"
    let batteryAway: Battery | null = null;
    let batteryHome: Battery | null = null;

    $('.game_result_info table tr').each((_, tr) => {
      const teamText = $(tr).find('th').text().trim();   // 例: "【楽天】"
      const batteryText = $(tr).find('td').text().trim(); // 例: "前田健、九谷 ‐ 太田"

      if (!teamText || !batteryText) return;

      // "投手A、投手B ‐ 捕手C" の形式
      const parts = batteryText.split(/[‐－\-]/);
      const pitchers = (parts[0] ?? '').trim();
      const catchers = (parts[1] ?? '').trim();

      // チーム名からホーム/アウェイ判定
      const teamCode = guessCode(teamText.replace(/[【】]/g, ''));
      if (teamCode === awayCode) {
        batteryAway = { pitchers, catchers };
      } else if (teamCode === homeCode) {
        batteryHome = { pitchers, catchers };
      }
    });

    // バッテリーテキスト全体から勝敗投手を抽出
    // セレクタ: .game_result_info (勝)名前 / (敗)名前 / (S)名前
    const resultText = $('.game_result_info').text();
    const winMatch = resultText.match(/[（(]勝[)）]([^\s　、，,\n（(]+)/);
    const lossMatch = resultText.match(/[（(]敗[)）]([^\s　、，,\n（(]+)/);
    const saveMatch = resultText.match(/[（(]S[)）]([^\s　、，,\n（(]+)/);

    return {
      urlPath: gameUrl,
      homeCode,
      awayCode,
      homeTeam,
      awayTeam,
      gameDate,
      startTime,
      venue,
      gameType,
      status,
      gameDetail,
      scoreHome,
      scoreAway,
      hitsHome,
      hitsAway,
      errorsHome,
      errorsAway,
      innings,
      lineupHome,
      lineupAway,
      batteryHome,
      batteryAway,
      winPitcher: winMatch ? winMatch[1].trim() : '',
      lossPitcher: lossMatch ? lossMatch[1].trim() : '',
      savePitcher: saveMatch ? saveMatch[1].trim() : '',
    };

  } catch (err: unknown) {
    const e = err as { response?: { status: number } };
    if (e.response?.status === 404) return null;
    console.warn(`[NPB Scraper] 無法解析 ${gameUrl}:`, (err as Error).message);
    return null;
  }
}

// ─── Step 3: DB 更新 ──────────────────────────────────────────────────────────

async function upsertGameToDB(g: GameDetail): Promise<number | null> {
  try {
    const timeStr = g.startTime ?? '18:00';
    const gameDateJST = `${g.gameDate}T${timeStr}:00+09:00`;

    // 既存レコードを JST 日付 + チーム名 で検索
    const existing = await pool.query(
      `SELECT id FROM games
       WHERE league = 'NPB'
         AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $1::date
         AND team_home = $2 AND team_away = $3
       LIMIT 1`,
      [g.gameDate, g.homeTeam, g.awayTeam]
    );

    let gameId: number;

    if (existing.rows.length > 0) {
      gameId = existing.rows[0].id;
      await pool.query(
        `UPDATE games SET
           score_home  = COALESCE($1, score_home),
           score_away  = COALESCE($2, score_away),
           status      = $3,
           game_detail = $4,
           venue       = COALESCE($5, venue),
           game_date   = CASE WHEN $6::text IS NOT NULL
                              THEN $6::timestamptz
                              ELSE game_date END
         WHERE id = $7`,
        [g.scoreHome, g.scoreAway, g.status, g.gameDetail,
         g.venue, g.startTime ? gameDateJST : null, gameId]
      );
    } else {
      const ins = await pool.query(
        `INSERT INTO games
           (league, team_home, team_away, score_home, score_away,
            status, game_detail, venue, game_date)
         VALUES ('NPB', $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (league, team_home, team_away, DATE(game_date AT TIME ZONE 'Asia/Tokyo')) DO UPDATE
           SET score_home  = EXCLUDED.score_home,
               score_away  = EXCLUDED.score_away,
               status      = EXCLUDED.status,
               game_detail = EXCLUDED.game_detail,
               venue       = COALESCE(EXCLUDED.venue, games.venue)
         RETURNING id`,
        [g.homeTeam, g.awayTeam, g.scoreHome, g.scoreAway,
         g.status, g.gameDetail, g.venue, gameDateJST]
      );
      gameId = ins.rows[0]?.id;
      if (!gameId) return null;
    }

    // イニング得点を保存
    for (const inn of g.innings) {
      if (inn.scoreAway === null && inn.scoreHome === null) continue;
      await pool.query(
        `INSERT INTO game_innings (game_id, inning, score_away, score_home)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, inning) DO UPDATE
           SET score_away = EXCLUDED.score_away,
               score_home = EXCLUDED.score_home`,
        [gameId, inn.inning, inn.scoreAway, inn.scoreHome]
      );
    }

    // game_stats (hits/errors/win-loss pitcher) を保存
    if (g.status === 'final' && (g.hitsHome !== null || g.winPitcher)) {
      await pool.query(
        `INSERT INTO game_stats
           (game_id, hits_away, hits_home, errors_away, errors_home,
            win_pitcher, loss_pitcher, save_pitcher, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (game_id) DO UPDATE
           SET hits_away    = COALESCE(EXCLUDED.hits_away, game_stats.hits_away),
               hits_home    = COALESCE(EXCLUDED.hits_home, game_stats.hits_home),
               errors_away  = COALESCE(EXCLUDED.errors_away, game_stats.errors_away),
               errors_home  = COALESCE(EXCLUDED.errors_home, game_stats.errors_home),
               win_pitcher  = COALESCE(NULLIF(EXCLUDED.win_pitcher,''), game_stats.win_pitcher),
               loss_pitcher = COALESCE(NULLIF(EXCLUDED.loss_pitcher,''), game_stats.loss_pitcher),
               save_pitcher = COALESCE(NULLIF(EXCLUDED.save_pitcher,''), game_stats.save_pitcher),
               updated_at   = NOW()`,
        [gameId, g.hitsAway, g.hitsHome, g.errorsAway, g.errorsHome,
         g.winPitcher, g.lossPitcher, g.savePitcher]
      );
    }

    // 先発オーダーをゲームのカラムに JSON 保存
    // (game_lineups テーブルがない場合は games の lineup_json カラムを使う想定)
    // テーブルが存在する場合のみ保存
    try {
      const lineupCheck = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='game_lineups')"
      );
      if (lineupCheck.rows[0].exists) {
        await pool.query('DELETE FROM game_lineups WHERE game_id = $1', [gameId]);
        const allPlayers = [
          ...g.lineupAway.map(p => ({ ...p, teamCode: g.awayCode, isHome: false })),
          ...g.lineupHome.map(p => ({ ...p, teamCode: g.homeCode, isHome: true })),
        ];
        for (const p of allPlayers) {
          await pool.query(
            `INSERT INTO game_lineups
               (game_id, team_code, is_home, batting_order, position, player_name)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [gameId, p.teamCode, p.isHome, p.battingOrder, p.position, p.name]
          );
        }
      }
    } catch { /* game_lineups テーブルなし → スキップ */ }

    return gameId;
  } catch (e) {
    console.warn('[NPB Scraper] DB 更新失敗:', (e as Error).message);
    return null;
  }
}

// ─── Step 4: Box Score (打者/投手成績) ────────────────────────────────────────

/**
 * npb.jp box.html セレクタ:
 *
 * 打者成績:
 *   away チーム表: #tablefix_t_b tbody tr
 *   home チーム表: #tablefix_b_b tbody tr
 *   列順: [0]打順 [1]守備 [2]選手名(a) [3]打数 [4]得点 [5]安打 [6]打点 [7]盗塁 [8+]各回打席結果
 *   打席結果テキスト例: "三　振" / "四　球" / "死　球" / "右前安" / "左越本"
 *
 * 投手成績:
 *   away チーム表: #tablefix_t_p tbody tr
 *   home チーム表: #tablefix_b_p tbody tr
 *   列順: [0](空) [1]投手名(a) [2]投球数 [3]打者 [4]投球回(nested table) [5]安打
 *         [6]本塁打 [7]四球 [8]死球 [9]三振 [10]暴投 [11]ボーク [12]失点 [13]自責点
 *   投球回: <table class="table_inning"><tr><th>6</th><td>1/3</td></tr></table>
 *            → "6 1/3"  (td が空なら整数局のみ)
 */
export async function scrapeNpbBoxScore(
  gameUrl: string,
  homeCode: string,
  awayCode: string,
  gameId: number,
  winPitcher: string,
  lossPitcher: string,
  savePitcher: string,
): Promise<void> {
  const boxUrl = (gameUrl.endsWith('/') ? gameUrl : `${gameUrl}/`) + 'box.html';

  try {
    const res = await axios.get(boxUrl, {
      timeout: 15000,
      headers: HEADERS,
      validateStatus: (s) => s === 200 || s === 403,
    });

    const $ = cheerio.load(res.data as string);

    // ── 打者成績パーサ ──────────────────────────────────────────────────────
    const parseBatters = (tableId: string, teamCode: string): BatterStat[] => {
      const batters: BatterStat[] = [];
      let rowOrder = 0;

      $(`#${tableId} tbody tr`).each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 7) return;

        const playerName = tds.eq(2).find('a').text().trim() || tds.eq(2).text().trim();
        if (!playerName) return;

        rowOrder++;
        const orderText = tds.eq(0).text().trim();
        const battingOrder = parseInt(orderText, 10) || rowOrder;
        const position    = tds.eq(1).text().replace(/\s+/g, '').trim();
        const atBats      = parseInt(tds.eq(3).text().trim(), 10);
        const runs        = parseInt(tds.eq(4).text().trim(), 10);
        const hits        = parseInt(tds.eq(5).text().trim(), 10);
        const rbi         = parseInt(tds.eq(6).text().trim(), 10);
        const stolenBases = parseInt(tds.eq(7).text().trim(), 10);

        // 各回打席テキストから打席結果・各種集計
        let strikeouts = 0, walks = 0, homeRuns = 0, hitByPitch = 0, sacrificeHits = 0;
        const atBatResults: string[] = [];

        tds.each((i, td) => {
          if (i < 8) return;
          const text = $(td).text().replace(/\s+/g, '').trim();
          if (!text) return;
          atBatResults.push(text);
          if (text.includes('三振'))   strikeouts++;
          if (text.includes('四球'))   walks++;
          if (text.includes('死球'))   hitByPitch++;
          if (text.includes('犠打'))   sacrificeHits++;
          if (text.includes('本'))     homeRuns++;
        });

        batters.push({
          teamCode,
          battingOrder,
          position,
          playerName,
          atBats:       isNaN(atBats)       ? 0 : atBats,
          hits:         isNaN(hits)         ? 0 : hits,
          rbi:          isNaN(rbi)          ? 0 : rbi,
          runs:         isNaN(runs)         ? 0 : runs,
          homeRuns,
          strikeouts,
          walks,
          stolenBases:  isNaN(stolenBases)  ? 0 : stolenBases,
          hitByPitch,
          sacrificeHits,
          atBatResults,
        });
      });

      return batters;
    };

    // ── 投手成績パーサ ──────────────────────────────────────────────────────
    const parsePitchers = (tableId: string, teamCode: string): PitcherStat[] => {
      const pitchers: PitcherStat[] = [];
      let pitcherOrder = 0;

      $(`#${tableId} tbody tr`).each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 6) return;

        const playerName = tds.eq(1).find('a').text().trim() || tds.eq(1).text().trim();
        if (!playerName) return;

        pitcherOrder++;

        // 投球数・打者数 (cols before nested table — no index shift)
        const pitchCount   = parseInt(tds.eq(2).text().trim(), 10);
        const battersFaced = parseInt(tds.eq(3).text().trim(), 10);

        // 投球回: nested <table class="table_inning"> <th>=整数局, <td>=端数
        const inningTable    = tds.eq(4).find('table.table_inning');
        const fullInnings    = inningTable.find('th').first().text().trim();
        const fracInnings    = inningTable.find('td').first().text().trim();
        const inningsPitched = fracInnings ? `${fullInnings} ${fracInnings}` : (fullInnings || '0');

        // NOTE: $(tr).find('td') picks up the nested <td> inside table.table_inning,
        // so indices after col[4] (投球回) are shifted by +1 vs. visual column order.
        // col[5]=nested fraction td  col[6]=安打 col[7]=本塁打 col[8]=四球 col[9]=死球
        // col[10]=三振 col[11]=暴投 col[12]=ボーク col[13]=失点 col[14]=自責点
        const hitsAllowed     = parseInt(tds.eq(6).text().trim(),  10);
        const homeRunsAllowed = parseInt(tds.eq(7).text().trim(),  10);
        const walksAllowed    = parseInt(tds.eq(8).text().trim(),  10);
        const hitByPitch      = parseInt(tds.eq(9).text().trim(),  10);
        const strikeouts      = parseInt(tds.eq(10).text().trim(), 10);
        const balk            = parseInt(tds.eq(12).text().trim(), 10);
        const runsAllowed     = parseInt(tds.eq(13).text().trim(), 10);
        const earnedRuns      = parseInt(tds.eq(14).text().trim(), 10);

        // 勝敗S を名前で照合
        let result = '';
        const n = playerName;
        if (winPitcher  && winPitcher.includes(n))       result = '勝';
        else if (lossPitcher && lossPitcher.includes(n)) result = '敗';
        else if (savePitcher && savePitcher.includes(n)) result = 'S';

        pitchers.push({
          teamCode,
          pitcherOrder,
          playerName,
          inningsPitched,
          hitsAllowed:     isNaN(hitsAllowed)     ? 0 : hitsAllowed,
          runsAllowed:     isNaN(runsAllowed)      ? 0 : runsAllowed,
          earnedRuns:      isNaN(earnedRuns)       ? 0 : earnedRuns,
          walks:           isNaN(walksAllowed)     ? 0 : walksAllowed,
          strikeouts:      isNaN(strikeouts)       ? 0 : strikeouts,
          result,
          pitchCount:      isNaN(pitchCount)       ? 0 : pitchCount,
          battersFaced:    isNaN(battersFaced)     ? 0 : battersFaced,
          homeRunsAllowed: isNaN(homeRunsAllowed)  ? 0 : homeRunsAllowed,
          hitByPitch:      isNaN(hitByPitch)       ? 0 : hitByPitch,
          balk:            isNaN(balk)             ? 0 : balk,
        });
      });

      return pitchers;
    };

    // away = table top (t), home = table bottom (b)
    const awayBatters   = parseBatters('tablefix_t_b', awayCode);
    const homeBatters   = parseBatters('tablefix_b_b', homeCode);
    const awayPitchers  = parsePitchers('tablefix_t_p', awayCode);
    const homePitchers  = parsePitchers('tablefix_b_p', homeCode);

    const allBatters  = [...awayBatters,  ...homeBatters];
    const allPitchers = [...awayPitchers, ...homePitchers];

    if (allBatters.length === 0 && allPitchers.length === 0) {
      console.log(`[NPB BoxScore] ${boxUrl} — 尚無成績資料，跳過`);
      return;
    }

    // ── DB 保存 ─────────────────────────────────────────────────────────────
    await pool.query('DELETE FROM game_batter_stats  WHERE game_id = $1', [gameId]);
    await pool.query('DELETE FROM game_pitcher_stats WHERE game_id = $1', [gameId]);

    for (const b of allBatters) {
      await pool.query(
        `INSERT INTO game_batter_stats
           (game_id, team_code, batting_order, position, player_name,
            at_bats, hits, rbi, runs, home_runs, strikeouts, walks,
            stolen_bases, hit_by_pitch, sacrifice_hits, at_bat_results)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [gameId, b.teamCode, b.battingOrder, b.position, b.playerName,
         b.atBats, b.hits, b.rbi, b.runs, b.homeRuns, b.strikeouts, b.walks,
         b.stolenBases, b.hitByPitch, b.sacrificeHits, b.atBatResults],
      );
    }

    for (const p of allPitchers) {
      await pool.query(
        `INSERT INTO game_pitcher_stats
           (game_id, team_code, pitcher_order, player_name,
            innings_pitched, hits_allowed, runs_allowed, earned_runs, walks, strikeouts, result,
            pitch_count, batters_faced, home_runs_allowed, hit_by_pitch, balk)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [gameId, p.teamCode, p.pitcherOrder, p.playerName,
         p.inningsPitched, p.hitsAllowed, p.runsAllowed, p.earnedRuns,
         p.walks, p.strikeouts, p.result,
         p.pitchCount, p.battersFaced, p.homeRunsAllowed, p.hitByPitch, p.balk],
      );
    }

    console.log(`[NPB BoxScore] game#${gameId} 打者 ${allBatters.length} 人、投手 ${allPitchers.length} 人`);
  } catch (err) {
    console.warn(`[NPB BoxScore] 無法解析 ${boxUrl}:`, (err as Error).message);
  }
}

// ─── Step 5: Yahoo Baseball 速報 (play-by-play) ──────────────────────────────

const YAHOO_BASE = 'https://baseball.yahoo.co.jp';

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'ja,zh-TW;q=0.9,en;q=0.8',
  'Referer': 'https://baseball.yahoo.co.jp/',
};

/**
 * Yahoo Baseball の日程ページからゲーム ID を取得する
 * URL: https://baseball.yahoo.co.jp/npb/schedule/?date=YYYYMMDD
 * セレクタ: a[href*="/npb/game/"] → "/npb/game/2026031701/top"
 *
 * チーム名マッピング (Yahoo → NPB コード)
 */
const YAHOO_TEAM_MAP: Record<string, string> = {
  '巨人': 'g', 'ジャイアンツ': 'g',
  'ＤｅＮＡ': 'db', 'DeNA': 'db', 'ベイスターズ': 'db',
  '阪神': 't', 'タイガース': 't',
  '広島': 'c', 'カープ': 'c',
  '中日': 'd', 'ドラゴンズ': 'd',
  'ヤクルト': 's', 'スワローズ': 's',
  '西武': 'l', 'ライオンズ': 'l',
  '楽天': 'e', 'ゴールデンイーグルス': 'e',
  'ソフトバンク': 'h', 'ホークス': 'h',
  '日本ハム': 'f', 'ファイターズ': 'f',
  'ロッテ': 'm', 'マリーンズ': 'm',
  'オリックス': 'b', 'バファローズ': 'b',
};

async function fetchYahooGameId(
  gameDate: string,   // YYYY-MM-DD
  homeCode: string,
  awayCode: string,
): Promise<string | null> {
  const dateCompact = gameDate.replace(/-/g, '');
  const url = `${YAHOO_BASE}/npb/schedule/?date=${dateCompact}`;

  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: YAHOO_HEADERS,
      validateStatus: (s) => s < 500,
    });

    const $ = cheerio.load(res.data as string);
    let foundId: string | null = null;

    // セレクタ: a[href*="/npb/game/"] のリンクを全取得
    $('a[href*="/npb/game/"]').each((_, el) => {
      if (foundId) return;
      const href = $(el).attr('href') ?? '';
      const match = href.match(/\/npb\/game\/(\d{10,})\//);
      if (!match) return;

      const gameId = match[1];
      // 同じ行/親要素からチーム名を取得して照合
      const row = $(el).closest('tr, .bb-score__content, [class*="score"]');
      const rowText = row.text();

      const awayName = CODE_TO_NAME[awayCode] ?? awayCode;
      const homeName = CODE_TO_NAME[homeCode] ?? homeCode;

      if (rowText.includes(awayName) && rowText.includes(homeName)) {
        foundId = gameId;
      } else {
        // 親要素のテキストからコードで照合 (より緩やかなマッチング)
        const codes = [homeCode, awayCode];
        const rowCodes = Object.values(YAHOO_TEAM_MAP).filter(code =>
          rowText.includes(Object.keys(YAHOO_TEAM_MAP).find(k => YAHOO_TEAM_MAP[k] === code) ?? '')
        );
        if (codes.every(c => rowCodes.includes(c))) foundId = gameId;
      }
    });

    // フォールバック: URL の日付部分だけで最初の ID を返す
    if (!foundId) {
      $('a[href*="/npb/game/"]').each((_, el) => {
        if (foundId) return;
        const href = $(el).attr('href') ?? '';
        const match = href.match(/\/npb\/game\/(\d{10,})\//);
        if (match && match[1].startsWith(dateCompact)) foundId = match[1];
      });
    }

    return foundId;
  } catch (err) {
    console.warn('[Yahoo] 無法取得日程頁:', (err as Error).message);
    return null;
  }
}

/**
 * Yahoo Baseball text ページから play-by-play を取得して DB に保存
 * URL: https://baseball.yahoo.co.jp/npb/game/{yahooGameId}/text
 *
 * HTML 構造 (SSR):
 *   <h3>N回表</h3> / <h3>N回裏</h3>  → イニング区切り
 *   <ol><li><p>テキスト</p></li>...</ol> → 各プレイ
 */
async function scrapeYahooPlayByPlay(
  yahooGameId: string,
  gameId: number,
): Promise<void> {
  const url = `${YAHOO_BASE}/npb/game/${yahooGameId}/text`;

  try {
    const res = await axios.get(url, {
      timeout: 20000,
      headers: YAHOO_HEADERS,
      validateStatus: (s) => s < 500,
      maxRedirects: 5,
    });

    if (res.status !== 200) {
      console.log(`[Yahoo PBP] ${url} → HTTP ${res.status}、跳過`);
      return;
    }

    const $ = cheerio.load(res.data as string);

    interface PlayEntry {
      inning: number;
      isTop: boolean;
      playOrder: number;
      description: string;
    }

    const plays: PlayEntry[] = [];
    let currentInning = 1;
    let currentIsTop  = true;
    let playCounter   = 0;

    // h3 タグ + 直後の ol を順に走査
    $('h3, ol').each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();

      if (tag === 'h3') {
        const text = $(el).text().trim();
        const m = text.match(/(\d+)回(表|裏)/);
        if (m) {
          currentInning = parseInt(m[1], 10);
          currentIsTop  = m[2] === '表';
          playCounter   = 0;
        }
      } else if (tag === 'ol') {
        $(el).find('li').each((_, li) => {
          const desc = $(li).find('p').map((_, p) => $(p).text().trim()).get().join(' ').trim()
            || $(li).text().replace(/\s+/g, ' ').trim();
          if (!desc) return;
          plays.push({
            inning:      currentInning,
            isTop:       currentIsTop,
            playOrder:   ++playCounter,
            description: desc,
          });
        });
      }
    });

    if (plays.length === 0) {
      console.log(`[Yahoo PBP] game#${gameId} — 尚無速報資料`);
      return;
    }

    // DELETE + re-INSERT (idempotent)
    await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [gameId]);
    for (const p of plays) {
      await pool.query(
        `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, p.inning, p.isTop, p.playOrder, p.description],
      );
    }

    console.log(`[Yahoo PBP] game#${gameId} 已儲存 ${plays.length} 筆速報`);
  } catch (err) {
    console.warn(`[Yahoo PBP] 無法解析 ${url}:`, (err as Error).message);
  }
}

// ─── Step 6: NPB.jp 官方文字速報 ─────────────────────────────────────────────
//  URL: https://npb.jp/scores/YYYY/MMDD/away-home-NN/playbyplay.html
//  結構: <h5>N回表/裏（チーム）</h5>  → 局數標題
//        <table>TDs: アウト | 壘包 | 選手 | 球數 | 結果</table>  → 每打席

async function scrapeNpbPlayByPlay(urlPath: string, gameId: number): Promise<void> {
  const url = `${NPB_BASE}${urlPath}playbyplay.html`;
  try {
    const res = await axios.get(url, {
      timeout: 20000,
      headers: HEADERS,
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) {
      console.log(`[NPB PBP] ${url} → HTTP ${res.status}，跳過`);
      return;
    }

    const $ = cheerio.load(res.data as string);

    interface PlayEntry { inning: number; isTop: boolean; playOrder: number; description: string; }
    const plays: PlayEntry[] = [];
    let currentInning = 1;
    let currentIsTop  = true;
    let playCounter   = 0;
    let hasSeenInning = false;

    $('h5, table').each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();

      if (tag === 'h5') {
        const text = $(el).text().trim();
        const m = text.match(/(\d+)回(表|裏)/);
        if (m) {
          currentInning = parseInt(m[1], 10);
          currentIsTop  = m[2] === '表';
          playCounter   = 0;
          hasSeenInning = true;
        }
        return;
      }

      if (tag === 'table' && hasSeenInning) {
        const tds = $(el).find('td')
          .map((_, td) => $(td).text().trim())
          .get()
          .filter(t => t.length > 0);
        if (tds.length < 2) return;
        if (tds.some(t => t.includes('先発投手'))) return;
        const desc = tds.join(' ').replace(/\s+/g, ' ').trim();
        if (!desc) return;
        plays.push({ inning: currentInning, isTop: currentIsTop, playOrder: ++playCounter, description: desc });
      }
    });

    if (plays.length === 0) {
      console.log(`[NPB PBP] game#${gameId} — 速報資料為空`);
      return;
    }

    await pool.query('DELETE FROM game_play_by_play WHERE game_id = $1', [gameId]);
    for (const p of plays) {
      await pool.query(
        `INSERT INTO game_play_by_play (game_id, inning, is_top, play_order, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [gameId, p.inning, p.isTop, p.playOrder, p.description],
      );
    }
    console.log(`[NPB PBP] game#${gameId} 已儲存 ${plays.length} 筆速報`);
  } catch (err) {
    console.warn(`[NPB PBP] 無法解析 ${url}:`, (err as Error).message);
  }
}

// ─── 公開 API ────────────────────────────────────────────────────────────────

export interface NpbScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesUpdated: number;
  isRunning: boolean;
  lastError: string | null;
}

export const npbScraperStatus: NpbScraperStatus = {
  lastRun: null,
  lastResult: '尚未執行',
  gamesUpdated: 0,
  isRunning: false,
  lastError: null,
};

/**
 * 今日の NPB 比賽を npb.jp からスクレイピングして DB 更新
 */
/**
 * 進行中の試合（status='live'）に対してのみ box score と play-by-play を再取得
 * 30 秒ごとに呼ばれる想定
 */
// ── 從 schedule_detail.html 批量填入 games.npb_url ──────────────────────────

export async function populateNpbUrls(): Promise<void> {
  try {
    const links = await fetchGameLinksFromUrl(PRESEASON_URL, null); // 全日程
    for (const link of links) {
      // link 格式: https://npb.jp/scores/2026/MMDD/home-away-NN/
      const m = link.match(/\/scores\/(\d{4})\/(\d{4})\/([\w]+-[\w]+-\d+)\/?$/);
      if (!m) continue;
      const [, year, mmdd, slug] = m;
      const urlPath = `/scores/${year}/${mmdd}/${slug}/`;
      // URL slug 格式: homeCode-awayCode-NN（與 fetchGameDetail 一致，第一碼為主場）
      const parts = slug.split('-');
      const homeCode = parts[0];
      const awayCode = parts[1];
      const homeName = CODE_TO_NAME[homeCode];
      const awayName = CODE_TO_NAME[awayCode];
      if (!awayName || !homeName) continue;

      const month = mmdd.slice(0, 2);
      const day   = mmdd.slice(2, 4);
      const dateStr = `${year}-${month}-${day}`;

      const r = await pool.query(
        `UPDATE games SET npb_url = $1
         WHERE league = 'NPB'
           AND team_away = $2 AND team_home = $3
           AND DATE(game_date AT TIME ZONE 'Asia/Tokyo') = $4::date
           AND (npb_url IS NULL OR npb_url != $1)`,
        [urlPath, awayName, homeName, dateStr],
      );
      if ((r.rowCount ?? 0) > 0) {
        console.log(`[NPB URL] ✅ ${awayName}@${homeName} ${dateStr} → ${urlPath}`);
      }
    }
    console.log(`[NPB URL] npb_url 填入完成（處理 ${links.length} 條連結）`);
  } catch (err) {
    console.warn('[NPB URL] 填入失敗:', (err as Error).message);
  }
}

// ── 每 30 秒：進行中比賽更新 + 剛完賽場次補抓 PBP ───────────────────────────

export async function runLiveBoxScoreUpdate(): Promise<void> {
  try {
    // ── 安全網：超過 6 小時仍為 live 的比賽強制標為 final ──────────────────
    const stuckResult = await pool.query(
      `UPDATE games SET status = 'final'
       WHERE status = 'live'
         AND game_date < NOW() - INTERVAL '6 hours'
         AND league IN ('NPB', 'NPB2')`,
    );
    if ((stuckResult.rowCount ?? 0) > 0) {
      console.log(`[NPB Live] 自動修正 ${stuckResult.rowCount} 場卡住的 live 比賽 → final`);
    }

    const reverseCode = (name: string) => {
      for (const [k, v] of Object.entries(CODE_TO_NAME)) if (v === name) return k;
      return '';
    };

    // ① 進行中比賽：更新比分 + 速報
    const liveGames = await pool.query<{
      id: number; team_home: string; team_away: string;
      yahoo_game_id: string | null; npb_url: string | null;
      win_pitcher: string | null; loss_pitcher: string | null; save_pitcher: string | null;
      game_date: string;
    }>(
      `SELECT g.id, g.team_home, g.team_away, g.yahoo_game_id, g.npb_url,
              gs.win_pitcher, gs.loss_pitcher, gs.save_pitcher, g.game_date
       FROM games g
       LEFT JOIN game_stats gs ON gs.game_id = g.id
       WHERE g.league = 'NPB' AND g.status = 'live'`,
    );

    for (const row of liveGames.rows) {
      const gameId = row.id;
      const homeCode = reverseCode(row.team_home);
      const awayCode = reverseCode(row.team_away);
      const jstDate  = new Date(new Date(row.game_date).getTime() + 9 * 3600 * 1000);

      // 取得今日 box score URL（同時存入 npb_url）
      let npbUrl = row.npb_url;
      if (!npbUrl) {
        const links = await fetchDailyGameLinks(jstDate);
        const gameLink = links.find(l => {
          const m = l.match(/\/scores\/\d+\/\d+\/([\w]+)-([\w]+)-\d+\/?/);
          return m && m[1] === homeCode && m[2] === awayCode;
        });
        if (gameLink) {
          const pm = gameLink.match(/\/scores\/(\d{4}\/\d{4}\/[\w-]+)\/?/);
          npbUrl = pm ? `/scores/${pm[1]}/` : null;
          if (npbUrl) {
            await pool.query('UPDATE games SET npb_url = $1 WHERE id = $2', [npbUrl, gameId]);
          }
        }
      }

      // 更新 box score
      const fullUrl = npbUrl ? `${NPB_BASE}${npbUrl}` : null;
      if (fullUrl) {
        await scrapeNpbBoxScore(
          fullUrl, homeCode, awayCode, gameId,
          row.win_pitcher ?? '', row.loss_pitcher ?? '', row.save_pitcher ?? '',
        );
      }

      // 更新 NPB.jp 文字速報
      if (npbUrl) {
        await scrapeNpbPlayByPlay(npbUrl, gameId);
      }
    }

    // ② 剛完賽（最近 24 小時）且尚無文字速報的場次：補抓一次
    const recentFinal = await pool.query<{ id: number; npb_url: string | null }>(
      `SELECT g.id, g.npb_url
       FROM games g
       WHERE g.league = 'NPB' AND g.status = 'final'
         AND g.game_date >= NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM game_play_by_play WHERE game_id = g.id
         )
         AND g.npb_url IS NOT NULL`,
    );

    for (const row of recentFinal.rows) {
      await scrapeNpbPlayByPlay(row.npb_url!, row.id);
      await new Promise(r => setTimeout(r, 800));
    }

  } catch (err) {
    console.warn('[Live Update] 更新失敗:', (err as Error).message);
  }
}

export async function runNpbScraper(): Promise<{ updated: number; message: string; status: NpbScraperStatus }> {
  if (npbScraperStatus.isRunning) {
    return { updated: 0, message: 'NPB 爬蟲正在執行中', status: npbScraperStatus };
  }

  npbScraperStatus.isRunning = true;
  npbScraperStatus.lastRun = new Date().toISOString();
  npbScraperStatus.lastError = null;

  try {
    // JST「今日」を使う
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = toLocalDateStr(jstNow);

    // Step 1: 今日の試合 URL を取得
    const gameLinks = await fetchDailyGameLinks(jstNow);

    if (gameLinks.length === 0) {
      npbScraperStatus.lastResult = `今日 (${dateStr}) 無 NPB 比賽資料`;
      npbScraperStatus.gamesUpdated = 0;
      npbScraperStatus.isRunning = false;
      return { updated: 0, message: npbScraperStatus.lastResult, status: npbScraperStatus };
    }

    // Step 2: 各試合の詳細を取得
    let updated = 0;
    for (const link of gameLinks) {
      const detail = await fetchGameDetail(link);
      if (!detail) continue;

      const gameId = await upsertGameToDB(detail);
      if (!gameId) continue;
      updated++;

      // 比賽結束或進行中 → 抓取 box score（打者/投手成績）
      if (detail.status === 'final' || detail.status === 'live') {
        await scrapeNpbBoxScore(
          link, detail.homeCode, detail.awayCode, gameId,
          detail.winPitcher, detail.lossPitcher, detail.savePitcher,
        );

        // npb.jp 文字速報：使用 npb_url（若已填入）
        const urlRow = await pool.query<{ npb_url: string | null }>(
          'SELECT npb_url FROM games WHERE id = $1', [gameId]
        );
        const npbUrl = urlRow.rows[0]?.npb_url ?? null;
        if (npbUrl) {
          await scrapeNpbPlayByPlay(npbUrl, gameId);
        }
      }

      // Rate limiting — npb.jp に負荷をかけない
      await new Promise(r => setTimeout(r, 1000));
    }

    npbScraperStatus.gamesUpdated = updated;
    npbScraperStatus.lastResult = `✅ NPB 更新 ${updated} 場 (${dateStr})`;
    npbScraperStatus.isRunning = false;
    console.log(`[NPB Scraper] ${npbScraperStatus.lastResult}`);
    return { updated, message: npbScraperStatus.lastResult, status: npbScraperStatus };

  } catch (err) {
    const msg = (err as Error).message;
    npbScraperStatus.lastError = msg;
    npbScraperStatus.lastResult = `❌ NPB 爬蟲錯誤：${msg}`;
    npbScraperStatus.isRunning = false;
    console.error('[NPB Scraper] 錯誤:', msg);
    return { updated: 0, message: npbScraperStatus.lastResult, status: npbScraperStatus };
  }
}

// ─── 歷史補抓：一次性補齊 preseason 所有已完賽場次的比分與球員數據 ────────────

export interface BackfillStatus {
  isRunning: boolean;
  total: number;
  done: number;
  updated: number;
  skipped: number;
  lastError: string | null;
  message: string;
}

export const backfillStatus: BackfillStatus = {
  isRunning: false,
  total: 0,
  done: 0,
  updated: 0,
  skipped: 0,
  lastError: null,
  message: '尚未執行',
};

/**
 * 從 preseason 頁取得全部試合連結，
 * 針對「已過去日期」（JST 今日之前）的場次補抓：
 *   - 比分 / 局分 (index.html)
 *   - 打者 / 投手成績 (box.html)
 *
 * 設計為可安全地重複呼叫（所有 DB 操作都是 UPSERT / DELETE+INSERT）
 */
export async function runNpbHistoricalBackfill(): Promise<BackfillStatus> {
  if (backfillStatus.isRunning) return backfillStatus;

  backfillStatus.isRunning = true;
  backfillStatus.done = 0;
  backfillStatus.updated = 0;
  backfillStatus.skipped = 0;
  backfillStatus.lastError = null;
  backfillStatus.message = '補抓進行中…';

  try {
    // JST 今日 00:00
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayMmdd = toMmdd(jstNow);
    const todayYear = jstNow.getFullYear();

    // 取得全部 preseason 連結
    const allLinks = await fetchGameLinksFromUrl(PRESEASON_URL, null);
    backfillStatus.total = allLinks.length;
    console.log(`[Backfill] preseason 共 ${allLinks.length} 場，開始補抓過去場次...`);

    for (const link of allLinks) {
      const m = link.match(/\/scores\/(\d{4})\/(\d{4})\/([\w]+-[\w]+-\d+)\/?/);
      if (!m) { backfillStatus.done++; backfillStatus.skipped++; continue; }

      const [, yr, mmdd] = m;

      // 跳過今日及未來場次（等每日定時任務處理）
      if (parseInt(yr) >= todayYear && mmdd >= todayMmdd) {
        backfillStatus.done++;
        backfillStatus.skipped++;
        continue;
      }

      // 解析詳細頁
      const detail = await fetchGameDetail(link);
      if (!detail) {
        backfillStatus.done++;
        backfillStatus.skipped++;
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // 未開賽的歷史場次（例如中止）→ 仍寫入 DB 但不抓 box score
      const gameId = await upsertGameToDB(detail);
      if (!gameId) {
        backfillStatus.done++;
        backfillStatus.skipped++;
        continue;
      }

      backfillStatus.updated++;

      // 已完賽 → 補抓打者 / 投手成績
      if (detail.status === 'final') {
        await scrapeNpbBoxScore(
          link, detail.homeCode, detail.awayCode, gameId,
          detail.winPitcher, detail.lossPitcher, detail.savePitcher,
        );

        // Yahoo play-by-play（若尚未存）
        const existingYahoo = await pool.query(
          'SELECT yahoo_game_id FROM games WHERE id = $1', [gameId]
        );
        let yahooGameId: string | null = existingYahoo.rows[0]?.yahoo_game_id ?? null;
        if (!yahooGameId) {
          yahooGameId = await fetchYahooGameId(detail.gameDate, detail.homeCode, detail.awayCode);
          if (yahooGameId) {
            await pool.query('UPDATE games SET yahoo_game_id=$1 WHERE id=$2', [yahooGameId, gameId]);
          }
        }
        if (yahooGameId) await scrapeYahooPlayByPlay(yahooGameId, gameId);
      }

      backfillStatus.done++;
      console.log(`[Backfill] ${backfillStatus.done}/${backfillStatus.total} ${link}`);

      // Rate limiting：每場之間等 1.2 秒
      await new Promise(r => setTimeout(r, 1200));
    }

    backfillStatus.message =
      `✅ 補抓完成：共 ${backfillStatus.total} 場，更新 ${backfillStatus.updated} 場，跳過 ${backfillStatus.skipped} 場`;
    backfillStatus.isRunning = false;
    console.log(`[Backfill] ${backfillStatus.message}`);
    return backfillStatus;

  } catch (err) {
    const msg = (err as Error).message;
    backfillStatus.lastError = msg;
    backfillStatus.message = `❌ 補抓錯誤：${msg}`;
    backfillStatus.isRunning = false;
    console.error('[Backfill] 錯誤:', msg);
    return backfillStatus;
  }
}

// ─── NPB.jp 文字速報補抓 ─────────────────────────────────────────────────────

export interface PbpBackfillStatus {
  isRunning: boolean;
  total: number;
  done: number;
  updated: number;
  skipped: number;
  message: string;
  lastError: string;
}

export const pbpBackfillStatus: PbpBackfillStatus = {
  isRunning: false, total: 0, done: 0, updated: 0, skipped: 0,
  message: '', lastError: '',
};

/**
 * 從 npb.jp 補抓所有已完賽 NPB 場次的文字速報
 * 優先使用 games.npb_url，若無則嘗試用球隊代碼+日期推導
 */
export async function runPbpBackfill(): Promise<PbpBackfillStatus> {
  if (pbpBackfillStatus.isRunning) return pbpBackfillStatus;

  Object.assign(pbpBackfillStatus, {
    isRunning: true, total: 0, done: 0, updated: 0, skipped: 0,
    message: '執行中...', lastError: '',
  });

  try {
    // 取得所有已完賽的 NPB 場次（有 npb_url 的優先，無則嘗試推導）
    const { rows } = await pool.query<{
      id: number; npb_url: string | null;
      team_away: string; team_home: string; game_date: string;
    }>(
      `SELECT id, npb_url, team_away, team_home,
              TO_CHAR(game_date AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') AS game_date
       FROM games
       WHERE league = 'NPB' AND status = 'final'
       ORDER BY game_date DESC`,
    );

    pbpBackfillStatus.total = rows.length;
    console.log(`[PBP Backfill] 共 ${rows.length} 場已完賽比賽需補抓`);

    for (const row of rows) {
      pbpBackfillStatus.done++;

      let urlPath = row.npb_url;

      // 若無儲存的 URL，嘗試以球隊代碼+日期推導（試 01, 02）
      if (!urlPath) {
        const [year, mo, da] = row.game_date.split('-');
        const mmdd = `${mo}${da}`;
        // DB 存日文名，需轉換為 npb.jp URL 短代碼
        const away = NAME_TO_CODE[row.team_away] || guessCode(row.team_away);
        const home = NAME_TO_CODE[row.team_home] || guessCode(row.team_home);
        if (!away || !home) {
          console.log(`[PBP Backfill] ⚠️ 無法解析球隊代碼: ${row.team_away}@${row.team_home} game#${row.id}`);
          pbpBackfillStatus.skipped++;
          continue;
        }
        let found = false;
        for (const n of ['01', '02']) {
          const candidate = `/scores/${year}/${mmdd}/${home}-${away}-${n}/`;
          const testUrl = `${NPB_BASE}${candidate}playbyplay.html`;
          try {
            const check = await axios.head(testUrl, { timeout: 8000, headers: HEADERS, validateStatus: s => s < 500 });
            if (check.status === 200) {
              urlPath = candidate;
              await pool.query('UPDATE games SET npb_url = $1 WHERE id = $2', [urlPath, row.id]);
              found = true;
              break;
            }
          } catch { /* 繼續嘗試下一個 */ }
        }
        if (!found) {
          console.log(`[PBP Backfill] ⚠️ 找不到 URL: ${row.team_away}@${row.team_home} ${row.game_date} game#${row.id}`);
          pbpBackfillStatus.skipped++;
          continue;
        }
      }

      await scrapeNpbPlayByPlay(urlPath!, row.id);
      pbpBackfillStatus.updated++;

      console.log(`[PBP Backfill] ${pbpBackfillStatus.done}/${pbpBackfillStatus.total} game#${row.id}`);
      await new Promise(r => setTimeout(r, 1000));
    }

    pbpBackfillStatus.message =
      `✅ PBP 補抓完成：共 ${pbpBackfillStatus.total} 場，更新 ${pbpBackfillStatus.updated} 場，跳過 ${pbpBackfillStatus.skipped} 場`;
    pbpBackfillStatus.isRunning = false;
    return pbpBackfillStatus;

  } catch (err) {
    const msg = (err as Error).message;
    pbpBackfillStatus.lastError = msg;
    pbpBackfillStatus.message = `❌ PBP 補抓錯誤：${msg}`;
    pbpBackfillStatus.isRunning = false;
    return pbpBackfillStatus;
  }
}

// ─── 二軍 Yahoo 文字速報補抓 ──────────────────────────────────────────────────

export interface FarmPbpBackfillStatus {
  isRunning: boolean;
  total: number;
  done: number;
  updated: number;
  skipped: number;
  message: string;
  lastError: string;
}

export const farmPbpBackfillStatus: FarmPbpBackfillStatus = {
  isRunning: false, total: 0, done: 0, updated: 0, skipped: 0,
  message: '', lastError: '',
};

/**
 * 爬取所有已完賽二軍場次（NPB2）的 Yahoo 文字速報
 * 1. 查詢 DB 中有 yahoo_game_id 或可推導 Yahoo ID 的場次
 * 2. 呼叫 scrapeYahooPlayByPlay 寫入 game_play_by_play 表
 * @param forceRefresh 是否強制重抓已有資料的場次（預設 false）
 */
export async function runFarmYahooPbpScraper(forceRefresh = false): Promise<FarmPbpBackfillStatus> {
  if (farmPbpBackfillStatus.isRunning) return farmPbpBackfillStatus;

  Object.assign(farmPbpBackfillStatus, {
    isRunning: true, total: 0, done: 0, updated: 0, skipped: 0,
    message: '執行中...', lastError: '',
  });

  try {
    const { rows } = await pool.query<{
      id: number;
      yahoo_game_id: string | null;
      team_away: string;
      team_home: string;
      game_date: string;
    }>(
      `SELECT id, yahoo_game_id, team_away, team_home,
              TO_CHAR(game_date AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') AS game_date
       FROM games
       WHERE league = 'NPB2' AND status = 'final'
       ORDER BY game_date DESC`,
    );

    farmPbpBackfillStatus.total = rows.length;
    console.log(`[Farm PBP] 共 ${rows.length} 場二軍完賽比賽`);

    for (const row of rows) {
      farmPbpBackfillStatus.done++;

      // 若非強制更新，跳過已有 PBP 的場次
      if (!forceRefresh) {
        const existing = await pool.query(
          'SELECT COUNT(*) AS cnt FROM game_play_by_play WHERE game_id=$1',
          [row.id],
        );
        if (parseInt(existing.rows[0].cnt) > 0) {
          farmPbpBackfillStatus.skipped++;
          continue;
        }
      }

      // 取得 Yahoo game ID
      let yahooId = row.yahoo_game_id;
      if (!yahooId) {
        const awayCode = NAME_TO_CODE[row.team_away] ?? guessCode(row.team_away);
        const homeCode = NAME_TO_CODE[row.team_home] ?? guessCode(row.team_home);
        if (!awayCode || !homeCode) {
          console.log(`[Farm PBP] ⚠️ 無法解析球隊代碼: ${row.team_away}@${row.team_home} game#${row.id}`);
          farmPbpBackfillStatus.skipped++;
          continue;
        }
        yahooId = await fetchYahooGameId(row.game_date, homeCode, awayCode);
        if (yahooId) {
          await pool.query('UPDATE games SET yahoo_game_id=$1 WHERE id=$2', [yahooId, row.id]);
          console.log(`[Farm PBP] game#${row.id} 找到 Yahoo ID: ${yahooId}`);
        }
      }

      if (!yahooId) {
        console.log(`[Farm PBP] game#${row.id} 找不到 Yahoo ID，跳過`);
        farmPbpBackfillStatus.skipped++;
        continue;
      }

      await scrapeYahooPlayByPlay(yahooId, row.id);
      farmPbpBackfillStatus.updated++;

      console.log(`[Farm PBP] ${farmPbpBackfillStatus.done}/${farmPbpBackfillStatus.total} game#${row.id} 完成`);
      await new Promise(r => setTimeout(r, 1500));
    }

    farmPbpBackfillStatus.message =
      `✅ 完成：共 ${farmPbpBackfillStatus.total} 場，更新 ${farmPbpBackfillStatus.updated} 場，跳過 ${farmPbpBackfillStatus.skipped} 場`;
    farmPbpBackfillStatus.isRunning = false;
    return farmPbpBackfillStatus;

  } catch (err) {
    const msg = (err as Error).message;
    farmPbpBackfillStatus.lastError = msg;
    farmPbpBackfillStatus.message = `❌ 二軍 PBP 錯誤：${msg}`;
    farmPbpBackfillStatus.isRunning = false;
    return farmPbpBackfillStatus;
  }
}

/**
 * 爬取單場二軍比賽的 Yahoo 文字速報（即時呼叫，供 live 更新使用）
 */
export async function scrapeFarmGamePbp(gameId: number): Promise<void> {
  const { rows } = await pool.query<{
    yahoo_game_id: string | null;
    team_away: string;
    team_home: string;
    game_date: string;
  }>(
    `SELECT yahoo_game_id, team_away, team_home,
            TO_CHAR(game_date AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') AS game_date
     FROM games WHERE id=$1`,
    [gameId],
  );
  if (!rows.length) return;

  let yahooId = rows[0].yahoo_game_id;
  if (!yahooId) {
    const awayCode = NAME_TO_CODE[rows[0].team_away] ?? guessCode(rows[0].team_away);
    const homeCode = NAME_TO_CODE[rows[0].team_home] ?? guessCode(rows[0].team_home);
    if (awayCode && homeCode) {
      yahooId = await fetchYahooGameId(rows[0].game_date, homeCode, awayCode);
      if (yahooId) {
        await pool.query('UPDATE games SET yahoo_game_id=$1 WHERE id=$2', [yahooId, gameId]);
      }
    }
  }

  if (yahooId) await scrapeYahooPlayByPlay(yahooId, gameId);
}
