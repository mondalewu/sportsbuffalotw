import { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { getMLBBoxscore, getMLBLinescore, MLB_TEAM_ZH, type MLBGame, type MLBBoxscore } from '../api/mlb';

interface Props {
  game: MLBGame;
  onClose: () => void;
}

type DetailTab = 'linescore' | 'away' | 'home';

export default function MLBGameDetail({ game, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>('linescore');
  const [boxscore, setBoxscore] = useState<MLBBoxscore | null>(null);
  const [linescore, setLinescore] = useState<any>(null);
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
      const [box, ls] = await Promise.all([
        getMLBBoxscore(game.gamePk),
        getMLBLinescore(game.gamePk),
      ]);
      setBoxscore(box);
      setLinescore(ls);
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

  const innings = linescore?.innings ?? [];
  const linescoreTeams = linescore?.teams ?? { away: {}, home: {} };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {/* Status */}
            <div className="flex items-center gap-2 mb-3">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-xs font-black text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {game.linescore?.inningHalf === 'Top' ? '上' : '下'}
                  {game.linescore?.currentInningOrdinal ?? ''} 局
                  &nbsp;{game.linescore?.outs ?? 0} 出局
                </span>
              ) : isFinal ? (
                <span className="text-xs font-bold text-gray-400">終場</span>
              ) : (
                <span className="text-xs font-bold text-blue-400">今日 {gameTime} (台北)</span>
              )}
              {refreshing && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />}
            </div>

            {/* Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-black text-white">{awayAbbr}</span>
                  <span className="ml-2 text-sm text-gray-400">{awayZh}</span>
                </div>
                {(isLive || isFinal) && (
                  <span className={`text-3xl font-black ${game.teams.away.isWinner ? 'text-white' : 'text-gray-500'}`}>
                    {game.teams.away.score ?? 0}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-black text-white">{homeAbbr}</span>
                  <span className="ml-2 text-sm text-gray-400">{homeZh}</span>
                  <span className="ml-1 text-[10px] text-gray-500">主</span>
                </div>
                {(isLive || isFinal) && (
                  <span className={`text-3xl font-black ${game.teams.home.isWinner ? 'text-white' : 'text-gray-500'}`}>
                    {game.teams.home.score ?? 0}
                  </span>
                )}
              </div>
            </div>

            {/* Decisions */}
            {isFinal && game.decisions && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                {game.decisions.winner && <span>勝 {game.decisions.winner.fullName}</span>}
                {game.decisions.loser && <span>敗 {game.decisions.loser.fullName}</span>}
                {game.decisions.save && <span>救援 {game.decisions.save.fullName}</span>}
              </div>
            )}

            {game.venue && <p className="mt-2 text-[11px] text-gray-500">{game.venue}</p>}
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-white transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0 px-1">
          {([['linescore', '局分'], ['away', `${awayAbbr} 打擊`], ['home', `${homeAbbr} 打擊`]] as [DetailTab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition ${tab === t ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'linescore' ? (
            <LinescoreView innings={innings} teams={linescoreTeams} awayAbbr={awayAbbr} homeAbbr={homeAbbr} />
          ) : (
            <BoxscoreView
              side={tab === 'away' ? boxscore?.away : boxscore?.home}
              label={tab === 'away' ? awayZh : homeZh}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── 局分表 ────────────────────────────────────────────────────────────────────
function LinescoreView({ innings, teams, awayAbbr, homeAbbr }: {
  innings: any[]; teams: any; awayAbbr: string; homeAbbr: string;
}) {
  if (!innings.length) {
    return <p className="text-center text-gray-400 py-10 text-sm">尚無局分資料</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm min-w-[520px]">
        <thead>
          <tr className="text-[11px] text-gray-400 font-bold border-b border-gray-100">
            <th className="text-left py-2 pl-2 w-16">隊伍</th>
            {innings.map((inn: any) => (
              <th key={inn.num} className="py-2 px-1 w-7">{inn.num}</th>
            ))}
            <th className="py-2 px-2 font-black text-gray-700">R</th>
            <th className="py-2 px-2 font-black text-gray-700">H</th>
            <th className="py-2 px-2 font-black text-gray-700">E</th>
          </tr>
        </thead>
        <tbody>
          {[
            { abbr: awayAbbr, side: 'away' },
            { abbr: homeAbbr, side: 'home' },
          ].map(({ abbr, side }) => (
            <tr key={side} className="border-b border-gray-50">
              <td className="text-left py-3 pl-2 font-black text-gray-800 w-16">{abbr}</td>
              {innings.map((inn: any) => (
                <td key={inn.num} className="py-3 px-1 text-gray-600">
                  {inn[side]?.runs ?? '-'}
                </td>
              ))}
              <td className="py-3 px-2 font-black text-gray-900">{teams[side]?.runs ?? '-'}</td>
              <td className="py-3 px-2 text-gray-600">{teams[side]?.hits ?? '-'}</td>
              <td className="py-3 px-2 text-gray-400">{teams[side]?.errors ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 打擊/投手成績 ─────────────────────────────────────────────────────────────
function BoxscoreView({ side, label }: { side: MLBBoxscore['away'] | undefined; label: string }) {
  if (!side) return <p className="text-center text-gray-400 py-10 text-sm">無資料</p>;

  return (
    <div className="space-y-6">
      {/* Batting */}
      <div>
        <h4 className="font-black text-sm text-gray-700 mb-2">{label} — 打擊成績</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="text-gray-400 font-bold border-b border-gray-100">
                <th className="text-left py-1.5 pl-1">球員</th>
                <th className="py-1.5 px-2 text-center">守位</th>
                <th className="py-1.5 px-2 text-center">AB</th>
                <th className="py-1.5 px-2 text-center">R</th>
                <th className="py-1.5 px-2 text-center">H</th>
                <th className="py-1.5 px-2 text-center">HR</th>
                <th className="py-1.5 px-2 text-center">RBI</th>
                <th className="py-1.5 px-2 text-center">BB</th>
                <th className="py-1.5 px-2 text-center">K</th>
                <th className="py-1.5 px-2 text-center">AVG</th>
              </tr>
            </thead>
            <tbody>
              {side.batters.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 pl-1 font-bold text-gray-800">{b.name}</td>
                  <td className="py-1.5 px-2 text-center text-gray-500">{b.position}</td>
                  <td className="py-1.5 px-2 text-center">{b.ab}</td>
                  <td className="py-1.5 px-2 text-center">{b.r}</td>
                  <td className="py-1.5 px-2 text-center font-bold text-gray-800">{b.h}</td>
                  <td className="py-1.5 px-2 text-center">{b.hr || '-'}</td>
                  <td className="py-1.5 px-2 text-center">{b.rbi}</td>
                  <td className="py-1.5 px-2 text-center">{b.bb}</td>
                  <td className="py-1.5 px-2 text-center">{b.so}</td>
                  <td className="py-1.5 px-2 text-center text-gray-500">{b.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pitching */}
      {side.pitchers.length > 0 && (
        <div>
          <h4 className="font-black text-sm text-gray-700 mb-2">{label} — 投手成績</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-gray-400 font-bold border-b border-gray-100">
                  <th className="text-left py-1.5 pl-1">球員</th>
                  <th className="py-1.5 px-2 text-center">IP</th>
                  <th className="py-1.5 px-2 text-center">H</th>
                  <th className="py-1.5 px-2 text-center">R</th>
                  <th className="py-1.5 px-2 text-center">ER</th>
                  <th className="py-1.5 px-2 text-center">BB</th>
                  <th className="py-1.5 px-2 text-center">K</th>
                  <th className="py-1.5 px-2 text-center">HR</th>
                  <th className="py-1.5 px-2 text-center">ERA</th>
                </tr>
              </thead>
              <tbody>
                {side.pitchers.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pl-1 font-bold text-gray-800">
                      {p.name}
                      {p.note && <span className="ml-1 text-[10px] font-black text-red-500">{p.note}</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold">{p.ip}</td>
                    <td className="py-1.5 px-2 text-center">{p.h}</td>
                    <td className="py-1.5 px-2 text-center">{p.r}</td>
                    <td className="py-1.5 px-2 text-center">{p.er}</td>
                    <td className="py-1.5 px-2 text-center">{p.bb}</td>
                    <td className="py-1.5 px-2 text-center">{p.so}</td>
                    <td className="py-1.5 px-2 text-center">{p.hr || '-'}</td>
                    <td className="py-1.5 px-2 text-center text-gray-500">{p.era}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
