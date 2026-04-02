
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface PlayByPlayEvent {
  id: number;
  game_id: number;
  inning: number;
  is_top: boolean;
  batter_name: string;
  pitcher_name: string;
  situation: string;
  result_text: string;
  score_home: number;
  score_away: number;
  sequence_num: number;
  created_at: string;
}

interface LiveGameTextProps {
  gameId: number;
  awayTeam?: string;
  homeTeam?: string;
}

// ── BSO 解析 ──────────────────────────────────────────────────────────────────
function parseBSO(situation: string): { balls: number; strikes: number; outs: number } {
  const balls   = parseInt(situation.match(/(\d+)B/)?.[1] ?? '0', 10);
  const strikes = parseInt(situation.match(/(\d+)S/)?.[1] ?? '0', 10);
  const outs    = parseInt(situation.match(/^(\d+)出/)?.[1] ?? '0', 10);
  return { balls, strikes, outs };
}

function BSODots({ situation }: { situation: string }) {
  const { balls, strikes, outs } = parseBSO(situation);
  return (
    <div className="flex items-center gap-2 select-none">
      {/* 壞球 綠色 */}
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={`inline-block w-2.5 h-2.5 rounded-full border ${
              i < balls
                ? 'bg-green-400 border-green-500'
                : 'bg-gray-100 border-gray-300'
            }`}
          />
        ))}
      </div>
      {/* 好球 黃色 */}
      <div className="flex items-center gap-0.5">
        {[0, 1].map(i => (
          <span
            key={i}
            className={`inline-block w-2.5 h-2.5 rounded-full border ${
              i < strikes
                ? 'bg-yellow-400 border-yellow-500'
                : 'bg-gray-100 border-gray-300'
            }`}
          />
        ))}
      </div>
      {/* 出局 紅色 */}
      <div className="flex items-center gap-0.5">
        {[0, 1].map(i => (
          <span
            key={i}
            className={`inline-block w-2.5 h-2.5 rounded-full border ${
              i < outs
                ? 'bg-red-400 border-red-500'
                : 'bg-gray-100 border-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

const LiveGameText: React.FC<LiveGameTextProps> = ({ gameId, awayTeam, homeTeam }) => {
  const [events, setEvents] = useState<PlayByPlayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/games/${gameId}/play-by-play`);
      const data = await response.json();
      setEvents(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching live text:', error);
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  if (loading) return <div className="p-4 text-center text-zinc-400">正在載入速報內容...</div>;

  // 按局數分組
  const groupedByInning = events.reduce((acc, event) => {
    const key = `${event.inning}${event.is_top ? '上' : '下'}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, PlayByPlayEvent[]>);

  return (
    <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg overflow-hidden shadow">
      {/* Header */}
      <div className="bg-indigo-600 px-4 py-2.5 flex justify-between items-center text-white">
        <h2 className="font-bold flex items-center gap-2 text-sm">
          <span className="animate-pulse w-2.5 h-2.5 bg-red-400 rounded-full inline-block" />
          文字速報
        </h2>
        {/* BSO 圖例 */}
        <div className="flex items-center gap-3 text-[11px] text-white/80 font-bold">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 border border-green-500" />壞球
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500" />好球
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 border border-red-500" />出局
          </span>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full transition font-bold disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      <div>
        {Object.keys(groupedByInning).length === 0 ? (
          <div className="p-10 text-center text-gray-400">目前尚無比賽事件紀錄</div>
        ) : (
          Object.entries(groupedByInning)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([inning, inningEvents]) => (
              <div key={inning} className="border-b border-gray-200">
                <div className={`px-4 py-1.5 font-bold text-sm ${
                  inning.endsWith('上')
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-orange-50 text-orange-700'
                }`}>
                  {inning}局
                  {inning.endsWith('上') && awayTeam
                    ? `　先攻（${awayTeam}）`
                    : inning.endsWith('下') && homeTeam
                    ? `　後攻（${homeTeam}）`
                    : '　攻擊'}
                </div>
                <div className="divide-y divide-gray-100">
                  {inningEvents.map(event => (
                    <div key={event.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-indigo-600 text-sm">{event.batter_name}</span>
                        <BSODots situation={event.situation} />
                        <span className="text-xs text-gray-400 ml-auto shrink-0">投手: {event.pitcher_name}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mb-1">{event.situation}</div>
                      <p className="text-gray-800 text-sm leading-relaxed">{event.result_text}</p>
                      <div className="mt-1.5 text-xs font-bold text-emerald-600">
                        比分: 客 {event.score_away} - {event.score_home} 主
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default LiveGameText;
