import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── 基本資訊 ──────────────────────────────────────────────
const EVENT_NAME = '2026 FIFA 世界盃';
const EVENT_SUBTITLE = '2026 FIFA WORLD CUP';
const EVENT_DATE = '2026年6月11日 — 7月19日';
const EVENT_HOST = '美國 · 加拿大 · 墨西哥';
const EVENT_TEAMS = 48;
const EVENT_GAMES = 104;

// ── 分組資料 ──────────────────────────────────────────────
const GROUPS = [
  { name: 'A', teams: [
    { name: '美國', flag: '🇺🇸', confederation: 'CONCACAF' },
    { name: '巴拿馬', flag: '🇵🇦', confederation: 'CONCACAF' },
    { name: '玻利維亞', flag: '🇧🇴', confederation: 'CONMEBOL' },
    { name: '摩洛哥', flag: '🇲🇦', confederation: 'CAF' },
  ]},
  { name: 'B', teams: [
    { name: '阿根廷', flag: '🇦🇷', confederation: 'CONMEBOL' },
    { name: '秘魯', flag: '🇵🇪', confederation: 'CONMEBOL' },
    { name: '智利', flag: '🇨🇱', confederation: 'CONMEBOL' },
    { name: '澳洲', flag: '🇦🇺', confederation: 'AFC' },
  ]},
  { name: 'C', teams: [
    { name: '墨西哥', flag: '🇲🇽', confederation: 'CONCACAF' },
    { name: '烏拉圭', flag: '🇺🇾', confederation: 'CONMEBOL' },
    { name: '加拿大', flag: '🇨🇦', confederation: 'CONCACAF' },
    { name: '葡萄牙', flag: '🇵🇹', confederation: 'UEFA' },
  ]},
  { name: 'D', teams: [
    { name: '巴西', flag: '🇧🇷', confederation: 'CONMEBOL' },
    { name: '墨西哥', flag: '🇲🇽', confederation: 'CONCACAF' },
    { name: '伊拉克', flag: '🇮🇶', confederation: 'AFC' },
    { name: '厄瓜多', flag: '🇪🇨', confederation: 'CONMEBOL' },
  ]},
  { name: 'E', teams: [
    { name: '法國', flag: '🇫🇷', confederation: 'UEFA' },
    { name: '沙烏地阿拉伯', flag: '🇸🇦', confederation: 'AFC' },
    { name: '丹麥', flag: '🇩🇰', confederation: 'UEFA' },
    { name: '突尼西亞', flag: '🇹🇳', confederation: 'CAF' },
  ]},
  { name: 'F', teams: [
    { name: '英格蘭', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA' },
    { name: '伊朗', flag: '🇮🇷', confederation: 'AFC' },
    { name: '賽內加爾', flag: '🇸🇳', confederation: 'CAF' },
    { name: '塞爾維亞', flag: '🇷🇸', confederation: 'UEFA' },
  ]},
  { name: 'G', teams: [
    { name: '西班牙', flag: '🇪🇸', confederation: 'UEFA' },
    { name: '日本', flag: '🇯🇵', confederation: 'AFC' },
    { name: '喀麥隆', flag: '🇨🇲', confederation: 'CAF' },
    { name: '比利時', flag: '🇧🇪', confederation: 'UEFA' },
  ]},
  { name: 'H', teams: [
    { name: '葡萄牙', flag: '🇵🇹', confederation: 'UEFA' },
    { name: '南韓', flag: '🇰🇷', confederation: 'AFC' },
    { name: '多哥', flag: '🇹🇬', confederation: 'CAF' },
    { name: '哥斯大黎加', flag: '🇨🇷', confederation: 'CONCACAF' },
  ]},
  { name: 'I', teams: [
    { name: '德國', flag: '🇩🇪', confederation: 'UEFA' },
    { name: '烏茲別克', flag: '🇺🇿', confederation: 'AFC' },
    { name: '墨西哥', flag: '🇲🇽', confederation: 'CONCACAF' },
    { name: '科特迪瓦', flag: '🇨🇮', confederation: 'CAF' },
  ]},
  { name: 'J', teams: [
    { name: '義大利', flag: '🇮🇹', confederation: 'UEFA' },
    { name: '卡達', flag: '🇶🇦', confederation: 'AFC' },
    { name: '厄瓜多', flag: '🇪🇨', confederation: 'CONMEBOL' },
    { name: '奈及利亞', flag: '🇳🇬', confederation: 'CAF' },
  ]},
  { name: 'K', teams: [
    { name: '荷蘭', flag: '🇳🇱', confederation: 'UEFA' },
    { name: '委內瑞拉', flag: '🇻🇪', confederation: 'CONMEBOL' },
    { name: '象牙海岸', flag: '🇨🇮', confederation: 'CAF' },
    { name: '波士尼亞', flag: '🇧🇦', confederation: 'UEFA' },
  ]},
  { name: 'L', teams: [
    { name: '克羅埃西亞', flag: '🇭🇷', confederation: 'UEFA' },
    { name: '奧地利', flag: '🇦🇹', confederation: 'UEFA' },
    { name: '埃及', flag: '🇪🇬', confederation: 'CAF' },
    { name: '巴拉圭', flag: '🇵🇾', confederation: 'CONMEBOL' },
  ]},
];

// ── 重要賽事時程 ──────────────────────────────────────────
const KEY_DATES = [
  { date: '6月11日', event: '揭幕戰', note: '墨西哥市 Estadio Azteca' },
  { date: '6月11日－7月2日', event: '小組賽', note: '12組 × 3場 共 72場' },
  { date: '7月4日－7日', event: '32強淘汰賽', note: '16場' },
  { date: '7月10日－13日', event: '16強淘汰賽', note: '8場' },
  { date: '7月17日－20日', event: '八強賽', note: '4場' },
  { date: '7月23日－26日', event: '四強賽', note: '2場' },
  { date: '7月29日', event: '季軍賽', note: 'MetLife Stadium, 紐澤西' },
  { date: '7月19日', event: '決賽', note: 'MetLife Stadium, 紐澤西' },
];

// ── 主辦城市 ──────────────────────────────────────────────
const HOST_CITIES = [
  { city: '紐約/紐澤西', country: '🇺🇸 美國', stadium: 'MetLife Stadium', capacity: '82,500', note: '決賽場地' },
  { city: '洛杉磯', country: '🇺🇸 美國', stadium: 'SoFi Stadium', capacity: '70,240', note: '' },
  { city: '達拉斯', country: '🇺🇸 美國', stadium: 'AT&T Stadium', capacity: '80,000', note: '' },
  { city: '舊金山', country: '🇺🇸 美國', stadium: "Levi's Stadium", capacity: '68,500', note: '' },
  { city: '亞特蘭大', country: '🇺🇸 美國', stadium: 'Mercedes-Benz Stadium', capacity: '71,000', note: '' },
  { city: '邁阿密', country: '🇺🇸 美國', stadium: 'Hard Rock Stadium', capacity: '65,326', note: '' },
  { city: '波士頓', country: '🇺🇸 美國', stadium: 'Gillette Stadium', capacity: '65,878', note: '' },
  { city: '費城', country: '🇺🇸 美國', stadium: 'Lincoln Financial Field', capacity: '69,328', note: '' },
  { city: '西雅圖', country: '🇺🇸 美國', stadium: 'Lumen Field', capacity: '68,740', note: '' },
  { city: '堪薩斯城', country: '🇺🇸 美國', stadium: 'Arrowhead Stadium', capacity: '76,416', note: '' },
  { city: '溫哥華', country: '🇨🇦 加拿大', stadium: 'BC Place', capacity: '54,500', note: '' },
  { city: '多倫多', country: '🇨🇦 加拿大', stadium: 'BMO Field', capacity: '45,000', note: '' },
  { city: '墨西哥市', country: '🇲🇽 墨西哥', stadium: 'Estadio Azteca', capacity: '87,523', note: '揭幕戰場地' },
  { city: '蒙特雷', country: '🇲🇽 墨西哥', stadium: 'Estadio BBVA', capacity: '51,348', note: '' },
  { city: '瓜達拉哈拉', country: '🇲🇽 墨西哥', stadium: 'Estadio Akron', capacity: '49,850', note: '' },
];

// ── 亞洲出線隊伍 ──────────────────────────────────────────
const AFC_TEAMS = [
  { name: '日本', flag: '🇯🇵', rank: 15, note: '連續8屆出賽，強隊' },
  { name: '南韓', flag: '🇰🇷', rank: 23, note: '連續10屆出賽' },
  { name: '伊朗', flag: '🇮🇷', rank: 22, note: '亞洲第一強隊' },
  { name: '沙烏地阿拉伯', flag: '🇸🇦', rank: 57, note: '2022年擊敗阿根廷' },
  { name: '澳洲', flag: '🇦🇺', rank: 24, note: '2022年八強' },
  { name: '伊拉克', flag: '🇮🇶', rank: 63, note: '久違重返世界盃' },
  { name: '卡達', flag: '🇶🇦', rank: 38, note: '2022地主國' },
  { name: '烏茲別克', flag: '🇺🇿', rank: 74, note: '首次晉級世界盃' },
];

const CONF_COLORS: Record<string, string> = {
  UEFA:     'bg-blue-100 text-blue-700',
  CONMEBOL: 'bg-yellow-100 text-yellow-700',
  AFC:      'bg-red-100 text-red-700',
  CAF:      'bg-green-100 text-green-700',
  CONCACAF: 'bg-purple-100 text-purple-700',
  OFC:      'bg-gray-100 text-gray-600',
};

export default function SoccerPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'groups' | 'schedule' | 'venues' | 'afc'>('groups');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden mb-8 text-white" style={{ minHeight: 280 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-black" />
        {/* 足球紋路裝飾 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-64 h-64 rounded-full border-4 border-white" />
          <div className="absolute top-16 right-16 w-40 h-40 rounded-full border-4 border-white" />
          <div className="absolute bottom-4 left-20 w-48 h-48 rounded-full border-2 border-white" />
        </div>

        <div className="relative z-10 p-8 flex flex-col justify-between" style={{ minHeight: 280 }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full backdrop-blur-sm">⚽ FIFA WORLD CUP 2026</span>
            <span className="bg-yellow-400/90 text-black text-xs font-black px-3 py-1 rounded-full">48支球隊 · 104場比賽</span>
          </div>

          <div>
            <p className="text-green-300 text-sm font-bold mb-1 tracking-widest uppercase">{EVENT_SUBTITLE}</p>
            <h1 className="text-4xl md:text-5xl font-black mb-3 leading-tight">{EVENT_NAME}</h1>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-300">📅</span>
                <span className="font-bold">{EVENT_DATE}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-300">🌎</span>
                <span className="font-bold">{EVENT_HOST}</span>
              </div>
            </div>
          </div>

          {/* 統計數字 */}
          <div className="flex gap-6 mt-6">
            {[
              { label: '參賽隊伍', value: EVENT_TEAMS },
              { label: '總場次', value: EVENT_GAMES },
              { label: '主辦城市', value: 16 },
              { label: '主辦國家', value: 3 },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-black text-white">{s.value}</div>
                <div className="text-xs text-green-300 font-bold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ['groups',   '🏆 分組資料'],
          ['schedule', '📅 重要時程'],
          ['venues',   '🏟️ 主辦城市'],
          ['afc',      '🌏 亞洲球隊'],
        ] as [typeof activeTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 rounded-xl font-black text-sm border transition-all ${activeTab === key ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 分組資料 ── */}
      {activeTab === 'groups' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black">12組 × 4隊 分組表</h2>
            <span className="text-xs text-gray-400 font-bold">每組前2名 + 8支第3名晉級32強</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GROUPS.map(g => (
              <div key={g.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-green-700 px-4 py-2.5">
                  <span className="text-white font-black text-lg">Group {g.name}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {g.teams.map(t => (
                    <div key={t.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{t.flag}</span>
                        <span className="font-bold text-sm text-gray-800">{t.name}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CONF_COLORS[t.confederation] ?? 'bg-gray-100 text-gray-500'}`}>
                        {t.confederation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">* 分組資料以官方抽籤結果為準，部分隊伍名稱依最終晉級結果確認</p>
        </div>
      )}

      {/* ── 重要時程 ── */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <h2 className="text-xl font-black mb-4">賽事時程總覽</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {KEY_DATES.map((d, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition">
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-black text-green-700">{d.date}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-gray-900">{d.event}</p>
                    {d.note && <p className="text-xs text-gray-400 mt-0.5">{d.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 賽制說明 */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6">
            <h3 className="font-black text-green-800 mb-3">2026 新賽制說明</h3>
            <ul className="space-y-2 text-sm text-green-700">
              <li className="flex gap-2"><span className="font-black">①</span>48支球隊分為12組，每組4隊進行單循環小組賽</li>
              <li className="flex gap-2"><span className="font-black">②</span>各組前2名直接晉級32強（共24支）</li>
              <li className="flex gap-2"><span className="font-black">③</span>12組第3名中，成績最佳的8支球隊也晉級（共8支）</li>
              <li className="flex gap-2"><span className="font-black">④</span>32強起進入淘汰賽，直至決賽</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── 主辦城市 ── */}
      {activeTab === 'venues' && (
        <div>
          <h2 className="text-xl font-black mb-4">16座主辦城市與場館</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {HOST_CITIES.map(v => (
              <div key={v.city} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <div className="text-3xl shrink-0">{v.country.slice(0, 2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-gray-900">{v.city}</span>
                    <span className="text-xs text-gray-400">{v.country.slice(3)}</span>
                    {v.note && <span className="text-[10px] font-black bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{v.note}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{v.stadium}</p>
                  <p className="text-xs text-gray-400">容量：{v.capacity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 亞洲球隊 ── */}
      {activeTab === 'afc' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black">AFC 亞洲出線隊伍</h2>
            <span className="text-xs text-gray-400 font-bold bg-red-50 text-red-600 px-3 py-1 rounded-full font-black">8.5席</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AFC_TEAMS.map(t => (
              <div key={t.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <span className="text-4xl">{t.flag}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-black text-gray-900">{t.name}</span>
                    <span className="text-xs text-gray-400">FIFA #{t.rank}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t.note}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mt-4">
            <h3 className="font-black text-red-800 mb-2">AFC 出線制度</h3>
            <p className="text-sm text-red-700">亞洲足協（AFC）獲得 <strong>8.5個</strong> 名額，最終第3輪排名前8隊直接晉級，第9名與洲際附加賽隊伍爭奪最後0.5席。</p>
          </div>
        </div>
      )}

      {/* 回首頁 */}
      <div className="mt-10 text-center">
        <button onClick={() => navigate('/')} className="text-sm font-bold text-gray-400 hover:text-green-700 transition">← 返回首頁</button>
      </div>
    </div>
  );
}