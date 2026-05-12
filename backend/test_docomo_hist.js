const axios = require('axios');

const DOCOMO_API = 'https://sports-api.smt.docomo.ne.jp/data/baseball/farm';

async function test() {
  // Try various historical schedule URL formats
  const urls = [
    `${DOCOMO_API}/top_20260510_schedule.json`,
    `${DOCOMO_API}/schedule/20260510.json`,
    `${DOCOMO_API}/result/20260510/schedule.json`,
    `${DOCOMO_API}/top_today_schedule.json`,
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      console.log('✓ SUCCESS:', url);
      const data = res.data;
      const games = data.today || data.games || data.schedule || [];
      console.log('  games count:', Array.isArray(games) ? games.length : 'not array');
      if (Array.isArray(games) && games.length > 0) {
        console.log('  sample game_id:', games[0].game_id, 'home:', games[0].home_team_name_s, 'away:', games[0].visit_team_name_s);
      }
    } catch (e) {
      console.log('✗ FAIL:', url, '->', e.message);
    }
  }
}

test().catch(console.error);
