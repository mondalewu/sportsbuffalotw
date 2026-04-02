const axios = require('axios');
const cheerio = require('cheerio');
async function main() {
  // Check npb.jp homepage for schedule links
  const r = await axios.get('https://npb.jp/', {
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
    timeout: 10000
  });
  const $ = cheerio.load(r.data);
  const links = [];
  $('a').each(function() {
    const h = $(this).attr('href');
    if (h && (h.includes('schedule') || h.includes('/scores/'))) links.push(h);
  });
  const unique = [...new Set(links)];
  console.log('Schedule/scores links:', unique.slice(0, 20));

  // Also check Yahoo for today's regular season games
  const y = await axios.get('https://baseball.yahoo.co.jp/npb/schedule/', {
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ja'},
    timeout: 10000, validateStatus: () => true
  });
  console.log('Yahoo schedule status:', y.status);
  if (y.status === 200) {
    const $y = cheerio.load(y.data);
    const gameLinks = [];
    $y('a').each(function() {
      const h = $y(this).attr('href');
      if (h && h.includes('/npb/game/')) gameLinks.push(h);
    });
    console.log('Yahoo game links:', [...new Set(gameLinks)].slice(0, 10));
  }
}
main().catch(console.error);
