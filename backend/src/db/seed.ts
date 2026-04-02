import pool from './pool';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 開始 Seed 資料...');
    await client.query('BEGIN');

    // 建立預設管理員帳號
    const adminHash = await bcrypt.hash('admin1234', 12);
    await client.query(`
      INSERT INTO users (email, password_hash, username, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@sportsbuffalo.com', adminHash, '水牛管理員', 'admin']);

    // 建立預設編輯帳號
    const editorHash = await bcrypt.hash('editor1234', 12);
    await client.query(`
      INSERT INTO users (email, password_hash, username, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['editor@sportsbuffalo.com', editorHash, '體育編輯', 'editor']);

    console.log('✓ 預設帳號建立完成');

    // Seed 新聞文章
    const articles = [
      {
        title: '2026經典賽資格賽 台灣確定主辦',
        slug: '2026-wbc-qualifier-taiwan-host',
        category: 'WBC',
        summary: '世界棒壘球總會(WBSC)正式宣布，2026年世界棒球經典賽(WBC)資格賽將由台灣主辦，預計將在台北大巨蛋舉行。',
        content: '世界棒壘球總會(WBSC)正式宣布，2026年世界棒球經典賽(WBC)資格賽將由台灣主辦，預計將在台北大巨蛋舉行。\n\n## 賽事亮點\n\n本次資格賽將吸引來自亞太地區的多支球隊參與競爭，爭奪 WBC 正賽資格。台灣作為主辦國，將享有直接晉級資格。\n\n中華職棒聯盟表示，此次主辦資格賽將大幅提升台灣棒球的國際能見度，預計吸引大量球迷入場。',
        image_url: 'https://picsum.photos/seed/baseball1/800/400',
        is_hot: true,
      },
      {
        title: '中職37年開幕戰 大巨蛋滿場',
        slug: 'cpbl-37-opening-game-full-house',
        category: 'CPBL',
        summary: '中華職棒37年開幕戰在台北大巨蛋點燃戰火，吸引滿場4萬名球迷進場觀戰，創下中職史上開幕戰最多人數紀錄。',
        content: '中華職棒37年開幕戰在台北大巨蛋點燃戰火，吸引滿場4萬名球迷進場觀戰，創下中職史上開幕戰最多人數紀錄。\n\n## 中信兄弟 vs 味全龍\n\n開幕戰由衛冕冠軍中信兄弟迎戰宿敵味全龍，雙方均全力備戰，讓球迷享受了一場精彩對決。',
        image_url: 'https://picsum.photos/seed/stadium1/800/400',
        is_hot: false,
      },
      {
        title: '大谷翔平再創紀錄 單季50轟50盜',
        slug: 'ohtani-50-50-record',
        category: 'MLB',
        summary: '洛杉磯道奇隊日籍球星大谷翔平今天在比賽中完成單季第50次盜壘成功，成為大聯盟史上第一位達成「50轟50盜」的球員。',
        content: '洛杉磯道奇隊日籍球星大谷翔平今天在比賽中完成單季第50次盜壘成功，成為大聯盟史上第一位達成「50轟50盜」的球員。\n\n這項紀錄的達成引發了全球棒球迷的熱烈討論，許多專家認為大谷翔平是史上最全能的棒球選手之一。',
        image_url: 'https://picsum.photos/seed/player1/800/400',
        is_hot: false,
      },
      {
        title: '詹姆斯大三元 湖人力克勇士',
        slug: 'lebron-triple-double-lakers-warriors',
        category: 'NBA',
        summary: '洛杉磯湖人隊與金州勇士隊上演激烈對決，詹姆斯(LeBron James)繳出大三元成績，帶領湖人以102比98險勝勇士。',
        content: '洛杉磯湖人隊與金州勇士隊上演激烈對決，詹姆斯繳出大三元成績，帶領湖人以102比98險勝勇士。\n\n## 比賽數據\n\n詹姆斯全場攻下28分、11籃板、12助攻，是本賽季第10次大三元表現。',
        image_url: 'https://picsum.photos/seed/basketball1/800/400',
        is_hot: false,
      },
    ];

    for (const article of articles) {
      await client.query(`
        INSERT INTO articles (title, slug, category, summary, content, image_url, is_hot)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (slug) DO NOTHING
      `, [article.title, article.slug, article.category, article.summary, article.content, article.image_url, article.is_hot]);
    }
    console.log('✓ 新聞文章 Seed 完成');

    // Seed WBC 賽程 (Pool C — 東京巨蛋)
    const wbcGames = [
      { home: '中華台北', away: '澳洲', venue: '東京巨蛋', date: '2026-03-05T12:00:00+09:00', league: 'WBC' },
      { home: '日本', away: '捷克', venue: '東京巨蛋', date: '2026-03-05T19:00:00+09:00', league: 'WBC' },
      { home: '日本', away: '中華台北', venue: '東京巨蛋', date: '2026-03-06T19:00:00+09:00', league: 'WBC' },
      { home: '中華台北', away: '捷克', venue: '東京巨蛋', date: '2026-03-07T12:00:00+09:00', league: 'WBC' },
      { home: '南韓', away: '澳洲', venue: '東京巨蛋', date: '2026-03-07T19:00:00+09:00', league: 'WBC' },
      { home: '中華台北', away: '南韓', venue: '東京巨蛋', date: '2026-03-08T12:00:00+09:00', league: 'WBC' },
      { home: '日本', away: '澳洲', venue: '東京巨蛋', date: '2026-03-08T19:00:00+09:00', league: 'WBC' },
      { home: '南韓', away: '捷克', venue: '東京巨蛋', date: '2026-03-09T19:00:00+09:00', league: 'WBC' },
      { home: '澳洲', away: '捷克', venue: '東京巨蛋', date: '2026-03-10T12:00:00+09:00', league: 'WBC' },
      { home: '日本', away: '南韓', venue: '東京巨蛋', date: '2026-03-10T19:00:00+09:00', league: 'WBC' },
      // Pool A — 聖胡安
      { home: '古巴', away: '巴拿馬', venue: '聖胡安', date: '2026-03-05T12:00:00-04:00', league: 'WBC' },
      { home: '波多黎各', away: '加拿大', venue: '聖胡安', date: '2026-03-05T19:00:00-04:00', league: 'WBC' },
      { home: '哥倫比亞', away: '古巴', venue: '聖胡安', date: '2026-03-06T12:00:00-04:00', league: 'WBC' },
      // Pool B — 休士頓
      { home: '墨西哥', away: '義大利', venue: '休士頓', date: '2026-03-06T13:00:00-05:00', league: 'WBC' },
      { home: '美國', away: '英國', venue: '休士頓', date: '2026-03-06T19:00:00-05:00', league: 'WBC' },
      { home: '美國', away: '墨西哥', venue: '休士頓', date: '2026-03-08T19:00:00-05:00', league: 'WBC' },
      // Pool D — 邁阿密
      { home: '多明尼加', away: '荷蘭', venue: '邁阿密', date: '2026-03-06T13:00:00-05:00', league: 'WBC' },
      { home: '委內瑞拉', away: '以色列', venue: '邁阿密', date: '2026-03-06T19:00:00-05:00', league: 'WBC' },
    ];

    for (const game of wbcGames) {
      await client.query(`
        INSERT INTO games (league, team_home, team_away, venue, game_date, status)
        VALUES ($1, $2, $3, $4, $5, 'scheduled')
        ON CONFLICT DO NOTHING
      `, [game.league, game.home, game.away, game.venue, game.date]);
    }
    console.log('✓ WBC 賽程 Seed 完成');

    // Seed 範例即時比賽 (NBA only — CPBL games come from cpbl2026.sql)
    await client.query(`
      INSERT INTO games (league, team_home, team_away, score_home, score_away, game_detail, status, game_date)
      SELECT 'NBA', '湖人', '勇士', 102, 98, 'Q4 2:15', 'final', NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM games WHERE league = 'NBA' AND team_home = '湖人' AND team_away = '勇士'
      )
    `);
    console.log('✓ 範例比賽 Seed 完成');

    // Seed CPBL 積分榜
    const cpblStandings = [
      { team: '中信兄弟', wins: 12, losses: 4, rank: 1 },
      { team: '富邦悍將', wins: 10, losses: 6, rank: 2 },
      { team: '樂天桃猿', wins: 9, losses: 7, rank: 3 },
      { team: '統一獅', wins: 8, losses: 8, rank: 4 },
      { team: '味全龍', wins: 6, losses: 10, rank: 5 },
      { team: '台鋼雄鷹', wins: 3, losses: 13, rank: 6 },
    ];

    for (const s of cpblStandings) {
      const winRate = s.wins / (s.wins + s.losses);
      const gb = (cpblStandings[0].wins - s.wins) / 2 + (s.losses - cpblStandings[0].losses) / 2;
      await client.query(`
        INSERT INTO standings (league, season, team_name, wins, losses, win_rate, games_behind, rank)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (league, season, team_name) DO NOTHING
      `, ['CPBL', '2026', s.team, s.wins, s.losses, winRate, gb, s.rank]);
    }
    console.log('✓ CPBL 積分榜 Seed 完成');

    // Seed 廣告版位
    const ads = [
      {
        name: '首頁側欄 CPM 廣告',
        type: 'CPM',
        position: 'sidebar',
        ad_code: '<!-- Google AdSense Placeholder --><div style="width:300px;height:250px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;border-radius:8px;">廣告版位 300×250</div>',
      },
      {
        name: '首頁頂部橫幅 CPD',
        type: 'CPD',
        position: 'hero',
        image_url: 'https://picsum.photos/seed/adbanner/1200/90',
        link_url: '#',
        client_name: '範例廣告主',
      },
    ];

    for (const ad of ads) {
      await client.query(`
        INSERT INTO ad_placements (name, type, position, ad_code, image_url, link_url, client_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [ad.name, ad.type, ad.position, (ad as { ad_code?: string }).ad_code || null,
         (ad as { image_url?: string }).image_url || null, (ad as { link_url?: string }).link_url || null,
         (ad as { client_name?: string }).client_name || null]);
    }
    console.log('✓ 廣告版位 Seed 完成');

    // CPBL 2026 完整賽程
    const cpblSql = fs.readFileSync(path.join(__dirname, 'cpbl2026.sql'), 'utf8');
    await client.query(cpblSql);
    console.log('✓ CPBL 2026 賽程 Seed 完成');

    await client.query('COMMIT');
    console.log('\n✅ Seed 全部完成！');
    console.log('\n預設帳號：');
    console.log('  管理員: admin@sportsbuffalo.com / admin1234');
    console.log('  編輯:   editor@sportsbuffalo.com / editor1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed 失敗:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
