const axios = require('axios');
const cheerio = require('cheerio');

const TEAM_MAP = {
  'ロッテ': 'ロッテ', '日本ハム': '日本ハム',
  '楽天': '楽天', '西武': '西武',
  'オリックス': 'オリックス', 'ソフトバンク': 'ソフトバンク',
  '巨人': '巨人', 'DeNA': 'DeNA', 'ＤｅＮＡ': 'DeNA',
  '阪神': '阪神', '広島': '広島',
  '中日': '中日', 'ヤクルト': 'ヤクルト',
  'ハヤテ': 'くふうハヤテ', 'くふうハヤテ': 'くふうハヤテ',
  'オイシックス': 'オイシックス',
};

async function fetchMeta(gid, year) {
  const res = await axios.get('https://baseball.yahoo.co.jp/npb/game/' + gid + '/score', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' },
    timeout: 10000, responseType: 'text'
  });
  const $ = cheerio.load(res.data);

  const dateText = $('.bb-gameRound--matchDate').first().text().trim();
  const dateM = dateText.match(/(\d{1,2})月(\d{1,2})日/);
  let gameDate = '';
  if (dateM) {
    gameDate = year + '-' + dateM[1].padStart(2, '0') + '-' + dateM[2].padStart(2, '0');
  }

  const teams = [];
  $('.bb-gameScoreTable__data--team').each(function() {
    const t = $(this).text().trim().replace(/\s+/g, '');
    if (t) teams.push(TEAM_MAP[t] || t);
  });

  return { gameDate, teams };
}

// Test with known game 2021040475 (2026-05-10, 日本ハム vs オイシックス)
fetchMeta('2021040475', 2026).then(function(r) {
  console.log('Result:', JSON.stringify(r));
  console.log('Expected: 2026-05-10, away=日本ハム, home=オイシックス');
}).catch(function(e) { console.error(e.message); });
