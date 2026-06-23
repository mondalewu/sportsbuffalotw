import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TW_PLAYERS = [
  {
    name: '林昀儒', nameJp: 'Lin Yun-Ju', rank: 4, age: 24,
    club: 'TT Fulda-Maberzell（德甲）', hand: '左手', style: '直板兩面攻',
    achievement: '2020東奧男雙銅牌、2024巴黎奧運男單銀牌',
    flag: '🏓',
  },
  {
    name: '鄭怡靜', nameJp: 'Cheng I-Ching', rank: 8, age: 29,
    club: 'Ekstraklasa（波蘭）', hand: '右手', style: '橫板弧圈',
    achievement: '2020東奧女雙銅牌、世界盃女單亞軍',
    flag: '🏓',
  },
  {
    name: '陳思羽', nameJp: 'Chen Szu-Yu', rank: 38, age: 28,
    club: '台灣國家隊', hand: '右手', style: '橫板弧圈',
    achievement: '亞運女雙銀牌',
    flag: '🏓',
  },
  {
    name: '莊智淵', nameJp: 'Chuang Chih-Yuan', rank: 85, age: 43,
    club: '台灣國家隊（資深國手）', hand: '右手', style: '橫板攻守兼備',
    achievement: '世界排名最高14位、六屆奧運參賽',
    flag: '🏓',
  },
];

const WORLD_RANKING_TOP = [
  { rank: 1, name: '樊振東', country: '🇨🇳', points: 13580 },
  { rank: 2, name: '王楚欽', country: '🇨🇳', points: 12960 },
  { rank: 3, name: '張本智和', country: '🇯🇵', points: 10240 },
  { rank: 4, name: '林昀儒', country: '🇹🇼', points: 9860 },
  { rank: 5, name: 'Felix Lebrun', country: '🇫🇷', points: 9440 },
  { rank: 6, name: 'Truls Moregard', country: '🇸🇪', points: 8980 },
  { rank: 7, name: '戶上隼輔', country: '🇯🇵', points: 8760 },
  { rank: 8, name: 'Darko Jorgic', country: '🇸🇮', points: 8320 },
];

const WORLD_RANKING_WOMEN = [
  { rank: 1, name: '孫穎莎', country: '🇨🇳', points: 13200 },
  { rank: 2, name: '陳夢', country: '🇨🇳', points: 12480 },
  { rank: 3, name: '王曼昱', country: '🇨🇳', points: 11960 },
  { rank: 4, name: '早田希娜', country: '🇯🇵', points: 10640 },
  { rank: 5, name: '平野美宇', country: '🇯🇵', points: 9280 },
  { rank: 6, name: '伊藤美誠', country: '🇯🇵', points: 8840 },
  { rank: 7, name: 'Bernadette Szocs', country: '🇷🇴', points: 8560 },
  { rank: 8, name: '鄭怡靜', country: '🇹🇼', points: 8120 },
];

const TOURNAMENTS_2026 = [
  { name: 'WTT 大滿貫 新加坡', date: '2026-07-14', location: '新加坡', status: '即將開始', level: 'Grand Smash' },
  { name: 'WTT 冠軍賽 重慶', date: '2026-06-10', location: '中國重慶', status: '已結束', level: 'Champions' },
  { name: 'WTT 球星挑戰賽 突尼西亞', date: '2026-05-20', location: '突尼西亞', status: '已結束', level: 'Star Contender' },
  { name: '世界乒乓球團體錦標賽', date: '2026-09-01', location: '卡達多哈', status: '即將開始', level: 'World Championships' },
  { name: 'WTT 大滿貫 薩爾斯堡', date: '2026-10-20', location: '奧地利', status: '即將開始', level: 'Grand Smash' },
];

const LEVEL_COLOR: Record<string, string> = {
  'Grand Smash': 'bg-yellow-100 text-yellow-700',
  'Champions': 'bg-purple-100 text-purple-700',
  'Star Contender': 'bg-blue-100 text-blue-700',
  'World Championships': 'bg-red-100 text-red-700',
};

type Tab = 'players' | 'ranking' | 'tournaments';

export default function TableTennisPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('players');
  const [rankingGender, setRankingGender] = useState<'men' | 'women'>('men');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-6 text-white" style={{ minHeight: 200 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-700" />
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-6 right-8 w-48 h-48 rounded-full border-4 border-white" />
          <div className="absolute bottom-4 left-12 w-28 h-28 rounded-full border-2 border-white" />
        </div>
        <div className="relative z-10 p-7 flex flex-col justify-between" style={{ minHeight: 200 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full">🏓 TABLE TENNIS</span>
            <span className="bg-cyan-400/80 text-black text-xs font-black px-3 py-1 rounded-full">WTT · ITTF</span>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2">桌球</h1>
            <p className="text-blue-200 text-sm font-bold">台灣旅外好手 · 世界排名 · 國際賽程</p>
          </div>
          <div className="flex gap-6 mt-4 flex-wrap">
            {([['4', '林昀儒世界排名'], ['8', '鄭怡靜世界排名'], ['2', '奧運獎牌（東奧+巴黎）'], ['6', '莊智淵奧運次數']] as [string, string][]).map(([v, l]) => (
              <div key={l} className="text-center">
                <div className="text-2xl font-black">{v}</div>
                <div className="text-[10px] text-blue-300 font-bold leading-tight">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ['players', '🇹🇼 台灣好手'],
          ['ranking', '🏆 世界排名'],
          ['tournaments', '📅 國際賽程'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl font-black text-sm border transition-all ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 台灣好手 */}
      {tab === 'players' && (
        <div className="space-y-4">
          {TW_PLAYERS.map(p => (
            <div key={p.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl flex-shrink-0">
                  {p.flag}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="text-lg font-black text-gray-900">{p.name}</h3>
                    <span className="text-xs text-gray-400 font-bold">{p.nameJp}</span>
                    <span className="text-xs font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      世界第 {p.rank} 名
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-bold mb-1">🏟 {p.club}</p>
                  <p className="text-xs text-gray-500 mb-2">{p.hand} · {p.style} · {p.age} 歲</p>
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2">
                    <p className="text-xs font-black text-yellow-700">🏅 {p.achievement}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 世界排名 */}
      {tab === 'ranking' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setRankingGender('men')}
              className={`px-4 py-2 rounded-xl font-black text-sm border transition-all ${rankingGender === 'men' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-500 border-gray-200'}`}>
              男子 Top 8
            </button>
            <button onClick={() => setRankingGender('women')}
              className={`px-4 py-2 rounded-xl font-black text-sm border transition-all ${rankingGender === 'women' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-500 border-gray-200'}`}>
              女子 Top 8
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className={`px-4 py-3 ${rankingGender === 'men' ? 'bg-blue-700' : 'bg-pink-600'}`}>
              <span className="text-white font-black text-sm">
                ITTF 世界排名 — {rankingGender === 'men' ? '男子' : '女子'} Top 8
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {(rankingGender === 'men' ? WORLD_RANKING_TOP : WORLD_RANKING_WOMEN).map(p => (
                <div key={p.name} className={`flex items-center gap-3 px-4 py-3 ${p.country === '🇹🇼' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <span className={`text-sm font-black w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    p.rank === 1 ? 'bg-yellow-400 text-white' :
                    p.rank === 2 ? 'bg-gray-300 text-white' :
                    p.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-gray-100 text-gray-500'}`}>
                    {p.rank}
                  </span>
                  <span className="text-xl flex-shrink-0">{p.country}</span>
                  <span className={`flex-1 font-bold text-sm ${p.country === '🇹🇼' ? 'text-blue-700 font-black' : 'text-gray-800'}`}>
                    {p.name}
                    {p.country === '🇹🇼' && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-black">台灣</span>}
                  </span>
                  <span className="text-sm font-black text-gray-600 tabular-nums">{p.points.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">* 排名積分僅供參考，以 ITTF 官方公告為準</p>
            </div>
          </div>
        </div>
      )}

      {/* 國際賽程 */}
      {tab === 'tournaments' && (
        <div className="space-y-3">
          {TOURNAMENTS_2026.map(t => (
            <div key={t.name} className={`bg-white rounded-2xl border shadow-sm p-4 ${t.status === '已結束' ? 'border-gray-100 opacity-70' : 'border-blue-100'}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${LEVEL_COLOR[t.level] ?? 'bg-gray-100 text-gray-500'}`}>
                  {t.level}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${t.status === '即將開始' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {t.status}
                </span>
              </div>
              <h3 className="font-black text-gray-900 text-sm mb-1">{t.name}</h3>
              <p className="text-xs text-gray-500">📅 {t.date} &nbsp;·&nbsp; 📍 {t.location}</p>
            </div>
          ))}
          <p className="text-xs text-gray-400 text-center pt-2">* 賽程資料僅供參考，以 WTT / ITTF 官方公告為準</p>
        </div>
      )}

      <div className="mt-10 text-center">
        <button onClick={() => navigate('/')} className="text-sm font-bold text-gray-400 hover:text-blue-700 transition">← 返回首頁</button>
      </div>
    </div>
  );
}
