const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const gid = '2021040475';
  const url = 'https://baseball.yahoo.co.jp/npb/game/' + gid + '/score';
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' },
    timeout: 15000,
    responseType: 'text'
  });
  const $ = cheerio.load(res.data);
  const html = $('body').html() || '';

  // Find anything with team name keywords
  console.log('--- searching for team-related classes ---');
  const allClasses = new Set();
  $('[class]').each(function() {
    const cls = $(this).attr('class') || '';
    cls.split(/\s+/).forEach(function(c) {
      if (c && (c.includes('team') || c.includes('Team') || c.includes('score') || c.includes('game') || c.includes('Game'))) {
        allClasses.add(c);
      }
    });
  });
  console.log('Matching classes:', JSON.stringify([...allClasses].slice(0, 50)));

  // Print middle section of HTML (where game content usually is)
  console.log('--- html 3000-6000 ---');
  console.log(html.substring(3000, 6000));
}

test().catch(function(e) { console.error(e.message); });
