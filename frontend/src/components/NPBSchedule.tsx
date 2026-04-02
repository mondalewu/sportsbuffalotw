import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import NpbGameDetail from './NpbGameDetail';
import { triggerNpbScraper } from '../api/scraper';
import { getNpbTeams, NpbTeam } from '../api/npb';
import type { Article } from '../types';
import NpbRosterModal from './NpbRosterModal';
import FarmGameDetail from './FarmGameDetail';

// 二軍分區對應表
const FARM_DIVISION: Record<string, string> = {
  '日本ハム': '東地区', '楽天': '東地区', 'ロッテ': '東地区', 'オイシックス': '東地区', 'ヤクルト': '東地区',
  '巨人': '中地区', 'DeNA': '中地区', '中日': '中地区', 'くふうハヤテ': '中地区', '西武': '中地区',
  '阪神': '西地区', 'ソフトバンク': '西地区', 'オリックス': '西地区', '広島': '西地区',
};
const FARM_DIVISION_ORDER = ['東地区', '中地区', '西地区'];
const FARM_DIVISION_COLOR: Record<string, string> = {
  '東地区': 'text-blue-700 bg-blue-50 border-blue-200',
  '中地区': 'text-green-700 bg-green-50 border-green-200',
  '西地区': 'text-orange-700 bg-orange-50 border-orange-200',
};

const NPB_LOGO_BASE = 'https://p.npb.jp/img/common/logo/2026';

interface NPBGame {
  id: number;
  league: string;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  game_detail: string | null;
  venue: string | null;
  game_date: string;
}

interface StandingRow {
  team_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  games_behind: number | null;
  games: number;
  rank: number;
}

const NAME_TO_CODE: Record<string, string> = {
  '巨人': 'g', 'DeNA': 'db', '阪神': 't', '広島': 'c',
  '中日': 'd', 'ヤクルト': 's', 'ソフトバンク': 'h', '日本ハム': 'f',
  'オリックス': 'b', '楽天': 'e', '西武': 'l', 'ロッテ': 'm',
};

function getCode(name: string): string {
  for (const [key, code] of Object.entries(NAME_TO_CODE)) {
    if (name.includes(key)) return code;
  }
  return '';
}

// 以週一作為每週起始，回傳包含 center 的那週週一
function getCenterStart(center: Date): Date {
  const d = new Date(center);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  d.setDate(d.getDate() - offset);
  return d;
}

// Use local date components to avoid UTC-offset issues
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Game dates from API are UTC; add 9h to get Japan date
function toJSTDate(game_date: string): string {
  const d = new Date(new Date(game_date).getTime() + 9 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function TeamLogo({ name, size = 28 }: { name: string; size?: number }) {
  const [error, setError] = useState(false);
  const code = getCode(name);
  if (!code || error) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-gray-400 text-white font-black flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={`${NPB_LOGO_BASE}/logo_${code}_s.gif`}
      alt={name}
      width={size} height={size}
      onError={() => setError(true)}
      className="flex-shrink-0 object-contain"
    />
  );
}

function ScoreCard({ game, onSelect }: { game: NPBGame; onSelect: () => void }) {
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const time = new Date(game.game_date).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
        isLive ? 'border-red-300 shadow-red-100' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-mono">{time}</span>
        {isLive && (
          <span className="text-xs font-black text-red-600 animate-pulse bg-red-50 px-2 py-0.5 rounded-full">
            ● LIVE {game.game_detail || ''}
          </span>
        )}
        {isFinal && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">試合終了</span>}
        {!isLive && !isFinal && (
          <span className="text-xs text-gray-400">
            {game.game_detail && game.game_detail !== '試合開始前' ? game.game_detail : '試合開始前'}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TeamLogo name={game.team_away} size={28} />
          <span className="font-bold text-sm text-gray-800">{game.team_away}</span>
        </div>
        <span className={`text-2xl font-black tabular-nums ${isFinal || isLive ? 'text-gray-900' : 'text-gray-300'}`}>
          {isFinal || isLive ? (game.score_away ?? '–') : '–'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TeamLogo name={game.team_home} size={28} />
          <span className="font-bold text-sm text-gray-800">{game.team_home}</span>
        </div>
        <span className={`text-2xl font-black tabular-nums ${isFinal || isLive ? 'text-gray-900' : 'text-gray-300'}`}>
          {isFinal || isLive ? (game.score_home ?? '–') : '–'}
        </span>
      </div>
      {game.venue && <div className="mt-2 text-[10px] text-gray-400 text-right">{game.venue}</div>}
    </button>
  );
}

const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function WeekDayTab({ dateStr, isSelected, onClick, hasGames, isToday }: {
  dateStr: string; isSelected: boolean; onClick: () => void; hasGames: boolean; isToday: boolean;
}) {
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS_ZH[d.getDay()];
  const isSun = d.getDay() === 0;
  const isSat = d.getDay() === 6;

  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-2.5 rounded-xl transition border ${
        isSelected
          ? 'bg-red-600 text-white border-red-600'
          : isToday
          ? 'bg-red-50 text-red-600 border-red-200'
          : 'bg-white border-gray-200 hover:border-red-300'
      }`}
    >
      <span className={`text-[10px] font-bold ${isSelected ? 'text-red-100' : 'text-gray-400'}`}>{month}/{day}</span>
      <span className={`text-sm font-black ${
        isSelected ? 'text-white' :
        isSun ? 'text-red-500' :
        isSat ? 'text-blue-500' :
        'text-gray-700'
      }`}>{weekday}</span>
      {hasGames && !isSelected && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5" />
      )}
    </button>
  );
}

// 最新 NPB 消息卡片 — 1大 + 2小版面 (exported for use in App.tsx)
function NewsImg({ src, alt, className }: { src?: string | null; alt: string; className: string }) {
  const fallback = `https://picsum.photos/seed/${encodeURIComponent(alt)}/400/300`;
  return src ? (
    <img src={src} alt={alt} className={className} referrerPolicy="no-referrer"
      onError={e => { (e.target as HTMLImageElement).src = fallback; }} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100`}>
      <span className="text-4xl">⚾</span>
    </div>
  );
}

export function NpbNewsBar({ articles, onSelect }: { articles: Article[]; onSelect: (a: Article) => void }) {
  if (articles.length === 0) return null;
  const [main, ...rest] = articles;

  return (
    <div className="space-y-2">
      {/* 大卡：左圖右文 */}
      <button
        onClick={() => onSelect(main)}
        className="w-full text-left flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group"
      >
        <NewsImg
          src={main.image_url}
          alt={main.title}
          className="w-40 sm:w-56 h-32 sm:h-36 object-cover flex-shrink-0 group-hover:scale-105 transition duration-500"
        />
        <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
          <span className="text-[10px] font-black text-red-600 mb-1.5">NPB 最新消息</span>
          <p className="font-black text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug">{main.title}</p>
          <p className="text-[10px] text-gray-400 mt-2">{new Date(main.published_at).toLocaleDateString('zh-TW')}</p>
        </div>
      </button>

      {/* 小卡：並排 */}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {rest.slice(0, 2).map(a => (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className="text-left flex gap-2.5 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group p-2"
            >
              <NewsImg
                src={a.image_url}
                alt={a.title}
                className="w-20 h-16 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition duration-500"
              />
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-xs font-black text-gray-800 line-clamp-3 leading-snug">{a.title}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString('zh-TW')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NPBSchedule: React.FC = () => {
  const today = new Date();
  const todayStr = toDateStr(today);

  const [allGames, setAllGames] = useState<NPBGame[]>([]);
  const [teams, setTeams] = useState<NpbTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [windowStart, setWindowStart] = useState<Date>(() => getCenterStart(today));
  const [selectedGame, setSelectedGame] = useState<NPBGame | null>(null);
  const [selectedGameIdx, setSelectedGameIdx] = useState<number>(0);
  const [farmGame, setFarmGame] = useState<NPBGame | null>(null);
  const [rosterTeam, setRosterTeam] = useState<NpbTeam | null>(null);
  const [leagueTab, setLeagueTab] = useState<'NPB' | 'NPB2'>('NPB');
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [standings, setStandings] = useState<{ central: StandingRow[]; pacific: StandingRow[] }>({ central: [], pacific: [] });
  const [showStandings, setShowStandings] = useState(true);
  const [scrapingMonth, setScrapingMonth] = useState(false);

  const fetchGames = (league: 'NPB' | 'NPB2' = leagueTab, month: number = selectedMonth) => {
    setLoading(true);
    const year = today.getFullYear();
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    fetch(`/api/v1/games?league=${league}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then((data: NPBGame[]) => { setAllGames(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setAllGames([]); setLoading(false); });
  };

  const fetchStandings = () => {
    fetch('/api/v1/npb/standings')
      .then(r => r.json())
      .then(data => setStandings(data))
      .catch(() => {});
  };

  useEffect(() => {
    const firstDate = `${today.getFullYear()}-${String(selectedMonth).padStart(2, '0')}-01`;
    setSelectedDate(todayStr);
    setWindowStart(getCenterStart(today));
    // ensure windowStart fits in selected month
    if (toJSTDate(today.toISOString()) === todayStr) {
      setWindowStart(getCenterStart(today));
    } else {
      setWindowStart(new Date(firstDate + 'T12:00:00'));
    }
    fetchGames(leagueTab, selectedMonth);
  }, [leagueTab, selectedMonth]);

  useEffect(() => {
    fetchStandings();
  }, []);

  useEffect(() => {
    getNpbTeams().then(setTeams).catch(() => {});
  }, []);

  // 以 windowStart 為起點的 7 天
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(windowStart);
      d.setDate(windowStart.getDate() + i);
      return toDateStr(d);
    });
  }, [windowStart]);

  const prevWeek = () => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() - 7);
    setWindowStart(d);
  };
  const nextWeek = () => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + 7);
    setWindowStart(d);
  };
  const goToday = () => {
    setWindowStart(getCenterStart(today));
    setSelectedDate(todayStr);
  };

  // 週區間文字
  const weekLabel = useMemo(() => {
    const end = new Date(windowStart);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${windowStart.getFullYear()} ${fmt(windowStart)} – ${fmt(end)}`;
  }, [windowStart]);

  const selectedGames = allGames
    .filter(g => toJSTDate(g.game_date) === selectedDate)
    .sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime());

  // NPB2: 按分區分組
  const farmGamesByDivision = useMemo(() => {
    if (leagueTab !== 'NPB2') return null;
    const map: Record<string, NPBGame[]> = {};
    for (const div of FARM_DIVISION_ORDER) map[div] = [];
    for (const g of selectedGames) {
      const div = FARM_DIVISION[g.team_home] ?? FARM_DIVISION[g.team_away] ?? '其他';
      if (!map[div]) map[div] = [];
      map[div].push(g);
    }
    return map;
  }, [selectedGames, leagueTab]);

  const handleScrape = async () => {
    setScraping(true);
    setScrapeMsg('');
    try {
      const res = await triggerNpbScraper();
      setScrapeMsg(res.message);
      fetchGames();
    } catch {
      setScrapeMsg('爬蟲執行失敗');
    } finally {
      setScraping(false);
    }
  };

  const central = teams.filter(t => t.npb_league === 'Central');
  const pacific = teams.filter(t => t.npb_league === 'Pacific');

  return (
    <div>
      {/* 標題列：一軍/二軍 切換 + 更新按鈕 */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['NPB', 'NPB2'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLeagueTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${
                leagueTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'NPB' ? '一軍' : '二軍'}
            </button>
          ))}
        </div>
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
          {scraping ? '更新中...' : '立即更新比分'}
        </button>
      </div>

      {scrapeMsg && (
        <div className="mb-4 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2">{scrapeMsg}</div>
      )}

      {/* 月份切換 */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {[3, 4, 5, 6, 7, 8, 9, 10, 11].map(m => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition ${
              selectedMonth === m
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {m}月
          </button>
        ))}
        {leagueTab === 'NPB2' && (
          <button
            onClick={async () => {
              setScrapingMonth(true);
              try {
                await fetch('/api/v1/scraper/trigger-npb-farm-month', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ year: today.getFullYear(), month: selectedMonth }),
                });
                fetchGames('NPB2', selectedMonth);
              } finally { setScrapingMonth(false); }
            }}
            disabled={scrapingMonth}
            className="ml-2 flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black border border-sky-300 text-sky-600 bg-white hover:bg-sky-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${scrapingMonth ? 'animate-spin' : ''}`} />
            {scrapingMonth ? '爬取中...' : `爬取${selectedMonth}月`}
          </button>
        )}
      </div>

      {/* 球隊 logo + 名冊按鈕 */}
      {teams.length > 0 && leagueTab === 'NPB' && (
        <div className="mb-5">
          {[
            { label: 'セントラル・リーグ（中央聯盟）', list: central },
            { label: 'パシフィック・リーグ（太平洋聯盟）', list: pacific },
          ].map(league => (
            <div key={league.label} className="mb-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{league.label}</p>
              <div className="flex flex-wrap gap-2">
                {league.list.map(team => (
                  <button
                    key={team.code}
                    onClick={() => setRosterTeam(team)}
                    title={`${team.name_full} 名冊`}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 hover:border-red-300 hover:shadow-sm transition"
                  >
                    <img
                      src={team.logo_url} alt={team.name}
                      className="w-6 h-6 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-xs font-bold text-gray-700">{team.name}</span>
                    <Users className="w-3 h-3 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 一軍積分榜 */}
      {leagueTab === 'NPB' && (standings.central.length > 0 || standings.pacific.length > 0) && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">2026 順位表</p>
            <button onClick={() => setShowStandings(v => !v)} className="text-[10px] font-bold text-gray-400 hover:text-gray-700 transition">
              {showStandings ? '▲ 收起' : '▼ 展開'}
            </button>
          </div>
          {showStandings && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'セントラル', rows: standings.central },
                { label: 'パシフィック', rows: standings.pacific },
              ].map(({ label, rows }) => rows.length === 0 ? null : (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="bg-gray-800 text-white text-[10px] font-black px-3 py-1.5 uppercase tracking-widest">{label}</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-1.5 font-black text-gray-500">#</th>
                        <th className="text-left px-2 py-1.5 font-black text-gray-500">球隊</th>
                        <th className="px-2 py-1.5 font-bold text-gray-400 text-center">試</th>
                        <th className="px-2 py-1.5 font-bold text-gray-400 text-center">勝</th>
                        <th className="px-2 py-1.5 font-bold text-gray-400 text-center">敗</th>
                        <th className="px-2 py-1.5 font-bold text-gray-400 text-center">分</th>
                        <th className="px-2 py-1.5 font-bold text-gray-400 text-center">率</th>
                        <th className="px-2 py-1.5 font-bold text-gray-400 text-center">差</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.team_name} className={`border-b border-gray-50 ${i === 0 ? 'bg-yellow-50' : ''}`}>
                          <td className="px-3 py-1.5 font-black text-gray-500">{r.rank}</td>
                          <td className="px-2 py-1.5 font-bold text-gray-800">{r.team_name}</td>
                          <td className="px-2 py-1.5 text-center text-gray-600">{r.games}</td>
                          <td className="px-2 py-1.5 text-center font-bold text-gray-800">{r.wins}</td>
                          <td className="px-2 py-1.5 text-center text-gray-600">{r.losses}</td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{r.draws}</td>
                          <td className="px-2 py-1.5 text-center text-gray-600">{r.win_rate.toFixed(3)}</td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{r.games_behind ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 二軍：依分區顯示球隊名冊 */}
      {teams.length > 0 && leagueTab === 'NPB2' && (
        <div className="mb-5">
          {FARM_DIVISION_ORDER.map(div => {
            const divTeams = teams.filter(t => FARM_DIVISION[t.name] === div);
            if (divTeams.length === 0) return null;
            return (
              <div key={div} className="mb-3">
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${FARM_DIVISION_COLOR[div]}`}>{div}</p>
                <div className="flex flex-wrap gap-2">
                  {divTeams.map(team => (
                    <button
                      key={team.code}
                      onClick={() => setRosterTeam(team)}
                      title={`${team.name_full} 名冊`}
                      className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 hover:border-red-300 hover:shadow-sm transition"
                    >
                      <img
                        src={team.logo_url} alt={team.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-xs font-bold text-gray-700">{team.name}</span>
                      <Users className="w-3 h-3 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 週導覽列 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={prevWeek}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-400 transition text-sm font-bold text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" /> 上一週
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-700">{weekLabel}</span>
            <button
              onClick={() => { setSelectedMonth(today.getMonth() + 1); goToday(); }}
              className={`text-xs font-bold px-2 py-0.5 rounded-lg transition border ${
                selectedDate === todayStr
                  ? 'text-gray-400 border-gray-200 cursor-default'
                  : 'text-red-600 border-red-300 hover:bg-red-50'
              }`}
              disabled={selectedDate === todayStr}
            >
              本日
            </button>
          </div>

          <button
            onClick={nextWeek}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-400 transition text-sm font-bold text-gray-600"
          >
            下一週 <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 7 天格 */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(d => (
            <WeekDayTab
              key={d}
              dateStr={d}
              isSelected={d === selectedDate}
              isToday={d === todayStr}
              onClick={() => setSelectedDate(d)}
              hasGames={allGames.some(g => toJSTDate(g.game_date) === d)}
            />
          ))}
        </div>
      </div>

      {/* 比賽卡片 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 font-bold">載入中...</div>
      ) : selectedGames.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="font-bold text-lg mb-1">本日無比賽資料</p>
          <p className="text-sm">可至管理後台觸發爬蟲，或按「立即更新比分」</p>
        </div>
      ) : leagueTab === 'NPB2' && farmGamesByDivision ? (
        /* ── 二軍：依分區顯示 ── */
        <div className="space-y-5">
          {FARM_DIVISION_ORDER.map(div => {
            const games = farmGamesByDivision[div] ?? [];
            if (games.length === 0) return null;
            return (
              <div key={div}>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border mb-3 ${FARM_DIVISION_COLOR[div]}`}>
                  {div}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {games.map(g => (
                    <ScoreCard key={g.id} game={g} onSelect={() => setFarmGame(g)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── 一軍：一般顯示 ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedGames.map((g, i) => (
            <ScoreCard key={g.id} game={g} onSelect={() => { setSelectedGame(g); setSelectedGameIdx(i); }} />
          ))}
        </div>
      )}

      {selectedGame && (() => {
        const awayCode = NAME_TO_CODE[selectedGame.team_away] ?? '';
        const homeCode = NAME_TO_CODE[selectedGame.team_home] ?? '';
        return (
          <NpbGameDetail
            key={selectedGame.id}
            game={selectedGame}
            awayCode={awayCode}
            homeCode={homeCode}
            onClose={() => setSelectedGame(null)}
            hasPrev={selectedGameIdx > 0}
            hasNext={selectedGameIdx < selectedGames.length - 1}
            onPrev={() => {
              const idx = selectedGameIdx - 1;
              setSelectedGameIdx(idx);
              setSelectedGame(selectedGames[idx]);
            }}
            onNext={() => {
              const idx = selectedGameIdx + 1;
              setSelectedGameIdx(idx);
              setSelectedGame(selectedGames[idx]);
            }}
          />
        );
      })()}
      {farmGame && (
        <FarmGameDetail game={farmGame} onClose={() => setFarmGame(null)} />
      )}
      {rosterTeam && (
        <NpbRosterModal team={rosterTeam} onClose={() => setRosterTeam(null)} />
      )}
    </div>
  );
};

export default NPBSchedule;
