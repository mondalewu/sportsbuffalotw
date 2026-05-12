const axios = require('axios');

const DOCOMO_API = 'https://sports-api.smt.docomo.ne.jp/data/baseball/farm';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
  'Referer': 'https://service.smt.docomo.ne.jp/',
};

async function test() {
  // Test today's schedule with correct headers
  const urls = [
    `${DOCOMO_API}/top_today_schedule.json`,
    `${DOCOMO_API}/top_20260510_schedule.json`,
    `${DOCOMO_API}/top_20260509_schedule.json`,
    `${DOCOMO_API}/result/2021040475/index.json`,
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      console.log('✓ SUCCESS:', url.split('/').pop());
      const data = res.data;
      const games = data.today || data.games || [];
      if (Array.isArray(games) && games.length > 0) {
        console.log('  game_ids:', games.slice(0,3).map(function(g) { return g.game_id + ' ' + g.home_team_name_s; }));
      } else {
        console.log('  data keys:', Object.keys(data).slice(0, 5));
      }
    } catch (e) {
      console.log('✗ FAIL:', url.split('/').pop(), '->', e.response ? e.response.status : e.message);
    }
  }
}

test().catch(console.error);
