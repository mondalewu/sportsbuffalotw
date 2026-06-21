import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getNbaGameSummary } from '../api/nba';
import type { NbaGameSummary, NbaTeamBoxScore } from '../api/nba';

// Labels to show in main table (omit OREB, DREB, PF which are secondary)
const MAIN_LABELS = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3PT', 'FT', '+/-'];
const ALL_LABELS  = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-'];

function getIdx(labels: string[], key: string) {
  return labels.indexOf(key);
}

function StatCell({ value, label }: { value: string; label: string }) {
  const isPlus = label === '+/-' && value && !value.startsWith('-') && value !== '0';
  const isMinus = label === '+/-' && value?.startsWith('-');
  return (
    <td className={`px-1.5 py-2 text-center text-xs tabular-nums whitespace-nowrap
      ${label === 'PTS' ? 'font-black text-gray-900' : 'text-gray-600'}
      ${isPlus ? 'text-green-600 font-bold' : ''}
      ${isMinus ? 'text-red-500' : ''}`}>
      {value || '—'}
    </td>
  );
}

function BoxScoreTable({ team, labels }: { team: NbaTeamBoxScore; labels: string[] }) {
  const starters = team.players.filter(p => p.starter);
  const bench    = team.players.filter(p => !p.starter);

  const displayLabels = MAIN_LABELS.filter(l => labels.includes(l));

  const StatRow = ({ player, dimmed }: { player: { displayName: string; jerseyNumber: string; stats: string[] }; dimmed?: boolean }) => (
    <tr className={`border-b border-gray-50 hover:bg-gray-50 transition ${dimmed ? 'opacity-60' : ''}`}>
      <td className="px-3 py-2 text-left min-w-[140px] sticky left-0 bg-white">
        <span className="text-[10px] text-gray-400 mr-1.5 font-mono w-4 inline-block text-right">{player.jerseyNumber}</span>
        <span className="text-xs font-bold text-gray-800">{player.displayName}</span>
      </td>
      {displayLabels.map(label => {
        const idx = getIdx(ALL_LABELS, label);
        return <StatCell key={label} value={player.stats[idx] ?? ''} label={label} />;
      })}
    </tr>
  );

  const TotalRow = () => {
    if (!team.totals.length) return null;
    return (
      <tr className="bg-gray-50 border-t-2 border-gray-200">
        <td className="px-3 py-2 text-left sticky left-0 bg-gray-50">
          <span className="text-xs font-black text-gray-700">全隊</span>
        </td>
        {displayLabels.map(label => {
          const idx = getIdx(ALL_LABELS, label);
          return (
            <td key={label} className={`px-1.5 py-2 text-center text-xs font-black tabular-nums
              ${label === 'PTS' ? 'text-gray-900' : 'text-gray-600'}`}>
              {team.totals[idx] ?? ''}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-black text-gray-400 bg-gray-50 border-b border-gray-100">
            <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 min-w-[140px]">球員</th>
            {displayLabels.map(l => (
              <th key={l} className="px-1.5 py-2 text-center min-w-[36px]">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {starters.map(p => <StatRow key={p.displayName} player={p} />)}
          {bench.length > 0 && (
            <tr className="bg-gray-50/80">
              <td colSpan={displayLabels.length + 1} className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                替補
              </td>
            </tr>
          )}
          {bench.map(p => <StatRow key={p.displayName} player={p} dimmed />)}
          <TotalRow />
        </tbody>
      </table>
    </div>
  );
}

function QuarterScore({ game }: { game: NbaGameSummary }) {
  const { homeTeam, awayTeam } = game;
  const quarters = Math.max(homeTeam.linescores.length, awayTeam.linescores.length);
  if (quarters === 0) return null;

  const qLabels = Array.from({ length: quarters }, (_, i) =>
    i < 4 ? `Q${i + 1}` : `OT${i - 3}`
  );

  return (
    <div className="overflow-x-auto mb-6">
      <table className="text-sm mx-auto">
        <thead>
          <tr className="text-[10px] font-black text-gray-400">
            <th className="px-4 py-1.5 text-left min-w-[120px]">球隊</th>
            {qLabels.map(q => <th key={q} className="px-3 py-1.5 text-center w-10">{q}</th>)}
            <th className="px-3 py-1.5 text-center font-black text-gray-700">T</th>
          </tr>
        </thead>
        <tbody>
          {[awayTeam, homeTeam].map((team, ti) => (
            <tr key={team.tricode} className={ti === 0 ? 'border-b border-gray-100' : ''}>
              <td className="px-4 py-2 font-bold text-gray-800 text-sm">
                {team.nameZh}
                {ti === 1 && <span className="ml-1.5 text-[10px] text-gray-400 font-normal">主</span>}
              </td>
              {team.linescores.map((s, i) => (
                <td key={i} className="px-3 py-2 text-center text-xs text-gray-600">{s}</td>
              ))}
              {Array.from({ length: quarters - team.linescores.length }, (_, i) => (
                <td key={`pad-${i}`} className="px-3 py-2 text-center text-xs text-gray-300">—</td>
              ))}
              <td className="px-3 py-2 text-center font-black text-gray-900">{team.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NbaGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<NbaGameSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<'away' | 'home'>('away');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!gameId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getNbaGameSummary(gameId);
      setGame(data);
      setActiveTeam('away');
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [gameId]);

  // Auto-refresh every 30s while live
  useEffect(() => {
    if (!game || game.gameStatus !== 2) return;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [game?.gameStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 font-bold">無法載入比賽資料</p>
        <button onClick={() => navigate('/nba')} className="text-red-600 font-black">← 返回 NBA</button>
      </div>
    );
  }

  const isLive  = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const awayWin = isFinal && game.awayTeam.score > game.homeTeam.score;
  const homeWin = isFinal && game.homeTeam.score > game.awayTeam.score;
  const activeTeamData = activeTeam === 'away' ? game.awayTeam : game.homeTeam;

  const gameTime = game.gameTimeUTC
    ? new Date(game.gameTimeUTC).toLocaleString('zh-TW', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Taipei', hour12: false,
      })
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate('/nba')} className="flex items-center gap-1 text-gray-400 hover:text-white transition font-bold text-sm">
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <span className="text-xs text-gray-400">{game.venue}</span>
        <button onClick={() => load(true)} className={`text-gray-400 hover:text-white transition ${refreshing ? 'animate-spin' : ''}`}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Score hero */}
      <div className="bg-gray-900 text-white px-4 pb-8 pt-2">
        {/* Status */}
        <div className="text-center mb-4">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Q{game.period} {game.gameClock}
            </span>
          ) : isFinal ? (
            <span className="text-xs font-bold text-gray-400">終場{game.attendance ? ` · 觀眾 ${game.attendance.toLocaleString()} 人` : ''}</span>
          ) : (
            <span className="text-xs text-gray-400">{gameTime}</span>
          )}
        </div>

        {/* Teams & Score */}
        <div className="flex items-center justify-center gap-6">
          {/* Away */}
          <div className="flex-1 text-center">
            <p className={`text-sm font-bold mb-1 ${awayWin ? 'text-white' : 'text-gray-400'}`}>{game.awayTeam.nameZh}</p>
            <p className={`text-5xl font-black tabular-nums ${awayWin ? 'text-white' : 'text-gray-400'}`}>
              {isFinal || isLive ? game.awayTeam.score : '—'}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">{game.awayTeam.tricode}</p>
          </div>

          <div className="text-gray-600 font-black text-lg">VS</div>

          {/* Home */}
          <div className="flex-1 text-center">
            <p className={`text-sm font-bold mb-1 ${homeWin ? 'text-white' : 'text-gray-400'}`}>
              {game.homeTeam.nameZh} <span className="text-[10px] text-gray-500 font-normal">主</span>
            </p>
            <p className={`text-5xl font-black tabular-nums ${homeWin ? 'text-white' : 'text-gray-400'}`}>
              {isFinal || isLive ? game.homeTeam.score : '—'}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">{game.homeTeam.tricode}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Quarter linescores */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">各節比分</h2>
          <QuarterScore game={game} />
        </div>

        {/* Box Score */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">球員數據</h2>
            <div className="flex gap-1">
              {(['away', 'home'] as const).map(side => {
                const t = side === 'away' ? game.awayTeam : game.homeTeam;
                return (
                  <button key={side}
                    onClick={() => setActiveTeam(side)}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition
                      ${activeTeam === side ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {t.nameZh}
                  </button>
                );
              })}
            </div>
          </div>
          {activeTeamData.players.length > 0 ? (
            <BoxScoreTable team={activeTeamData} labels={game.labels} />
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">比賽尚未開始或暫無球員數據</p>
          )}
        </div>
      </div>
    </div>
  );
}
