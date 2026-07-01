import { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import {
  getMLBBoxscore, getMLBLinescore, getMLBPlayByPlay, getMLBContent,
  MLB_TEAM_ZH, type MLBGame, type MLBBoxscore, type MLBPlay, type MLBContent,
} from '../api/mlb';

// ── 球隊顏色 ────────────────────────────────────────────────────────────────
const TEAM_COLORS: Record<string, string> = {
  NYY: '#003087', BOS: '#BD3039', TOR: '#134A8E', TB: '#092C5C', BAL: '#DF4601',
  CLE: '#E31937', MIN: '#002B5C', DET: '#0C2340', CWS: '#27251F', KC: '#004687',
  HOU: '#002D62', LAA: '#BA0021', SEA: '#005C5C', ATH: '#003831', TEX: '#003278',
  ATL: '#CE1141', NYM: '#002D72', PHI: '#E81828', MIA: '#00A3E0', WSH: '#AB0003',
  MIL: '#FFC52F', CHC: '#0E3386', CIN: '#C6011F', STL: '#C41E3A', PIT: '#FDB827',
  LAD: '#005A9C', SF: '#FD5A1E', SD: '#2F241D', AZ: '#A71930', COL: '#333366',
};

interface Props {
  game: MLBGame;
  onClose: () => void;
}

type MainTab = 'home' | 'score' | 'pbp' | 'stats';

// ── 球隊徽章（顏色圓圈 + 縮寫）────────────────────────────────────────────
function TeamBadge({ abbr, size = 36 }: { abbr: string; size?: number }) {
  const color = TEAM_COLORS[abbr] ?? '#374151';
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-black flex-shrink-0 shadow"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.3) }}
    >
      {abbr.slice(0, 2)}
    </div>
  );
}

// ── BSO 燈號（與 NPB 相同）─────────────────────────────────────────────────
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

// ── 棒球場面板 ──────────────────────────────────────────────────────────────
function BaseballFieldPanel({
  balls, strikes, outs,
  has1B, has2B, has3B,
  runner1, runner2, runner3,
  pitcherName, batterName,
  isFinal,
}: {
  balls: number; strikes: number; outs: number;
  has1B: boolean; has2B: boolean; has3B: boolean;
  runner1?: string; runner2?: string; runner3?: string;
  pitcherName?: string; batterName?: string;
  isFinal: boolean;
}) {
  const basePositions = {
    b1: { left: '85%', top: '45%' },
    b2: { left: '50%', top: '33%' },
    b3: { left: '15%', top: '45%' },
  };

  const BaseMarker = ({ active, runner }: { active: boolean; runner?: string }) => (
    <div className="flex flex-col items-center gap-0.5">
      {active && runner && (
        <div className="mb-0.5 bg-black/85 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow border border-yellow-400/30">
          {runner}
        </div>
      )}
      <div
        className={`w-5 h-5 rounded-sm border-2 shadow ${
          active ? 'bg-yellow-400 border-yellow-200 shadow-yellow-400/50' : 'bg-white/85 border-gray-300'
        }`}
        style={{ transform: 'rotate(45deg)' }}
      />
    </div>
  );

  return (
    <div className="relative overflow-hidden bg-gray-900" style={{ height: 360 }}>
      <img
        src="/baseball-field.png"
        alt="baseball field"
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* 壘包 */}
      <div className="absolute" style={{ left: basePositions.b2.left, top: basePositions.b2.top, transform: 'translate(-50%, -50%)' }}>
        <BaseMarker active={has2B} runner={runner2} />
      </div>
      <div className="absolute" style={{ left: basePositions.b3.left, top: basePositions.b3.top, transform: 'translate(-50%, -50%)' }}>
        <BaseMarker active={has3B} runner={runner3} />
      </div>
      <div className="absolute" style={{ left: basePositions.b1.left, top: basePositions.b1.top, transform: 'translate(-50%, -50%)' }}>
        <BaseMarker active={has1B} runner={runner1} />
      </div>

      {/* BSO 燈號（左下）*/}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-xl">
        <div className="text-[9px] text-gray-400 font-bold tracking-widest text-center mb-1.5">B · S · O</div>
        <BSOLights balls={balls} strikes={strikes} outs={isFinal ? 3 : outs} />
      </div>

      {/* 投手資訊（中央）*/}
      {pitcherName && !isFinal && (
        <div className="absolute bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 shadow-xl text-center"
          style={{ left: '50%', top: '58%', transform: 'translate(-50%, -50%)' }}>
          <div className="text-[9px] text-gray-400 font-bold tracking-wide mb-0.5">投手</div>
          <div className="text-white font-black text-sm">{pitcherName.split(' ').slice(-1)[0]}</div>
        </div>
      )}

      {/* 打者資訊（下中央）*/}
      {batterName && !isFinal && (
        <div className="absolute bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 shadow-xl text-center"
          style={{ left: '50%', bottom: '16px', transform: 'translateX(-50%)' }}>
          <div className="text-[9px] text-gray-400 font-bold tracking-wide mb-0.5">打者</div>
          <div className="text-white font-black text-sm">{batterName.split(' ').slice(-1)[0]}</div>
        </div>
      )}

      {/* 終場 overlay */}
      {isFinal && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/70 rounded-2xl px-8 py-4 text-center">
            <div className="text-white font-black text-2xl">終場</div>
            <div className="text-gray-400 text-sm mt-1">Final</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 局分表 ─────────────────────────────────────────────────────────────────
function InningScoreTable({ innings, lsTeams, awayAbbr, homeAbbr }: {
  innings: any[]; lsTeams: any; awayAbbr: string; homeAbbr: string;
}) {
  if (!innings.length) return null;
  return (
    <div className="overflow-x-auto border-b border-gray-100">
      <table className="w-full text-center text-xs min-w-[420px]">
        <thead>
          <tr className="text-gray-400 font-bold border-b border-gray-100 bg-gray-50">
            <th className="text-left py-2 pl-3 w-14">球隊</th>
            {innings.map((inn: any) => (
              <th key={inn.num} className="py-2 px-1 w-7">{inn.num}</th>
            ))}
            <th className="py-2 px-2 font-black text-gray-700">R</th>
            <th className="py-2 px-2 font-black text-gray-700">H</th>
            <th className="py-2 px-2 font-black text-gray-700">E</th>
          </tr>
        </thead>
        <tbody>
          {([
            { abbr: awayAbbr, side: 'away' },
            { abbr: homeAbbr, side: 'home' },
          ] as const).map(({ abbr, side }) => (
            <tr key={side} className="border-b border-gray-50">
              <td className="text-left py-2.5 pl-3 font-black text-gray-800 text-xs">{abbr}</td>
              {innings.map((inn: any) => (
                <td key={inn.num} className="py-2.5 px-1 text-gray-600">
                  {inn[side]?.runs ?? (inn[side]?.runs === 0 ? '0' : '·')}
                </td>
              ))}
              <td className="py-2.5 px-2 font-black text-gray-900">{lsTeams?.[side]?.runs ?? '-'}</td>
              <td className="py-2.5 px-2 text-gray-600">{lsTeams?.[side]?.hits ?? '-'}</td>
              <td className="py-2.5 px-2 text-gray-400">{lsTeams?.[side]?.errors ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 打擊成績表 ─────────────────────────────────────────────────────────────
function BatterTable({ side, label }: { side: MLBBoxscore['away'] | undefined; label: string }) {
  if (!side || side.batters.length === 0)
    return <p className="text-center text-gray-400 py-6 text-xs">無打擊資料</p>;
  return (
    <div>
      <h4 className="font-black text-xs text-gray-700 mb-2 px-1">{label} — 打擊成績</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[420px]">
          <thead>
            <tr className="text-gray-400 font-bold border-b border-gray-100 bg-gray-50">
              <th className="text-left py-1.5 pl-2">球員</th>
              <th className="py-1.5 px-1.5 text-center">守</th>
              <th className="py-1.5 px-1.5 text-center">AB</th>
              <th className="py-1.5 px-1.5 text-center">R</th>
              <th className="py-1.5 px-1.5 text-center">H</th>
              <th className="py-1.5 px-1.5 text-center">HR</th>
              <th className="py-1.5 px-1.5 text-center">RBI</th>
              <th className="py-1.5 px-1.5 text-center">BB</th>
              <th className="py-1.5 px-1.5 text-center">K</th>
              <th className="py-1.5 px-1.5 text-center">打率</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map(b => (
              <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 pl-2 font-bold text-gray-800">{b.name}</td>
                <td className="py-1.5 px-1.5 text-center text-gray-500">{b.position}</td>
                <td className="py-1.5 px-1.5 text-center">{b.ab}</td>
                <td className="py-1.5 px-1.5 text-center">{b.r}</td>
                <td className="py-1.5 px-1.5 text-center font-bold text-gray-800">{b.h}</td>
                <td className="py-1.5 px-1.5 text-center">{b.hr || '-'}</td>
                <td className="py-1.5 px-1.5 text-center">{b.rbi}</td>
                <td className="py-1.5 px-1.5 text-center">{b.bb}</td>
                <td className="py-1.5 px-1.5 text-center">{b.so}</td>
                <td className="py-1.5 px-1.5 text-center text-gray-500">{b.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 投手成績表 ─────────────────────────────────────────────────────────────
function PitcherTable({ side, label }: { side: MLBBoxscore['away'] | undefined; label: string }) {
  if (!side || side.pitchers.length === 0) return null;
  return (
    <div>
      <h4 className="font-black text-xs text-gray-700 mb-2 px-1">{label} — 投手成績</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[380px]">
          <thead>
            <tr className="text-gray-400 font-bold border-b border-gray-100 bg-gray-50">
              <th className="text-left py-1.5 pl-2">球員</th>
              <th className="py-1.5 px-1.5 text-center">IP</th>
              <th className="py-1.5 px-1.5 text-center">H</th>
              <th className="py-1.5 px-1.5 text-center">R</th>
              <th className="py-1.5 px-1.5 text-center">ER</th>
              <th className="py-1.5 px-1.5 text-center">BB</th>
              <th className="py-1.5 px-1.5 text-center">K</th>
              <th className="py-1.5 px-1.5 text-center">HR</th>
              <th className="py-1.5 px-1.5 text-center">ERA</th>
            </tr>
          </thead>
          <tbody>
            {side.pitchers.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1.5 pl-2 font-bold text-gray-800">
                  {p.name}
                  {p.note && <span className="ml-1 text-[10px] font-black text-red-500">{p.note}</span>}
                </td>
                <td className="py-1.5 px-1.5 text-center font-bold">{p.ip}</td>
                <td className="py-1.5 px-1.5 text-center">{p.h}</td>
                <td className="py-1.5 px-1.5 text-center">{p.r}</td>
                <td className="py-1.5 px-1.5 text-center">{p.er}</td>
                <td className="py-1.5 px-1.5 text-center">{p.bb}</td>
                <td className="py-1.5 px-1.5 text-center">{p.so}</td>
                <td className="py-1.5 px-1.5 text-center">{p.hr || '-'}</td>
                <td className="py-1.5 px-1.5 text-center text-gray-500">{p.era}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 主元件 ─────────────────────────────────────────────────────────────────
export default function MLBGameDetail({ game, onClose }: Props) {
  const [tab, setTab] = useState<MainTab>('score');
  const [boxscore, setBoxscore] = useState<MLBBoxscore | null>(null);
  const [linescore, setLinescore] = useState<any>(null);
  const [plays, setPlays] = useState<{ allPlays: MLBPlay[]; scoringPlays: MLBPlay[] } | null>(null);
  const [content, setContent] = useState<MLBContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const awayAbbr = game.teams.away.team.abbreviation;
  const homeAbbr = game.teams.home.team.abbreviation;
  const awayZh = MLB_TEAM_ZH[awayAbbr] ?? game.teams.away.team.name;
  const homeZh = MLB_TEAM_ZH[homeAbbr] ?? game.teams.home.team.name;
  const isFinal = game.status.abstractGameState === 'Final';
  const isLive = game.status.abstractGameState === 'Live';
  const gameTime = new Date(game.gameDate).toLocaleTimeString('zh-TW', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  });

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [box, ls, pbp, cnt] = await Promise.all([
        getMLBBoxscore(game.gamePk),
        getMLBLinescore(game.gamePk),
        getMLBPlayByPlay(game.gamePk).catch(() => null),
        getMLBContent(game.gamePk).catch(() => null),
      ]);
      setBoxscore(box);
      setLinescore(ls);
      if (pbp) setPlays(pbp);
      if (cnt) setContent(cnt);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isLive) interval = setInterval(() => load(true), 30_000);
    return () => { if (interval) clearInterval(interval); };
  }, [game.gamePk]);

  // 從 linescore 取得局分 / BSO / 壘上 / 投打資訊
  const innings = linescore?.innings ?? [];
  const lsTeams = linescore?.teams ?? { away: {}, home: {} };
  const offense = linescore?.offense ?? {};
  const defense = linescore?.defense ?? {};

  const balls   = linescore?.balls   ?? 0;
  const strikes = linescore?.strikes ?? 0;
  const outs    = linescore?.outs    ?? 0;
  const has1B   = !!offense?.first;
  const has2B   = !!offense?.second;
  const has3B   = !!offense?.third;
  const runner1 = offense?.first?.fullName as string | undefined;
  const runner2 = offense?.second?.fullName as string | undefined;
  const runner3 = offense?.third?.fullName as string | undefined;

  // 投手：優先使用 linescore defense.pitcher，其次 boxscore 最後一位投手
  const livePitcherName: string | undefined =
    defense?.pitcher?.fullName ??
    boxscore?.home.pitchers[boxscore.home.pitchers.length - 1]?.name;
  // 打者：linescore offense.batter
  const liveBatterName: string | undefined = offense?.batter?.fullName;

  // 分數
  const awayScore = game.teams.away.score ?? 0;
  const homeScore = game.teams.home.score ?? 0;

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'home',  label: '首頁' },
    { key: 'score', label: '比分速報' },
    { key: 'pbp',   label: '文字速報' },
    { key: 'stats', label: '成績' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gray-900 text-white px-5 py-4 shrink-0">
          {/* 關閉 + 更新按鈕 */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 置中：客隊 分數 vs/狀態 分數 主隊 */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {/* 客隊 */}
            <div className="flex items-center gap-2">
              <TeamBadge abbr={awayAbbr} size={32} />
              <div className="text-right">
                <div className="text-xs text-gray-400 font-bold">{awayZh}</div>
              </div>
              <span className={`text-3xl font-black tabular-nums leading-none ml-1 ${
                isFinal && awayScore > homeScore ? 'text-yellow-400' : 'text-white'
              }`}>
                {(isLive || isFinal) ? awayScore : '–'}
              </span>
            </div>

            {/* 中間狀態 */}
            <div className="text-center min-w-[56px]">
              {isLive && (
                <div className="text-xs font-black text-red-400 animate-pulse flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </div>
              )}
              {isLive && linescore?.currentInningOrdinal && (
                <div className="text-[11px] text-gray-300 mt-0.5">
                  {linescore.inningHalf === 'Top' ? '上' : '下'}{linescore.currentInning}局
                </div>
              )}
              {isFinal && <div className="text-sm text-gray-400 font-bold">終了</div>}
              {!isLive && !isFinal && <div className="text-sm text-gray-500">vs</div>}
              {!isLive && !isFinal && (
                <div className="text-[10px] text-gray-500 mt-0.5">{gameTime}</div>
              )}
            </div>

            {/* 主隊 */}
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black tabular-nums leading-none mr-1 ${
                isFinal && homeScore > awayScore ? 'text-yellow-400' : 'text-white'
              }`}>
                {(isLive || isFinal) ? homeScore : '–'}
              </span>
              <div>
                <div className="text-xs text-gray-400 font-bold">{homeZh}</div>
                <div className="text-[10px] text-gray-500">主場</div>
              </div>
              <TeamBadge abbr={homeAbbr} size={32} />
            </div>
          </div>

          {/* 場館 */}
          {game.venue && (
            <div className="text-center text-[11px] text-gray-500 mt-2">{game.venue}</div>
          )}

          {/* 勝負投手 */}
          {isFinal && game.decisions && (
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 mt-2">
              {game.decisions.winner && <span>勝 {game.decisions.winner.fullName}</span>}
              {game.decisions.loser && <span>敗 {game.decisions.loser.fullName}</span>}
              {game.decisions.save && <span>救援 {game.decisions.save.fullName}</span>}
            </div>
          )}
        </div>

        {/* ── 局分表（固定於 Tab 上方）── */}
        {!loading && innings.length > 0 && (
          <InningScoreTable
            innings={innings}
            lsTeams={lsTeams}
            awayAbbr={awayAbbr}
            homeAbbr={homeAbbr}
          />
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex-1 py-2.5 text-sm font-bold transition ${
                tab === key
                  ? 'border-b-2 border-red-600 text-red-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {(key === 'score' || key === 'pbp') && isLive && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* ── 內容區 ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'home' ? (
            /* ── 首頁：精華影片 + 賽後報導 + 先發投手 + 打線 ── */
            <div className="p-4 space-y-5">
              {/* 精華影片 */}
              {content?.highlights && content.highlights.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-black text-xs text-gray-500 tracking-wide uppercase">精彩片段</h4>
                  <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                    <video
                      src={content.highlights[0].videoUrl}
                      poster={content.highlights[0].thumbnail}
                      controls
                      className="w-full"
                      preload="none"
                    />
                    <div className="px-3 py-2 flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-700 font-bold line-clamp-2">{content.highlights[0].title}</p>
                      <span className="text-[10px] text-gray-400 shrink-0">{content.highlights[0].duration}</span>
                    </div>
                  </div>
                  {content.highlights.length > 1 && (
                    <div className="grid grid-cols-2 gap-2">
                      {content.highlights.slice(1, 5).map((h, i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                          <video src={h.videoUrl} poster={h.thumbnail} controls className="w-full h-28 object-cover" preload="none" />
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] text-gray-700 font-bold line-clamp-2">{h.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 賽後報導 */}
              {content?.recap && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <h4 className="font-black text-sm text-gray-900 mb-1 leading-snug">{content.recap.headline}</h4>
                  {content.recap.subhead && (
                    <p className="text-xs text-gray-500 font-bold mb-2">{content.recap.subhead}</p>
                  )}
                  <p className="text-xs text-gray-600 leading-relaxed">{content.recap.blurb}</p>
                </div>
              )}

              {/* 先發投手 */}
              <div className="grid grid-cols-2 gap-3">
                {(['away', 'home'] as const).map(side => {
                  const team = side === 'away' ? awayZh : homeZh;
                  const starter = boxscore?.[side]?.pitchers[0];
                  return (
                    <div key={side} className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                      <div className="text-[10px] text-gray-400 font-bold mb-1.5 tracking-wide">先發投手 · {team}</div>
                      <div className="font-black text-gray-800">{starter?.name ?? '未定'}</div>
                      {starter && (
                        <div className="text-xs text-gray-500 mt-1.5">
                          <span className="mr-3">IP {starter.ip}</span>
                          <span className="mr-3">K {starter.so}</span>
                          <span>ERA {starter.era || '-'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 打線 */}
              <div className="grid grid-cols-2 gap-4">
                {(['away', 'home'] as const).map(side => {
                  const team = side === 'away' ? awayZh : homeZh;
                  const lineup = (boxscore?.[side]?.batters ?? [])
                    .filter(b => b.battingOrder && Number(b.battingOrder) % 100 === 0)
                    .sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder));
                  return (
                    <div key={side}>
                      <div className="font-black text-xs text-gray-700 mb-2">{team}</div>
                      {lineup.length === 0 ? (
                        <div className="text-xs text-gray-400">打線尚未公布</div>
                      ) : (
                        <div className="space-y-0.5">
                          {lineup.map((b, i) => (
                            <div key={b.id} className="flex items-center gap-2 py-0.5 text-xs">
                              <span className="w-4 font-black text-gray-500 shrink-0">{i + 1}</span>
                              <span className="w-6 text-gray-400 shrink-0">{b.position}</span>
                              <span className="font-bold text-gray-800 flex-1 truncate">{b.name}</span>
                              <span className="text-gray-400 tabular-nums">{b.avg || '-'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          ) : tab === 'score' ? (
            /* ── 比分速報：棒球場面板 ── */
            <BaseballFieldPanel
              balls={balls}
              strikes={strikes}
              outs={outs}
              has1B={has1B}
              has2B={has2B}
              has3B={has3B}
              runner1={runner1}
              runner2={runner2}
              runner3={runner3}
              pitcherName={livePitcherName}
              batterName={liveBatterName}
              isFinal={isFinal}
            />

          ) : tab === 'pbp' ? (
            /* ── 文字速報：逐球事件 + 得分紀錄 ── */
            !plays || plays.allPlays.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">速報資料尚未更新</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {/* 得分播報 */}
                {plays.scoringPlays.length > 0 && (
                  <div className="p-4">
                    <h4 className="font-black text-xs text-gray-500 uppercase tracking-wide mb-3">得分紀錄</h4>
                    <div className="space-y-2">
                      {plays.scoringPlays.map((p, i) => (
                        <div key={i} className="flex items-start gap-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2.5">
                          <div className="shrink-0 text-center min-w-[36px]">
                            <div className="text-[10px] text-gray-400 font-bold">
                              {p.halfInning === 'top' ? '上' : '下'}{p.inning}
                            </div>
                            <div className="text-xs font-black text-yellow-700 mt-0.5">{p.awayScore}-{p.homeScore}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                p.event === 'Home Run' ? 'bg-red-100 text-red-700' :
                                p.rbi >= 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>{p.event}</span>
                              {p.rbi > 0 && <span className="text-[10px] font-black text-gray-500">{p.rbi} RBI</span>}
                            </div>
                            <p className="text-xs text-gray-700 leading-snug">{p.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 按局顯示所有 plays */}
                {(() => {
                  const byInning = new Map<string, MLBPlay[]>();
                  for (const p of plays.allPlays) {
                    const key = `${p.inning}-${p.halfInning}`;
                    if (!byInning.has(key)) byInning.set(key, []);
                    byInning.get(key)!.push(p);
                  }
                  return [...byInning.entries()].map(([key, inningPlays]) => {
                    const first = inningPlays[0];
                    const label = `${first.halfInning === 'top' ? '上' : '下'} ${first.inning} 局`;
                    return (
                      <div key={key} className="p-3">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{label}</div>
                        <div className="space-y-1.5">
                          {inningPlays.map((p, i) => (
                            <div key={i} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs ${
                              p.rbi > 0 ? 'bg-yellow-50' : p.isOut ? 'bg-gray-50/50' : 'hover:bg-gray-50'
                            }`}>
                              <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 flex-none mt-1.5 ${
                                p.event === 'Home Run' ? 'bg-red-500' :
                                p.rbi > 0 ? 'bg-yellow-500' :
                                p.isOut ? 'bg-gray-400' :
                                'bg-blue-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-gray-800">{p.batter}</span>
                                <span className="text-gray-400 mx-1">·</span>
                                <span className={`font-bold ${
                                  p.event === 'Home Run' ? 'text-red-600' :
                                  p.rbi > 0 ? 'text-yellow-700' :
                                  p.isOut ? 'text-gray-500' : 'text-blue-600'
                                }`}>{p.event}</span>
                                <p className="text-gray-500 mt-0.5 leading-snug">{p.description}</p>
                              </div>
                              {(p.awayScore !== undefined) && (
                                <div className="shrink-0 text-[10px] text-gray-400 font-mono tabular-nums mt-0.5">
                                  {p.awayScore}-{p.homeScore}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )

          ) : (
            /* ── 成績：打擊 + 投手 ── */
            <div className="p-4 space-y-6">
              <BatterTable side={boxscore?.away} label={awayZh} />
              <BatterTable side={boxscore?.home} label={homeZh} />
              <PitcherTable side={boxscore?.away} label={awayZh} />
              <PitcherTable side={boxscore?.home} label={homeZh} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
