/**
 * FarmGameDetail — 二軍比賽詳情（Docomo API）
 * 資料與 NPB 一軍共用相同 tables：game_batter_stats / game_pitcher_stats / game_play_by_play / game_pitch_data
 * UI 完全對應 NpbGameDetail
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getGameInnings, getGameStats, getGameBatters, getGamePitchers,
  getGamePlayByPlay, getGamePitchData,
  GameInning, GameStats, BatterStat, PitcherStat, PlayByPlayEvent, PitchData,
} from '../api/npb';

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

// ── TeamLogo（by name）───────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface NPBGame {
  id: number;
  team_home: string; team_away: string;
  score_home: number | null; score_away: number | null;
  status: string;
  game_date: string;
  venue: string | null;
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
    <div className="flex flex-col gap-1.5 select-none">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-300 w-3.5 font-bold">B</span>
        {[0,1,2].map(i => (
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
        {[0,1].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < outs ? 'bg-red-400 border-red-300' : 'bg-gray-700 border-gray-600'}`} />
        ))}
      </div>
    </div>
  );
}

// ── 好球帶 ────────────────────────────────────────────────────────────────────

const BALL_KIND_COLORS: Record<string, string> = {
  'ストレート': '#ef4444', 'フォーシーム': '#ef4444', 'ツーシーム': '#f97316',
  'カットボール': '#eab308', 'スライダー': '#22c55e', 'カーブ': '#06b6d4',
  'チェンジアップ': '#a855f7', 'フォーク': '#3b82f6', 'シンカー': '#f472b6', 'シュート': '#fb923c',
};
const DEFAULT_PITCH_COLOR = '#9ca3af';
function pitchColor(k: string) {
  for (const [key, c] of Object.entries(BALL_KIND_COLORS)) if (k.includes(key)) return c;
  return DEFAULT_PITCH_COLOR;
}
const SZ_W = 80, SZ_H = 90;
const SZ_LEFT = 18, SZ_RIGHT = 62, SZ_TOP = 12, SZ_BOTTOM = 64;
function mapXY(dx: number, dy: number) {
  return {
    cx: SZ_LEFT + ((dx - 55) / (145 - 55)) * (SZ_RIGHT - SZ_LEFT),
    cy: SZ_TOP  + ((dy - 30) / (170 - 30)) * (SZ_BOTTOM - SZ_TOP),
  };
}

function StrikeZoneOverlay({ pitches = [] }: { pitches?: PitchData[] }) {
  const hasPitches = pitches.length > 0;
  const kinds = [...new Set(pitches.map(p => p.ball_kind).filter(Boolean))];
  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] text-gray-300 font-bold tracking-wider mb-1 text-center">好球帶</div>
      <svg width={SZ_W} height={SZ_H + 14} viewBox={`0 0 ${SZ_W} ${SZ_H + 14}`}>
        <rect x={SZ_LEFT} y={SZ_TOP} width={SZ_RIGHT - SZ_LEFT} height={SZ_BOTTOM - SZ_TOP}
          fill="rgba(255,255,255,0.08)" stroke="rgba(156,163,175,0.7)" strokeWidth="1" />
        {[1,2].map(i => (
          <g key={i}>
            <line x1={SZ_LEFT + (SZ_RIGHT - SZ_LEFT)*i/3} y1={SZ_TOP} x2={SZ_LEFT + (SZ_RIGHT - SZ_LEFT)*i/3} y2={SZ_BOTTOM} stroke="rgba(156,163,175,0.4)" strokeWidth="0.5" />
            <line x1={SZ_LEFT} y1={SZ_TOP + (SZ_BOTTOM - SZ_TOP)*i/3} x2={SZ_RIGHT} y2={SZ_TOP + (SZ_BOTTOM - SZ_TOP)*i/3} stroke="rgba(156,163,175,0.4)" strokeWidth="0.5" />
          </g>
        ))}
        {pitches.map((p, i) => {
          const { cx, cy } = mapXY(p.x, p.y);
          const color = pitchColor(p.ball_kind);
          const isLast = i === pitches.length - 1;
          return (
            <g key={`${p.at_bat_key}-${p.pitch_num}`}>
              <circle cx={cx} cy={cy} r={isLast ? 4 : 3} fill={color}
                stroke={isLast ? 'white' : color} strokeWidth={isLast ? 1.5 : 0.5} opacity={isLast ? 1 : 0.75} />
              {isLast && p.speed && (
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize="5" fill="white" fontWeight="bold">{p.speed}</text>
              )}
            </g>
          );
        })}
        <polygon
          points={`${SZ_W/2},${SZ_H-2} ${SZ_W/2+10},${SZ_H-2} ${SZ_W/2+10},${SZ_H+5} ${SZ_W/2},${SZ_H+8} ${SZ_W/2-10},${SZ_H+5} ${SZ_W/2-10},${SZ_H-2}`}
          fill="#9ca3af" opacity="0.7" />
      </svg>
      {hasPitches && kinds.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 justify-center max-w-[90px]">
          {kinds.map(k => (
            <div key={k} className="flex items-center gap-0.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pitchColor(k) }} />
              <span className="text-[8px] text-gray-300 whitespace-nowrap">{k}</span>
            </div>
          ))}
        </div>
      )}
      {hasPitches && (
        <div className="mt-1 text-center">
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
            pitches[pitches.length - 1].is_strike ? 'bg-red-500/30 text-red-300' : 'bg-green-500/30 text-green-300'
          }`}>
            {pitches[pitches.length - 1].result || (pitches[pitches.length - 1].is_strike ? 'ストライク' : 'ボール')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── PBP 解析（同 NpbGameDetail）──────────────────────────────────────────────

function parseNpbDescription(desc: string) {
  const outsMatch = desc.match(/^(\d)アウト/);
  const outs = outsMatch ? parseInt(outsMatch[1], 10) : 0;
  const base1 = /1塁/.test(desc), base2 = /2塁/.test(desc), base3 = /3塁/.test(desc), manrui = /満塁/.test(desc);
  const bsoMatch = desc.match(/(\d)-(\d)より/);
  const balls = bsoMatch ? parseInt(bsoMatch[1], 10) : 0;
  const strikes = bsoMatch ? parseInt(bsoMatch[2], 10) : 0;
  const beforeBso = desc.split(/\d-\dより/)[0] ?? desc;
  const tokens = beforeBso.replace(/^\d+アウト\s*/, '').replace(/[満1-3]?[・塁]+/g, '').trim().split(/\s+/);
  const batterName = tokens.filter(t => t.length > 0).pop() ?? '';
  const yoriIdx = desc.indexOf('より');
  const resultText = yoriIdx >= 0 ? desc.slice(yoriIdx + 2).trim() : '';
  return { outs, balls, strikes, base1: base1||manrui, base2: base2||manrui, base3: base3||manrui, batterName, resultText };
}

function inferFarmRunners(events: PlayByPlayEvent[]) {
  if (!events.length) return { base1: null as string|null, base2: null as string|null, base3: null as string|null };
  const latest = events[events.length - 1];
  const sameHalf = events.filter(e => e.inning === latest.inning && e.is_top === latest.is_top);
  let b1: string|null = null, b2: string|null = null, b3: string|null = null;
  for (const ev of sameHalf) {
    const { batterName, resultText } = parseNpbDescription(ev.description);
    if (!batterName) continue;
    if (/本塁打/.test(resultText)) { b1=null; b2=null; b3=null; }
    else if (/三塁打/.test(resultText)) { b1=null; b2=null; b3=batterName; }
    else if (/二塁打/.test(resultText)) { b3=b2; b2=batterName; b1=null; }
    else if (/ヒット|安打|内野安打/.test(resultText)) { b3=b2; b2=b1; b1=batterName; }
    else if (/四球|死球/.test(resultText)) {
      if (b1&&b2) { b3=b2; b2=b1; b1=batterName; }
      else if (b1) { b2=b1; b1=batterName; }
      else { b1=batterName; }
    } else if (/盗塁/.test(resultText)) {
      if (b1) { b2=b1; b1=null; } else if (b2) { b3=b2; b2=null; }
    }
  }
  return { base1: b1, base2: b2, base3: b3 };
}

// ── 棒球場面板 ────────────────────────────────────────────────────────────────

function BaseballFieldPanel({
  latestEvent, isFinal, allEvents, currentPitcherName, currentBatterName, pitches,
}: {
  latestEvent?: PlayByPlayEvent; isFinal: boolean; allEvents?: PlayByPlayEvent[];
  currentPitcherName?: string; currentBatterName?: string; pitches?: PitchData[];
}) {
  const parsed = latestEvent ? parseNpbDescription(latestEvent.description) : null;
  const has1B = parsed?.base1 ?? false, has2B = parsed?.base2 ?? false, has3B = parsed?.base3 ?? false;
  const balls = parsed?.balls ?? 0, strikes = parsed?.strikes ?? 0, outs = isFinal ? 3 : (parsed?.outs ?? 0);
  const runners = allEvents ? inferFarmRunners(allEvents) : { base1: null, base2: null, base3: null };

  const bp = { b1: { left:'85%', top:'45%' }, b2: { left:'50%', top:'33%' }, b3: { left:'15%', top:'45%' } };

  const BaseMarker = ({ active, runner }: { active: boolean; runner?: string|null }) => (
    <div className="flex flex-col items-center gap-0.5">
      {active && runner && (
        <div className="mb-0.5 bg-black/85 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow border border-yellow-400/30">{runner}</div>
      )}
      <div className={`w-5 h-5 rounded-sm border-2 shadow ${active ? 'bg-yellow-400 border-yellow-200 shadow-yellow-400/50' : 'bg-white/85 border-gray-300'}`}
        style={{ transform: 'rotate(45deg)' }} />
    </div>
  );

  return (
    <div className="relative overflow-hidden bg-gray-900" style={{ height: 400 }}>
      <img src="/baseball-field.png" alt="baseball field" className="absolute inset-0 w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute" style={{ left: bp.b2.left, top: bp.b2.top, transform:'translate(-50%,-50%)' }}><BaseMarker active={has2B} runner={runners.base2} /></div>
      <div className="absolute" style={{ left: bp.b3.left, top: bp.b3.top, transform:'translate(-50%,-50%)' }}><BaseMarker active={has3B} runner={runners.base3} /></div>
      <div className="absolute" style={{ left: bp.b1.left, top: bp.b1.top, transform:'translate(-50%,-50%)' }}><BaseMarker active={has1B} runner={runners.base1} /></div>
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-xl">
        <div className="text-[9px] text-gray-400 font-bold tracking-widest text-center mb-1.5">B · S · O</div>
        <BSOLights balls={balls} strikes={strikes} outs={outs} />
      </div>
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-3 shadow-xl">
        <StrikeZoneOverlay pitches={pitches ?? []} />
      </div>
      {!isFinal && currentPitcherName && (
        <div className="absolute bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 shadow-xl text-center"
          style={{ left:'50%', top:'60%', transform:'translate(-50%,-50%)' }}>
          <div className="text-[9px] text-gray-400 font-bold tracking-wide mb-0.5">投手</div>
          <div className="text-white font-black text-sm">{currentPitcherName}</div>
        </div>
      )}
      {!isFinal && currentBatterName && (
        <div className="absolute bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 shadow-xl text-center"
          style={{ left:'50%', bottom:'4px', transform:'translateX(-50%)' }}>
          <div className="text-[9px] text-gray-400 font-bold tracking-wide mb-0.5">打者</div>
          <div className="text-white font-black text-sm">{currentBatterName}</div>
        </div>
      )}
      {isFinal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-white text-3xl font-black tracking-widest drop-shadow-lg">試合終了</div>
          <div className="text-gray-300 text-lg font-bold mt-1 tracking-widest">FINAL</div>
        </div>
      )}
    </div>
  );
}

// ── 局分表 ────────────────────────────────────────────────────────────────────

function InningScoreTable({ innings, stats, awayName, homeName, totalAway, totalHome }: {
  innings: GameInning[]; stats: GameStats | null;
  awayName: string; homeName: string; totalAway: number; totalHome: number;
}) {
  if (innings.length === 0) return <p className="text-center py-4 text-gray-400 text-sm">比分資料尚未更新</p>;
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
            {stats && <><th className="px-2 py-2 font-bold text-gray-500">H</th><th className="px-2 py-2 font-bold text-gray-500">E</th></>}
          </tr>
        </thead>
        <tbody>
          {[
            { name: awayName, getScore: (i: GameInning) => i.score_away, total: totalAway, hits: stats?.hits_away, errors: stats?.errors_away },
            { name: homeName, getScore: (i: GameInning) => i.score_home, total: totalHome, hits: stats?.hits_home, errors: stats?.errors_home },
          ].map((team, ri) => (
            <tr key={ri} className={ri === 0 ? 'border-b border-gray-200' : ''}>
              <td className="text-left px-3 py-2 font-bold text-gray-800">{team.name}</td>
              {cols.map(n => {
                const inn = innings.find(i => i.inning === n);
                const score = inn ? team.getScore(inn) : null;
                return (
                  <td key={n} className="px-2 py-2 tabular-nums text-gray-700">
                    {score !== null && score !== undefined ? score : <span className="text-gray-300">·</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 font-black text-gray-900 border-l border-gray-200 tabular-nums">{team.total}</td>
              {stats && <><td className="px-2 py-2 text-gray-600 tabular-nums">{team.hits ?? 0}</td><td className="px-2 py-2 text-gray-600 tabular-nums">{team.errors ?? 0}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
      {stats && (stats.win_pitcher || stats.loss_pitcher) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
          {stats.win_pitcher  && <span><span className="text-green-600 font-bold">勝</span> {stats.win_pitcher}</span>}
          {stats.loss_pitcher && <span><span className="text-red-600 font-bold">敗</span> {stats.loss_pitcher}</span>}
          {stats.save_pitcher && <span><span className="text-blue-600 font-bold">救</span> {stats.save_pitcher}</span>}
          {stats.game_time    && <span>時間 {stats.game_time}</span>}
        </div>
      )}
    </div>
  );
}

// ── 先発投手カード ────────────────────────────────────────────────────────────

function StarterCard({ label, name, pitchCount }: { label: string; name: string; pitchCount?: number }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
      <div className="text-[10px] text-gray-400 font-bold mb-1.5 tracking-wide">先発投手 · {label}</div>
      <div className="font-black text-gray-800">{name || '未定'}</div>
      {pitchCount != null && pitchCount > 0 && (
        <div className="text-xs text-gray-500 mt-1">{pitchCount} 球</div>
      )}
    </div>
  );
}

// ── 打撃陣容 ──────────────────────────────────────────────────────────────────

function LineupPanel({ name, batters }: { name: string; batters: BatterStat[] }) {
  if (batters.length === 0) return <div className="text-center py-6 text-gray-400 text-xs">打者資料尚未更新</div>;
  const shownOrders = new Set<number>();
  return (
    <div>
      <div className="font-black text-xs text-gray-700 mb-2 px-1">{name}</div>
      <div className="flex items-center gap-2 px-2 pb-1 border-b border-gray-100 text-[9px] text-gray-400 font-bold">
        <span className="w-4 shrink-0 text-center">棒</span>
        <span className="w-8 shrink-0 text-center">守備</span>
        <span className="flex-1">選手</span>
        <span className="w-4 shrink-0 text-center">打</span>
        <span className="w-10 shrink-0 text-right">打率</span>
      </div>
      <div className="space-y-0">
        {batters.map((b, i) => {
          const avg = b.at_bats > 0 ? (b.hits / b.at_bats).toFixed(3) : '.---';
          const pos = b.position || '–';
          const isStarter = pos.startsWith('(') || pos.startsWith('（');
          const showOrder = isStarter && !shownOrders.has(b.batting_order);
          if (showOrder) shownOrders.add(b.batting_order);
          return (
            <div key={i} className={`flex items-center gap-2 py-[3px] px-2 text-xs ${isStarter ? 'hover:bg-gray-50' : 'hover:bg-amber-50 bg-amber-50/30'}`}>
              <span className="w-4 shrink-0 text-center font-black text-[11px] text-gray-700">{showOrder ? b.batting_order : ''}</span>
              <span className={`w-8 shrink-0 text-center text-[10px] font-bold ${isStarter ? 'text-gray-600' : 'text-amber-600'}`}>{pos}</span>
              <span className={`flex-1 truncate text-[11px] ${isStarter ? 'font-bold text-gray-800' : 'font-medium text-amber-700'}`}>{b.player_name}</span>
              <span className="text-gray-500 tabular-nums text-[11px] shrink-0 w-4 text-center">–</span>
              <span className="text-gray-500 tabular-nums text-[11px] shrink-0 w-10 text-right">{avg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 日文→中文翻譯 ─────────────────────────────────────────────────────────────

function translateJa(text: string): string {
  const map: [RegExp | string, string][] = [
    [/0アウト/g,'0出局'],[/1アウト/g,'1出局'],[/2アウト/g,'2出局'],[/無死/g,'0出局'],
    [/1塁/g,'1壘'],[/2塁/g,'2壘'],[/3塁/g,'3壘'],
    [/1・2塁/g,'1・2壘'],[/1・3塁/g,'1・3壘'],[/2・3塁/g,'2・3壘'],
    [/満塁/g,'滿壘'],[/無走者/g,'壘上無人'],
    [/より/g,' → '],
    ['空振り三振','空振三振'],['見逃し三振','見逃三振'],
    ['内野安打','內野安打'],[/ヒット/g,'安打'],
    ['本塁打','全壘打'],['ホームラン','全壘打'],
    ['二塁打','二壘安打'],['三塁打','三壘安打'],
    ['ショートゴロ','游擊滾地球'],['セカンドゴロ','二壘滾地球'],['ファーストゴロ','一壘滾地球'],
    ['サードゴロ','三壘滾地球'],['ピッチャーゴロ','投手前滾地球'],['キャッチャーゴロ','捕手前滾地球'],
    [/ゴロ/g,'滾地球'],
    ['センターフライ','中外野飛球'],['ライトフライ','右外野飛球'],['レフトフライ','左外野飛球'],
    ['ファウルフライ','界外飛球'],['内野フライ','內野飛球'],[/フライ/g,'飛球'],
    ['センターライナー','中外野平飛球'],['ライトライナー','右外野平飛球'],['レフトライナー','左外野平飛球'],
    [/ライナー/g,'平飛球'],
    ['犠打','犧打'],['犠飛','犧牲飛球'],['バント安打','觸擊安打'],[/バント/g,'觸擊'],
    ['四球','四壞球'],['死球','觸身球'],['敬遠','故意四壞'],
    ['野手選択','野手選擇'],['失策','失誤'],
    ['盗塁死','盜壘出局'],['盗塁','盜壘'],
    ['併殺打','雙殺打'],['併殺','雙殺'],
    [/（投手交代）/g,'（投手替換）'],[/投手交代/g,'投手替換'],
  ];
  let result = text;
  for (const [pattern, replacement] of map) {
    if (typeof pattern === 'string') result = result.split(pattern).join(replacement);
    else result = result.replace(pattern, replacement);
  }
  return result;
}

// ── 文字速報ヘルパー ──────────────────────────────────────────────────────────

/** 橫向 BSO 點（白底卡片用） */
function BSODotsWhite({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
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

/** 壘包菱形（白底卡片用） */
function BaseDiamondSmall({ base1, base2, base3 }: { base1: boolean; base2: boolean; base3: boolean }) {
  const size = 9, gap = 2, span = size + gap, svgSize = span * 2 + size;
  return (
    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
      <rect x={span} y={0} width={size} height={size} rx={1}
        transform={`rotate(45 ${span + size/2} ${size/2})`}
        fill={base2 ? '#f59e0b' : '#d1d5db'} />
      <rect x={0} y={span} width={size} height={size} rx={1}
        transform={`rotate(45 ${size/2} ${span + size/2})`}
        fill={base3 ? '#f59e0b' : '#d1d5db'} />
      <rect x={span*2} y={span} width={size} height={size} rx={1}
        transform={`rotate(45 ${span*2 + size/2} ${span + size/2})`}
        fill={base1 ? '#f59e0b' : '#d1d5db'} />
      <rect x={span} y={span*2} width={size} height={size} rx={1}
        transform={`rotate(45 ${span + size/2} ${span*2 + size/2})`}
        fill="#d1d5db" />
    </svg>
  );
}

/** 打擊結果徽章（中文結果文字） */
function resultBadgeFarm(resultJa: string): { label: string; color: string } | null {
  const t = translateJa(resultJa);
  if (/全壘打/.test(t)) return { label: '全打', color: 'bg-red-600 text-white' };
  if (/三壘安打/.test(t)) return { label: '三安', color: 'bg-orange-500 text-white' };
  if (/二壘安打/.test(t)) return { label: '二安', color: 'bg-green-600 text-white' };
  if (/安打|ヒット/.test(resultJa)) return { label: '安打', color: 'bg-green-500 text-white' };
  if (/四球|四壞/.test(t)) return { label: '四壞', color: 'bg-teal-500 text-white' };
  if (/死球|觸身球/.test(t)) return { label: '死球', color: 'bg-blue-500 text-white' };
  if (/犠飛|犧牲飛球/.test(t)) return { label: '犠飛', color: 'bg-gray-500 text-white' };
  if (/犠打|犧打/.test(t)) return { label: '犠打', color: 'bg-gray-500 text-white' };
  if (/三振/.test(t)) return { label: '三振', color: 'bg-gray-400 text-white' };
  if (/雙殺|併殺/.test(t)) return { label: '雙殺', color: 'bg-gray-500 text-white' };
  if (/飛球/.test(t)) return { label: '飛出', color: 'bg-gray-400 text-white' };
  if (/平飛球/.test(t)) return { label: '直飛', color: 'bg-gray-400 text-white' };
  if (/滾地球/.test(t)) return { label: '滾出', color: 'bg-gray-400 text-white' };
  if (/失誤/.test(t)) return { label: '失誤', color: 'bg-yellow-500 text-white' };
  return null;
}

// ── 文字速報（卡片格式，對應 CPBL LiveGameText）──────────────────────────────

function FarmPBPCards({ events, awayName, homeName, pitchers }: {
  events: PlayByPlayEvent[];
  awayName: string;
  homeName: string;
  pitchers: { team_code: string; pitcher_order: number; player_name: string }[];
}) {
  const grouped: Map<string, PlayByPlayEvent[]> = new Map();
  for (const e of events) {
    const key = `${e.inning}-${e.is_top}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div>
      {[...grouped.entries()].reverse().map(([key, plays]) => {
        const [innStr, isTopStr] = key.split('-');
        const inning = parseInt(innStr), isTop = isTopStr === 'true';
        const attackTeam = isTop ? awayName : homeName;
        const defPitchers = pitchers
          .filter(p => p.team_code === (isTop ? homeName : awayName))
          .sort((a, b) => a.pitcher_order - b.pitcher_order);

        return (
          <div key={key}>
            {/* 局次標題 */}
            <div className={`px-4 py-1.5 text-xs font-bold sticky top-0 z-10 ${isTop ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'}`}>
              {inning}局{isTop ? '上' : '下'}（{attackTeam}攻）
            </div>
            {/* 每打席卡片 */}
            <div className="divide-y divide-gray-100">
              {[...plays].reverse().map((p, i) => {
                const parsed = parseNpbDescription(p.description);
                const badge = resultBadgeFarm(parsed.resultText);
                // find current pitcher by matching order (pitchers increase over game)
                const currentPitcher = defPitchers.length > 0
                  ? defPitchers[defPitchers.length - 1].player_name
                  : '';

                return (
                  <div key={i} className="px-4 py-3 bg-white hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      {/* 左側：打席順 + 打者名 + 結果徽章 */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-gray-400 font-bold tabular-nums w-4 shrink-0 text-center">{p.play_order}</span>
                        <span className="font-bold text-sm text-gray-800 truncate">{parsed.batterName || '–'}</span>
                        {badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>{badge.label}</span>
                        )}
                      </div>
                      {/* 右側：BSO + 壘包 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <BSODotsWhite balls={parsed.balls} strikes={parsed.strikes} outs={parsed.outs} />
                        <BaseDiamondSmall base1={parsed.base1} base2={parsed.base2} base3={parsed.base3} />
                      </div>
                    </div>
                    {/* 投手行 */}
                    {currentPitcher && (
                      <div className="text-[10px] text-gray-400 ml-6 mb-1">投手 {currentPitcher}</div>
                    )}
                    {/* 描述文字 */}
                    <div className="text-xs text-gray-600 ml-6 leading-relaxed">{translateJa(p.description)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 打者成績表 ────────────────────────────────────────────────────────────────

function BatterTable({ title, batters }: { title: string; batters: BatterStat[] }) {
  const maxResults = Math.max(...batters.map(b => b.at_bat_results?.length ?? 0), 0);
  const inningCols = Array.from({ length: maxResults }, (_, i) => i + 1);
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
              <th className="px-1.5 py-1.5 font-bold">点</th>
              <th className="px-1.5 py-1.5 font-bold">安</th>
              <th className="px-1.5 py-1.5 font-bold">本</th>
              <th className="px-1.5 py-1.5 font-bold">打点</th>
              <th className="px-1.5 py-1.5 font-bold">三</th>
              <th className="px-1.5 py-1.5 font-bold">四</th>
              <th className="px-1.5 py-1.5 font-bold">死</th>
              <th className="px-1.5 py-1.5 font-bold">犠</th>
              <th className="px-1.5 py-1.5 font-bold">盗</th>
              {inningCols.map(n => <th key={n} className="px-1.5 py-1.5 font-bold text-gray-400 min-w-[32px]">{n}回</th>)}
            </tr>
          </thead>
          <tbody>
            {batters.map((b, i) => {
              const avg = b.at_bats > 0 ? (b.hits / b.at_bats).toFixed(3) : '.000';
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-1.5 py-1.5 text-center tabular-nums font-bold text-gray-400 sticky left-0 bg-inherit">{b.batting_order || ''}</td>
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
                    const isHit = !isHr && (result.includes('安') || result.includes('二塁') || result.includes('三塁'));
                    return (
                      <td key={n} className="px-1 py-1 text-center whitespace-nowrap">
                        {result ? (
                          <span className={isHr ? 'inline-block px-1 rounded font-bold text-white bg-red-600' : isHit ? 'inline-block px-1 rounded font-bold text-red-600 bg-red-50' : 'text-gray-500'}>
                            {result}
                          </span>
                        ) : <span className="text-gray-200">·</span>}
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

// ── 投手成績表 ────────────────────────────────────────────────────────────────

function parseInnings(ip: string): number {
  if (!ip) return 0;
  const parts = ip.trim().split(/\s+/);
  const full = parseInt(parts[0], 10) || 0;
  if (parts[1] === '1/3') return full + 1/3;
  if (parts[1] === '2/3') return full + 2/3;
  return full;
}

function PitcherTable({ title, pitchers }: { title: string; pitchers: PitcherStat[] }) {
  return (
    <div>
      <h4 className="font-black text-sm text-gray-700 mb-2 px-1">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-500 text-center">
              <th className="text-left px-2 py-1.5 font-bold whitespace-nowrap">投手</th>
              <th className="px-1.5 py-1.5 font-bold">防御率</th>
              <th className="px-1.5 py-1.5 font-bold">投球回</th>
              <th className="px-1.5 py-1.5 font-bold">球数</th>
              <th className="px-1.5 py-1.5 font-bold">打者</th>
              <th className="px-1.5 py-1.5 font-bold">被安</th>
              <th className="px-1.5 py-1.5 font-bold">被本</th>
              <th className="px-1.5 py-1.5 font-bold">奪三</th>
              <th className="px-1.5 py-1.5 font-bold">与四</th>
              <th className="px-1.5 py-1.5 font-bold">与死</th>
              <th className="px-1.5 py-1.5 font-bold">失点</th>
              <th className="px-1.5 py-1.5 font-bold">自責</th>
              <th className="px-1.5 py-1.5 font-bold">結果</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => {
              const ipNum = parseInnings(p.innings_pitched);
              const era = ipNum > 0 ? ((p.earned_runs / ipNum) * 27).toFixed(2) : '–';
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1.5 font-bold text-gray-800 whitespace-nowrap">{p.player_name}</td>
                  <td className="px-1.5 py-1.5 text-center text-gray-600">{era}</td>
                  <td className="px-1.5 py-1.5 text-center text-gray-700">{p.innings_pitched}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.pitch_count}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.batters_faced}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.hits_allowed}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.home_runs_allowed}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums font-bold text-gray-700">{p.strikeouts}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.walks}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.hit_by_pitch}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.runs_allowed}</td>
                  <td className="px-1.5 py-1.5 text-center tabular-nums text-gray-700">{p.earned_runs}</td>
                  <td className="px-1.5 py-1.5 text-center text-gray-700 font-bold">{p.result ?? '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export default function FarmGameDetail({ game, onClose, standalone = false, onPrev, onNext, hasPrev = false, hasNext = false }: Props) {
  const [innings,    setInnings]    = useState<GameInning[]>([]);
  const [stats,      setStats]      = useState<GameStats | null>(null);
  const [batters,    setBatters]    = useState<BatterStat[]>([]);
  const [pitchers,   setPitchers]   = useState<PitcherStat[]>([]);
  const [playByPlay, setPlayByPlay] = useState<PlayByPlayEvent[]>([]);
  const [pitchData,  setPitchData]  = useState<PitchData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tab,          setTab]          = useState<MainTab>('score');
  const [statsTab,     setStatsTab]     = useState<StatsTab>('batter');
  const [awayScore, setAwayScore] = useState<number | null>(game.score_away);
  const [homeScore, setHomeScore] = useState<number | null>(game.score_home);
  const [liveStatus, setLiveStatus] = useState<string>(game.status);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLive  = liveStatus === 'live';
  const isFinal = liveStatus === 'final';

  const awayName = game.team_away;
  const homeName = game.team_home;

  const loadData = async () => {
    const [inn, st, bat, pit, pbp, pitches] = await Promise.all([
      getGameInnings(game.id),
      getGameStats(game.id).catch(() => null),
      getGameBatters(game.id),
      getGamePitchers(game.id),
      getGamePlayByPlay(game.id),
      getGamePitchData(game.id).catch(() => [] as PitchData[]),
    ]);
    setInnings(inn);
    setStats(st);
    setBatters(bat);
    setPitchers(pit);
    setPlayByPlay(pbp);
    setPitchData(pitches);
    if (inn.length > 0) {
      setAwayScore(inn.reduce((s, i) => s + (i.score_away ?? 0), 0));
      setHomeScore(inn.reduce((s, i) => s + (i.score_home ?? 0), 0));
    }
  };

  useEffect(() => {
    loadData().catch(() => {}).finally(() => setLoading(false));
    intervalRef.current = setInterval(() => loadData().catch(() => {}), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [game.id]);

  useEffect(() => {
    if (isFinal && intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, [isFinal]);

  useEffect(() => {
    setLiveStatus(game.status);
    if (game.score_away != null) setAwayScore(game.score_away);
    if (game.score_home != null) setHomeScore(game.score_home);
  }, [game.status, game.score_away, game.score_home]);

  // Docomo saves team_code = team full name (e.g. '日本ハム'), filter by game.team_away/team_home
  const awayBatters  = batters.filter(b => b.team_code === awayName).sort((a, b) => a.batting_order - b.batting_order);
  const homeBatters  = batters.filter(b => b.team_code === homeName).sort((a, b) => a.batting_order - b.batting_order);
  const awayPitchers = pitchers.filter(p => p.team_code === awayName).sort((a, b) => a.pitcher_order - b.pitcher_order);
  const homePitchers = pitchers.filter(p => p.team_code === homeName).sort((a, b) => a.pitcher_order - b.pitcher_order);

  const totalAway = awayScore ?? innings.reduce((s, i) => s + (i.score_away ?? 0), 0);
  const totalHome = homeScore ?? innings.reduce((s, i) => s + (i.score_home ?? 0), 0);

  const latestPbpEvent = playByPlay.length > 0 ? playByPlay[playByPlay.length - 1] : undefined;
  const isTopAttack = latestPbpEvent?.is_top ?? true;
  const currentPitchers = isTopAttack ? homePitchers : awayPitchers;
  const currentBatters  = isTopAttack ? awayBatters  : homeBatters;
  const currentPitcher  = currentPitchers.length > 0 ? currentPitchers[currentPitchers.length - 1] : undefined;
  const latestBatterName = latestPbpEvent ? parseNpbDescription(latestPbpEvent.description).batterName : '';
  const currentBatterStat = currentBatters.find(b => b.player_name === latestBatterName)
    ?? (currentBatters.length > 0 ? currentBatters[currentBatters.length - 1] : undefined);

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'home',  label: '首頁' },
    { key: 'score', label: '比分速報' },
    { key: 'pbp',   label: '文字速報' },
    { key: 'stats', label: '成績' },
  ];

  return (
    <div
      className={standalone ? "min-h-screen bg-gray-100" : "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"}
      onClick={standalone ? undefined : onClose}
    >
      <div
        className={standalone ? "max-w-4xl mx-auto bg-white min-h-screen flex flex-col shadow-xl" : "bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[98vh] flex flex-col overflow-hidden"}
        onClick={standalone ? undefined : (e => e.stopPropagation())}
      >
        {standalone && (
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition">← 返回</button>
            <button onClick={async () => { setIsRefreshing(true); await loadData().catch(() => {}); setIsRefreshing(false); }}
              disabled={isRefreshing} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-600 disabled:opacity-50 transition">
              {isRefreshing ? '⟳' : '↻'} 更新比分
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="bg-gray-900 text-white px-6 py-3 shrink-0">
          {!standalone && (onPrev || onNext) && (
            <div className="flex items-center justify-between mb-2">
              <button onClick={onPrev} disabled={!hasPrev}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition px-2 py-1 rounded-lg hover:bg-white/10">← 上一場</button>
              <div className="flex items-center gap-1">
                <button onClick={async () => { setIsRefreshing(true); await loadData().catch(() => {}); setIsRefreshing(false); }}
                  disabled={isRefreshing} className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50 transition px-2 py-1 rounded-lg hover:bg-white/10">
                  {isRefreshing ? '⟳' : '↻'} 更新
                </button>
                <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/10">✕ 關閉</button>
              </div>
              <button onClick={onNext} disabled={!hasNext}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition px-2 py-1 rounded-lg hover:bg-white/10">下一場 →</button>
            </div>
          )}
          {!standalone && !onPrev && !onNext && (
            <div className="flex justify-end mb-1">
              <div className="flex items-center gap-1">
                <button onClick={async () => { setIsRefreshing(true); await loadData().catch(() => {}); setIsRefreshing(false); }}
                  disabled={isRefreshing} className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50 transition px-2 py-1 rounded-lg hover:bg-white/10">
                  {isRefreshing ? '⟳' : '↻'} 更新
                </button>
                <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/10">✕ 關閉</button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TeamLogo name={awayName} size={28} />
              <span className="font-bold text-sm">{awayName}</span>
              <span className={`text-2xl font-black tabular-nums leading-none ${(isFinal||isLive) && totalAway > totalHome ? 'text-yellow-400' : 'text-white'}`}>
                {isFinal||isLive ? totalAway : '–'}
              </span>
            </div>
            <div className="text-center px-1">
              {isLive  && <span className="text-xs font-black text-red-400 animate-pulse block">● LIVE</span>}
              {isFinal && <span className="text-xs text-gray-400 block">終了</span>}
              {!isLive && !isFinal && <span className="text-xs text-gray-500 block">vs</span>}
              {game.game_detail && <div className="text-[11px] text-gray-400">{game.game_detail}</div>}
              <span className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded font-bold">ファーム</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black tabular-nums leading-none ${(isFinal||isLive) && totalHome > totalAway ? 'text-yellow-400' : 'text-white'}`}>
                {isFinal||isLive ? totalHome : '–'}
              </span>
              <span className="font-bold text-sm">{homeName}</span>
              <TeamLogo name={homeName} size={28} />
            </div>
          </div>
          {game.venue && <div className="text-center text-[11px] text-gray-500 mt-1">{game.venue}</div>}
        </div>

        {/* ── 局分表 ── */}
        {!loading && (
          <div className="shrink-0 border-b border-gray-200 bg-white">
            <InningScoreTable innings={innings} stats={stats} awayName={awayName} homeName={homeName} totalAway={totalAway} totalHome={totalHome} />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative flex-1 py-2.5 text-sm font-bold transition ${tab === key ? 'border-b-2 border-red-600 text-red-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
              {key === 'pbp' && isLive && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
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

          ) : tab === 'score' ? (
            <BaseballFieldPanel
              latestEvent={latestPbpEvent}
              isFinal={isFinal}
              allEvents={playByPlay}
              currentPitcherName={currentPitcher?.player_name}
              currentBatterName={latestBatterName || currentBatterStat?.player_name}
              pitches={pitchData}
            />

          ) : tab === 'pbp' ? (
            playByPlay.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {isLive ? '速報資料載入中，請稍候...' : '速報資料尚未更新'}
              </div>
            ) : (
              <FarmPBPCards events={playByPlay} awayName={awayName} homeName={homeName} pitchers={pitchers} />
            )

          ) : tab === 'home' ? (
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <StarterCard label={awayName} name={awayPitchers[0]?.player_name ?? '未定'} pitchCount={awayPitchers[0]?.pitch_count} />
                <StarterCard label={homeName} name={homePitchers[0]?.player_name ?? '未定'} pitchCount={homePitchers[0]?.pitch_count} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <LineupPanel name={awayName} batters={awayBatters} />
                <LineupPanel name={homeName} batters={homeBatters} />
              </div>
            </div>

          ) : (
            /* ── 成績 ── */
            <div>
              <div className="flex border-b border-gray-100 bg-gray-50">
                {(['batter', 'pitcher'] as StatsTab[]).map(k => (
                  <button key={k} onClick={() => setStatsTab(k)}
                    className={`flex-1 py-2 text-sm font-bold transition ${statsTab === k ? 'border-b-2 border-blue-500 text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}>
                    {k === 'batter' ? '打者成績' : '投手成績'}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-6">
                {statsTab === 'batter' ? (
                  <>
                    {awayBatters.length > 0 && <BatterTable title={awayName} batters={awayBatters} />}
                    {homeBatters.length > 0 && <BatterTable title={homeName} batters={homeBatters} />}
                    {awayBatters.length === 0 && homeBatters.length === 0 && (
                      <p className="text-center py-10 text-gray-400 font-bold">打者成績尚未更新</p>
                    )}
                  </>
                ) : (
                  <>
                    {awayPitchers.length > 0 && <PitcherTable title={awayName} pitchers={awayPitchers} />}
                    {homePitchers.length > 0 && <PitcherTable title={homeName} pitchers={homePitchers} />}
                    {awayPitchers.length === 0 && homePitchers.length === 0 && (
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
