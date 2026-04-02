import { useEffect, useRef, useState } from 'react';
import LiveGameText from './LiveGameText';
import { teamLogos } from '../data/staticData';

// ── 球隊設定 ──────────────────────────────────────────────────────────────────

const TEAM_CONFIG: Record<string, { abbr: string; bg: string; color: string }> = {
  '味全龍':  { abbr: 'W', bg: 'bg-pink-500',   color: '#ec4899' },
  '中信兄弟':{ abbr: 'B', bg: 'bg-yellow-500', color: '#eab308' },
  '富邦悍將':{ abbr: 'G', bg: 'bg-blue-600',   color: '#2563eb' },
  '台鋼雄鷹':{ abbr: 'T', bg: 'bg-teal-600',   color: '#0d9488' },
  '樂天桃猿':{ abbr: 'R', bg: 'bg-red-700',    color: '#b91c1c' },
  '統一獅':  { abbr: 'U', bg: 'bg-indigo-700', color: '#4338ca' },
};

const TEAM_CODE_MAP: Record<string, string> = {
  'AJL011': '樂天桃猿', 'AEO011': '富邦悍將', 'ACN011': '中信兄弟',
  'AKP011': '台鋼雄鷹', 'AAA011': '味全龍',   'AJD011': '統一獅',
};

// ── 介面 ──────────────────────────────────────────────────────────────────────

interface CPBLGame {
  id: number;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  game_detail: string | null;
  venue: string | null;
  game_date: string;
}

interface InningRow { inning: number; score_away: number | null; score_home: number | null; }
interface GameStats {
  win_pitcher: string | null; loss_pitcher: string | null; save_pitcher: string | null;
  hits_away: number | null; hits_home: number | null;
  errors_away: number | null; errors_home: number | null;
  attendance: number | null; game_time: string | null;
}
interface BatterRow {
  team_code: string; batting_order: number; player_name: string; position: string | null;
  at_bats: number; hits: number; rbi: number; runs: number;
  home_runs: number; strikeouts: number; walks: number;
  hit_by_pitch: number; sacrifice_hits: number; stolen_bases: number;
  at_bat_results: string[] | null;
}
interface LineupRow {
  team_code: string; is_home: boolean; batting_order: number;
  position: string | null; player_name: string;
}
interface PitcherRow {
  team_code: string; pitcher_order: number | null; player_name: string;
  innings_pitched: string | null; hits_allowed: number; runs_allowed: number;
  earned_runs: number; walks: number; strikeouts: number; pitch_count: number;
  batters_faced: number; home_runs_allowed: number; hit_by_pitch: number;
  balk: number; result: string | null;
}

interface Props {
  game: CPBLGame;
  onClose: () => void;
  standalone?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

type MainTab = 'home' | 'score' | 'pbp' | 'stats';

// ── 球隊徽章 ──────────────────────────────────────────────────────────────────

function TeamBadge({ name, size = 32 }: { name: string; size?: number }) {
  const logo = teamLogos[name];
  if (logo) return (
    <img
      src={logo}
      alt={name}
      className="object-contain flex-shrink-0"
      style={{ width: size, height: size }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
  const cfg = TEAM_CONFIG[name];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-black flex-shrink-0 ${cfg?.bg ?? 'bg-gray-500'}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {cfg?.abbr ?? name.slice(0, 1)}
    </span>
  );
}

// ── BSO 燈號 ──────────────────────────────────────────────────────────────────

function BSOLights({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">B</span>
        {[0, 1, 2].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${
            i < balls ? 'bg-green-400 border-green-300' : 'bg-gray-700 border-gray-600'
          }`} />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">S</span>
        {[0, 1].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${
            i < strikes ? 'bg-yellow-400 border-yellow-300' : 'bg-gray-700 border-gray-600'
          }`} />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">O</span>
        {[0, 1].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${
            i < outs ? 'bg-red-400 border-red-300' : 'bg-gray-700 border-gray-600'
          }`} />
        ))}
      </div>
    </div>
  );
}

// ── 好球帶 ────────────────────────────────────────────────────────────────────

function StrikeZoneOverlay() {
  const size = 22;
  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] text-gray-300 font-bold tracking-wider mb-1.5 text-center">好球帶</div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gap: 1 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ width: size, height: size }}
            className="border border-gray-400/60 bg-white/10 hover:bg-white/20 transition" />
        ))}
      </div>
      <div className="mt-1.5">
        <svg viewBox="0 0 40 14" width="40" height="14">
          <polygon points="20,1 38,1 38,10 20,13 2,10 2,1" fill="#9ca3af" opacity="0.7" />
        </svg>
      </div>
    </div>
  );
}

// ── 球場面板 ──────────────────────────────────────────────────────────────────

function BaseballFieldPanel({ outs }: { outs: number }) {
  return (
    <div className="relative overflow-hidden bg-gray-900" style={{ height: 400 }}>
      <img
        src="/baseball-field.png"
        alt="baseball field"
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-black/25" />

      {/* 壘包（空置）*/}
      {[
        { left: '50%', top: '33%', label: '2B' },
        { left: '15%', top: '45%', label: '3B' },
        { left: '85%', top: '45%', label: '1B' },
      ].map(({ left, top, label }) => (
        <div key={label} className="absolute flex flex-col items-center gap-0.5"
          style={{ left, top, transform: 'translate(-50%, -50%)' }}>
          <div className="w-5 h-5 rounded-sm border-2 shadow bg-white/85 border-gray-300"
            style={{ transform: 'rotate(45deg)' }} />
          <span className="text-[8px] text-white font-black drop-shadow">{label}</span>
        </div>
      ))}

      {/* BSO 燈號 */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-xl">
        <div className="text-[9px] text-gray-400 font-bold tracking-widest text-center mb-1.5">B · S · O</div>
        <BSOLights balls={0} strikes={0} outs={outs} />
      </div>

      {/* 好球帶 */}
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-3 shadow-xl">
        <StrikeZoneOverlay />
      </div>
    </div>
  );
}

// ── 打者陣容 ──────────────────────────────────────────────────────────────────

// ── 打者成績表（與 NPB 同款格式）───────────────────────────────────────────────

function BatterTable({ title, batters, lineups }: { title: string; batters: BatterRow[]; lineups?: LineupRow[] }) {
  const maxResults = Math.max(...batters.map(b => b.at_bat_results?.length ?? 0), 0);
  const inningCols = Array.from({ length: maxResults }, (_, i) => i + 1);

  // 棒次對照表：從先發名單補充（batter stats 若未含棒次時使用）
  const lineupOrderByName: Record<string, number> = {};
  lineups?.forEach(l => { if (l.batting_order > 0) lineupOrderByName[l.player_name] = l.batting_order; });

  return (
    <div>
      <h4 className="font-black text-sm text-gray-700 mb-2 px-1">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-500 text-center">
              <th className="px-1.5 py-1.5 font-bold w-5 sticky left-0 bg-gray-100">#</th>
              <th className="text-left px-2 py-1.5 font-bold sticky left-8 bg-gray-100 whitespace-nowrap">選手</th>
              <th className="px-1.5 py-1.5 font-bold">打率</th>
              <th className="px-1.5 py-1.5 font-bold">打</th>
              <th className="px-1.5 py-1.5 font-bold">分</th>
              <th className="px-1.5 py-1.5 font-bold">安</th>
              <th className="px-1.5 py-1.5 font-bold">本</th>
              <th className="px-1.5 py-1.5 font-bold">打點</th>
              <th className="px-1.5 py-1.5 font-bold">三</th>
              <th className="px-1.5 py-1.5 font-bold">四</th>
              <th className="px-1.5 py-1.5 font-bold">死</th>
              <th className="px-1.5 py-1.5 font-bold">犠</th>
              <th className="px-1.5 py-1.5 font-bold">盗</th>
              {inningCols.map(n => (
                <th key={n} className="px-1.5 py-1.5 font-bold text-gray-400 min-w-[32px]">{n}打</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batters.map((b, i) => {
              const order = b.batting_order || lineupOrderByName[b.player_name] || 0;
              const avg = b.at_bats > 0 ? (b.hits / b.at_bats).toFixed(3) : '.000';
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-1.5 py-1.5 text-center tabular-nums font-bold text-gray-400 sticky left-0 bg-inherit">
                    {order > 0 ? order : ''}
                  </td>
                  <td className="px-2 py-1.5 font-bold text-gray-800 whitespace-nowrap sticky left-8 bg-inherit">
                    {b.position && <span className="text-gray-400 mr-1 font-normal">{b.position}</span>}
                    {b.player_name}
                  </td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-500">{avg}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.at_bats}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.runs}</td>
                  <td className={`px-1.5 py-1.5 text-center tabular-nums font-bold ${b.hits > 0 ? 'text-red-600' : ''}`}>{b.hits}</td>
                  <td className={`px-1.5 py-1.5 text-center tabular-nums font-bold ${b.home_runs > 0 ? 'text-red-600' : ''}`}>{b.home_runs}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.rbi}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.strikeouts}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.walks}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.hit_by_pitch}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.sacrifice_hits}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.stolen_bases}</td>
                  {inningCols.map(n => {
                    const result = b.at_bat_results?.[n - 1] ?? '';
                    const isHr  = result.includes('本');
                    const isHit = !isHr && (result.includes('安') || result.includes('二') || result.includes('三'));
                    return (
                      <td key={n} className="px-1 py-1 text-center whitespace-nowrap">
                        {result ? (
                          <span className={
                            isHr  ? 'inline-block px-1 rounded font-bold text-white bg-red-600' :
                            isHit ? 'inline-block px-1 rounded font-bold text-red-600 bg-red-50' :
                            'text-gray-500'
                          }>{result}</span>
                        ) : (
                          <span className="text-gray-200">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 投手成績表（與 NPB 同款格式）───────────────────────────────────────────────

function parseInnings(ip: string | null): number {
  if (!ip) return 0;
  const [whole, frac] = ip.split('.');
  return parseInt(whole || '0') + (parseInt(frac || '0') / 3);
}

function PitcherTable({ title, pitchers }: { title: string; pitchers: PitcherRow[] }) {
  return (
    <div>
      <h4 className="font-black text-sm text-gray-700 mb-2 px-1">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-500 text-center">
              <th className="text-left px-2 py-1.5 font-bold whitespace-nowrap sticky left-0 bg-gray-100">投手</th>
              <th className="px-1.5 py-1.5 font-bold">防御率</th>
              <th className="px-1.5 py-1.5 font-bold">投球局</th>
              <th className="px-1.5 py-1.5 font-bold">球數</th>
              <th className="px-1.5 py-1.5 font-bold">打者</th>
              <th className="px-1.5 py-1.5 font-bold">被安</th>
              <th className="px-1.5 py-1.5 font-bold">被本</th>
              <th className="px-1.5 py-1.5 font-bold">奪三</th>
              <th className="px-1.5 py-1.5 font-bold">四壞</th>
              <th className="px-1.5 py-1.5 font-bold">觸身</th>
              <th className="px-1.5 py-1.5 font-bold">失分</th>
              <th className="px-1.5 py-1.5 font-bold">自責</th>
              <th className="px-1.5 py-1.5 font-bold">結果</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => {
              const ipNum = parseInnings(p.innings_pitched);
              const era = ipNum > 0 ? ((p.earned_runs / ipNum) * 27).toFixed(2) : '–';
              const resultColor = p.result === '勝' ? 'text-green-600' : p.result === '敗' ? 'text-red-600' : p.result === '救' ? 'text-blue-600' : 'text-gray-500';
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1.5 font-bold text-gray-800 whitespace-nowrap sticky left-0 bg-inherit">{p.player_name}</td>
                  <td className="px-1.5 py-1.5 text-center text-gray-600">{era}</td>
                  <td className="px-1.5 py-1.5 text-center text-gray-700">{p.innings_pitched ?? '–'}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.pitch_count}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.batters_faced}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.hits_allowed}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.home_runs_allowed}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums font-bold text-gray-700">{p.strikeouts}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.walks}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.hit_by_pitch}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.runs_allowed}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.earned_runs}</td>
                  <td className={`px-1.5 py-1.5 text-center font-black ${resultColor}`}>{p.result ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 各局得分表 ────────────────────────────────────────────────────────────────

function InningScoreTable({ innings, stats, awayName, homeName, totalAway, totalHome }: {
  innings: InningRow[];
  stats: GameStats | null;
  awayName: string; homeName: string;
  totalAway: number; totalHome: number;
}) {
  if (innings.length === 0 && !stats) {
    return <p className="text-center py-4 text-gray-400 text-sm">比分資料尚未更新</p>;
  }
  const maxInning = Math.max(innings.length, 9);
  const cols = Array.from({ length: maxInning }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="text-left px-3 py-2 font-bold w-20 text-gray-600">球隊</th>
            {cols.map(n => <th key={n} className="px-2 py-2 font-bold min-w-[28px]">{n}</th>)}
            <th className="px-3 py-2 font-black text-gray-800 border-l border-gray-200">R</th>
            {stats && <>
              <th className="px-2 py-2 font-bold text-gray-500">H</th>
              <th className="px-2 py-2 font-bold text-gray-500">E</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {[
            { name: awayName, getScore: (i: InningRow) => i.score_away, total: totalAway, hits: stats?.hits_away, errors: stats?.errors_away },
            { name: homeName, getScore: (i: InningRow) => i.score_home, total: totalHome, hits: stats?.hits_home, errors: stats?.errors_home },
          ].map((team, rowIdx) => {
            const hasAnyData = innings.some(i => team.getScore(i) !== null);
            return (
            <tr key={rowIdx} className={rowIdx === 0 ? 'border-b border-gray-200' : ''}>
              <td className="text-left px-3 py-2 font-bold text-gray-800">{team.name}</td>
              {cols.map(n => {
                const inn = innings.find(i => i.inning === n);
                const score = inn ? team.getScore(inn) : null;
                return (
                  <td key={n} className="px-2 py-2 tabular-nums text-gray-700">
                    {score !== null && score !== undefined ? score : <span className="text-gray-300">{hasAnyData ? '·' : '–'}</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 font-black text-gray-900 border-l border-gray-200 tabular-nums">{team.total}</td>
              {stats && <>
                <td className="px-2 py-2 text-gray-600 tabular-nums">{team.hits ?? 0}</td>
                <td className="px-2 py-2 text-gray-600 tabular-nums">{team.errors ?? 0}</td>
              </>}
            </tr>
            );
          })}
        </tbody>
      </table>
      {stats && (stats.win_pitcher || stats.loss_pitcher || stats.attendance) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
          {stats.win_pitcher  && <span><span className="text-green-600 font-bold">勝</span> {stats.win_pitcher}</span>}
          {stats.loss_pitcher && <span><span className="text-red-600 font-bold">敗</span> {stats.loss_pitcher}</span>}
          {stats.save_pitcher && <span><span className="text-blue-600 font-bold">救</span> {stats.save_pitcher}</span>}
          {stats.attendance   && <span>觀眾 {stats.attendance.toLocaleString()}人</span>}
          {stats.game_time    && <span>時間 {stats.game_time}</span>}
        </div>
      )}
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

type StatsSubTab = 'batter' | 'pitcher';

const CPBLGameDetail: React.FC<Props> = ({
  game, onClose, standalone = false,
  hasPrev = false, hasNext = false, onPrev, onNext,
}) => {
  const [innings,  setInnings]  = useState<InningRow[]>([]);
  const [stats,    setStats]    = useState<GameStats | null>(null);
  const [batters,  setBatters]  = useState<BatterRow[]>([]);
  const [pitchers, setPitchers] = useState<PitcherRow[]>([]);
  const [lineups,  setLineups]  = useState<LineupRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tab,          setTab]          = useState<MainTab>('score');
  const [statsTab,     setStatsTab]     = useState<StatsSubTab>('batter');
  const [pbpKey,       setPbpKey]       = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLive  = game.status === 'live';
  const isFinal = game.status === 'final';

  const loadData = async () => {
    const [inn, st, bat, lu, pit] = await Promise.all([
      fetch(`/api/v1/games/${game.id}/innings`).then(r => r.json()).catch(() => []),
      fetch(`/api/v1/games/${game.id}/stats`).then(r => r.json()).catch(() => null),
      fetch(`/api/v1/games/${game.id}/batters`).then(r => r.json()).catch(() => []),
      fetch(`/api/v1/games/${game.id}/lineups`).then(r => r.json()).catch(() => []),
      fetch(`/api/v1/games/${game.id}/pitchers`).then(r => r.json()).catch(() => []),
    ]);
    setInnings(Array.isArray(inn) ? inn : []);
    setStats(st);
    setBatters(Array.isArray(bat) ? bat : []);
    setPitchers(Array.isArray(pit) ? pit : []);
    setLineups(Array.isArray(lu) ? lu : []);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    if (isLive) {
      intervalRef.current = setInterval(() => loadData(), 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [game.id]);

  const totalAway = game.score_away ?? innings.reduce((s, i) => s + (i.score_away ?? 0), 0);
  const totalHome = game.score_home ?? innings.reduce((s, i) => s + (i.score_home ?? 0), 0);

  // Split batters by team
  const awayCode = Object.entries(TEAM_CODE_MAP).find(([, name]) => name === game.team_away)?.[0];
  const homeCode = Object.entries(TEAM_CODE_MAP).find(([, name]) => name === game.team_home)?.[0];
  const awayBatters = awayCode
    ? batters.filter(b => b.team_code === awayCode).sort((a, b) => a.batting_order - b.batting_order)
    : batters.slice(0, Math.ceil(batters.length / 2));
  const homeBatters = homeCode
    ? batters.filter(b => b.team_code === homeCode).sort((a, b) => a.batting_order - b.batting_order)
    : batters.slice(Math.ceil(batters.length / 2));

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'home',  label: '首頁' },
    { key: 'score', label: '比分速報' },
    { key: 'pbp',   label: '文字速報' },
    { key: 'stats', label: '成績' },
  ];

  return (
    <div
      className={standalone
        ? 'min-h-screen bg-gray-100'
        : 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4'}
      onClick={standalone ? undefined : onClose}
    >
      <div
        className={standalone
          ? 'max-w-4xl mx-auto bg-white min-h-screen flex flex-col shadow-xl'
          : 'bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[98vh] flex flex-col overflow-hidden'}
        onClick={standalone ? undefined : e => e.stopPropagation()}
      >
        {standalone && (
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition">
              ← 返回
            </button>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await loadData();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-600 disabled:opacity-50 transition"
            >
              {isRefreshing ? '⟳' : '↻'} 更新比分
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="bg-gray-900 text-white px-6 py-3 shrink-0">
          {!standalone && (
            <div className="flex items-center justify-between mb-2">
              <button onClick={onPrev} disabled={!hasPrev}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition px-2 py-1 rounded-lg hover:bg-white/10">
                ← 上一場
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    await loadData();
                    setIsRefreshing(false);
                  }}
                  disabled={isRefreshing}
                  title="更新比分"
                  className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50 transition px-2 py-1 rounded-lg hover:bg-white/10"
                >
                  {isRefreshing ? '⟳' : '↻'} 更新
                </button>
                <button onClick={onClose}
                  className="text-xs font-bold text-gray-400 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/10">
                  ✕ 關閉
                </button>
              </div>
              <button onClick={onNext} disabled={!hasNext}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition px-2 py-1 rounded-lg hover:bg-white/10">
                下一場 →
              </button>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TeamBadge name={game.team_away} size={28} />
              <span className="font-bold text-sm">{game.team_away}</span>
              <span className={`text-2xl font-black tabular-nums leading-none ${
                (isFinal || isLive) && totalAway > totalHome ? 'text-yellow-400' : 'text-white'
              }`}>{isFinal || isLive ? totalAway : '–'}</span>
            </div>
            <div className="text-center px-1">
              {isLive  && <span className="text-xs font-black text-red-400 animate-pulse block">● LIVE</span>}
              {isFinal && <span className="text-xs text-gray-400 block">終了</span>}
              {!isLive && !isFinal && <span className="text-xs text-gray-500 block">vs</span>}
              {game.game_detail && <div className="text-[11px] text-gray-400">{game.game_detail}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black tabular-nums leading-none ${
                (isFinal || isLive) && totalHome > totalAway ? 'text-yellow-400' : 'text-white'
              }`}>{isFinal || isLive ? totalHome : '–'}</span>
              <span className="font-bold text-sm">{game.team_home}</span>
              <TeamBadge name={game.team_home} size={28} />
            </div>
          </div>
          {game.venue && <div className="text-center text-[11px] text-gray-500 mt-1">{game.venue}</div>}
        </div>

        {/* ── 各局得分（固定於 Tab 上方）── */}
        {!loading && (
          <div className="shrink-0 border-b border-gray-200 bg-white">
            <InningScoreTable
              innings={innings} stats={stats}
              awayName={game.team_away} homeName={game.team_home}
              totalAway={totalAway} totalHome={totalHome}
            />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative flex-1 py-2.5 text-sm font-bold transition ${
                tab === key
                  ? 'border-b-2 border-red-600 text-red-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {key === 'pbp' && isLive && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* ── 內容區 ── */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-10 text-gray-400 font-bold">載入中...</div>
          ) : tab === 'home' ? (
            /* 首頁：先發名單 */
            <div className="p-4">
              {lineups.length === 0 ? (
                <p className="text-center py-10 text-gray-400">賽前打序尚未公布</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {[false, true].map(isHome => {
                    const teamName = isHome ? game.team_home : game.team_away;
                    const pitcher = lineups.find(l => l.is_home === isHome && l.batting_order === 0);
                    const batLineup = lineups
                      .filter(l => l.is_home === isHome && l.batting_order > 0)
                      .sort((a, b) => a.batting_order - b.batting_order);
                    return (
                      <div key={String(isHome)}>
                        <div className="flex items-center gap-2 mb-3">
                          <TeamBadge name={teamName} size={20} />
                          <span className="font-black text-sm text-gray-800">{teamName}</span>
                        </div>
                        {pitcher && (
                          <div className="flex items-center gap-2 px-2 py-1.5 mb-2 bg-blue-50 rounded-lg text-xs">
                            <span className="text-blue-500 font-black w-6 text-center">先</span>
                            <span className="text-gray-400 w-6 text-center shrink-0">P</span>
                            <span className="font-bold text-gray-800 flex-1">{pitcher.player_name}</span>
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {batLineup.map(l => (
                            <div key={l.batting_order} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 text-xs">
                              <span className="text-gray-400 font-bold w-4 text-center shrink-0">{l.batting_order}</span>
                              <span className="text-gray-400 w-6 text-center shrink-0 text-[10px]">{l.position || '–'}</span>
                              <span className="font-bold text-gray-800 flex-1 truncate">{l.player_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : tab === 'score' ? (
            /* 比分速報：球場面板 */
            <BaseballFieldPanel outs={isFinal ? 3 : 0} />
          ) : tab === 'pbp' ? (
            /* 文字速報 */
            <div className="p-4">
              <LiveGameText key={pbpKey} gameId={game.id} awayTeam={game.team_away} homeTeam={game.team_home} />
              {isLive && (
                <button
                  onClick={() => setPbpKey(k => k + 1)}
                  className="mt-3 flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 transition"
                >
                  重新整理
                </button>
              )}
            </div>
          ) : (
            /* 成績：打者 / 投手 子選項 */
            <div>
              <div className="flex border-b border-gray-100 bg-gray-50">
                {(['batter', 'pitcher'] as StatsSubTab[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setStatsTab(key)}
                    className={`flex-1 py-2 text-sm font-bold transition ${
                      statsTab === key
                        ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {key === 'batter' ? '打者成績' : '投手成績'}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-6">
                {statsTab === 'batter' ? (
                  <>
                    {awayBatters.length > 0 && <BatterTable title={game.team_away} batters={awayBatters} lineups={lineups.filter(l => !l.is_home)} />}
                    {homeBatters.length > 0 && <BatterTable title={game.team_home} batters={homeBatters} lineups={lineups.filter(l => l.is_home)} />}
                    {awayBatters.length === 0 && homeBatters.length === 0 && (
                      <p className="text-center py-10 text-gray-400 font-bold">打者成績尚未更新</p>
                    )}
                  </>
                ) : (
                  <>
                    {awayCode && pitchers.filter(p => p.team_code === awayCode).length > 0 && (
                      <PitcherTable title={game.team_away} pitchers={pitchers.filter(p => p.team_code === awayCode)} />
                    )}
                    {homeCode && pitchers.filter(p => p.team_code === homeCode).length > 0 && (
                      <PitcherTable title={game.team_home} pitchers={pitchers.filter(p => p.team_code === homeCode)} />
                    )}
                    {pitchers.length === 0 && (
                      <p className="text-center py-10 text-gray-400 font-bold">投手成績尚未更新</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CPBLGameDetail;
