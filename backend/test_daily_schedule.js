const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  // Test daily schedule for May 10, 2026
  const url = 'https://baseball.yahoo.co.jp/npb/schedule/farm/20260510';
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' },
    timeout: 15000,
    responseType: 'text'
  });
  const $ = cheerio.load(res.data);

  const ids = new Set();
  $('a').each(function() {
    const href = $(this).attr('href') || '';
    const m = href.match(/\/npb\/game\/(\d+)\//);
    if (m) ids.add(m[1]);
  });

  console.log('Game IDs found:', ids.size, JSON.stringify([...ids]));

  // Check if team names are on this page
  const teamEls = [];
  $('.bb-gameScoreTable__data--team, .bb-gamescoreList__team, .bb-scoreList__team').each(function() {
    teamEls.push($(this).text().trim());
  });
  console.log('Teams:', JSON.stringify(teamEls));

  // Also try to find teams from schedule list
  const allClasses = new Set();
  $('[class]').each(function() {
    const cls = $(this).attr('class') || '';
    cls.split(/\s+/).forEach(function(c) {
      if (c && (c.includes('team') || c.includes('score') || c.includes('game') || c.includes('list') || c.includes('List'))) {
        allClasses.add(c);
      }
    });
  });
  console.log('Relevant classes:', JSON.stringify([...allClasses].slice(0, 30)));

  // Try raw HTML date match
  const dateM = res.data.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  console.log('Year in raw HTML:', dateM ? dateM[0] : 'NOT FOUND');

  // Print body snippet
  const html = $('body').html() || '';
  const schedIdx = html.indexOf('bb-game');
  console.log('\n--- snippet around first bb-game ---');
  console.log(html.substring(Math.max(0, schedIdx-100), schedIdx + 1500));
}

test().catch(function(e) { console.error('Error:', e.message); });
