/**
 * CPBL 二軍賽程匯入腳本（本機 Playwright 瀏覽器執行）
 *
 * 為什麼用 Playwright？
 *   CPBL WAF 使用 TLS 指紋辨識，封鎖所有非真實瀏覽器的請求（包含 axios、curl）。
 *   Playwright 使用真實 Chromium，TLS 指紋完全一致，可正常繞過 WAF。
 *
 * 執行方式：
 *   node scripts/importCpblFarm.js               # 匯入 2026 年全季
 *   node scripts/importCpblFarm.js --year 2026   # 指定年份
 *   node scripts/importCpblFarm.js --dry-run     # 試跑，不寫入 DB
 *   node scripts/importCpblFarm.js --visible     # 顯示瀏覽器視窗（除錯用）
 */

const { chromium } = require('playwright');
const { Pool } = require('pg');

// ─── 參數 ─────────────────────────────────────────────────────────────────────

const _yearIdx = process.argv.indexOf('--year');
const YEAR    = _yearIdx !== -1 ? parseInt(process.argv[_yearIdx + 1], 10) : 2026;
const DRY_RUN = process.argv.includes('--dry-run');
const VISIBLE = process.argv.includes('--visible');

// ─── DB 連線（直接連本機 5432 埠）────────────────────────────────────────────

const DB = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'sports_buffalo',
  user: 'postgres',
  password: 'changeme',
});

const TEAM_MAP = {
  '中信兄弟': '中信兄弟',
  '統一7-ELEVEn獅': '統一獅', '統一獅': '統一獅',
  '統一7-ELEVEN獅': '統一獅', '統一7ELEVEn獅': '統一獅',
  '富邦悍將': '富邦悍將',
  '樂天桃猿': '樂天桃猿',
  '台鋼雄鷹': '台鋼雄鷹',
  '味全龍': '味全龍',
};

function normTeam(name) {
  const t = (name || '').trim();
  return TEAM_MAP[t] || t;
}

// ─── 用 Playwright 抓全年賽程 ─────────────────────────────────────────────────

async function fetchAllGamesWithBrowser() {
  const browser = await chromium.launch({ headless: !VISIBLE });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  });
  const page = await context.newPage();

  try {
    // 使用 on('response') 監聽全部回應（比 route 更可靠）
    let gameDataBody = null;

    page.on('response', async (response) => {
      if (response.url().includes('/schedule/getgamedatas')) {
        try {
          gameDataBody = await response.text();
          console.log(`  ✓ 攔截到 API 回應 (${gameDataBody.length} bytes)`);
        } catch { /* ignore */ }
      }
    });

    // 只載入一次，取得全年資料（API 回傳全年，前端過濾月份）
    console.log('📡 載入 CPBL 二軍賽程頁面...');
    const url = `https://www.cpbl.com.tw/schedule?kindCode=B&year=${YEAR}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // 等待 API 回應（最多 15 秒）
    for (let i = 0; i < 15; i++) {
      if (gameDataBody) break;
      await page.waitForTimeout(1000);
    }

    if (gameDataBody) {
      const result = JSON.parse(gameDataBody);
      if (result.Success && result.GameDatas && result.GameDatas !== '[]') {
        const allGames = JSON.parse(result.GameDatas).filter(g => !g.KindCode || g.KindCode === 'B');
        console.log(`✓ 取得 ${allGames.length} 場二軍比賽`);
        return allGames;
      } else {
        console.log('⚠ API 回傳空資料，改從 DOM 讀取...');
      }
    } else {
      console.log('⚠ 未攔截到 API 回應，改從 DOM 讀取...');
    }

    // Fallback: DOM 讀取（Vue 組件 gameDatas）
    const domGames = await page.evaluate((year) => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        if (el.__vue__ && el.__vue__.$data && Array.isArray(el.__vue__.$data.gameDatas) && el.__vue__.$data.gameDatas.length > 0) {
          return el.__vue__.$data.gameDatas.filter(g => (!g.KindCode || g.KindCode === 'B') && new Date(g.GameDate).getFullYear() === year);
        }
      }
      return [];
    }, YEAR);

    if (domGames.length > 0) {
      console.log(`✓ DOM 讀取：${domGames.length} 場`);
    }
    return domGames;

  } finally {
    await browser.close();
  }
}

// ─── 從 DOM 讀取已渲染的賽程資料 ──────────────────────────────────────────────

async function extractFromDom(page, year, month) {
  return page.evaluate(({ year, month }) => {
    // 嘗試從 Vue 2 根組件取資料
    const findVue = (el) => {
      if (!el) return null;
      if (el.__vue__) return el.__vue__;
      for (const child of el.children || []) {
        const found = findVue(child);
        if (found) return found;
      }
      return null;
    };

    // 掃描所有 DOM 元素找 Vue instance
    const allEls = document.querySelectorAll('*');
    let vueData = null;
    for (const el of allEls) {
      if (el.__vue__ && el.__vue__.$data && el.__vue__.$data.gameDatas) {
        vueData = el.__vue__.$data.gameDatas;
        break;
      }
    }

    if (!vueData) return [];

    return vueData.filter(g => {
      if (g.KindCode && g.KindCode !== 'B') return false;
      const d = new Date(g.GameDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, { year, month });
}

// ─── 寫入 DB ──────────────────────────────────────────────────────────────────

async function importGames(games) {
  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;

  for (const g of games) {
    const home = normTeam(g.HomeTeamName);
    const away = normTeam(g.VisitingTeamName);
    if (!home || !away) { skipped++; continue; }

    const gameDateTW = (g.GameDate || '').slice(0, 10);
    if (!gameDateTW) { skipped++; continue; }

    let timeStr = '14:05:00';
    if (g.PreExeDate) {
      const tm = g.PreExeDate.match(/T(\d{2}:\d{2})/);
      if (tm) timeStr = `${tm[1]}:00`;
    }
    const gameTs = `${gameDateTW}T${timeStr}+08:00`;

    const status = g.GameResult === '0' ? 'final' : 'scheduled';

    if (DRY_RUN) {
      console.log(`  [DRY] ${gameDateTW} ${away}@${home} @ ${g.FieldAbbe || '??'} ${timeStr} [${status}]`);
      inserted++;
      continue;
    }

    const existing = await DB.query(
      `SELECT id, status FROM games
       WHERE league = 'CPBL-B'
         AND DATE(game_date AT TIME ZONE 'Asia/Taipei') = $1::date
         AND team_home ILIKE $2 AND team_away ILIKE $3
       LIMIT 1`,
      [gameDateTW, `%${home}%`, `%${away}%`]
    );

    if (existing.rows.length > 0) {
      if (status === 'final' && existing.rows[0].status !== 'final') {
        await DB.query(`UPDATE games SET status = 'final' WHERE id = $1`, [existing.rows[0].id]);
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    await DB.query(
      `INSERT INTO games (league, team_home, team_away, venue, game_date, status, game_detail)
       VALUES ('CPBL-B', $1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [home, away, g.FieldAbbe || null, gameTs, status, String(g.GameSno)]
    );
    inserted++;
  }

  if (!DRY_RUN) {
    console.log(`\n✅ 完成！新增 ${inserted} 場 | 更新 ${updated} 場 | 跳過 ${skipped} 場`);
  } else {
    console.log(`\n✅ 試跑完成！共 ${inserted} 場（未寫入 DB）`);
  }
}

// ─── 主程式 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 CPBL 二軍賽程匯入工具 [Playwright 版]`);
  console.log(`   年份: ${YEAR}  模式: ${DRY_RUN ? '試跑' : '寫入DB'}  瀏覽器: ${VISIBLE ? '顯示' : '背景'}`);
  console.log('─'.repeat(50));

  try {
    const games = await fetchAllGamesWithBrowser();
    console.log(`\n📊 共取得 ${games.length} 場二軍賽程\n`);

    if (games.length === 0) {
      console.warn('⚠ 未取得任何資料，請確認：');
      console.warn('  1. 網路可以連到 cpbl.com.tw');
      console.warn('  2. CPBL 官網 二軍賽程是否已公布');
      console.warn('  3. 加 --visible 重跑以觀察瀏覽器行為');
      process.exit(1);
    }

    await importGames(games);
  } catch (err) {
    console.error('\n❌ 錯誤:', err.message);
    process.exit(1);
  } finally {
    await DB.end();
  }
}

main();
