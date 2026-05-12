const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const gid = '2021040475';
  const url = 'https://baseball.yahoo.co.jp/npb/game/' + gid + '/score';
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' },
    timeout: 10000,
    responseType: 'text'
  });
  const $ = cheerio.load(res.data);

  console.log('--- date selectors ---');
  console.log('bb-gameRound__date:', $('.bb-gameRound__date').first().text().trim());
  console.log('bb-gameHeader__date:', $('.bb-gameHeader__date').first().text().trim());
  console.log('bb-main__date:', $('.bb-main__date').first().text().trim());

  console.log('--- team selectors ---');
  const teamRound = [];
  $('.bb-gameRound__team').each(function() { teamRound.push($(this).text().trim()); });
  console.log('bb-gameRound__team:', JSON.stringify(teamRound));

  const teamMatch = [];
  $('.bb-matchTeamName').each(function() { teamMatch.push($(this).text().trim()); });
  console.log('bb-matchTeamName:', JSON.stringify(teamMatch));

  const teamGame = [];
  $('.bb-gameTeam__name').each(function() { teamGame.push($(this).text().trim()); });
  console.log('bb-gameTeam__name:', JSON.stringify(teamGame));

  console.log('--- body snippet ---');
  const html = $('body').html() || '';
  console.log(html.substring(0, 3000));
}

test().catch(function(e) { console.error(e.message); });
