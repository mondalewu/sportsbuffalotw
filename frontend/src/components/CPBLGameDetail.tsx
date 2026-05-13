import { useEffect, useRef, useState } from 'react';
import LiveGameText from './LiveGameText';
import { teamLogos } from '../data/staticData';
import { API_BASE } from '../api/client';

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
  'AKP011': '台鋼雄鷹', 'AAA011': '味全龍',   'ADD011': '統一獅',
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
  season_avg: number | null;
  season_ab?: number | null;
}
interface LineupRow {
  team_code: string; is_home: boolean; batting_order: number;
  position: string | null; player_name: string;
}
interface PitcherRow {
  team_code: string; pitcher_order: number | null; player_name: string;
  innings_pitched: string | null; hits_allowed: number; runs_allowed: number;
  earned_runs: number; walks: number; strikeouts: number; pitch_count: number;
  season_era: number | null; season_ip: number | null;
  batters_faced: number; home_runs_allowed: number; hit_by_pitch: number;
  balk: number; result: string | null;
}

interface PlayByPlayEvent {
  id: number; game_id: number; inning: number; is_top: boolean;
  batter_name: string; pitcher_name: string;
  situation: string; result_text: string;
  score_home: number; score_away: number; sequence_num: number;
  hitter_acnt?: string | null;
  batting_order?: number | null;
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

// ── 局面解析 ──────────────────────────────────────────────────────────────────

function parseSituation(situation: string) {
  const outs    = parseInt(situation.match(/^(\d+)出/)?.[1]  ?? '0', 10);
  const balls   = parseInt(situation.match(/(\d+)B/)?.[1]    ?? '0', 10);
  const strikes = parseInt(situation.match(/(\d+)S/)?.[1]    ?? '0', 10);
  const base1   = /一壘|一二壘|一三壘|滿壘/.test(situation);
  const base2   = /二壘|一二壘|二三壘|滿壘/.test(situation);
  const base3   = /三壘|一三壘|二三壘|滿壘/.test(situation);
  return { outs, balls, strikes, base1, base2, base3 };
}

// ── 上壘球員推算（從 PBP 事件序列追蹤）────────────────────────────────────────

function inferRunners(events: PlayByPlayEvent[]): { base1: string | null; base2: string | null; base3: string | null } {
  if (!events.length) return { base1: null, base2: null, base3: null };

  // 找到最新一局（ASC 排序，最後一筆最新）
  const latest = events[events.length - 1];
  const sameHalf = events.filter(e => e.inning === latest.inning && e.is_top === latest.is_top);
  // 確保時間順序（sequence_num ASC）
  const chronological = [...sameHalf].sort((a, b) => a.sequence_num - b.sequence_num);

  let b1: string | null = null;
  let b2: string | null = null;
  let b3: string | null = null;

  // 清除某人名在所有壘的記錄（避免同一選手出現在多個壘包）
  function clearName(name: string) {
    if (b1 === name) b1 = null;
    if (b2 === name) b2 = null;
    if (b3 === name) b3 = null;
  }

  for (const ev of chronological) {
    const r = ev.result_text;
    const name = ev.batter_name;

    if (/本壘打/.test(r)) {
      b1 = null; b2 = null; b3 = null;
    } else if (/三壘安打/.test(r)) {
      // 所有人得分，打者上三壘
      b1 = null; b2 = null; clearName(name); b3 = name;
    } else if (/二壘安打/.test(r)) {
      // 一壘跑者通常得分，打者上二壘
      b1 = null; b3 = b2; clearName(name); b2 = name;
    } else if (/一壘安打/.test(r) || (r.includes('安打') && !r.includes('二壘') && !r.includes('三壘'))) {
      // 推進跑者
      if (b2) b3 = b2;
      b2 = b1;
      clearName(name);
      b1 = name;
    } else if (/四壞球|死球|滿壘/.test(r) && !r.includes('出局')) {
      // 強迫推進
      if (b1 && b2) { b3 = b2; b2 = b1; clearName(name); b1 = name; }
      else if (b1) { b2 = b1; clearName(name); b1 = name; }
      else { clearName(name); b1 = name; }
    } else if (/盜壘成功/.test(r)) {
      if (b1 === name) { b2 = name; b1 = null; }
      else if (b2 === name) { b3 = name; b2 = null; }
    } else if (/得分/.test(r)) {
      // 清除跑者（得分回本壘）
      if (b3) b3 = null;
      else if (b2) b2 = null;
      else if (b1) b1 = null;
    } else if (/雙殺|併殺/.test(r)) {
      b1 = null;
    } else if (/三振|飛球|滾地|接殺|觸殺|封殺|出局|比賽結束/.test(r)) {
      // 打者出局，壘上跑者維持（簡化：不移動）
    }
  }

  return { base1: b1, base2: b2, base3: b3 };
}

// ── 打者今日成績摘要 ──────────────────────────────────────────────────────────

function todayResultSummary(results: string[] | null): string {
  if (!results || !results.length) return '';
  const hits = results.filter(r => /安|二|三|本/.test(r)).length;
  const ab   = results.length;
  if (hits === 0) return `${ab}打數0安`;
  return `${ab}打數${hits}安`;
}

// ── 球場面板 ──────────────────────────────────────────────────────────────────

function BaseballFieldPanel({
  outs,
  isFinal,
  latestEvent,
  allEvents,
  batterAvgMap,
  batterResultMap,
  pitcherStatsMap,
}: {
  outs: number;
  isFinal?: boolean;
  latestEvent?: PlayByPlayEvent | null;
  allEvents?: PlayByPlayEvent[];
  batterAvgMap?: Record<string, string>;
  batterResultMap?: Record<string, string[]>;
  pitcherStatsMap?: Record<string, { era: string; pitch_count: number }>;
}) {
  const parsed = latestEvent
    ? parseSituation(latestEvent.situation)
    : { outs, balls: 0, strikes: 0, base1: false, base2: false, base3: false };

  const { base1: occ1, base2: occ2, base3: occ3 } = parsed;
  const displayOuts    = parsed.outs;
  const displayBalls   = parsed.balls;
  const displayStrikes = parsed.strikes;

  const runners = allEvents ? inferRunners(allEvents) : { base1: null, base2: null, base3: null };

  const batterAvg    = latestEvent && batterAvgMap     ? (batterAvgMap[latestEvent.batter_name]       ?? null) : null;
  const batterToday  = latestEvent && batterResultMap  ? (batterResultMap[latestEvent.batter_name]    ?? null) : null;
  const pitcherInfo  = latestEvent && pitcherStatsMap  ? (pitcherStatsMap[latestEvent.pitcher_name]   ?? null) : null;

  // 壘包定義（位置 + 是否有人）
  const BASES = [
    { key: '2B', left: '50%',  top: '33%', occupied: occ2, runner: runners.base2, anchor: 'center' },
    { key: '3B', left: '15%',  top: '45%', occupied: occ3, runner: runners.base3, anchor: 'right' },
    { key: '1B', left: '85%',  top: '45%', occupied: occ1, runner: runners.base1, anchor: 'left' },
  ];

  return (
    <div className="relative overflow-hidden bg-gray-900" style={{ height: 420 }}>
      <img
        src="/baseball-field.png"
        alt="baseball field"
        className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* ── 比賽結束 overlay ── */}
      {isFinal && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-black/75 backdrop-blur-sm rounded-3xl px-10 py-6 text-center shadow-2xl border border-white/10">
            <div className="text-white text-2xl font-black tracking-widest mb-1">比賽結束</div>
            <div className="text-gray-400 text-xs font-bold tracking-wider">FINAL</div>
          </div>
        </div>
      )}

      {/* ── 壘包 + 跑者姓名 ── */}
      {BASES.map(({ key, left, top, occupied, runner }) => (
        <div key={key} className="absolute flex flex-col items-center"
          style={{ left, top, transform: 'translate(-50%, -50%)' }}>
          {/* 跑者姓名（壘上有人才顯示，有追蹤到姓名才顯示 badge） */}
          {occupied && runner && (
            <div className="mb-1 bg-black/85 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow border border-yellow-400/30">
              {runner}
            </div>
          )}
          {/* 壘包 */}
          <div
            className={`w-6 h-6 rounded-sm border-2 shadow-lg transition-all duration-300 ${
              occupied
                ? 'bg-yellow-400 border-yellow-200 shadow-yellow-400/80 scale-110'
                : 'bg-white/80 border-gray-300'
            }`}
            style={{ transform: 'rotate(45deg)' }}
          />
        </div>
      ))}

      {/* ── 投手資訊（中央偏上，草坪區）── */}
      {latestEvent && !isFinal && (
        <div className="absolute text-center" style={{ left: '50%', top: '52%', transform: 'translate(-50%, -50%)' }}>
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-xl text-white inline-block">
            <div className="text-[9px] text-gray-400 font-bold tracking-widest mb-0.5">場上投手</div>
            <div className="font-black text-sm">{latestEvent.pitcher_name}</div>
            {pitcherInfo && (
              <div className="text-[11px] text-blue-300 font-bold mt-0.5 flex items-center justify-center gap-2">
                <span>{pitcherInfo.pitch_count} 球</span>
                <span className="text-gray-500">·</span>
                <span>ERA {pitcherInfo.era}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BSO 燈號（左下）── */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-xl">
        <div className="text-[9px] text-gray-400 font-bold tracking-widest text-center mb-1.5">B · S · O</div>
        <BSOLights balls={displayBalls} strikes={displayStrikes} outs={displayOuts} />
      </div>

      {/* ── 打者資訊（下方中央，本壘板上方）── */}
      {latestEvent && !isFinal && (
        <div className="absolute text-center" style={{ left: '50%', bottom: 16, transform: 'translateX(-50%)' }}>
          <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-5 py-2.5 shadow-xl text-white inline-block min-w-[180px]">
            <div className="text-[9px] text-gray-400 font-bold tracking-widest mb-0.5">打者</div>
            <div className="font-black text-base leading-tight">{latestEvent.batter_name}</div>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              {batterAvg && (
                <span className="text-[11px] text-yellow-300 font-bold">打率 {batterAvg}</span>
              )}
              {batterToday && batterToday.length > 0 && (
                <>
                  <span className="text-gray-600 text-[10px]">·</span>
                  <span className="text-[11px] text-green-300 font-bold">本場 {todayResultSummary(batterToday)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 好球帶（右下）── */}
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-3 shadow-xl">
        <StrikeZoneOverlay />
      </div>
    </div>
  );
}

// ── 打者陣容（NPB 同款格式）─────────────────────────────────────────────────────

function CpblLineupPanel({
  name, lineups, batters,
}: {
  name: string;
  lineups: LineupRow[];
  batters: BatterRow[];
}) {
  // Build batting avg map from batter stats (prefer season avg)
  const avgMap: Record<string, { avg: string; atBats: number }> = {};
  batters.forEach(b => {
    const avg = b.season_avg != null && b.season_avg > 0
      ? Number(b.season_avg).toFixed(3)
      : b.at_bats > 0 ? (b.hits / b.at_bats).toFixed(3) : '.---';
    avgMap[b.player_name] = { avg, atBats: b.at_bats };
  });

  // Group by batting_order: first = starter, rest = substitutes
  const grouped: { order: number; starter: LineupRow; subs: LineupRow[] }[] = [];
  for (const l of lineups.sort((a, b) => a.batting_order - b.batting_order)) {
    const existing = grouped.find(g => g.order === l.batting_order);
    if (existing) {
      existing.subs.push(l);
    } else {
      grouped.push({ order: l.batting_order, starter: l, subs: [] });
    }
  }

  if (grouped.length === 0) {
    return <div className="text-center py-6 text-gray-400 text-xs">打序尚未公布</div>;
  }

  return (
    <div>
      <div className="font-black text-xs text-gray-700 mb-2 px-1">{name}</div>
      {/* 欄位標題 */}
      <div className="flex items-center gap-2 px-2 pb-1 border-b border-gray-100 text-[9px] text-gray-400 font-bold">
        <span className="w-4 shrink-0 text-center">棒</span>
        <span className="w-8 shrink-0 text-center">守備</span>
        <span className="flex-1">選手</span>
        <span className="w-5 shrink-0 text-center">打</span>
        <span className="w-10 shrink-0 text-right">打率</span>
      </div>
      <div className="space-y-0">
        {grouped.map(({ order, starter, subs }) => {
          const starterStats = avgMap[starter.player_name];
          const isReplaced = subs.length > 0;
          return (
            <div key={order}>
              {/* 先發 */}
              <div className={`flex items-center gap-2 py-[3px] px-2 text-xs hover:bg-gray-50 ${isReplaced ? 'opacity-40' : ''}`}>
                <span className="w-4 shrink-0 text-center font-black text-[11px] text-gray-700">{order}</span>
                <span className="w-8 shrink-0 text-center text-[10px] font-bold text-gray-600">({starter.position || '–'})</span>
                <span className="flex-1 truncate text-[11px] font-bold text-gray-800">{starter.player_name}</span>
                <span className="shrink-0 text-[10px] w-5 text-center text-gray-400">
                  {starterStats?.atBats != null && starterStats.atBats > 0 ? starterStats.atBats : '–'}
                </span>
                <span className="text-gray-500 tabular-nums text-[11px] shrink-0 w-10 text-right">
                  {starterStats?.avg ?? '.---'}
                </span>
              </div>
              {/* 代打・代走 */}
              {subs.map((s, i) => {
                const subStats = avgMap[s.player_name];
                return (
                  <div key={i} className="flex items-center gap-2 py-[3px] px-2 text-xs hover:bg-amber-50 bg-amber-50/30">
                    <span className="w-4 shrink-0" />
                    <span className="w-8 shrink-0 text-center text-[10px] font-bold text-amber-600">{s.position || '代'}</span>
                    <span className="flex-1 truncate text-[11px] font-medium text-amber-700">{s.player_name}</span>
                    <span className="shrink-0 text-[10px] w-5 text-center text-gray-400">
                      {subStats?.atBats != null && subStats.atBats > 0 ? subStats.atBats : '–'}
                    </span>
                    <span className="text-amber-600 tabular-nums text-[11px] shrink-0 w-10 text-right">
                      {subStats?.avg ?? '.---'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 從 PBP 推導每局打擊結果（Content → 短碼）────────────────────────────────────

function cpblResultShortCode(text: string): string {
  if (!text) return '';
  if (text.includes('全壘打')) return '全打';
  if (text.includes('三壘安打')) return '三安';
  if (text.includes('二壘安打')) return '二安';
  if (text.includes('一壘安打') || text.includes('內野安打')) return '一安';
  if (text.includes('四壞球') || text.includes('四壞') || text.includes('四球')) return '四球';
  if (text.includes('死球') || text.includes('觸身球')) return '死球';
  if (text.includes('犧牲短打') || text.includes('犧打')) return '犧打';
  if (text.includes('犧牲飛球') || text.includes('犧飛')) return '犧飛';
  if (text.includes('三振')) return '三振';
  if (text.includes('雙殺打') || text.includes('雙殺')) return '雙殺';
  if (text.includes('飛球接殺') || text.includes('高飛')) return '飛出';
  if (text.includes('平飛')) return '直飛';
  if (text.includes('滾地球') && text.includes('出局')) return '滾出';
  if (text.includes('出局')) return '出局';
  return '';
}

function isFinalEvent(text: string): boolean {
  return (
    text.includes('出局') ||
    text.includes('安打') ||
    text.includes('全壘打') ||
    text.includes('四壞球') ||
    text.includes('四壞') ||
    text.includes('四球') ||
    text.includes('死球') ||
    text.includes('觸身球') ||
    text.includes('犧牲')
  );
}

// Returns: { [playerName]: { [inning]: shortCode } }
function buildCpblInningResultMap(
  pbpEvents: PlayByPlayEvent[]
): Record<string, Record<number, string>> {
  const map: Record<string, Record<number, string>> = {};
  // PBP events arrive in sequence; we keep the last "final" event per batter per inning
  for (const ev of pbpEvents) {
    const name = ev.batter_name;
    if (!name) continue;
    if (!isFinalEvent(ev.result_text)) continue;
    const code = cpblResultShortCode(ev.result_text);
    if (!code) continue;
    if (!map[name]) map[name] = {};
    map[name][ev.inning] = code;
  }
  return map;
}

// ── 打者成績表（與 NPB 同款格式）───────────────────────────────────────────────

function BatterTable({ title, batters, lineups, inningResultMap }: {
  title: string; batters: BatterRow[]; lineups?: LineupRow[];
  inningResultMap?: Record<string, Record<number, string>>;
}) {
  // Compute max inning from inningResultMap or at_bat_results
  const maxInningFromMap = inningResultMap
    ? Math.max(0, ...Object.values(inningResultMap).flatMap(m => Object.keys(m).map(Number)))
    : 0;
  const maxResults = Math.max(...batters.map(b => b.at_bat_results?.length ?? 0), 0, maxInningFromMap);
  const inningCols = Array.from({ length: maxResults }, (_, i) => i + 1);

  // 棒次對照表：從先發名單補充（batter stats 若未含棒次時使用）
  const lineupOrderByName: Record<string, number> = {};
  lineups?.forEach(l => { if (l.batting_order > 0) lineupOrderByName[l.player_name] = l.batting_order; });

  // 正規化顯示棒次：無論 DB 存 1-9 或 10-18，一律顯示 1-9
  const uniqueOrders = [...new Set(
    batters.map(b => b.batting_order || lineupOrderByName[b.player_name] || 0).filter(o => o > 0)
  )].sort((a, b) => a - b);
  const displayOrderMap: Record<number, number> = {};
  uniqueOrders.forEach((o, i) => { displayOrderMap[o] = i + 1; });

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
                <th key={n} className="px-1.5 py-1.5 font-bold text-gray-400 min-w-[36px]">{n}回</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Build starter lookup from lineups: for each batting_order, the FIRST player in lineups is the starter
              const starterByOrder: Record<number, string> = {};
              if (lineups && lineups.length > 0) {
                // lineups is already sorted by batting_order from the parent filter
                // The starter is the one whose position is NOT 代打/代走/pinch
                for (const l of lineups) {
                  if (l.batting_order > 0 && !starterByOrder[l.batting_order]) {
                    starterByOrder[l.batting_order] = l.player_name;
                  }
                }
              }
              const seenOrders = new Set<number>();
              return batters.map((b, i) => {
              const order = b.batting_order || lineupOrderByName[b.player_name] || 0;
              // If we have lineup data, use it to determine starter; otherwise fall back to first-seen
              const isStarter = order > 0 && (
                starterByOrder[order]
                  ? starterByOrder[order] === b.player_name
                  : !seenOrders.has(order)
              );
              if (order > 0) seenOrders.add(order);
              const isSub = order > 0 && !isStarter;
              const avg = b.season_avg != null && b.season_avg > 0
                ? Number(b.season_avg).toFixed(3)
                : b.at_bats > 0 ? (b.hits / b.at_bats).toFixed(3) : '.000';
              // Use inningResultMap if available, else fall back to at_bat_results array
              const playerInningMap = inningResultMap?.[b.player_name] ?? {};
              const hasInningData = Object.keys(playerInningMap).length > 0;
              const rowBg = isSub ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
              return (
                <tr key={i} className={rowBg}>
                  <td className="px-1.5 py-1.5 text-center tabular-nums font-black text-gray-700 sticky left-0 bg-inherit">
                    {isStarter && order > 0 ? (displayOrderMap[order] ?? order) : ''}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap sticky left-8 bg-inherit">
                    {isSub ? (
                      <span className="flex items-center gap-1">
                        <span className="text-amber-600 font-bold text-[10px]">{b.position || '代'}</span>
                        <span className="font-medium text-amber-700">{b.player_name}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        {b.position && <span className="text-gray-500 font-bold text-[10px]">({b.position})</span>}
                        <span className="font-bold text-gray-800">{b.player_name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-500">{avg}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{(() => { const pa = b.at_bats + b.walks + b.hit_by_pitch + b.sacrifice_hits; return pa > 0 ? pa : <span className="text-gray-300">–</span>; })()}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.runs > 0 ? b.runs : <span className="text-gray-300">0</span>}</td>
                  <td className={`px-1.5 py-1.5 text-center tabular-nums font-bold ${b.hits > 0 ? 'text-red-600' : ''}`}>{b.hits}</td>
                  <td className={`px-1.5 py-1.5 text-center tabular-nums font-bold ${b.home_runs > 0 ? 'text-red-600' : ''}`}>{b.home_runs}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.rbi}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.strikeouts}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.walks}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.hit_by_pitch}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.sacrifice_hits}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums">{b.stolen_bases}</td>
                  {inningCols.map(n => {
                    const result = hasInningData
                      ? (playerInningMap[n] ?? '')
                      : (b.at_bat_results?.[n - 1] ?? '');
                    const isHr   = result.includes('全打');
                    const isHit  = !isHr && (result.includes('安') || result === '一安' || result === '二安' || result === '三安');
                    const isWalk = result === '四球' || result === '死球';
                    return (
                      <td key={n} className="px-1 py-1 text-center whitespace-nowrap min-w-[36px]">
                        {result ? (
                          <span className={
                            isHr   ? 'inline-block px-1 py-0.5 rounded text-[10px] font-black text-white bg-red-600' :
                            isHit  ? 'inline-block px-1 py-0.5 rounded text-[10px] font-bold text-red-600 bg-red-50' :
                            isWalk ? 'text-[10px] text-blue-500 font-bold' :
                            'text-[10px] text-gray-500'
                          }>{result}</span>
                        ) : (
                          <span className="text-gray-200 text-[10px]">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
              });
            })()}
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

function PitcherTable({ title, pitchers, stats }: { title: string; pitchers: PitcherRow[]; stats?: GameStats | null }) {
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
              const gameEra = ipNum > 0 ? ((p.earned_runs / ipNum) * 27).toFixed(2) : '–';
              // 優先顯示賽季防禦率，不足3局時顯示本場
              const era = p.season_era != null ? Number(p.season_era).toFixed(2) : gameEra;
              const eraLabel = p.season_era != null ? `${era}` : gameEra;
              const derivedResult = p.result ??
                (stats?.win_pitcher && p.player_name === stats.win_pitcher ? '勝' :
                 stats?.loss_pitcher && p.player_name === stats.loss_pitcher ? '敗' :
                 stats?.save_pitcher && p.player_name === stats.save_pitcher ? '救' : null);
              const resultColor = derivedResult === '勝' ? 'text-green-600' : derivedResult === '敗' ? 'text-red-600' : derivedResult === '救' ? 'text-blue-600' : 'text-gray-500';
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1.5 font-bold text-gray-800 whitespace-nowrap sticky left-0 bg-inherit">{p.player_name}</td>
                  <td className="px-1.5 py-1.5 text-center text-gray-600">
                    {eraLabel}
                    {p.season_era != null && <span className="text-gray-400 text-[9px] ml-0.5">季</span>}
                  </td>
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
                  <td className={`px-1.5 py-1.5 text-center font-black ${resultColor}`}>{derivedResult ?? ''}</td>
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

function InningScoreTable({ innings, stats, awayName, homeName, totalAway, totalHome, gameStatus }: {
  innings: InningRow[];
  stats: GameStats | null;
  awayName: string; homeName: string;
  totalAway: number; totalHome: number;
  gameStatus: string;
}) {
  if (innings.length === 0 && !stats) {
    // Live game with known score: show table with dashes (innings still loading)
    if (gameStatus === 'live' && (totalAway > 0 || totalHome > 0)) {
      // fall through to render table
    } else {
      return <p className="text-center py-4 text-gray-400 text-sm">比分資料尚未更新</p>;
    }
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
  const [innings,   setInnings]   = useState<InningRow[]>([]);
  const [stats,     setStats]     = useState<GameStats | null>(null);
  const [batters,   setBatters]   = useState<BatterRow[]>([]);
  const [pitchers,  setPitchers]  = useState<PitcherRow[]>([]);
  const [lineups,   setLineups]   = useState<LineupRow[]>([]);
  const [pbpEvents, setPbpEvents] = useState<PlayByPlayEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tab,          setTab]          = useState<MainTab>('score');
  const [statsTab,     setStatsTab]     = useState<StatsSubTab>('batter');
  const [pbpKey,       setPbpKey]       = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLive  = game.status === 'live';
  const isFinal = game.status === 'final';

  const loadData = async () => {
    const [inn, st, bat, lu, pit, pbp] = await Promise.all([
      fetch(`${API_BASE}/api/v1/games/${game.id}/innings`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/v1/games/${game.id}/stats`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/api/v1/games/${game.id}/batters`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/v1/games/${game.id}/lineups`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/v1/games/${game.id}/pitchers`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/v1/games/${game.id}/play-by-play`).then(r => r.json()).catch(() => []),
    ]);
    setInnings(Array.isArray(inn) ? inn : []);
    setStats(st);
    setBatters(Array.isArray(bat) ? bat : []);
    setPitchers(Array.isArray(pit) ? pit : []);
    setLineups(Array.isArray(lu) ? lu : []);
    setPbpEvents(Array.isArray(pbp) ? pbp : []);
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

  // Split batters by team — match by code OR name (for robustness)
  const awayCode = Object.entries(TEAM_CODE_MAP).find(([, name]) => name === game.team_away)?.[0];
  const homeCode = Object.entries(TEAM_CODE_MAP).find(([, name]) => name === game.team_home)?.[0];
  const awayBatters = batters
    .filter(b => b.team_code === awayCode || b.team_code === game.team_away)
    .sort((a, b) => a.batting_order - b.batting_order);
  const homeBatters = batters
    .filter(b => b.team_code === homeCode || b.team_code === game.team_home)
    .sort((a, b) => a.batting_order - b.batting_order);

  // 打者打率查詢表（名字 → 賽季打率，若無則用本場）
  const batterAvgMap: Record<string, string> = {};
  batters.forEach(b => {
    if (b.season_avg != null && b.season_avg > 0) {
      batterAvgMap[b.player_name] = Number(b.season_avg).toFixed(3);
    } else if (b.at_bats > 0) {
      batterAvgMap[b.player_name] = (b.hits / b.at_bats).toFixed(3);
    } else {
      batterAvgMap[b.player_name] = '.000';
    }
  });

  // 投手成績查詢表（名字 → ERA + 球數，優先顯示賽季防禦率）
  const pitcherStatsMap: Record<string, { era: string; pitch_count: number }> = {};
  pitchers.forEach(p => {
    const ipNum = parseInnings(p.innings_pitched);
    const gameEra = ipNum > 0 ? ((p.earned_runs / ipNum) * 27).toFixed(2) : '–';
    const era = p.season_era != null ? Number(p.season_era).toFixed(2) : gameEra;
    pitcherStatsMap[p.player_name] = { era, pitch_count: p.pitch_count };
  });

  // 打者本場逐打席結果查詢表（名字 → at_bat_results[]）
  const batterResultMap: Record<string, string[]> = {};
  batters.forEach(b => {
    if (b.at_bat_results?.length) batterResultMap[b.player_name] = b.at_bat_results;
  });

  // 最新打席事件（PBP 以 sequence_num ASC 排序，最後一筆最新）
  const latestEvent = pbpEvents[pbpEvents.length - 1] ?? null;

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
              gameStatus={game.status}
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
                <div className="space-y-4">
                  {/* 先發投手 */}
                  {(() => {
                    const awayPitcher = lineups.find(l => !l.is_home && l.batting_order === 0);
                    const homePitcher = lineups.find(l => l.is_home && l.batting_order === 0);
                    if (!awayPitcher && !homePitcher) return null;
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        {[awayPitcher, homePitcher].map((p, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-xs border border-blue-100">
                            <span className="text-blue-500 font-black w-5 text-center shrink-0">先</span>
                            <span className="text-gray-400 text-[10px] shrink-0">P</span>
                            <span className="font-bold text-gray-800 flex-1 truncate">{p?.player_name ?? '未定'}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {/* 打者陣容 */}
                  <div className="grid grid-cols-2 gap-6">
                    <CpblLineupPanel
                      name={game.team_away}
                      lineups={lineups.filter(l => !l.is_home && l.batting_order > 0)}
                      batters={awayBatters}
                    />
                    <CpblLineupPanel
                      name={game.team_home}
                      lineups={lineups.filter(l => l.is_home && l.batting_order > 0)}
                      batters={homeBatters}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'score' ? (
            /* 比分速報：球場面板 */
            <BaseballFieldPanel
              outs={isFinal ? 3 : 0}
              latestEvent={latestEvent}
              isFinal={isFinal}
              allEvents={pbpEvents}
              batterAvgMap={batterAvgMap}
              batterResultMap={batterResultMap}
              pitcherStatsMap={pitcherStatsMap}
            />
          ) : tab === 'pbp' ? (
            /* 文字速報 */
            <div className="p-4">
              <LiveGameText
                key={pbpKey}
                gameId={game.id}
                awayTeam={game.team_away}
                homeTeam={game.team_home}
                batterAvgMap={batterAvgMap}
                pitcherStatsMap={pitcherStatsMap}
              />
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
                    {(() => {
                      const inningResultMap = buildCpblInningResultMap(pbpEvents);
                      return (
                        <>
                          {awayBatters.length > 0 && <BatterTable title={game.team_away} batters={awayBatters} lineups={lineups.filter(l => !l.is_home)} inningResultMap={inningResultMap} />}
                          {homeBatters.length > 0 && <BatterTable title={game.team_home} batters={homeBatters} lineups={lineups.filter(l => l.is_home)} inningResultMap={inningResultMap} />}
                          {awayBatters.length === 0 && homeBatters.length === 0 && (
                            <p className="text-center py-10 text-gray-400 font-bold">打者成績尚未更新</p>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {awayCode && pitchers.filter(p => p.team_code === awayCode).length > 0 && (
                      <PitcherTable title={game.team_away} pitchers={pitchers.filter(p => p.team_code === awayCode)} stats={stats} />
                    )}
                    {homeCode && pitchers.filter(p => p.team_code === homeCode).length > 0 && (
                      <PitcherTable title={game.team_home} pitchers={pitchers.filter(p => p.team_code === homeCode)} stats={stats} />
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
