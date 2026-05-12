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

  console.log('bb-gameRound--matchDate:', $('.bb-gameRound--matchDate').text().trim());
  console.log('bb-gameRound--classification:', $('.bb-gameRound--classification').text().trim());
  console.log('bb-gameRound--time:', $('.bb-gameRound--time').text().trim());
  console.log('bb-gameRound--stadium:', $('.bb-gameRound--stadium').text().trim());

  const teamData = [];
  $('.bb-gameScoreTable__data--team').each(function() { teamData.push($(this).text().trim()); });
  console.log('bb-gameScoreTable__data--team:', JSON.stringify(teamData));

  const teamEl = [];
  $('.bb-gameScoreTable__team').each(function() { teamEl.push($(this).text().trim()); });
  console.log('bb-gameScoreTable__team:', JSON.stringify(teamEl));

  // Also print the surrounding HTML for date
  console.log('--- bb-gameRound html ---');
  console.log($('.bb-gameRound').html());
}

test().catch(function(e) { console.error(e.message); });
