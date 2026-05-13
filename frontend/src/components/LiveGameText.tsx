
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../api/client';

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
  hitter_acnt: string | null;
  batting_order: number | null;
}

interface LiveGameTextProps {
  gameId: number;
  awayTeam?: string;
  homeTeam?: string;
  batterAvgMap?: Record<string, string>;
  pitcherStatsMap?: Record<string, { era: string; pitch_count: number }>;
}

// ── BSO 點點（壞/好/出）
function BSODots({ situation }: { situation: string }) {
  const balls   = parseInt(situation.match(/(\d+)B/)?.[1] ?? '0', 10);
  const strikes = parseInt(situation.match(/(\d+)S/)?.[1] ?? '0', 10);
  const outs    = parseInt(situation.match(/^(\d+)出/)?.[1] ?? '0', 10);
  return (
    <div className="flex items-center gap-1.5 select-none">
      <div className="flex gap-0.5">
        {[0,1,2].map(i => (
          <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full border ${i < balls ? 'bg-green-400 border-green-500' : 'bg-gray-200 border-gray-300'}`} />
        ))}
      </div>
      <div className="flex gap-0.5">
        {[0,1].map(i => (
          <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full border ${i < strikes ? 'bg-yellow-400 border-yellow-500' : 'bg-gray-200 border-gray-300'}`} />
        ))}
      </div>
      <div className="flex gap-0.5">
        {[0,1].map(i => (
          <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full border ${i < outs ? 'bg-red-400 border-red-500' : 'bg-gray-200 border-gray-300'}`} />
        ))}
      </div>
    </div>
  );
}

// ── 壘包菱形
function BaseDiamond({ situation }: { situation: string }) {
  const b1 = /一壘/.test(situation) || /滿壘/.test(situation);
  const b2 = /二壘/.test(situation) || /滿壘/.test(situation);
  const b3 = /三壘/.test(situation) || /滿壘/.test(situation);
  const size = 10;
  const gap  = 2;
  const span = size + gap;
  const svgSize = span * 2 + size;
  return (
    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
      {/* 2B top */}
      <rect x={span} y={0} width={size} height={size} rx={1}
        transform={`rotate(45 ${span + size/2} ${size/2})`}
        fill={b2 ? '#f59e0b' : '#d1d5db'} />
      {/* 3B left */}
      <rect x={0} y={span} width={size} height={size} rx={1}
        transform={`rotate(45 ${size/2} ${span + size/2})`}
        fill={b3 ? '#f59e0b' : '#d1d5db'} />
      {/* 1B right */}
      <rect x={span*2} y={span} width={size} height={size} rx={1}
        transform={`rotate(45 ${span*2 + size/2} ${span + size/2})`}
        fill={b1 ? '#f59e0b' : '#d1d5db'} />
      {/* Home bottom (always empty grey) */}
      <rect x={span} y={span*2} width={size} height={size} rx={1}
        transform={`rotate(45 ${span + size/2} ${span*2 + size/2})`}
        fill="#d1d5db" />
    </svg>
  );
}

// ── 打擊結果徽章
function resultBadge(text: string): { label: string; color: string } | null {
  if (!text) return null;
  if (/全壘打/.test(text)) return { label: '全打', color: 'bg-red-600 text-white' };
  if (/三壘安打/.test(text)) return { label: '三安', color: 'bg-orange-500 text-white' };
  if (/二壘安打/.test(text)) return { label: '二安', color: 'bg-green-600 text-white' };
  if (/一壘安打|內野安打/.test(text)) return { label: '一安', color: 'bg-green-500 text-white' };
  if (/四壞球|四壞|四球/.test(text)) return { label: '四壞', color: 'bg-green-500 text-white' };
  if (/死球|觸身球/.test(text)) return { label: '死球', color: 'bg-blue-500 text-white' };
  if (/犠牲飛球|犠飛/.test(text)) return { label: '犠飛', color: 'bg-gray-500 text-white' };
  if (/犠牲短打|犠打/.test(text)) return { label: '犠打', color: 'bg-gray-500 text-white' };
  if (/三振/.test(text)) return { label: '三振', color: 'bg-gray-400 text-white' };
  if (/雙殺|併殺/.test(text)) return { label: '雙殺', color: 'bg-gray-500 text-white' };
  if (/飛球接殺|高飛球/.test(text) && /出局/.test(text)) return { label: '飛出', color: 'bg-gray-400 text-white' };
  if (/中外野|左外野|右外野/.test(text) && /飛球|高飛/.test(text) && /出局/.test(text)) return { label: '飛出', color: 'bg-gray-400 text-white' };
  if (/平飛/.test(text) && /出局/.test(text)) return { label: '直飛', color: 'bg-gray-400 text-white' };
  if (/滾地球/.test(text) && /出局/.test(text)) return { label: '滾出', color: 'bg-gray-400 text-white' };
  if (/出局/.test(text)) return { label: '出局', color: 'bg-gray-400 text-white' };
  return null;
}

// ── 球種/動作分類（用於 pitch number 背景色）
// isFinal=true → 依結果上色；false → 依球種上色
function pitchBgColor(text: string, isFinal: boolean): string {
  if (isFinal) {
    if (/安打|全壘打/.test(text)) return 'bg-blue-500 text-white';
    if (/四壞球|四壞|四球|死球/.test(text)) return 'bg-green-400 text-white';
    if (/三振|飛球|滾地|接殺|觸殺|封殺|出局|雙殺|犠牲/.test(text)) return 'bg-red-500 text-white';
    return 'bg-yellow-400 text-gray-800';
  }
  // Non-final pitch: color by ball/strike type
  if (/壞球/.test(text)) return 'bg-green-400 text-white';
  // 好球, 空振, 界外, 沒揮棒 → yellow
  return 'bg-yellow-400 text-gray-800';
}

// ── 打者照片 URL（CPBL）
function cpblPhotoUrl(acnt: string | null): string | null {
  if (!acnt) return null;
  return `https://www.cpbl.com.tw/images/players/${acnt}.jpg`;
}


// ── Group events: consecutive runs of same batter in same inning/half = one at-bat
interface AtBat {
  inning: number;
  is_top: boolean;
  batter_name: string;
  pitcher_name: string;
  hitter_acnt: string | null;
  batting_order: number | null;
  pitches: PlayByPlayEvent[];   // all pitch-by-pitch actions in this at-bat
  finalEvent: PlayByPlayEvent;  // last event = result
}

function groupIntoAtBats(events: PlayByPlayEvent[]): AtBat[] {
  const atBats: AtBat[] = [];
  for (const ev of events) {
    const last = atBats[atBats.length - 1];
    if (
      last &&
      last.inning === ev.inning &&
      last.is_top === ev.is_top &&
      last.batter_name === ev.batter_name
    ) {
      last.pitches.push(ev);
      last.finalEvent = ev;
    } else {
      atBats.push({
        inning: ev.inning,
        is_top: ev.is_top,
        batter_name: ev.batter_name,
        pitcher_name: ev.pitcher_name,
        hitter_acnt: ev.hitter_acnt,
        batting_order: ev.batting_order,
        pitches: [ev],
        finalEvent: ev,
      });
    }
  }
  return atBats;
}

// ── 主元件
const LiveGameText: React.FC<LiveGameTextProps> = ({ gameId, awayTeam, homeTeam, batterAvgMap, pitcherStatsMap }) => {
  const [events, setEvents] = useState<PlayByPlayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAtBats, setExpandedAtBats] = useState<Set<string>>(new Set());

  const toggleAtBat = (key: string) => {
    setExpandedAtBats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/games/${gameId}/play-by-play`);
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">正在載入速報內容...</div>;

  const atBats = groupIntoAtBats(events);
  if (atBats.length === 0) {
    return <div className="p-10 text-center text-gray-400">目前尚無比賽事件紀錄</div>;
  }

  // Group at-bats by inning-half
  interface HalfInning { key: string; inning: number; is_top: boolean; atBats: AtBat[] }
  const halves: HalfInning[] = [];
  for (const ab of atBats) {
    const key = `${ab.inning}-${ab.is_top ? 'top' : 'bot'}`;
    const last = halves[halves.length - 1];
    if (last && last.key === key) {
      last.atBats.push(ab);
    } else {
      halves.push({ key, inning: ab.inning, is_top: ab.is_top, atBats: [ab] });
    }
  }
  // Show latest inning first
  const sortedHalves = [...halves].reverse();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse inline-block" />
          <span className="font-black text-gray-800 text-sm">文字速報</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400 font-bold">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />壞/好球</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" />出局</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-600 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {/* Half-inning sections */}
      <div className="space-y-2">
        {sortedHalves.map(half => {
          const teamName = half.is_top ? awayTeam : homeTeam;
          const bgHeader = half.is_top ? 'bg-blue-600' : 'bg-orange-600';
          return (
            <div key={half.key} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              {/* Inning header */}
              <div className={`${bgHeader} px-4 py-1.5 flex items-center gap-2`}>
                <span className="text-white font-black text-sm">{half.inning} 局{half.is_top ? '上' : '下'}</span>
                {teamName && <span className="text-white/80 text-xs font-bold">（{teamName}）</span>}
              </div>

              {/* At-bats in this half */}
              <div className="divide-y divide-gray-100 bg-white">
                {[...half.atBats].reverse().map((ab, abIdx) => {
                  const badge    = resultBadge(ab.finalEvent.result_text);
                  const avg      = batterAvgMap?.[ab.batter_name];
                  const pitStats = pitcherStatsMap?.[ab.pitcher_name];
                  const photoUrl = cpblPhotoUrl(ab.hitter_acnt);
                  const orderNum = ab.batting_order != null && ab.batting_order > 0
                    ? (ab.batting_order > 9 ? ab.batting_order - 9 : ab.batting_order)
                    : null;
                  const abKey = `${half.key}-${abIdx}`;
                  const isExpanded = expandedAtBats.has(abKey);

                  return (
                    <div key={abIdx} className="p-3">
                      {/* Batter card header */}
                      <div className="flex items-start gap-3">
                        {/* Photo */}
                        <div className="w-12 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={ab.batter_name}
                              className="w-full h-full object-cover object-top"
                              onError={e => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                              {ab.batter_name.slice(0, 1)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name + order */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {orderNum != null && (
                              <span className="text-xs font-black text-gray-500">第{orderNum}棒</span>
                            )}
                            <span className="font-black text-gray-800 text-sm">{ab.batter_name}</span>
                            {avg && (
                              <span className="text-[11px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded">
                                {avg}
                              </span>
                            )}
                          </div>

                          {/* BSO + badge + diamond + score */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <BSODots situation={ab.finalEvent.situation} />
                            {badge && (
                              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${badge.color}`}>
                                {badge.label}
                              </span>
                            )}
                            <BaseDiamond situation={ab.finalEvent.situation} />
                            <span className="ml-auto text-xs font-black text-gray-600 tabular-nums">
                              客 {ab.finalEvent.score_away} : {ab.finalEvent.score_home} 主
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pitcher line + toggle */}
                      {ab.pitches.length > 0 ? (
                        <button
                          onClick={() => toggleAtBat(abKey)}
                          className="mt-2 mb-1.5 w-full flex items-center gap-2 pl-0.5 text-left hover:bg-gray-50 rounded-md py-0.5 transition-colors"
                        >
                          <span className="text-[11px] text-gray-400">投手：{ab.pitcher_name}</span>
                          {pitStats && (
                            <span className="text-[11px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                              {pitStats.pitch_count}球 ERA {pitStats.era}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-gray-400 shrink-0">
                            {ab.pitches.filter(p => !/更換投手|更換選手|更換守備|代打|代跑/.test(p.result_text)).length}球
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />
                            }
                          </span>
                        </button>
                      ) : (
                        <div className="mt-2 mb-1.5 flex items-center gap-2 pl-0.5">
                          <span className="text-[11px] text-gray-400">投手：{ab.pitcher_name}</span>
                          {pitStats && (
                            <span className="text-[11px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                              {pitStats.pitch_count}球 ERA {pitStats.era}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Per-pitch list (collapsible) — announcements always visible, real pitches collapsible */}
                      {ab.pitches.length > 0 && (() => {
                        const isAnn = (t: string) => /更換投手|更換選手|更換守備|代打|代跑/.test(t);
                        const announcements = ab.pitches.filter(p => isAnn(p.result_text));
                        const realPitches   = ab.pitches.filter(p => !isAnn(p.result_text));
                        const pitchesToShow = isExpanded
                          ? realPitches
                          : realPitches.slice(-1);
                        return (
                          <>
                            {/* Announcements — always shown */}
                            {announcements.length > 0 && (
                              <div className="space-y-0.5 mb-0.5">
                                {announcements.map(pitch => (
                                  <div key={pitch.id} className="flex items-center gap-1.5 py-1 px-2 bg-amber-50 rounded border-l-2 border-amber-300">
                                    <span className="flex-1 text-xs text-amber-800 leading-relaxed">{pitch.result_text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Real pitches */}
                            {realPitches.length > 0 && (
                              <div className="space-y-0 pl-1 border-l-2 border-gray-100 ml-1">
                                {pitchesToShow.map((pitch, i) => {
                                  const pitchNum = isExpanded ? i + 1 : realPitches.length;
                                  const bso = (() => {
                                    const b = parseInt(pitch.situation.match(/(\d+)B/)?.[1] ?? '0', 10);
                                    const s = parseInt(pitch.situation.match(/(\d+)S/)?.[1] ?? '0', 10);
                                    return `${b}-${s}`;
                                  })();
                                  const isFinalPitch = pitch === realPitches[realPitches.length - 1];
                                  const numBg = pitchBgColor(pitch.result_text, isFinalPitch);
                                  return (
                                    <div key={pitch.id} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded">
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${numBg}`}>
                                        {pitchNum}
                                      </span>
                                      <span className="flex-1 text-xs text-gray-700 leading-relaxed">{pitch.result_text}</span>
                                      <span className="text-[11px] font-bold text-gray-400 tabular-nums shrink-0">{bso}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveGameText;
