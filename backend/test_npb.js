const axios = require('axios');
const cheerio = require('cheerio');
const H = {'User-Agent':'Mozilla/5.0','Accept-Language':'ja-JP,ja;q=0.9'};
axios.get('https://baseball.yahoo.co.jp/npb/schedule/first/all?date=2026-03-27',{headers:H,timeout:15000}).then(res=>{
  const $=cheerio.load(res.data);
  const games=[];
  $('.bb-scheduleTable tbody').each((_,tbody)=>{
    const head=$(tbody).find('.bb-scheduleTable__head').first().text().trim();
    $(tbody).find('.bb-scheduleTable__row').each((_,tr)=>{
      if($(tr).find('.bb-scheduleTable__data--nogame').length)return;
      const home=$(tr).find('[class*="scheduleTable__homeName"] a').first().text().trim();
      const away=$(tr).find('[class*="scheduleTable__awayName"] a').first().text().trim();
      if(home&&away)games.push(head+': '+home+' vs '+away);
    });
  });
  console.log('Games:',games.length);
  games.forEach(g=>console.log(g));
}).catch(e=>console.error('ERR:',e.message));
