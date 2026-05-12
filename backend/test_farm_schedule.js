const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  // Test May 2026 farm schedule
  const url = 'https://baseball.yahoo.co.jp/npb/schedule/?type=farm&ym=202605';
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' },
    timeout: 15000,
    responseType: 'text'
  });
  const $ = cheerio.load(res.data);

  // Collect all hrefs
  const ids = new Set();
  const allLinks = [];
  $('a').each(function() {
    const href = $(this).attr('href') || '';
    allLinks.push(href);
    const m = href.match(/\/npb\/game\/(\d{8,})\//);
    if (m) ids.add(m[1]);
  });

  console.log('Total unique game IDs found:', ids.size);
  console.log('Game IDs:', JSON.stringify([...ids].slice(0, 20)));

  // Check if there are any game-related links we're missing
  const gameLinks = allLinks.filter(h => h.includes('/npb/game/') || h.includes('/game/'));
  console.log('\nAll game links (first 20):', JSON.stringify(gameLinks.slice(0, 20)));

  // Check all hrefs matching game pattern with different digit counts
  const anyGameMatch = allLinks.filter(h => /\/game\/\d+/.test(h));
  console.log('\nAny /game/digits links:', JSON.stringify(anyGameMatch.slice(0, 20)));

  // Print snippet of page where schedule should be
  const bodyHtml = $('body').html() || '';
  const gameIdx = bodyHtml.indexOf('game');
  if (gameIdx > 0) {
    console.log('\n--- snippet around first "game" mention ---');
    console.log(bodyHtml.substring(Math.max(0, gameIdx - 100), gameIdx + 500));
  }
}

test().catch(function(e) { console.error('Error:', e.message); });
