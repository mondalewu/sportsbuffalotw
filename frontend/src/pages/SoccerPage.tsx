import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ════════════════════════════════════════════════════════
//  2026 FIFA World Cup 資料
// ════════════════════════════════════════════════════════
const WC_GROUPS = [
  { name: 'A', teams: [
    { name: '美國', flag: '🇺🇸', conf: 'CONCACAF' },
    { name: '巴拿馬', flag: '🇵🇦', conf: 'CONCACAF' },
    { name: '玻利維亞', flag: '🇧🇴', conf: 'CONMEBOL' },
    { name: '摩洛哥', flag: '🇲🇦', conf: 'CAF' },
  ]},
  { name: 'B', teams: [
    { name: '阿根廷', flag: '🇦🇷', conf: 'CONMEBOL' },
    { name: '秘魯', flag: '🇵🇪', conf: 'CONMEBOL' },
    { name: '智利', flag: '🇨🇱', conf: 'CONMEBOL' },
    { name: '澳洲', flag: '🇦🇺', conf: 'AFC' },
  ]},
  { name: 'C', teams: [
    { name: '墨西哥', flag: '🇲🇽', conf: 'CONCACAF' },
    { name: '烏拉圭', flag: '🇺🇾', conf: 'CONMEBOL' },
    { name: '加拿大', flag: '🇨🇦', conf: 'CONCACAF' },
    { name: '葡萄牙', flag: '🇵🇹', conf: 'UEFA' },
  ]},
  { name: 'D', teams: [
    { name: '巴西', flag: '🇧🇷', conf: 'CONMEBOL' },
    { name: '伊拉克', flag: '🇮🇶', conf: 'AFC' },
    { name: '厄瓜多', flag: '🇪🇨', conf: 'CONMEBOL' },
    { name: '委內瑞拉', flag: '🇻🇪', conf: 'CONMEBOL' },
  ]},
  { name: 'E', teams: [
    { name: '法國', flag: '🇫🇷', conf: 'UEFA' },
    { name: '沙烏地阿拉伯', flag: '🇸🇦', conf: 'AFC' },
    { name: '丹麥', flag: '🇩🇰', conf: 'UEFA' },
    { name: '突尼西亞', flag: '🇹🇳', conf: 'CAF' },
  ]},
  { name: 'F', teams: [
    { name: '英格蘭', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', conf: 'UEFA' },
    { name: '伊朗', flag: '🇮🇷', conf: 'AFC' },
    { name: '賽內加爾', flag: '🇸🇳', conf: 'CAF' },
    { name: '塞爾維亞', flag: '🇷🇸', conf: 'UEFA' },
  ]},
  { name: 'G', teams: [
    { name: '西班牙', flag: '🇪🇸', conf: 'UEFA' },
    { name: '日本', flag: '🇯🇵', conf: 'AFC' },
    { name: '喀麥隆', flag: '🇨🇲', conf: 'CAF' },
    { name: '比利時', flag: '🇧🇪', conf: 'UEFA' },
  ]},
  { name: 'H', teams: [
    { name: '葡萄牙', flag: '🇵🇹', conf: 'UEFA' },
    { name: '南韓', flag: '🇰🇷', conf: 'AFC' },
    { name: '多哥', flag: '🇹🇬', conf: 'CAF' },
    { name: '哥斯大黎加', flag: '🇨🇷', conf: 'CONCACAF' },
  ]},
  { name: 'I', teams: [
    { name: '德國', flag: '🇩🇪', conf: 'UEFA' },
    { name: '烏茲別克', flag: '🇺🇿', conf: 'AFC' },
    { name: '科特迪瓦', flag: '🇨🇮', conf: 'CAF' },
    { name: '奧地利', flag: '🇦🇹', conf: 'UEFA' },
  ]},
  { name: 'J', teams: [
    { name: '義大利', flag: '🇮🇹', conf: 'UEFA' },
    { name: '卡達', flag: '🇶🇦', conf: 'AFC' },
    { name: '厄瓜多', flag: '🇪🇨', conf: 'CONMEBOL' },
    { name: '奈及利亞', flag: '🇳🇬', conf: 'CAF' },
  ]},
  { name: 'K', teams: [
    { name: '荷蘭', flag: '🇳🇱', conf: 'UEFA' },
    { name: '象牙海岸', flag: '🇨🇮', conf: 'CAF' },
    { name: '波士尼亞', flag: '🇧🇦', conf: 'UEFA' },
    { name: '巴拉圭', flag: '🇵🇾', conf: 'CONMEBOL' },
  ]},
  { name: 'L', teams: [
    { name: '克羅埃西亞', flag: '🇭🇷', conf: 'UEFA' },
    { name: '奧地利', flag: '🇦🇹', conf: 'UEFA' },
    { name: '埃及', flag: '🇪🇬', conf: 'CAF' },
    { name: '巴拉圭', flag: '🇵🇾', conf: 'CONMEBOL' },
  ]},
];

const WC_KEY_DATES = [
  { date: '6月11日', event: '揭幕戰', note: '墨西哥市 Estadio Azteca' },
  { date: '6月11日－7月2日', event: '小組賽（72場）', note: '12組 × 3場' },
  { date: '7月4日－7日', event: '32強淘汰賽', note: '16場' },
  { date: '7月10日－13日', event: '16強淘汰賽', note: '8場' },
  { date: '7月17日－20日', event: '八強賽', note: '4場' },
  { date: '7月23日－26日', event: '四強賽', note: '2場' },
  { date: '7月29日', event: '季軍賽', note: 'MetLife Stadium, 紐澤西' },
  { date: '7月19日', event: '決賽', note: 'MetLife Stadium, 紐澤西' },
];

const WC_HOST_CITIES = [
  { city: '紐約/紐澤西', country: '🇺🇸', stadium: 'MetLife Stadium', cap: '82,500', note: '決賽' },
  { city: '洛杉磯', country: '🇺🇸', stadium: 'SoFi Stadium', cap: '70,240', note: '' },
  { city: '達拉斯', country: '🇺🇸', stadium: 'AT&T Stadium', cap: '80,000', note: '' },
  { city: '舊金山', country: '🇺🇸', stadium: "Levi's Stadium", cap: '68,500', note: '' },
  { city: '亞特蘭大', country: '🇺🇸', stadium: 'Mercedes-Benz Stadium', cap: '71,000', note: '' },
  { city: '邁阿密', country: '🇺🇸', stadium: 'Hard Rock Stadium', cap: '65,326', note: '' },
  { city: '波士頓', country: '🇺🇸', stadium: 'Gillette Stadium', cap: '65,878', note: '' },
  { city: '費城', country: '🇺🇸', stadium: 'Lincoln Financial Field', cap: '69,328', note: '' },
  { city: '西雅圖', country: '🇺🇸', stadium: 'Lumen Field', cap: '68,740', note: '' },
  { city: '堪薩斯城', country: '🇺🇸', stadium: 'Arrowhead Stadium', cap: '76,416', note: '' },
  { city: '溫哥華', country: '🇨🇦', stadium: 'BC Place', cap: '54,500', note: '' },
  { city: '多倫多', country: '🇨🇦', stadium: 'BMO Field', cap: '45,000', note: '' },
  { city: '墨西哥市', country: '🇲🇽', stadium: 'Estadio Azteca', cap: '87,523', note: '揭幕戰' },
  { city: '蒙特雷', country: '🇲🇽', stadium: 'Estadio BBVA', cap: '51,348', note: '' },
  { city: '瓜達拉哈拉', country: '🇲🇽', stadium: 'Estadio Akron', cap: '49,850', note: '' },
];

// ════════════════════════════════════════════════════════
//  J League 資料
// ════════════════════════════════════════════════════════
const JLEAGUE_STANDINGS = [
  { rank: 1,  team: 'ヴィッセル神戸',   flag: '⚓', played: 17, won: 11, drawn: 4, lost: 2, gf: 35, ga: 18, pts: 37 },
  { rank: 2,  team: 'ガンバ大阪',       flag: '🔵', played: 17, won: 11, drawn: 3, lost: 3, gf: 30, ga: 17, pts: 36 },
  { rank: 3,  team: '鹿島アントラーズ', flag: '🦌', played: 17, won: 10, drawn: 4, lost: 3, gf: 28, ga: 16, pts: 34 },
  { rank: 4,  team: 'サンフレッチェ広島', flag: '🟣', played: 17, won: 9,  drawn: 5, lost: 3, gf: 27, ga: 15, pts: 32 },
  { rank: 5,  team: '浦和レッズ',       flag: '🔴', played: 17, won: 9,  drawn: 3, lost: 5, gf: 26, ga: 20, pts: 30 },
  { rank: 6,  team: 'FC東京',           flag: '🔵', played: 17, won: 8,  drawn: 4, lost: 5, gf: 24, ga: 21, pts: 28 },
  { rank: 7,  team: '横浜F・マリノス', flag: '🔵', played: 17, won: 8,  drawn: 3, lost: 6, gf: 29, ga: 26, pts: 27 },
  { rank: 8,  team: 'セレッソ大阪',     flag: '🌸', played: 17, won: 7,  drawn: 5, lost: 5, gf: 22, ga: 19, pts: 26 },
  { rank: 9,  team: '川崎フロンターレ', flag: '🟡', played: 17, won: 7,  drawn: 4, lost: 6, gf: 23, ga: 24, pts: 25 },
  { rank: 10, team: '名古屋グランパス', flag: '🔴', played: 17, won: 6,  drawn: 5, lost: 6, gf: 19, ga: 20, pts: 23 },
];

const JLEAGUE_TOP_SCORERS = [
  { name: '大迫勇也', team: 'ヴィッセル神戸', goals: 14, flag: '🇯🇵' },
  { name: '宇佐美貴史', team: 'ガンバ大阪', goals: 12, flag: '🇯🇵' },
  { name: '鈴木優磨', team: '鹿島アントラーズ', goals: 11, flag: '🇯🇵' },
  { name: 'レオ セアラ', team: 'セレッソ大阪', goals: 10, flag: '🇧🇷' },
  { name: '山田楓喜', team: 'FC東京', goals: 9, flag: '🇯🇵' },
];

// ════════════════════════════════════════════════════════
//  台灣企業甲級聯賽 (TPSL)
// ════════════════════════════════════════════════════════
const TPSL_STANDINGS = [
  { rank: 1,  team: '台電足球隊',   badge: '⚡', played: 12, won: 9,  drawn: 2, lost: 1, gf: 28, ga: 10, pts: 29 },
  { rank: 2,  team: '台灣鋼鐵',     badge: '🔩', played: 12, won: 8,  drawn: 2, lost: 2, gf: 24, ga: 12, pts: 26 },
  { rank: 3,  team: '陸光足球隊',   badge: '🪖', played: 12, won: 7,  drawn: 3, lost: 2, gf: 22, ga: 11, pts: 24 },
  { rank: 4,  team: '航源FC',       badge: '✈️', played: 12, won: 6,  drawn: 3, lost: 3, gf: 20, ga: 14, pts: 21 },
  { rank: 5,  team: '勝利FC',       badge: '🏆', played: 12, won: 5,  drawn: 3, lost: 4, gf: 18, ga: 16, pts: 18 },
  { rank: 6,  team: '台北市立大學', badge: '🎓', played: 12, won: 4,  drawn: 3, lost: 5, gf: 15, ga: 18, pts: 15 },
  { rank: 7,  team: '玉山金控',     badge: '🏔️', played: 12, won: 3,  drawn: 2, lost: 7, gf: 12, ga: 22, pts: 11 },
  { rank: 8,  team: '中華電信FC',   badge: '📡', played: 12, won: 2,  drawn: 2, lost: 8, gf: 10, ga: 28, pts: 8  },
];

const TPSL_INFO = [
  { label: '聯賽全名', value: '台灣企業甲級足球聯賽（TPSL）' },
  { label: '主辦單位', value: '中華民國足球協會（CTFA）' },
  { label: '參賽隊伍', value: '8支球隊' },
  { label: '賽制', value: '主客場雙循環制，共 14 輪' },
  { label: '2026賽季', value: '2026年3月 — 11月' },
  { label: '冠軍晉升', value: '亞足聯冠軍盃資格賽' },
];

// ── 顏色對應 ─────────────────────────────────────────────
const CONF_COLORS: Record<string, string> = {
  UEFA:     'bg-blue-100 text-blue-700',
  CONMEBOL: 'bg-yellow-100 text-yellow-700',
  AFC:      'bg-red-100 text-red-700',
  CAF:      'bg-green-100 text-green-700',
  CONCACAF: 'bg-purple-100 text-purple-700',
};

type Section = 'worldcup' | 'jleague' | 'tpsl';
type WcTab = 'groups' | 'schedule' | 'venues';

export default function SoccerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState<Section>('worldcup');
  const [wcTab, setWcTab] = useState<WcTab>('groups');

  useEffect(() => {
    const s = searchParams.get('section');
    if (s === 'worldcup' || s === 'jleague' || s === 'tpsl') setSection(s);
  }, [searchParams]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* ════════════════════════════════════════
          2026 FIFA 世界盃
      ════════════════════════════════════════ */}
      {section === 'worldcup' && (
        <div>
          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden mb-6 text-white" style={{ minHeight: 220 }}>
            <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-black" />
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-56 h-56 rounded-full border-4 border-white" />
              <div className="absolute bottom-4 left-16 w-40 h-40 rounded-full border-2 border-white" />
            </div>
            <div className="relative z-10 p-7 flex flex-col justify-between" style={{ minHeight: 220 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full">⚽ FIFA WORLD CUP 2026</span>
                <span className="bg-yellow-400/90 text-black text-xs font-black px-3 py-1 rounded-full">48隊 · 104場</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black mb-2">2026 FIFA 世界盃</h1>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="font-bold">📅 2026年6月11日 — 7月19日</span>
                  <span className="font-bold">🌎 美國 · 加拿大 · 墨西哥</span>
                </div>
              </div>
              <div className="flex gap-6 mt-4">
                {[['48', '參賽隊伍'], ['104', '總場次'], ['16', '主辦城市'], ['3', '主辦國']].map(([v, l]) => (
                  <div key={l} className="text-center">
                    <div className="text-2xl font-black">{v}</div>
                    <div className="text-xs text-green-300 font-bold">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sub tabs */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {([['groups', '🏆 分組資料'], ['schedule', '📅 賽事時程'], ['venues', '🏟️ 主辦城市']] as [WcTab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setWcTab(k)}
                className={`px-4 py-2 rounded-xl font-black text-sm border transition-all ${wcTab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* 分組 */}
          {wcTab === 'groups' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-500">12組 × 4隊，每組前2 + 8支最佳第3晉級</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {WC_GROUPS.map(g => (
                  <div key={g.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-green-700 px-4 py-2">
                      <span className="text-white font-black">Group {g.name}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {g.teams.map(t => (
                        <div key={t.name} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{t.flag}</span>
                            <span className="font-bold text-sm">{t.name}</span>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CONF_COLORS[t.conf] ?? 'bg-gray-100 text-gray-500'}`}>{t.conf}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 時程 */}
          {wcTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {WC_KEY_DATES.map((d, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition">
                      <div className="w-40 shrink-0 text-sm font-black text-green-700">{d.date}</div>
                      <div className="flex-1">
                        <p className="font-black text-gray-900">{d.event}</p>
                        {d.note && <p className="text-xs text-gray-400 mt-0.5">{d.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                <h3 className="font-black text-green-800 mb-2">新賽制說明</h3>
                <p className="text-sm text-green-700">48支球隊分12組，各組前2名 + 8支最佳第3名 = 32強，之後進行單淘汰賽至決賽。</p>
              </div>
            </div>
          )}

          {/* 場館 */}
          {wcTab === 'venues' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WC_HOST_CITIES.map(v => (
                <div key={v.city} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{v.country}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-sm">{v.city}</span>
                      {v.note && <span className="text-[10px] font-black bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{v.note}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{v.stadium}</p>
                    <p className="text-xs text-gray-400">容量 {v.cap}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          J League
      ════════════════════════════════════════ */}
      {section === 'jleague' && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden text-white" style={{ minHeight: 160 }}>
            <div className="absolute inset-0 bg-gradient-to-r from-red-700 via-red-600 to-red-800" />
            <div className="relative z-10 p-7 flex flex-col justify-between" style={{ minHeight: 160 }}>
              <span className="text-red-200 text-xs font-black tracking-widest uppercase">J1 LEAGUE 2026</span>
              <div>
                <h2 className="text-3xl font-black mb-1">J League J1</h2>
                <p className="text-red-200 text-sm">2026 賽季 · 第17節結束後積分榜</p>
              </div>
            </div>
          </div>

          {/* 積分榜 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-black text-sm text-gray-700">積分榜 Standings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-black text-gray-400 border-b border-gray-100">
                    <th className="text-left px-4 py-2 w-8">#</th>
                    <th className="text-left px-2 py-2">球隊</th>
                    <th className="px-2 py-2 text-center">場</th>
                    <th className="px-2 py-2 text-center">勝</th>
                    <th className="px-2 py-2 text-center">平</th>
                    <th className="px-2 py-2 text-center">負</th>
                    <th className="px-2 py-2 text-center">進</th>
                    <th className="px-2 py-2 text-center">失</th>
                    <th className="px-2 py-2 text-center font-black text-gray-700">積分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {JLEAGUE_STANDINGS.map(r => (
                    <tr key={r.rank} className={`hover:bg-gray-50 transition ${r.rank <= 3 ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ${r.rank === 1 ? 'bg-yellow-400 text-white' : r.rank === 2 ? 'bg-gray-300 text-white' : r.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span>{r.flag}</span>
                          <span className="font-bold text-gray-800 text-xs">{r.team}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.played}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-700">{r.won}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.drawn}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.lost}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.gf}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.ga}</td>
                      <td className="px-2 py-3 text-center font-black text-red-600">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 射手榜 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-black text-sm text-gray-700">射手榜 Top Scorers</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {JLEAGUE_TOP_SCORERS.map((p, i) => (
                <div key={p.name} className="flex items-center gap-4 px-4 py-3">
                  <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <span className="text-base shrink-0">{p.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.team}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-2xl font-black text-red-600">{p.goals}</span>
                    <span className="text-xs text-gray-400 font-bold">球</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">* 資料為模擬數據，實際積分請參考 J.League 官方網站</p>
        </div>
      )}

      {/* ════════════════════════════════════════
          台灣企業甲級聯賽
      ════════════════════════════════════════ */}
      {section === 'tpsl' && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden text-white" style={{ minHeight: 160 }}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-800" />
            <div className="relative z-10 p-7 flex flex-col justify-between" style={{ minHeight: 160 }}>
              <span className="text-blue-200 text-xs font-black tracking-widest uppercase">TAIWAN PREMIER SOCCER LEAGUE 2026</span>
              <div>
                <h2 className="text-3xl font-black mb-1">台灣企業甲級聯賽</h2>
                <p className="text-blue-200 text-sm">TPSL 2026 賽季 · 第12輪積分榜</p>
              </div>
            </div>
          </div>

          {/* 聯賽資訊 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TPSL_INFO.map(info => (
              <div key={info.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] font-black text-gray-400 mb-1">{info.label}</p>
                <p className="text-sm font-bold text-gray-800">{info.value}</p>
              </div>
            ))}
          </div>

          {/* 積分榜 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-black text-sm text-gray-700">積分榜 Standings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-black text-gray-400 border-b border-gray-100">
                    <th className="text-left px-4 py-2 w-8">#</th>
                    <th className="text-left px-2 py-2">球隊</th>
                    <th className="px-2 py-2 text-center">場</th>
                    <th className="px-2 py-2 text-center">勝</th>
                    <th className="px-2 py-2 text-center">平</th>
                    <th className="px-2 py-2 text-center">負</th>
                    <th className="px-2 py-2 text-center">進</th>
                    <th className="px-2 py-2 text-center">失</th>
                    <th className="px-2 py-2 text-center font-black text-gray-700">積分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {TPSL_STANDINGS.map(r => (
                    <tr key={r.rank} className={`hover:bg-gray-50 transition ${r.rank <= 2 ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ${r.rank === 1 ? 'bg-yellow-400 text-white' : r.rank === 2 ? 'bg-gray-300 text-white' : r.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span>{r.badge}</span>
                          <span className="font-bold text-gray-800 text-xs">{r.team}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.played}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-700">{r.won}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.drawn}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.lost}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.gf}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.ga}</td>
                      <td className="px-2 py-3 text-center font-black text-blue-600">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
              <span className="text-[10px] text-blue-600 font-bold">🏆 前2名晉升亞足聯冠軍盃資格賽</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">* 資料為模擬數據，實際積分請參考中華民國足球協會官方網站</p>
        </div>
      )}

      <div className="mt-10 text-center">
        <button onClick={() => navigate('/')} className="text-sm font-bold text-gray-400 hover:text-green-700 transition">← 返回首頁</button>
      </div>
    </div>
  );
}