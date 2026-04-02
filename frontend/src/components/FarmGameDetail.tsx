/**
 * FarmGameDetail — 二軍比賽詳情
 * 4 tabs 完全對應一軍：首頁 / 比分速報 / 文字速報 / 成績
 * 資料來源：/api/v1/games/:id/farm-box（局分+打投）, /api/v1/games/:id/play-by-play
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const NPB_LOGO = 'https://p.npb.jp/img/common/logo/2026';

const NAME_TO_CODE: Record<string, string> = {
  '巨人': 'g', 'DeNA': 'db', '阪神': 't', '広島': 'c',
  '中日': 'd', 'ヤクルト': 's', 'ソフトバンク': 'h', '日本ハム': 'f',
  'オリックス': 'b', '楽天': 'e', '西武': 'l', 'ロッテ': 'm',
};

function getCode(name: string) {
  for (const [k, v] of Object.entries(NAME_TO_CODE)) if (name.includes(k)) return v;
  return '';
}

// ── TeamLogo ──────────────────────────────────────────────────────────────────

function TeamLogo({ name, size = 32 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const code = getCode(name);
  if (!code || err) return (
    <span className="inline-flex items-center justify-center rounded-full bg-gray-500 text-white font-black flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {name.slice(0, 2)}
    </span>
  );
  return (
    <img src={`${NPB_LOGO}/logo_${code}_m.gif`} alt={name}
      width={size} height={size} onError={() => setErr(true)} className="flex-shrink-0" />
  );
}

// ── 型別 ──────────────────────────────────────────────────────────────────────

interface FarmBatter  { batting_order?: number; position: string; name: string; ab: number; h: number; rbi: number; bb: number; hbp: number; k: number }
interface FarmPitcher { result: string; name: string; ip: string; batters: number; h: number; bb: number; hbp: number; k: number; er: number }
interface FarmTeam    { name: string; dbName: string; isHome: boolean; batters: FarmBatter[]; pitchers: FarmPitcher[] }
interface FarmInning  { team: string; scores: (number | null)[]; r: number; h: number; e: number }

interface FarmBoxData {
  game: { team_home: string; team_away: string; score_home: number | null; score_away: number | null; status: string; venue: string | null; game_date: string };
  innings: FarmInning[];
  winPitcher: string | null; lossPitcher: string | null; savePitcher: string | null;
  hrText: string | null;
  teams: FarmTeam[];
}

// game_play_by_play table shape (same as NpbGameDetail)
interface FarmPBPEvent {
  inning: number;
  is_top: boolean;
  play_order: number;
  description: string;
}

interface NPBGame {
  id: number; team_home: string; team_away: string;
  score_home: number | null; score_away: number | null;
  status: string; game_date: string; venue: string | null;
  game_detail?: string | null;
}

interface Props {
  game: NPBGame;
  onClose: () => void;
  standalone?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

type MainTab  = 'home' | 'score' | 'pbp' | 'stats';
type StatsTab = 'batter' | 'pitcher';

// ── BSO 燈號 ──────────────────────────────────────────────────────────────────

function BSOLights({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">B</span>
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < balls ? 'bg-green-400 border-green-300' : 'bg-gray-700 border-gray-600'}`} />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">S</span>
        {[0,1,2].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < strikes ? 'bg-yellow-400 border-yellow-300' : 'bg-gray-700 border-gray-600'}`} />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">O</span>
        {[0,1,2].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < outs ? 'bg-red-400 border-red-300' : 'bg-gray-700 border-gray-600'}`} />
        ))}
      </div>
    </div>
  );
}

// ── 好球帶（9 宮格）────────────────────────────────────────────────────────────

function StrikeZoneOverlay() {
  const zones = Array.from({ length: 9 });
  const size = 22;
  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] text-gray-300 font-bold tracking-wider mb-1.5 text-center">好球帶</div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(3, ${size}px)`, gap: 1 }}>
        {zones.map((_, i) => (
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

// ── 棒球場面板（比分速報 tab）────────────────────────────────────────────────

function BaseballFieldPanel({ bases, balls, strikes, outs }: {
  bases: number; balls: number; strikes: number; outs: number;
}) {
  const has1B = (bases & 1) !== 0;
  const has2B = (bases & 2) !== 0;
  const has3B = (bases & 4) !== 0;
  const basePositions = {
    b1: { left: '85%', top: '45%' },
    b2: { left: '50%', top: '33%' },
    b3: { left: '15%', top: '45%' },
  };

  const BaseMarker = ({ active, label }: { active: boolean; label: string }) => (
    <div className="relative flex flex-col items-center gap-0.5">
      {active && <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg shadow-red-500/50 animate-pulse" />}
      <div className={`w-5 h-5 rounded-sm border-2 shadow ${active ? 'bg-yellow-400 border-yellow-200 shadow-yellow-400/50' : 'bg-white/85 border-gray-300'}`}
        style={{ transform: 'rotate(45deg)' }} />
      <span className="text-[8px] text-white font-black drop-shadow">{label}</span>
    </div>
  );

  return (
    <div className="relative overflow-hidden bg-gray-900" style={{ height: 400 }}>
      <img src="/baseball-field.png" alt="baseball field"
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute" style={{ left: basePositions.b2.left, top: basePositions.b2.top, transform: 'translate(-50%, -50%)' }}>
        <BaseMarker active={has2B} label="2B" />
      </div>
      <div className="absolute" style={{ left: basePositions.b3.left, top: basePositions.b3.top, transform: 'translate(-50%, -50%)' }}>
        <BaseMarker active={has3B} label="3B" />
      </div>
      <div className="absolute" style={{ left: basePositions.b1.left, top: basePositions.b1.top, transform: 'translate(-50%, -50%)' }}>
        <BaseMarker active={has1B} label="1B" />
      </div>
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-xl">
        <div className="text-[9px] text-gray-400 font-bold tracking-widest text-center mb-1.5">B · S · O</div>
        <BSOLights balls={balls} strikes={strikes} outs={outs} />
      </div>
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-3 shadow-xl">
        <StrikeZoneOverlay />
      </div>
    </div>
  );
}

// ── 局分表（固定於 Tab 上方）──────────────────────────────────────────────────

function FarmInningTable({ innings, awayName, homeName, winPitcher, lossPitcher, savePitcher, hrText }: {
  innings: FarmInning[];
  awayName: string; homeName: string;
  winPitcher: string | null; lossPitcher: string | null; savePitcher: string | null;
  hrText: string | null;
}) {
  if (innings.length === 0) return <p className="text-center py-4 text-gray-400 text-sm">比分資料尚未更新</p>;

  const awayRow = innings.find(r => r.team.includes(awayName.slice(0, 2))) ?? innings[0];
  const homeRow = innings.find(r => r.team.includes(homeName.slice(0, 2))) ?? innings[1];
  const maxInning = Math.max(awayRow?.scores.length ?? 0, homeRow?.scores.length ?? 0, 9);
  const cols = Array.from({ length: maxInning }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500">
            <th className="text-left px-3 py-2 font-bold w-20 text-gray-600">球隊</th>
            {cols.map(n => <th key={n} className="px-2 py-2 font-bold min-w-[28px]">{n}</th>)}
            <th className="px-3 py-2 font-black text-gray-800 border-l border-gray-200">R</th>
            <th className="px-2 py-2 font-bold text-gray-500">H</th>
            <th className="px-2 py-2 font-bold text-gray-500">E</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: awayName, row: awayRow },
            { label: homeName, row: homeRow },
          ].map(({ label, row }, ri) => (
            <tr key={ri} className={ri === 0 ? 'border-b border-gray-200' : ''}>
              <td className="text-left px-3 py-2 font-bold text-gray-800">{label}</td>
              {cols.map(n => {
                const s = row?.scores[n - 1];
                return (
                  <td key={n} className="px-2 py-2 tabular-nums text-gray-700">
                    {s !== null && s !== undefined ? s : <span className="text-gray-300">·</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 font-black text-gray-900 border-l border-gray-200 tabular-nums">{row?.r ?? 0}</td>
              <td className="px-2 py-2 text-gray-600 tabular-nums">{row?.h ?? 0}</td>
              <td className="px-2 py-2 text-gray-600 tabular-nums">{row?.e ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(winPitcher || lossPitcher || hrText) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
          {winPitcher  && <span><span className="text-green-600 font-bold">勝</span> {winPitcher}</span>}
          {lossPitcher && <span><span className="text-red-600 font-bold">敗</span> {lossPitcher}</span>}
          {savePitcher && <span><span className="text-blue-600 font-bold">救</span> {savePitcher}</span>}
          {hrText && <span>💥 {hrText}</span>}
        </div>
      )}
    </div>
  );
}

// ── 先発投手カード ──────────────────────────────────────────────────────────────

function StarterCard({ label, name }: { label: string; name: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
      <div className="text-[10px] text-gray-400 font-bold mb-1.5 tracking-wide">先発投手 · {label}</div>
      <div className="font-black text-gray-800">{name || '未定'}</div>
    </div>
  );
}

// ── 打撃陣容 ──────────────────────────────────────────────────────────────────

function FarmLineupPanel({ name, batters }: { name: string; batters: FarmBatter[] }) {
  if (batters.length === 0) return <div className="text-center py-6 text-gray-400 text-xs">打者資料尚未更新</div>;
  return (
    <div>
      <div className="font-black text-xs text-gray-700 mb-2 px-1">{name}</div>
      <div className="space-y-0.5">
        {batters.map((b, i) => {
          const avg = b.ab > 0 ? (b.h / b.ab).toFixed(3) : '.---';
          return (
            <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-gray-50 text-xs">
              <span className="text-gray-400 font-bold w-8 text-center shrink-0 text-[10px]">{b.position || '–'}</span>
              <span className="font-bold text-gray-800 flex-1 truncate text-[11px]">{b.name}</span>
              <span className="text-gray-500 tabular-nums text-[11px] shrink-0">{avg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 文字速報 ──────────────────────────────────────────────────────────────────

function FarmPlayByPlay({ events, awayName, homeName }: {
  events: FarmPBPEvent[];
  awayName: string; homeName: string;
}) {
  const grouped: Map<string, FarmPBPEvent[]> = new Map();
  for (const e of events) {
    const key = `${e.inning}-${e.is_top}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div>
      {[...grouped.entries()].reverse().map(([key, plays]) => {
        const [inningStr, isTopStr] = key.split('-');
        const inning = parseInt(inningStr);
        const isTop  = isTopStr === 'true';
        return (
          <div key={key} className="border-b border-gray-100 last:border-0">
            <div className={`px-4 py-1.5 text-xs font-bold sticky top-0 ${
              isTop ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {inning}回{isTop ? '表' : '裏'}（{isTop ? awayName : homeName}攻）
            </div>
            <ol className="divide-y divide-gray-50">
              {[...plays].reverse().map((p, i) => (
                <li key={i} className="px-4 py-2 text-sm text-gray-700 leading-relaxed">
                  <span className="text-gray-300 mr-1.5 text-xs tabular-nums">{p.play_order}.</span>
                  {p.description}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

// ── 打者成績表 ────────────────────────────────────────────────────────────────

function FarmBatterTable({ title, batters }: { title: string; batters: FarmBatter[] }) {
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
              <th className="px-1.5 py-1.5 font-bold">安</th>
              <th className="px-1.5 py-1.5 font-bold">打点</th>
              <th className="px-1.5 py-1.5 font-bold">四球</th>
              <th className="px-1.5 py-1.5 font-bold">死球</th>
              <th className="px-1.5 py-1.5 font-bold">三振</th>
            </tr>
          </thead>
          <tbody>
            {batters.map((b, i) => {
              const avg = b.ab > 0 ? (b.h / b.ab).toFixed(3) : '.000';
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-1.5 py-1.5 text-center tabular-nums font-bold text-gray-400 sticky left-0 bg-inherit">
                    {b.batting_order || ''}
                  </td>
                  <td className="px-2 py-1.5 font-bold text-gray-800 whitespace-nowrap sticky left-8 bg-inherit">
                    {b.position && <span className="text-gray-400 mr-1 font-normal">{b.position}</span>}
                    {b.name}
                  </td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-500">{avg}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.ab}</td>
                  <td className={`px-1.5 py-1.5 text-center tabular-nums font-bold ${b.h > 0 ? 'text-red-600' : ''}`}>{b.h}</td>
                  <td className={`px-1.5 py-1.5 text-center tabular-nums ${b.rbi > 0 ? 'font-bold' : ''}`}>{b.rbi}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-600">{b.bb}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-600">{b.hbp}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-600">{b.k}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 投手成績表 ────────────────────────────────────────────────────────────────

function FarmPitcherTable({ title, pitchers }: { title: string; pitchers: FarmPitcher[] }) {
  return (
    <div>
      <h4 className="font-black text-sm text-gray-700 mb-2 px-1">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-500 text-center">
              <th className="text-left px-2 py-1.5 font-bold whitespace-nowrap">投手</th>
              <th className="px-1.5 py-1.5 font-bold">投球回</th>
              <th className="px-1.5 py-1.5 font-bold">打者</th>
              <th className="px-1.5 py-1.5 font-bold">被安</th>
              <th className="px-1.5 py-1.5 font-bold">与四</th>
              <th className="px-1.5 py-1.5 font-bold">与死</th>
              <th className="px-1.5 py-1.5 font-bold">奪三</th>
              <th className="px-1.5 py-1.5 font-bold">自責</th>
              <th className="px-1.5 py-1.5 font-bold">結果</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1.5 font-bold text-gray-800 whitespace-nowrap">{p.name}</td>
                <td className="px-1.5 py-1.5 text-center text-gray-700">{p.ip}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.batters}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.h}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.bb}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.hbp}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums font-bold text-gray-700">{p.k}</td>
                <td className={`px-1.5 py-1.5 text-center tabular-nums font-bold ${p.er > 0 ? 'text-red-600' : 'text-gray-700'}`}>{p.er}</td>
                <td className="px-1.5 py-1.5 text-center font-black text-sm">
                  {p.result === '○' ? <span className="text-green-600">勝</span>
                  : p.result === '●' ? <span className="text-red-600">敗</span>
                  : p.result === 'Ｓ' || p.result === 'S' ? <span className="text-blue-600">S</span>
                  : <span className="text-gray-300">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export default function FarmGameDetail({ game, onClose, standalone = false, onPrev, onNext, hasPrev = false, hasNext = false }: Props) {
  const [data,         setData]         = useState<FarmBoxData | null>(null);
  const [pbp,          setPbp]          = useState<FarmPBPEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState('');
  const [tab,          setTab]          = useState<MainTab>('score');
  const [statsTab,     setStatsTab]     = useState<StatsTab>('batter');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLive  = game.status === 'live';
  const isFinal = game.status === 'final';

  const loadAll = async () => {
    const [boxRes, pbpRes] = await Promise.all([
      fetch(`/api/v1/games/${game.id}/farm-box`),
      fetch(`/api/v1/npb/games/${game.id}/playbyplay`),
    ]);
    const boxJson = await boxRes.json();
    const pbpJson = await pbpRes.json();

    if (boxJson.message) {
      setError(boxJson.message);
    } else {
      setData(boxJson as FarmBoxData);
    }
    if (Array.isArray(pbpJson)) {
      setPbp(pbpJson as FarmPBPEvent[]);
    }
  };

  useEffect(() => {
    setLoading(true); setError('');
    loadAll()
      .catch(() => setError('無法取得比賽詳情'))
      .finally(() => setLoading(false));

    if (isLive) {
      intervalRef.current = setInterval(() => loadAll().catch(() => {}), 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [game.id]);

  const totalAway = game.score_away ?? 0;
  const totalHome = game.score_home ?? 0;

  const awayTeam = data?.teams.find(t => !t.isHome) ?? data?.teams[1];
  const homeTeam = data?.teams.find(t => t.isHome)  ?? data?.teams[0];
  const awayName = game.team_away;
  const homeName = game.team_home;

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'home',  label: '首頁' },
    { key: 'score', label: '比分速報' },
    { key: 'pbp',   label: '文字速報' },
    { key: 'stats', label: '成績' },
  ];

  return (
    <div
      className={standalone
        ? "min-h-screen bg-gray-100"
        : "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"}
      onClick={standalone ? undefined : onClose}
    >
      <div
        className={standalone
          ? "max-w-4xl mx-auto bg-white min-h-screen flex flex-col shadow-xl"
          : "bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[98vh] flex flex-col overflow-hidden"}
        onClick={standalone ? undefined : (e => e.stopPropagation())}
      >
        {standalone && (
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition">
              ← 返回
            </button>
            <button
              onClick={async () => { setIsRefreshing(true); await loadAll().catch(() => {}); setIsRefreshing(false); }}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-600 disabled:opacity-50 transition"
            >
              {isRefreshing ? '⟳' : '↻'} 更新比分
            </button>
          </div>
        )}

        {/* ── Header（暗色，沿用一軍）── */}
        <div className="bg-gray-900 text-white px-6 py-3 shrink-0">
          {!standalone && (onPrev || onNext) && (
            <div className="flex items-center justify-between mb-2">
              <button onClick={onPrev} disabled={!hasPrev}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition px-2 py-1 rounded-lg hover:bg-white/10">
                ← 上一場
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => { setIsRefreshing(true); await loadAll().catch(() => {}); setIsRefreshing(false); }}
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
          {!standalone && !onPrev && !onNext && (
            <div className="flex justify-end mb-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => { setIsRefreshing(true); await loadAll().catch(() => {}); setIsRefreshing(false); }}
                  disabled={isRefreshing}
                  className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50 transition px-2 py-1 rounded-lg hover:bg-white/10"
                >
                  {isRefreshing ? '⟳' : '↻'} 更新
                </button>
                <button onClick={onClose}
                  className="text-xs font-bold text-gray-400 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/10">
                  ✕ 關閉
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TeamLogo name={awayName} size={28} />
              <span className="font-bold text-sm">{awayName}</span>
              <span className={`text-2xl font-black tabular-nums leading-none ${
                (isFinal || isLive) && totalAway > totalHome ? 'text-yellow-400' : 'text-white'
              }`}>
                {isFinal || isLive ? totalAway : '–'}
              </span>
            </div>
            <div className="text-center px-1">
              {isLive  && <span className="text-xs font-black text-red-400 animate-pulse block">● LIVE</span>}
              {isFinal && <span className="text-xs text-gray-400 block">終了</span>}
              {!isLive && !isFinal && <span className="text-xs text-gray-500 block">vs</span>}
              <span className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded font-bold">ファーム</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black tabular-nums leading-none ${
                (isFinal || isLive) && totalHome > totalAway ? 'text-yellow-400' : 'text-white'
              }`}>
                {isFinal || isLive ? totalHome : '–'}
              </span>
              <span className="font-bold text-sm">{homeName}</span>
              <TeamLogo name={homeName} size={28} />
            </div>
          </div>
          {game.venue && (
            <div className="text-center text-[11px] text-gray-500 mt-1">{game.venue}</div>
          )}
        </div>

        {/* ── 局分表（固定於 Tab 上方）── */}
        {!loading && data && (
          <div className="shrink-0 border-b border-gray-200 bg-white">
            <FarmInningTable
              innings={data.innings}
              awayName={awayName} homeName={homeName}
              winPitcher={data.winPitcher} lossPitcher={data.lossPitcher}
              savePitcher={data.savePitcher} hrText={data.hrText}
            />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative flex-1 py-2.5 text-sm font-bold transition ${
                tab === key ? 'border-b-2 border-red-600 text-red-600 bg-white' : 'text-gray-500 hover:text-gray-700'
              }`}>
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
            <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-bold">載入中...</span>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              {game.status === 'scheduled' ? (
                <>
                  <p className="text-3xl mb-3">⚾</p>
                  <p className="font-bold text-gray-600 mb-1">比賽尚未開始</p>
                  <p className="text-xs text-gray-400">比賽結束後將自動更新成績詳情</p>
                </>
              ) : game.status === 'live' ? (
                <>
                  <p className="text-3xl mb-3">📡</p>
                  <p className="font-bold text-gray-600 mb-1">比賽進行中</p>
                  <p className="text-xs text-gray-400">二軍詳細成績將於賽後更新</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-gray-500 mb-1">比賽詳情暫不可用</p>
                  <p className="text-xs text-gray-400">{error}</p>
                </>
              )}
            </div>

          ) : tab === 'home' ? (
            /* ── 首頁：先発投手 + 打撃陣容 ── */
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <StarterCard label={awayName} name={awayTeam?.pitchers[0]?.name ?? '未定'} />
                <StarterCard label={homeName} name={homeTeam?.pitchers[0]?.name ?? '未定'} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <FarmLineupPanel name={awayName} batters={awayTeam?.batters ?? []} />
                <FarmLineupPanel name={homeName} batters={homeTeam?.batters ?? []} />
              </div>
            </div>

          ) : tab === 'score' ? (
            /* ── 比分速報：棒球場 + BSO ── */
            <BaseballFieldPanel
              bases={0} balls={0} strikes={0}
              outs={isFinal ? 3 : 0}
            />

          ) : tab === 'pbp' ? (
            /* ── 文字速報 ── */
            pbp.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">速報資料尚未更新</div>
            ) : (
              <FarmPlayByPlay events={pbp} awayName={awayName} homeName={homeName} />
            )

          ) : (
            /* ── 成績：打者 / 投手 子選項 ── */
            <div>
              <div className="flex border-b border-gray-100 bg-gray-50">
                {(['batter', 'pitcher'] as StatsTab[]).map(k => (
                  <button key={k} onClick={() => setStatsTab(k)}
                    className={`flex-1 py-2 text-sm font-bold transition ${
                      statsTab === k ? 'border-b-2 border-blue-500 text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {k === 'batter' ? '打者成績' : '投手成績'}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-6">
                {statsTab === 'batter' ? (
                  <>
                    {awayTeam && awayTeam.batters.length > 0 && <FarmBatterTable title={awayName} batters={awayTeam.batters} />}
                    {homeTeam && homeTeam.batters.length > 0 && <FarmBatterTable title={homeName} batters={homeTeam.batters} />}
                    {(!awayTeam?.batters.length && !homeTeam?.batters.length) && (
                      <p className="text-center py-10 text-gray-400 font-bold">打者成績尚未更新</p>
                    )}
                  </>
                ) : (
                  <>
                    {awayTeam && awayTeam.pitchers.length > 0 && <FarmPitcherTable title={awayName} pitchers={awayTeam.pitchers} />}
                    {homeTeam && homeTeam.pitchers.length > 0 && <FarmPitcherTable title={homeName} pitchers={homeTeam.pitchers} />}
                    {(!awayTeam?.pitchers.length && !homeTeam?.pitchers.length) && (
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
}
