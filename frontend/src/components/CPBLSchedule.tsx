import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users, TrendingUp } from 'lucide-react';
import CPBLGameDetail from './CPBLGameDetail';
import CPBLRosterModal from './CPBLRosterModal';
import { teamLogos } from '../data/staticData';

interface CPBLGame {
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

interface CpblStanding {
  team_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  games_behind: number | null;
  rank: number;
  games: number;
}

interface Props {
  onSelectGame?: (game: CPBLGame) => void;
}

const TEAM_CONFIG: Record<string, { abbr: string; bg: string; text: string; color: string }> = {
  '味全龍':  { abbr: 'W', bg: 'bg-pink-500',   text: 'text-white', color: '#ec4899' },
  '中信兄弟':{ abbr: 'B', bg: 'bg-yellow-500', text: 'text-white', color: '#eab308' },
  '富邦悍將':{ abbr: 'G', bg: 'bg-blue-600',   text: 'text-white', color: '#2563eb' },
  '台鋼雄鷹':{ abbr: 'T', bg: 'bg-teal-600',   text: 'text-white', color: '#0d9488' },
  '樂天桃猿':{ abbr: 'R', bg: 'bg-red-700',    text: 'text-white', color: '#b91c1c' },
  '統一獅':  { abbr: 'U', bg: 'bg-indigo-700', text: 'text-white', color: '#4338ca' },
};

const VENUE_BG: Record<string, string> = {
  '大巨蛋': 'bg-teal-100', '天母': 'bg-pink-100', '新莊': 'bg-amber-100',
  '桃園': 'bg-blue-100', '洲際': 'bg-yellow-100', '斗六': 'bg-green-100',
  '嘉義市': 'bg-lime-100', '嘉義': 'bg-lime-100', '亞太主': 'bg-sky-100',
  '亞太副': 'bg-sky-50', '澄清湖': 'bg-orange-100', '臺東': 'bg-purple-100',
  '花蓮': 'bg-emerald-100',
};

const VENUE_LEGEND = [
  { name: '臺北大巨蛋', color: 'bg-teal-200' }, { name: '天母', color: 'bg-pink-200' },
  { name: '新莊', color: 'bg-amber-200' }, { name: '桃園', color: 'bg-blue-200' },
  { name: '洲際', color: 'bg-yellow-200' }, { name: '斗六', color: 'bg-green-200' },
  { name: '嘉義市', color: 'bg-lime-200' }, { name: '亞太主', color: 'bg-sky-200' },
  { name: '澄清湖', color: 'bg-orange-200' }, { name: '花蓮', color: 'bg-emerald-200' },
  { name: '臺東', color: 'bg-purple-200' },
];

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function getVenueBg(venue: string | null): string {
  if (!venue) return '';
  for (const key of Object.keys(VENUE_BG)) {
    if (venue.includes(key)) return VENUE_BG[key];
  }
  return 'bg-gray-100';
}

// Use local date components to avoid UTC-offset issues (Taiwan is UTC+8)
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Game dates from the API are UTC timestamps; add 8h to get Taiwan date
function toTWDate(game_date: string): string {
  const d = new Date(new Date(game_date).getTime() + 8 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 取得日期所在週的星期一
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=日, 1=一 ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function TeamBadge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const cfg = TEAM_CONFIG[name];
  const sz = size === 'xs' ? 'w-5 h-5' : 'w-6 h-6';
  const logo = teamLogos[name];
  if (logo) {
    return (
      <img src={logo} alt={name} className={`${sz} object-contain flex-shrink-0`} />
    );
  }
  if (!cfg) return <span className="font-bold text-xs">{name.slice(0, 1)}</span>;
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-black ${sz} text-xs ${cfg.bg} ${cfg.text} flex-shrink-0`}>
      {cfg.abbr}
    </span>
  );
}

// ── 月賽程 GameCell ────────────────────────────────────────────────────────────

function GameCell({ game, onClick }: { game: CPBLGame; onClick: () => void }) {
  const bg = getVenueBg(game.venue);
  const time = new Date(game.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });
  const venueShort = game.venue?.replace(/棒球場|棒球|球場|台北|臺北|台中|高雄/g, '').slice(0, 3) || '';
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  return (
    <button onClick={onClick} className={`w-full text-left p-1.5 rounded mb-1 ${bg} hover:brightness-95 transition border border-black/5 relative`}>
      <div className="flex items-center gap-1">
        <span className="text-gray-400 font-mono text-[10px] w-7 flex-shrink-0">
          {game.game_detail?.padStart(3, '0') || '—'}
        </span>
        <TeamBadge name={game.team_away} size="xs" />
        <span className="text-[10px] text-gray-600 font-bold mx-0.5">{time}</span>
        <TeamBadge name={game.team_home} size="xs" />
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-gray-500 ml-7">{venueShort}</span>
        {isLive && <span className="text-[9px] font-black text-red-600 animate-pulse">LIVE</span>}
        {isFinal && <span className="text-[10px] font-bold text-gray-700">{game.score_away}-{game.score_home}</span>}
      </div>
    </button>
  );
}

// ── 周賽程 ScoreCard ───────────────────────────────────────────────────────────

function CPBLScoreCard({ game, onClick }: { game: CPBLGame; onClick: () => void }) {
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const time = new Date(game.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });
  const bg = getVenueBg(game.venue);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${
        isLive ? 'border-red-300 shadow-red-100' : 'border-gray-100'
      } ${bg || 'bg-white'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-mono">{time}</span>
        {isLive && <span className="text-xs font-black text-red-600 animate-pulse bg-red-50 px-2 py-0.5 rounded-full">● LIVE {game.game_detail || ''}</span>}
        {isFinal && <span className="text-xs font-bold text-gray-500 bg-white/80 px-2 py-0.5 rounded-full">終場</span>}
        {!isLive && !isFinal && <span className="text-xs text-gray-400">{game.venue?.slice(0, 3) || ''}</span>}
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TeamBadge name={game.team_away} size="sm" />
          <span className="font-bold text-sm text-gray-800">{game.team_away}</span>
        </div>
        <span className={`text-2xl font-black tabular-nums ${isFinal || isLive ? 'text-gray-900' : 'text-gray-300'}`}>
          {isFinal || isLive ? (game.score_away ?? '–') : '–'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TeamBadge name={game.team_home} size="sm" />
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

// ── 周賽程 日期Tab ─────────────────────────────────────────────────────────────

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
        isSelected ? 'bg-red-600 text-white border-red-600'
        : isToday ? 'bg-red-50 text-red-600 border-red-200'
        : 'bg-white border-gray-200 hover:border-red-300'
      }`}
    >
      <span className={`text-[10px] font-bold ${isSelected ? 'text-red-100' : 'text-gray-400'}`}>{month}/{day}</span>
      <span className={`text-sm font-black ${
        isSelected ? 'text-white' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'
      }`}>{weekday}</span>
      {hasGames && !isSelected && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5" />}
    </button>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

const CPBL_TEAMS = [
  { code: 'AJL011', name: '樂天桃猿', color: '#CC0000' },
  { code: 'AEO011', name: '富邦悍將', color: '#003399' },
  { code: 'ACN011', name: '中信兄弟', color: '#F5A623' },
  { code: 'AKP011', name: '台鋼雄鷹', color: '#00897B' },
  { code: 'AAA011', name: '味全龍',   color: '#E91E8C' },
  { code: 'ADD011', name: '統一獅',   color: '#3F51B5' },
];

const CPBLSchedule: React.FC<Props> = () => {
  const today = new Date();
  const todayStr = toDateStr(today);

  const [games, setGames] = useState<CPBLGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [leagueMode, setLeagueMode] = useState<'CPBL' | 'CPBL-W' | 'CPBL-B'>('CPBL-W');
  const [scheduleView, setScheduleView] = useState<'week' | 'month'>('week');
  const [selectedGame, setSelectedGame] = useState<CPBLGame | null>(null);
  const [selectedGameIdx, setSelectedGameIdx] = useState(0);
  const [rosterTeam, setRosterTeam] = useState<typeof CPBL_TEAMS[number] | null>(null);
  const [standings, setStandings] = useState<CpblStanding[]>([]);

  // 周賽程 state
  const [windowStart, setWindowStart] = useState<Date>(() => getMonday(today));
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const liveTimerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    setLoading(true);
    const from = new Date(today); from.setDate(from.getDate() - 60);
    const to = new Date(today); to.setDate(to.getDate() + 120);
    fetch(`/api/v1/games?league=${leagueMode}&from=${toDateStr(from)}&to=${toDateStr(to)}`)
      .then(r => r.json())
      .then((data: CPBLGame[]) => { setGames(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [leagueMode]);

  // 順位表：只有例行賽模式才顯示（CPBL API 不提供熱身賽/二軍積分榜）
  useEffect(() => {
    if (leagueMode !== 'CPBL') { setStandings([]); return; }
    fetch(`/api/v1/cpbl/standings?year=2026&kindCode=A`)
      .then(r => r.json())
      .then((data: CpblStanding[]) => setStandings(Array.isArray(data) ? data : []))
      .catch(() => setStandings([]));
  }, [leagueMode]);

  // 穩定的 live 判斷（避免 dependency array 直接放 .some() 產生不穩定比較）
  const hasLiveGame = useMemo(
    () => games.some(g => g.status === 'live'),
    [games],
  );

  // 有 live 比賽時每 30 秒刷新當前選取日期的比分
  useEffect(() => {
    clearInterval(liveTimerRef.current);
    if (!hasLiveGame) return;
    liveTimerRef.current = setInterval(() => {
      fetch(`/api/v1/games?league=${leagueMode}&date=${selectedDate}`)
        .then(r => r.json())
        .then((fresh: CPBLGame[]) => {
          if (!Array.isArray(fresh) || fresh.length === 0) return;
          setGames(prev => {
            const map = new Map(prev.map(g => [g.id, g]));
            fresh.forEach(g => map.set(g.id, g));
            return Array.from(map.values());
          });
          // 同步更新已開啟的比賽 modal
          setSelectedGame(prev => {
            if (!prev) return prev;
            const updated = fresh.find(g => g.id === prev.id);
            return updated ?? prev;
          });
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(liveTimerRef.current);
  }, [hasLiveGame, leagueMode, selectedDate]);

  // 月賽程 calendar
  const firstDay = new Date(viewYear, viewMonth - 1, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  const gamesByDate: Record<string, CPBLGame[]> = {};
  games.forEach(g => {
    const twStr = toTWDate(g.game_date); // e.g. "2026-03-18"
    const [gy, gm, gd] = twStr.split('-').map(Number);
    if (gy === viewYear && gm === viewMonth) {
      const key = gd.toString();
      if (!gamesByDate[key]) gamesByDate[key] = [];
      gamesByDate[key].push(g);
    }
  });

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const monthNames = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < totalCells) cells.push(null);

  // 周賽程 week days
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    return toDateStr(d);
  }), [windowStart]);

  const weekLabel = useMemo(() => {
    const end = new Date(windowStart); end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${windowStart.getFullYear()} ${fmt(windowStart)} – ${fmt(end)}`;
  }, [windowStart]);

  const prevWeek = () => { const d = new Date(windowStart); d.setDate(d.getDate() - 7); setWindowStart(d); };
  const nextWeek = () => { const d = new Date(windowStart); d.setDate(d.getDate() + 7); setWindowStart(d); };
  const goToday = () => { setWindowStart(getMonday(today)); setSelectedDate(todayStr); };

  const selectedGames = games
    .filter(g => toTWDate(g.game_date) === selectedDate)
    .sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime());

  return (
    <div>
      {/* 球隊名冊按鈕（二軍模式下隱藏） */}
      <div className={`flex flex-wrap gap-2 mb-4 ${leagueMode === 'CPBL-B' ? 'hidden' : ''}`}>
        {CPBL_TEAMS.map(team => (
          <button
            key={team.code}
            onClick={() => setRosterTeam(team)}
            title={`${team.name} 名冊`}
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 hover:border-red-300 hover:shadow-sm transition"
          >
            {teamLogos[team.name] ? (
              <img src={teamLogos[team.name]} alt={team.name} className="w-5 h-5 object-contain shrink-0" />
            ) : (
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
                style={{ backgroundColor: team.color }}
              >
                {TEAM_CONFIG[team.name]?.abbr ?? team.name.slice(0, 1)}
              </span>
            )}
            <span className="text-xs font-bold text-gray-700">{team.name}</span>
            <Users className="w-3 h-3 text-gray-400" />
          </button>
        ))}
      </div>

      {/* 頂部控制列 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 熱身賽/例行賽/二軍賽程 */}
        <div className="flex gap-2">
          <button onClick={() => setLeagueMode('CPBL-W')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${leagueMode === 'CPBL-W' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            熱身賽
          </button>
          <button onClick={() => setLeagueMode('CPBL')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${leagueMode === 'CPBL' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            例行賽
          </button>
          <button onClick={() => setLeagueMode('CPBL-B')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${leagueMode === 'CPBL-B' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            二軍賽程
          </button>
        </div>

        <div className="flex-1" />

        {/* 周賽程/月賽程 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setScheduleView('week')}
            className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${scheduleView === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            周賽程
          </button>
          <button onClick={() => setScheduleView('month')}
            className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${scheduleView === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            月賽程
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 font-bold">載入賽程中...</div>
      ) : scheduleView === 'week' ? (
        /* ── 周賽程 ── */
        <div>
          {/* 週導覽列 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevWeek}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-400 transition text-sm font-bold text-gray-600">
                <ChevronLeft className="w-4 h-4" /> 上一週
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-700">{weekLabel}</span>
                <button onClick={goToday} disabled={selectedDate === todayStr}
                  className={`text-xs font-bold px-2 py-0.5 rounded-lg transition border ${
                    selectedDate === todayStr ? 'text-gray-400 border-gray-200 cursor-default' : 'text-red-600 border-red-300 hover:bg-red-50'
                  }`}>
                  本日
                </button>
              </div>
              <button onClick={nextWeek}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-400 transition text-sm font-bold text-gray-600">
                下一週 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(d => (
                <WeekDayTab key={d} dateStr={d} isSelected={d === selectedDate} isToday={d === todayStr}
                  onClick={() => setSelectedDate(d)}
                  hasGames={games.some(g => toTWDate(g.game_date) === d)} />
              ))}
            </div>
          </div>

          {/* 比賽卡片 */}
          {selectedGames.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="font-bold text-lg mb-1">
                {leagueMode === 'CPBL-B' ? '本日無二軍比賽資料' : '本日無 CPBL 比賽資料'}
              </p>
              {leagueMode === 'CPBL-B' && (
                <p className="text-sm mt-1">二軍賽程需由管理後台手動觸發爬蟲更新</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedGames.map(g => (
                <CPBLScoreCard key={g.id} game={g} onClick={() => { const idx = selectedGames.indexOf(g); setSelectedGame(g); setSelectedGameIdx(idx >= 0 ? idx : 0); }} />
              ))}
            </div>
          )}

          {/* 球隊圖例 */}
          <div className="mt-6 flex flex-wrap gap-3">
            {Object.entries(TEAM_CONFIG).map(([name]) => (
              <div key={name} className="flex items-center gap-1.5">
                <TeamBadge name={name} size="xs" />
                <span className="text-xs text-gray-600">{name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── 月賽程 ── */
        <>
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-black">{viewYear} <span className="text-red-600">{monthNames[viewMonth]}</span></h2>
            <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 transition">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`text-center text-sm font-black py-2 ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-700'}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 border-l border-t border-gray-200">
            {cells.map((day, idx) => {
              const dow = idx % 7;
              const dayGames = day ? (gamesByDate[day.toString()] || []) : [];
              const isToday = day !== null &&
                new Date().getFullYear() === viewYear &&
                new Date().getMonth() + 1 === viewMonth &&
                new Date().getDate() === day;
              return (
                <div key={idx} className={`min-h-[100px] border-r border-b border-gray-200 p-1 ${!day ? 'bg-gray-50' : 'bg-white'}`}>
                  {day !== null && (
                    <>
                      <div className={`text-right text-xs font-bold mb-1 ${
                        isToday ? 'text-red-600' : dow === 6 ? 'text-red-400' : dow === 5 ? 'text-blue-400' : 'text-gray-500'
                      }`}>
                        {isToday ? <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5">{day}</span> : day}
                      </div>
                      {dayGames
                        .sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime())
                        .map(g => <GameCell key={g.id} game={g} onClick={() => { setSelectedGame(g); setSelectedGameIdx(0); }} />)}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 場館圖例 */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {VENUE_LEGEND.map(v => (
              <div key={v.name} className="flex items-center gap-1">
                <span className={`w-3 h-3 rounded-sm ${v.color} border border-black/10`}></span>
                <span className="text-xs text-gray-500">{v.name}</span>
              </div>
            ))}
          </div>

          {/* 球隊圖例 */}
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(TEAM_CONFIG).map(([name]) => (
              <div key={name} className="flex items-center gap-1.5">
                <TeamBadge name={name} size="xs" />
                <span className="text-xs text-gray-600">{name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 順位表 */}
      {standings.length > 0 && (
        <div className="mt-8">
          <h3 className="flex items-center gap-2 text-base font-black text-gray-800 mb-3">
            <TrendingUp className="w-4 h-4 text-red-600" />
            2026 例行賽順位
          </h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="px-3 py-2.5 text-center font-bold w-8">名</th>
                  <th className="px-3 py-2.5 text-left font-bold">球隊</th>
                  <th className="px-2 py-2.5 text-center font-bold">試合</th>
                  <th className="px-2 py-2.5 text-center font-bold text-green-700">勝</th>
                  <th className="px-2 py-2.5 text-center font-bold text-red-600">敗</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-400">和</th>
                  <th className="px-2 py-2.5 text-center font-bold">勝率</th>
                  <th className="px-2 py-2.5 text-center font-bold">差</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((r, i) => (
                  <tr key={r.team_name} className={`border-t border-gray-100 transition ${
                    i === 0 ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'
                  }`}>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-gray-300 text-gray-700' :
                        i === 2 ? 'bg-orange-300 text-orange-900' :
                        'bg-gray-100 text-gray-500'
                      }`}>{r.rank}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {teamLogos[r.team_name] && (
                          <img src={teamLogos[r.team_name]} alt={r.team_name} className="w-5 h-5 object-contain flex-shrink-0" />
                        )}
                        <span className="font-black text-gray-800 text-xs">{r.team_name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-500 text-xs tabular-nums">{r.games}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-green-700 text-xs tabular-nums">{r.wins}</td>
                    <td className="px-2 py-2.5 text-center text-red-600 text-xs tabular-nums">{r.losses}</td>
                    <td className="px-2 py-2.5 text-center text-gray-400 text-xs tabular-nums">{r.draws}</td>
                    <td className="px-2 py-2.5 text-center font-mono text-gray-700 text-xs tabular-nums">{Number(r.win_rate).toFixed(3)}</td>
                    <td className="px-2 py-2.5 text-center text-gray-500 text-xs tabular-nums">
                      {r.games_behind === null || r.games_behind === 0 ? (i === 0 ? '–' : '0') : r.games_behind}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 比賽詳情 Modal */}
      {selectedGame && (
        <CPBLGameDetail
          key={selectedGame.id}
          game={selectedGame}
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
      )}

      {/* 名冊 Modal */}
      {rosterTeam && (
        <CPBLRosterModal team={rosterTeam} onClose={() => setRosterTeam(null)} />
      )}
    </div>
  );
};

export default CPBLSchedule;
