/**
 * NpbGameLive — NPB 一軍比賽詳情 + 回顧
 * Route: /npb/game/:id（via NpbGamePage）
 * 格式與 FarmGameDetail 相同：棒球場背景 + 逐球導覽
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import {
  NpbGame, NpbTeam, GameInning, GameStats, BatterStat, PitcherStat,
  PlayByPlayEvent, PitchData,
  getGame, getNpbTeams, getGameInnings, getGameStats,
  getGameBatters, getGamePitchers, getGamePlayByPlay, getGamePitchData,
} from '../api/npb';

// ─── 工具函式（與 FarmGameDetail 相同）───────────────────────────────────────

const NPB_LOGO = 'https://p.npb.jp/img/common/logo/2026';
const NAME_TO_CODE: Record<string, string> = {
  '巨人': 'g', 'DeNA': 'db', '横浜DeNA': 'db', '阪神': 't', '広島': 'c',
  '中日': 'd', 'ヤクルト': 's', 'ソフトバンク': 'h', '日本ハム': 'f',
  'オリックス': 'b', '楽天': 'e', '西武': 'l', 'ロッテ': 'm',
};
function getCode(name: string) {
  for (const [k, v] of Object.entries(NAME_TO_CODE)) if (name.includes(k)) return v;
  return '';
}

function matchTeam(teams: NpbTeam[], name: string): NpbTeam | undefined {
  return teams.find(t => t.name === name || t.name_full === name || name.includes(t.name) || t.name.includes(name));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} (${['日','一','二','三','四','五','六'][d.getDay()]})`;
}

function fmtAvg(hits: number, ab: number): string {
  if (ab === 0) return '.---';
  const s = (hits / ab).toFixed(3);
  return s.startsWith('0.') ? s.slice(1) : s;
}
function fmtBoxAvg(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return '';
  const n = parseFloat(String(raw));
  if (isNaN(n)) return '';
  const s = n.toFixed(3);
  return s.startsWith('0.') ? s.slice(1) : s;
}

function translatePitchResultShort(result: string): string {
  if (!result) return '–';
  const map: [RegExp, string][] = [
    [/見逃し三振/, '見逃三振'], [/空振り三振/, '空振三振'], [/三振/, '三振'],
    [/本塁打|ホームラン/, '全壘打'], [/三塁打/, '三壘安打'], [/二塁打/, '二壘安打'],
    [/内野安打/, '內野安打'], [/ヒット|安打/, '安打'],
    [/四球/, '四壞球'], [/死球/, '觸身球'],
    [/犠飛/, '犧牲飛球'], [/犠打/, '犧打'],
    [/併殺/, '雙殺打'],
    [/ショートゴロ/, '游擊滾地'], [/セカンドゴロ/, '二壘滾地'], [/ファーストゴロ/, '一壘滾地'],
    [/サードゴロ/, '三壘滾地'], [/ピッチャーゴロ/, '投手前滾地'],
    [/ゴロ/, '滾地球'],
    [/センターフライ/, '中外野飛球'], [/ライトフライ/, '右外野飛球'], [/レフトフライ/, '左外野飛球'],
    [/フライ/, '飛球'], [/ライナー/, '平飛球'],
    [/野手選択/, '野手選擇'], [/失策/, '失誤'],
    [/空振り/, '空振'], [/ファウル/, '界外球'],
    [/ストライク/, '好球'], [/ボール|壊球|壊/, '壞球'],
    [/^([右左中内])安$/, '$1安打'], [/^([右左中])本$/, '$1本壘打'],
    [/^([右左中])[２2]$/, '$1二壘打'], [/^([右左中])[３3]$/, '$1三壘打'],
    [/^([右左中邪内])飛$/, '$1飛球'], [/^([右左中])直$/, '$1平飛球'],
    [/^([遊二一三投捕])ゴ$/, '$1滾地球'],
  ];
  for (const [re, t] of map) if (re.test(result)) return result.replace(re, t);
  return result;
}

function isOutResult(result: string): boolean {
  if (/三振/.test(result)) return true;
  if (/ゴロ/.test(result) && !/ヒット|安打|内野安打|野手選択/.test(result)) return true;
  if (/フライ/.test(result) && !/ヒット|安打|失策/.test(result)) return true;
  if (/ライナー/.test(result) && !/ヒット|安打/.test(result)) return true;
  if (/犠打|犠飛/.test(result)) return true;
  return false;
}

function parseInningsNum(ip: string): number {
  if (!ip) return 0;
  const parts = ip.split('.');
  const full = parseInt(parts[0]) || 0;
  const frac = parts[1] ? parseInt(parts[1]) / 3 : 0;
  return full + frac;
}
function fmtEra(earnedRuns: number, ip: string): string {
  const n = parseInningsNum(ip);
  if (n <= 0) return '-.--';
  return ((earnedRuns * 9) / n).toFixed(2);
}

function pitchCircleBg(result: string, isStrike: boolean, isFinal: boolean): string {
  if (isFinal) {
    if (/安打|ヒット|本塁打|ホームラン|二塁打|三塁打/.test(result)) return 'bg-blue-500 text-white';
    if (/四球|死球/.test(result)) return 'bg-green-400 text-white';
    if (/三振|ゴロ|フライ|ライナー|犠/.test(result)) return 'bg-red-500 text-white';
    return 'bg-yellow-400 text-gray-800';
  }
  return isStrike ? 'bg-yellow-400 text-gray-800' : 'bg-green-400 text-white';
}

function translatePitchShort(result: string): string {
  if (!result) return '';
  if (result.includes('ボール')) return '壞球';
  if (result.includes('空振')) return '揮空';
  if (result.includes('見逃')) return '見逃';
  if (result.includes('ファウル')) return '界外';
  if (result.includes('三振')) return '三振';
  if (result.includes('安打') || result.includes('ヒット')) return '安打';
  if (result.includes('本塁打') || result.includes('ホームラン')) return '全壘打';
  if (result.includes('ゴロ')) return '滾地';
  if (result.includes('フライ')) return '飛球';
  if (result.includes('四球')) return '四壞';
  if (result.includes('死球')) return '觸身';
  return result;
}

function translateJaPbp(text: string): string {
  return text
    .replace(/投手交代/g, '投手替換').replace(/に代わって/g, '→')
    .replace(/守備位置の変更/g, '守備變更').replace(/代打/g, '代打')
    .replace(/代走/g, '代跑').replace(/試合終了/g, '試合終了')
    .replace(/：/g, ':');
}

function resultBadge(result: string): { label: string; color: string } | null {
  if (/本塁打|ホームラン/.test(result)) return { label: '全打', color: 'bg-blue-600 text-white font-black' };
  if (/三塁打/.test(result)) return { label: '三安', color: 'bg-blue-500 text-white' };
  if (/二塁打/.test(result)) return { label: '二安', color: 'bg-blue-500 text-white' };
  if (/安打|ヒット|内野安打/.test(result)) return { label: '安打', color: 'bg-blue-500 text-white' };
  if (/四球/.test(result)) return { label: '四壞', color: 'bg-teal-500 text-white' };
  if (/死球/.test(result)) return { label: '死球', color: 'bg-cyan-500 text-white' };
  if (/犠飛/.test(result)) return { label: '犠飛', color: 'bg-red-400 text-white' };
  if (/犠打/.test(result)) return { label: '犠打', color: 'bg-red-400 text-white' };
  if (/三振/.test(result)) return { label: '三振', color: 'bg-gray-500 text-white' };
  if (/併殺/.test(result)) return { label: '雙殺', color: 'bg-red-600 text-white' };
  if (/フライ|飛/.test(result)) return { label: '飛出', color: 'bg-red-500 text-white' };
  if (/ゴロ/.test(result)) return { label: '滾出', color: 'bg-red-500 text-white' };
  return null;
}

// ─── 打席結構 ────────────────────────────────────────────────────────────────

interface AtBatEntry {
  inning: number;
  is_top: boolean;
  batterName: string;
  pitcherName: string;
  pitches: PitchData[];
  abSeq: number;
}

function buildAtBatList(pitchData: PitchData[]): AtBatEntry[] {
  const map = new Map<string, PitchData[]>();
  for (const p of pitchData) {
    const key = `${p.inning}-${p.is_top ? 1 : 0}-${p.at_bat_key}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  const entries: AtBatEntry[] = [];
  for (const [, pitches] of map) {
    pitches.sort((a, b) => a.pitch_num - b.pitch_num);
    const first = pitches[0];
    entries.push({ inning: first.inning, is_top: first.is_top, batterName: first.batter_name, pitcherName: first.pitcher_name, pitches, abSeq: 0 });
  }
  entries.sort((a, b) => a.inning - b.inning || (a.is_top === b.is_top ? 0 : a.is_top ? -1 : 1));
  entries.forEach((e, i) => { e.abSeq = i + 1; });
  return entries;
}

function computeReplayRunners(atBats: AtBatEntry[], currentAbIdx: number) {
  const currentAb = atBats[currentAbIdx];
  if (!currentAb) return { base1: null as string|null, base2: null as string|null, base3: null as string|null };
  const prevInHalf = atBats.filter((ab, i) =>
    i < currentAbIdx && ab.inning === currentAb.inning && ab.is_top === currentAb.is_top
  );
  let b1: string|null = null, b2: string|null = null, b3: string|null = null;
  for (const ab of prevInHalf) {
    const result = ab.pitches[ab.pitches.length - 1]?.result ?? '';
    const batter = ab.batterName;
    if (/本塁打|ホームラン/.test(result)) { b1=null; b2=null; b3=null; }
    else if (/三塁打/.test(result)) { b1=null; b2=null; b3=batter; }
    else if (/二塁打/.test(result)) { b3=b2; b2=batter; b1=null; }
    else if (/ヒット|安打|内野安打/.test(result)) { b3=b2; b2=b1; b1=batter; }
    else if (/四球|死球/.test(result)) {
      if (b1&&b2) { b3=b2; b2=b1; b1=batter; }
      else if (b1) { b2=b1; b1=batter; }
      else { b1=batter; }
    }
  }
  return { base1: b1, base2: b2, base3: b3 };
}

// ─── 好球帶顏色 ──────────────────────────────────────────────────────────────

const PITCH_COLORS: Record<string, string> = {
  'ストレート': '#ef4444', 'フォーシーム': '#ef4444', 'ツーシーム': '#f97316',
  'カットボール': '#eab308', 'スライダー': '#22c55e', 'カーブ': '#06b6d4',
  'チェンジアップ': '#a855f7', 'フォーク': '#3b82f6', 'シンカー': '#f472b6', 'シュート': '#fb923c',
};
function pitchColor(k: string) {
  for (const [key, c] of Object.entries(PITCH_COLORS)) if (k.includes(key)) return c;
  return '#9ca3af';
}

const SZ_W = 80, SZ_H = 90;
const SZ_LEFT = 18, SZ_RIGHT = 62, SZ_TOP = 12, SZ_BOTTOM = 64;
function mapXY(dx: number, dy: number) {
  return {
    cx: SZ_LEFT + ((dx - 55) / (145 - 55)) * (SZ_RIGHT - SZ_LEFT),
    cy: SZ_TOP  + ((dy - 30) / (170 - 30)) * (SZ_BOTTOM - SZ_TOP),
  };
}

// ─── BSO 燈號 ────────────────────────────────────────────────────────────────

function BSOLights({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  return (
    <div className="flex flex-col gap-1.5 select-none">
      {[['B', balls, 3, 'bg-green-400 border-green-300'], ['S', strikes, 2, 'bg-yellow-400 border-yellow-300'], ['O', outs, 2, 'bg-red-400 border-red-300']].map(([label, val, max, activeClass]) => (
        <div key={label as string} className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-300 w-3.5 font-bold">{label}</span>
          {Array.from({ length: max as number }, (_, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 ${i < (val as number) ? activeClass : 'bg-gray-700 border-gray-600'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 球隊 Logo ────────────────────────────────────────────────────────────────

function TeamLogo({ name, size = 32 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const code = getCode(name);
  if (!code || err) return (
    <span className="inline-flex items-center justify-center rounded-full bg-gray-500 text-white font-black flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {name.slice(0, 2)}
    </span>
  );
  return <img src={`${NPB_LOGO}/logo_${code}_m.gif`} alt={name} width={size} height={size} onError={() => setErr(true)} className="flex-shrink-0" />;
}

// ─── 局分表 ──────────────────────────────────────────────────────────────────

function InningScoreTable({ innings, stats, awayName, homeName, awayTeam, homeTeam, game }: {
  innings: GameInning[]; stats: GameStats | null;
  awayName: string; homeName: string;
  awayTeam?: NpbTeam; homeTeam?: NpbTeam;
  game: NpbGame;
}) {
  const maxInn = Math.max(9, ...innings.map(i => i.inning));
  const inningNums = Array.from({ length: maxInn }, (_, i) => i + 1);
  const totalAway = game.score_away ?? 0;
  const totalHome = game.score_home ?? 0;

  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left pl-3 py-2 text-gray-500 font-bold w-24">球隊</th>
            {inningNums.map(n => <th key={n} className="text-center py-2 px-2 text-gray-500 font-medium min-w-[32px]">{n}</th>)}
            <th className="text-center py-2 px-3 font-black text-gray-800 border-l border-gray-200">R</th>
            <th className="text-center py-2 px-2 text-gray-500 font-medium">H</th>
            <th className="text-center py-2 px-2 text-gray-500 font-medium">E</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: awayName, team: awayTeam, getInn: (i: GameInning) => i.score_away, total: totalAway, hits: stats?.hits_away, errors: stats?.errors_away },
            { name: homeName, team: homeTeam, getInn: (i: GameInning) => i.score_home, total: totalHome, hits: stats?.hits_home, errors: stats?.errors_home },
          ].map(({ name, team, getInn, total, hits, errors }) => (
            <tr key={name} className="border-t border-gray-100">
              <td className="pl-3 py-2">
                <div className="flex items-center gap-1.5">
                  {team?.logo_url ? <img src={team.logo_url} alt={name} className="w-6 h-6 object-contain" /> : <TeamLogo name={name} size={24} />}
                  <span className="font-bold text-gray-800 text-sm truncate max-w-[64px]">{name}</span>
                </div>
              </td>
              {inningNums.map(n => {
                const inn = innings.find(i => i.inning === n);
                return <td key={n} className="text-center py-2 px-2 text-gray-700">{getInn(inn!) ?? (inn ? '—' : '')}</td>;
              })}
              <td className="text-center py-2 px-3 font-black text-gray-900 text-base border-l border-gray-200">
                {game.score_away !== null || game.score_home !== null ? total : '—'}
              </td>
              <td className="text-center py-2 px-2 text-gray-600">{hits ?? '—'}</td>
              <td className="text-center py-2 px-2 text-gray-600">{errors ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 棒球場回顧面板 ───────────────────────────────────────────────────────────

function FieldReplayPanel({
  pitchData, awayName, homeName, batters, pitchers, innings, isFinal, isLive,
  initialAbIdx,
}: {
  pitchData: PitchData[];
  awayName: string;
  homeName: string;
  batters?: BatterStat[];
  pitchers?: PitcherStat[];
  innings?: GameInning[];
  isFinal: boolean;
  isLive: boolean;
  initialAbIdx?: number;
}) {
  const atBats = buildAtBatList(pitchData);
  const total = atBats.length;

  const [abIdx, setAbIdx] = useState(() => initialAbIdx ?? Math.max(0, total - 1));
  const [pitchIdx, setPitchIdx] = useState(() => {
    const ab = atBats[initialAbIdx ?? Math.max(0, total - 1)];
    return ab ? ab.pitches.length - 1 : 0;
  });
  const wasAtEnd = useRef(true);

  // Live 模式：新打席資料進來時，若在最新則自動跟進
  useEffect(() => {
    if (total === 0) return;
    const newLastAbIdx = total - 1;
    if (wasAtEnd.current) {
      const newAb = atBats[newLastAbIdx];
      setAbIdx(newLastAbIdx);
      setPitchIdx(newAb ? newAb.pitches.length - 1 : 0);
    }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0) {
    if (isFinal) return null;
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm bg-gray-50 border-t">
        尚無球路資料
      </div>
    );
  }

  const safeAbIdx    = Math.max(0, Math.min(abIdx, total - 1));
  const ab           = atBats[safeAbIdx];
  const pitches      = ab.pitches;
  const maxPitch     = pitches.length - 1;
  const safePitchIdx = Math.max(0, Math.min(pitchIdx, maxPitch));
  const revealedPitches = pitches.slice(0, safePitchIdx + 1);
  const currentPitch = pitches[safePitchIdx];
  const isLastAb     = safeAbIdx === total - 1;
  const isLastPitch  = safePitchIdx === maxPitch;
  const isAtEnd      = isLastAb && isLastPitch;
  const attackTeam   = ab.is_top ? awayName : homeName;

  // BSO before current pitch
  let balls = 0, strikes = 0;
  for (let i = 0; i < safePitchIdx; i++) {
    if (!pitches[i].is_strike) balls = Math.min(balls + 1, 3);
    else if (strikes < 2) strikes++;
  }
  // Outs at start of this at-bat
  let outs = 0;
  for (const prev of atBats) {
    if (prev.abSeq >= ab.abSeq) break;
    if (prev.inning === ab.inning && prev.is_top === ab.is_top) {
      if (isOutResult(prev.pitches[prev.pitches.length - 1]?.result ?? '')) outs = Math.min(outs + 1, 2);
    }
  }

  const runners = computeReplayRunners(atBats, safeAbIdx);

  const batterAvgMap = new Map<string, string>();
  if (batters) for (const b of batters) batterAvgMap.set(b.player_name, fmtBoxAvg(b.box_avg) || fmtAvg(b.hits, b.at_bats));
  const pitcherPitchMap = new Map<string, number>();
  if (pitchers) for (const p of pitchers) pitcherPitchMap.set(p.player_name, p.pitch_count);

  const pitchLabel  = translatePitchResultShort(currentPitch.result);
  const finalBadge  = isLastPitch ? resultBadge(currentPitch.result) : null;

  function goNextAb()   { wasAtEnd.current = safeAbIdx + 1 === total - 1; setAbIdx(safeAbIdx + 1); setPitchIdx(0); }
  function goPrevAb()   { wasAtEnd.current = false; setAbIdx(safeAbIdx - 1); setPitchIdx(0); }
  function goNextPitch() {
    if (safePitchIdx < maxPitch) { wasAtEnd.current = isLastAb && safePitchIdx + 1 === maxPitch; setPitchIdx(safePitchIdx + 1); }
    else if (safeAbIdx < total - 1) goNextAb();
  }
  function goPrevPitch() {
    if (safePitchIdx > 0) { wasAtEnd.current = false; setPitchIdx(safePitchIdx - 1); }
    else if (safeAbIdx > 0) { wasAtEnd.current = false; setAbIdx(safeAbIdx - 1); const prevAb = atBats[safeAbIdx - 1]; setPitchIdx(prevAb.pitches.length - 1); }
  }
  function jumpToEnd() { wasAtEnd.current = true; setAbIdx(total - 1); const last = atBats[total - 1]; setPitchIdx(last.pitches.length - 1); }

  const bp = { b1: { left: '85%', top: '45%' }, b2: { left: '50%', top: '33%' }, b3: { left: '15%', top: '45%' } };

  const ReplayBase = ({ active, runner }: { active: boolean; runner?: string|null }) => (
    <div className="flex flex-col items-center gap-0.5">
      {active && runner && (
        <div className="mb-0.5 bg-black/85 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow border border-yellow-400/30">{runner}</div>
      )}
      <div className={`w-5 h-5 rounded-sm border-2 shadow ${active ? 'bg-yellow-400 border-yellow-200 shadow-yellow-400/50' : 'bg-white/85 border-gray-300'}`}
        style={{ transform: 'rotate(45deg)' }} />
    </div>
  );

  const SZ_W_R = Math.round(SZ_W * 1.2);
  const SZ_H_R = Math.round((SZ_H + 14) * 1.2);

  return (
    <div className="flex flex-col select-none">
      {/* 球場背景 */}
      <div className="relative overflow-hidden bg-gray-900" style={{ height: 380 }}>
        <img src="/baseball-field.png" alt="" className="absolute inset-0 w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0 bg-black/50" />

        {/* 壘包 */}
        <div className="absolute" style={{ left: bp.b2.left, top: bp.b2.top, transform: 'translate(-50%,-50%)' }}><ReplayBase active={!!runners.base2} runner={runners.base2} /></div>
        <div className="absolute" style={{ left: bp.b3.left, top: bp.b3.top, transform: 'translate(-50%,-50%)' }}><ReplayBase active={!!runners.base3} runner={runners.base3} /></div>
        <div className="absolute" style={{ left: bp.b1.left, top: bp.b1.top, transform: 'translate(-50%,-50%)' }}><ReplayBase active={!!runners.base1} runner={runners.base1} /></div>

        {/* 左上：局次 + BSO */}
        <div className="absolute top-3 left-3 bg-black/85 rounded-xl px-3 py-2 shadow-xl min-w-[110px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-white font-black text-xs">{ab.inning}回{ab.is_top ? '表' : '裏'}</span>
            {isLive && isAtEnd
              ? <span className="flex items-center gap-1 text-green-400 text-[10px] font-bold"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />LIVE</span>
              : <span className="text-yellow-400 font-black text-[10px] border border-yellow-400 px-1 rounded">リプレイ</span>
            }
          </div>
          <BSOLights balls={balls} strikes={strikes} outs={outs} />
        </div>

        {/* 上中央：球種 + 結果 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/85 rounded-xl px-4 py-2 text-center shadow-xl">
          <div className="text-white font-black text-sm">{pitchLabel}</div>
          {(currentPitch.ball_kind || currentPitch.speed) && (
            <div className="text-gray-300 text-[11px] mt-0.5">
              {currentPitch.speed && <span className="text-blue-300 font-bold">{currentPitch.speed}km/h </span>}
              {currentPitch.ball_kind && <span>{currentPitch.ball_kind}</span>}
            </div>
          )}
          {finalBadge && (
            <span className={`mt-1 inline-block text-[11px] font-black px-2 py-0.5 rounded-full ${finalBadge.color}`}>{finalBadge.label}</span>
          )}
        </div>

        {/* 左下：投手カード */}
        <div className="absolute bottom-3 left-3 bg-black/85 rounded-xl px-3 py-2 shadow-xl max-w-[140px]">
          <div className="text-gray-400 text-[9px] font-bold tracking-wide mb-1">投手</div>
          <div className="text-white font-black text-sm truncate">{ab.pitcherName}</div>
          {pitcherPitchMap.get(ab.pitcherName) != null && (
            <div className="text-gray-400 text-[10px] mt-0.5">{pitcherPitchMap.get(ab.pitcherName)} 球</div>
          )}
        </div>

        {/* 中下：打者カード */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/85 rounded-xl px-3 py-2 text-center shadow-xl max-w-[140px]">
          <div className="text-gray-400 text-[9px] font-bold tracking-wide mb-1">打者</div>
          <div className="text-white font-black text-sm truncate">{ab.batterName}</div>
          {batterAvgMap.get(ab.batterName) && (
            <div className="text-yellow-400 text-[10px] font-bold mt-0.5">{batterAvgMap.get(ab.batterName)}</div>
          )}
        </div>

        {/* 右下：好球帶 + 球歷 */}
        <div className="absolute bottom-3 right-3 bg-black/85 rounded-xl px-2 py-2 shadow-xl flex gap-2 items-start">
          <svg width={SZ_W_R} height={SZ_H_R} viewBox={`0 0 ${SZ_W} ${SZ_H + 14}`}>
            <rect x={SZ_LEFT} y={SZ_TOP} width={SZ_RIGHT - SZ_LEFT} height={SZ_BOTTOM - SZ_TOP}
              fill="rgba(255,255,255,0.08)" stroke="rgba(156,163,175,0.7)" strokeWidth="1" />
            {[1, 2].map(i => (
              <g key={i}>
                <line x1={SZ_LEFT + (SZ_RIGHT - SZ_LEFT) * i / 3} y1={SZ_TOP} x2={SZ_LEFT + (SZ_RIGHT - SZ_LEFT) * i / 3} y2={SZ_BOTTOM} stroke="rgba(156,163,175,0.35)" strokeWidth="0.5" />
                <line x1={SZ_LEFT} y1={SZ_TOP + (SZ_BOTTOM - SZ_TOP) * i / 3} x2={SZ_RIGHT} y2={SZ_TOP + (SZ_BOTTOM - SZ_TOP) * i / 3} stroke="rgba(156,163,175,0.35)" strokeWidth="0.5" />
              </g>
            ))}
            {revealedPitches.filter(p => p.x != null && p.y != null).map((p, i) => {
              const { cx, cy } = mapXY(p.x, p.y);
              const isCur = i === revealedPitches.filter(pp => pp.x != null).length - 1;
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={isCur ? 5 : 3.5} fill={pitchColor(p.ball_kind)}
                    stroke={isCur ? 'white' : 'transparent'} strokeWidth={isCur ? 1.5 : 0} opacity={isCur ? 1 : 0.6} />
                  <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle"
                    fontSize={isCur ? 7 : 5.5} fill="white" fontWeight="bold">{i + 1}</text>
                </g>
              );
            })}
          </svg>
          <div className="flex flex-col gap-0.5 min-w-[72px] max-h-[100px] overflow-y-auto">
            {revealedPitches.map((p, i) => {
              const isCur = i === revealedPitches.length - 1;
              return (
                <div key={i} className={`flex items-center gap-1 text-[10px] ${isCur ? 'text-white font-black' : 'text-gray-400'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${isCur ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-gray-300'}`}>{i + 1}</span>
                  <span className="truncate">{translatePitchResultShort(p.result)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 下部導覽列 */}
      <div className="bg-gray-900 flex items-center justify-between px-3 py-2.5 gap-2">
        {/* 打席導覽 */}
        <div className="flex items-center gap-1.5 flex-1">
          <button onClick={goPrevAb} disabled={safeAbIdx === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-black disabled:opacity-30 hover:bg-blue-700 active:scale-95 transition shrink-0">
            ◀ 前へ
          </button>
          <div className="text-center flex-1">
            <div className="text-white font-black text-xs">{attackTeam}攻撃中</div>
            <div className="text-gray-400 text-[10px]">打者 {ab.abSeq} / {total}</div>
          </div>
          <button onClick={goNextAb} disabled={isLastAb}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-black disabled:opacity-30 hover:bg-gray-500 active:scale-95 transition shrink-0">
            次へ ▶
          </button>
        </div>
        {/* 球導覽 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={goPrevPitch} disabled={safeAbIdx === 0 && safePitchIdx === 0}
            className="px-2.5 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-black disabled:opacity-30 hover:bg-gray-600 active:scale-95 transition">
            前一球
          </button>
          <div className="text-center min-w-[48px]">
            <div className="text-gray-300 text-[10px] font-bold tabular-nums">{safePitchIdx + 1}/{pitches.length}球</div>
          </div>
          <button onClick={goNextPitch} disabled={isAtEnd}
            className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-black disabled:opacity-30 hover:bg-blue-700 active:scale-95 transition">
            下一球
          </button>
          {isLive && !isAtEnd && (
            <button onClick={jumpToEnd}
              className="px-2.5 py-1.5 bg-green-700 text-white rounded-lg text-xs font-black hover:bg-green-600 active:scale-95 transition">
              最新
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 文字速報 ────────────────────────────────────────────────────────────────

interface RichAtBat {
  batNum: string;
  batterName: string;
  outsB4: number;
  result: string;
  balls: number;
  strikes: number;
  pitches: { num: string; text: string }[];
}

function parseRichDesc(description: string): RichAtBat | null {
  try {
    const obj = JSON.parse(description);
    if (obj && typeof obj.batterName === 'string') return obj as RichAtBat;
  } catch {}
  return null;
}

function BSODotsInline({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  return (
    <div className="flex items-center gap-1.5 select-none">
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full border ${i < balls ? 'bg-green-400 border-green-500' : 'bg-gray-200 border-gray-300'}`} />)}
      </div>
      <div className="flex gap-0.5">
        {[0, 1].map(i => <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full border ${i < strikes ? 'bg-yellow-400 border-yellow-500' : 'bg-gray-200 border-gray-300'}`} />)}
      </div>
      <div className="flex gap-0.5">
        {[0, 1].map(i => <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full border ${i < outs ? 'bg-red-400 border-red-500' : 'bg-gray-200 border-gray-300'}`} />)}
      </div>
    </div>
  );
}

function PBPCards({
  events, awayName, homeName, batters, pitchData, pitchers,
}: {
  events: PlayByPlayEvent[];
  awayName: string;
  homeName: string;
  batters: BatterStat[];
  pitchData: PitchData[];
  pitchers: PitcherStat[];
}) {
  const batterOrderMap = new Map<string, number>();
  const batterAvgMap = new Map<string, string>();       // name → season avg
  const batterTodayMap = new Map<string, string>();     // name → "H/AB"
  for (const b of batters) {
    const names = [b.player_name, b.player_name.replace(/\s/g, '')];
    for (const n of names) {
      if (b.batting_order >= 1 && b.batting_order <= 9) batterOrderMap.set(n, b.batting_order);
      const avg = fmtBoxAvg(b.box_avg);
      if (avg) batterAvgMap.set(n, avg);
      if (b.at_bats > 0 || b.hits > 0) batterTodayMap.set(n, `${b.hits}/${b.at_bats}`);
    }
  }

  // Build pitch lookup map: "${inning}_${isTop?1:0}_${abSeq}" → PitchData[]
  const pitchMap = new Map<string, PitchData[]>();
  for (const p of pitchData) {
    const key = p.at_bat_key ?? '';
    if (!key.startsWith('s')) continue;
    const parts = key.split('_');
    if (parts.length < 4) continue;
    const inn = parseInt(parts[1]);
    const tob = parseInt(parts[2]); // 1=top, 2=bottom
    const abSeq = parseInt(parts[3]);
    const mapKey = `${inn}_${tob === 1 ? 1 : 0}_${abSeq}`;
    if (!pitchMap.has(mapKey)) pitchMap.set(mapKey, []);
    pitchMap.get(mapKey)!.push(p);
  }
  for (const [, ps] of pitchMap) ps.sort((a, b) => a.pitch_num - b.pitch_num);

  // Build pitcher ERA map
  const pitcherStatMap = new Map<string, PitcherStat>();
  for (const p of pitchers) pitcherStatMap.set(p.player_name, p);

  const grouped: Map<string, PlayByPlayEvent[]> = new Map();
  for (const e of events) {
    const key = `${e.inning}-${e.is_top}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    const [ai, at] = a.split('-');
    const [bi, bt] = b.split('-');
    const diff = parseInt(ai) - parseInt(bi);
    if (diff !== 0) return diff;
    return (at === 'true' ? 1 : 0) - (bt === 'true' ? 1 : 0);
  }).reverse();

  const hasSanspoData = pitchData.some(p => (p.at_bat_key ?? '').startsWith('s'));

  if (sortedKeys.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        <div className="text-2xl mb-2">📋</div>
        尚無速報資料（請在 Admin 頁執行爬蟲）
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      {hasSanspoData && (
        <div className="flex items-center justify-end gap-3 px-4 pt-3 pb-1 text-[10px] text-gray-500 border-b">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" />壞球</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />好球</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />出局</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />安打</span>
        </div>
      )}
      {sortedKeys.map(key => {
        const [inningStr, isTopStr] = key.split('-');
        const inning = parseInt(inningStr);
        const isTop = isTopStr === 'true';
        const teamName = isTop ? awayName : homeName;
        const evs = grouped.get(key)!;

        // Count BATTER (JSON) entries to get abSeq per group
        let abSeqCounter = 0;
        const evWithSeq = evs.map(ev => {
          let seq: number | null = null;
          try {
            const obj = JSON.parse(ev.description);
            if (obj && typeof obj.batterName === 'string') {
              abSeqCounter++;
              seq = abSeqCounter;
            }
          } catch {}
          return { ev, seq };
        });

        return (
          <div key={key} className="border-b border-gray-100 last:border-0">
            <div className={`px-4 py-1.5 text-xs font-bold sticky top-0 z-10 ${isTop ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
              {inning}回{isTop ? '表' : '裏'}（{teamName}攻）
            </div>
            <div className="divide-y divide-gray-50">
              {[...evWithSeq].reverse().map(({ ev, seq }, i) => {
                let rich: RichAtBat | null = null;
                try {
                  const obj = JSON.parse(ev.description);
                  if (obj && typeof obj.batterName === 'string') rich = obj as RichAtBat;
                } catch {}

                if (!rich) {
                  return (
                    <div key={i} className="px-4 py-2 text-xs text-gray-500 leading-relaxed">
                      {translateJaPbp(ev.description)}
                    </div>
                  );
                }

                const nameKey = rich.batterName;
                const nameNoSpace = nameKey.replace(/\s/g, '');
                const order = batterOrderMap.get(nameKey) ?? batterOrderMap.get(nameNoSpace) ?? (rich.batNum ? parseInt(rich.batNum) : undefined);
                const avg = batterAvgMap.get(nameKey) ?? batterAvgMap.get(nameNoSpace);
                const todayStat = batterTodayMap.get(nameKey) ?? batterTodayMap.get(nameNoSpace);
                const badge = resultBadge(rich.result);
                const pitchKey = seq != null ? `${inning}_${isTop ? 1 : 0}_${seq}` : null;
                const pitchRows = pitchKey ? (pitchMap.get(pitchKey) ?? []) : [];

                // Pitcher info from pitch rows
                const pitcherName = pitchRows[0]?.pitcher_name ?? '';
                const pitcherStat = pitcherName ? pitcherStatMap.get(pitcherName) : null;
                const pitcherInfo = pitcherName ? {
                  name: pitcherName,
                  pitch_count: pitcherStat?.pitch_count,
                  era: pitcherStat
                    ? fmtEra(pitcherStat.earned_runs, pitcherStat.innings_pitched)
                    : undefined,
                } : null;

                return (
                  <RichAtBatCard key={i} rich={rich} order={order} badge={badge}
                    avg={avg} todayStat={todayStat}
                    pitchRows={pitchRows} pitcherInfo={pitcherInfo} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RichAtBatCard({
  rich, order, badge, avg, todayStat, pitchRows, pitcherInfo,
}: {
  rich: RichAtBat;
  order: number | undefined;
  badge: { label: string; color: string } | null;
  avg?: string;
  todayStat?: string;
  pitchRows?: PitchData[];
  pitcherInfo?: { name: string; pitch_count?: number; era?: string } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasPitchData = pitchRows && pitchRows.length > 0;
  const displayPitches = hasPitchData
    ? (expanded ? pitchRows : pitchRows.slice(-1))
    : [];

  return (
    <div className="px-4 py-3 hover:bg-gray-50">
      {/* 投手行 */}
      {pitcherInfo && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-500">
            投手：<span className="font-bold text-gray-700">{pitcherInfo.name}</span>
          </span>
          <div className="flex items-center gap-1.5">
            {pitcherInfo.pitch_count != null && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                {pitcherInfo.pitch_count}球
              </span>
            )}
            {pitcherInfo.era != null && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                ERA {pitcherInfo.era}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 items-start">
        {/* 打序バッジ */}
        <div className="w-9 h-10 rounded-md bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-bold">
          {order ? `#${order}` : '?'}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {/* 打者名 + 打率 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {order && <span className="text-xs font-bold text-gray-500">第{order}棒</span>}
            <span className="font-bold text-sm text-gray-800">{rich.batterName}</span>
            {avg && (
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {avg}
              </span>
            )}
            {todayStat && (
              <span className="text-[10px] text-gray-400 font-medium">{todayStat}</span>
            )}
          </div>
          {/* BSO + 結果バッジ */}
          <div className="flex items-center gap-2 flex-wrap">
            <BSODotsInline balls={rich.balls} strikes={rich.strikes} outs={rich.outsB4} />
            {badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}>
                {badge.label}
              </span>
            )}
            <span className="text-xs text-gray-600 ml-1">{rich.result}</span>
          </div>

          {/* 逐球顯示（Sanspo pitch data） */}
          {hasPitchData && (() => {
            // Pre-compute B-S count before each pitch
            const bsCounts: { b: number; s: number }[] = [];
            let b = 0, s = 0;
            for (const p of pitchRows!) {
              bsCounts.push({ b, s });
              const isFoul = /ファウル/.test(p.result ?? '');
              if (p.is_strike && !(isFoul && s >= 2)) s++;
              else if (!p.is_strike) b++;
            }
            return (
              <div className="mt-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  {displayPitches.map((p, pi) => {
                    const globalIdx = expanded ? pi : pitchRows!.length - 1;
                    const isFinal = globalIdx === pitchRows!.length - 1;
                    const circleCls = pitchCircleBg(p.result ?? '', p.is_strike, isFinal);
                    const bs = bsCounts[globalIdx] ?? { b: 0, s: 0 };
                    return (
                      <div key={pi} className="flex items-center gap-1 text-[11px]">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${circleCls}`}>
                          {p.pitch_num}
                        </span>
                        {p.ball_kind && <span className="text-gray-500">{p.ball_kind}</span>}
                        {p.speed && <span className="text-blue-500 font-bold">{p.speed}km</span>}
                        <span className="text-gray-600">{translatePitchShort(p.result ?? '')}</span>
                        <span className="text-gray-400">{bs.b}-{bs.s}</span>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-[10px] text-blue-500 hover:text-blue-700 font-bold flex items-center gap-0.5"
                  >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? '收合' : `全${pitchRows!.length}球`}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 舊格式 fallback（無 Sanspo 資料時顯示 rich.pitches） */}
          {!hasPitchData && rich.pitches.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-[10px] text-blue-500 hover:text-blue-700 font-bold flex items-center gap-0.5 mt-0.5"
              >
                {expanded ? '▲' : '▼'} {rich.pitches.length}球
              </button>
              {expanded && (
                <div className="mt-1 space-y-0.5 pl-1 border-l-2 border-gray-200">
                  {rich.pitches.map((p, pi) => (
                    <div key={pi} className="flex gap-1.5 text-[11px] text-gray-500">
                      <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[9px] font-black flex-shrink-0">{p.num}</span>
                      <span className="leading-relaxed">{p.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 打者成績表 ──────────────────────────────────────────────────────────────

function BatterTable({ batters, label }: { batters: BatterStat[]; label: string }) {
  return (
    <div className="overflow-x-auto">
      <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600 border-b">{label}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b bg-gray-50">
            <th className="text-left pl-3 py-1.5 w-6">#</th>
            <th className="text-left py-1.5 w-8">位</th>
            <th className="text-left py-1.5">選手</th>
            <th className="text-center py-1.5">打</th>
            <th className="text-center py-1.5 text-green-600">安</th>
            <th className="text-center py-1.5 text-yellow-600">打點</th>
            <th className="text-center py-1.5">得</th>
            <th className="text-center py-1.5">本</th>
            <th className="text-center py-1.5 text-red-500">振</th>
            <th className="text-center py-1.5 text-blue-500">四</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {batters.map(b => (
            <tr key={b.player_name + b.batting_order} className="hover:bg-gray-50">
              <td className="pl-3 py-1.5 text-gray-400">{b.batting_order}</td>
              <td className="py-1.5 text-gray-500">{b.position}</td>
              <td className="py-1.5 font-medium text-gray-800">{b.player_name}</td>
              <td className="text-center py-1.5">{b.at_bats}</td>
              <td className="text-center py-1.5 text-green-600">{b.hits}</td>
              <td className="text-center py-1.5 text-yellow-600">{b.rbi}</td>
              <td className="text-center py-1.5">{b.runs}</td>
              <td className="text-center py-1.5 text-blue-600">{b.home_runs || ''}</td>
              <td className="text-center py-1.5 text-red-500">{b.strikeouts || ''}</td>
              <td className="text-center py-1.5 text-blue-500">{b.walks || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PitcherTable({ pitchers, label }: { pitchers: PitcherStat[]; label: string }) {
  return (
    <div className="overflow-x-auto">
      <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-600 border-b">{label}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b bg-gray-50">
            <th className="text-left pl-3 py-1.5">投手</th>
            <th className="text-center py-1.5">局</th>
            <th className="text-center py-1.5">球數</th>
            <th className="text-center py-1.5">安</th>
            <th className="text-center py-1.5">三振</th>
            <th className="text-center py-1.5">四死</th>
            <th className="text-center py-1.5">失點</th>
            <th className="text-center py-1.5">自責</th>
            <th className="text-center py-1.5">結果</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {pitchers.map(p => {
            const res = p.result;
            const resColor = res === '勝' || res === 'W' ? 'text-green-600 font-black' : res === '敗' || res === 'L' ? 'text-red-500 font-black' : res === 'S' ? 'text-blue-500 font-black' : 'text-gray-500';
            return (
              <tr key={p.player_name + p.pitcher_order} className="hover:bg-gray-50">
                <td className="pl-3 py-1.5 font-medium text-gray-800">{p.player_name}</td>
                <td className="text-center py-1.5">{p.innings_pitched}</td>
                <td className="text-center py-1.5">{p.pitch_count}</td>
                <td className="text-center py-1.5">{p.hits_allowed}</td>
                <td className="text-center py-1.5 text-red-500">{p.strikeouts}</td>
                <td className="text-center py-1.5">{p.walks + p.hit_by_pitch}</td>
                <td className="text-center py-1.5">{p.runs_allowed}</td>
                <td className="text-center py-1.5">{p.earned_runs}</td>
                <td className={`text-center py-1.5 ${resColor}`}>{res || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 主頁面 ──────────────────────────────────────────────────────────────────

type Tab = 'score' | 'pbp' | 'stats';

export default function NpbGameLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gameId = parseInt(id ?? '0', 10);

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [game, setGame]           = useState<NpbGame | null>(null);
  const [teams, setTeams]         = useState<NpbTeam[]>([]);
  const [innings, setInnings]     = useState<GameInning[]>([]);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [batters, setBatters]     = useState<BatterStat[]>([]);
  const [pitchers, setPitchers]   = useState<PitcherStat[]>([]);
  const [pbp, setPbp]             = useState<PlayByPlayEvent[]>([]);
  const [pitchData, setPitchData] = useState<PitchData[]>([]);
  const [tab, setTab]             = useState<Tab>('score');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchAll = useCallback(async () => {
    try {
      const [gameRes, teamsRes, inningsRes, statsRes, battersRes, pitchersRes, pbpRes, pitchDataRes] =
        await Promise.allSettled([
          getGame(gameId), getNpbTeams(), getGameInnings(gameId), getGameStats(gameId),
          getGameBatters(gameId), getGamePitchers(gameId), getGamePlayByPlay(gameId), getGamePitchData(gameId),
        ]);
      if (gameRes.status === 'fulfilled') setGame(gameRes.value);
      else { setError('找不到比賽資料'); return; }
      if (teamsRes.status === 'fulfilled') setTeams(teamsRes.value);
      if (inningsRes.status === 'fulfilled') setInnings(inningsRes.value);
      if (statsRes.status === 'fulfilled') setGameStats(statsRes.value);
      if (battersRes.status === 'fulfilled') setBatters(battersRes.value);
      if (pitchersRes.status === 'fulfilled') setPitchers(pitchersRes.value);
      if (pbpRes.status === 'fulfilled') setPbp(pbpRes.value);
      if (pitchDataRes.status === 'fulfilled') setPitchData(pitchDataRes.value);
      setLastRefresh(new Date());
    } catch { setError('資料載入失敗'); }
  }, [gameId]);

  useEffect(() => { setLoading(true); fetchAll().finally(() => setLoading(false)); }, [fetchAll]);

  useEffect(() => {
    if (game?.status === 'live') timerRef.current = setInterval(fetchAll, 20000);
    return () => clearInterval(timerRef.current);
  }, [game?.status, fetchAll]);

  const awayTeam = game ? matchTeam(teams, game.team_away) : undefined;
  const homeTeam = game ? matchTeam(teams, game.team_home) : undefined;

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center text-gray-400"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" /><div>載入中...</div></div>
    </div>
  );
  if (error || !game) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4">⚾</div><div className="text-lg text-gray-500">{error ?? '比賽不存在'}</div>
        <button onClick={() => navigate('/npb')} className="mt-4 text-blue-500 hover:underline text-sm">← 回到賽程</button>
      </div>
    </div>
  );

  const awayName = game.team_away;
  const homeName = game.team_home;
  const isFinal  = game.status === 'final';
  const isLive   = game.status === 'live';
  const atBats   = buildAtBatList(pitchData);

  // 主客場投打分離
  const getTeamCode = (name: string) => awayTeam?.code === getCode(name) ? 'away' : 'home';
  const awayBatters  = batters.filter(b => awayTeam ? b.team_code !== homeTeam?.code : true);
  const homeBatters  = batters.filter(b => homeTeam ? b.team_code === homeTeam?.code : false);
  const awayPitchers = pitchers.filter(p => awayTeam ? p.team_code !== homeTeam?.code : false);
  const homePitchers = pitchers.filter(p => homeTeam ? p.team_code === homeTeam?.code : true);

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: 'score', label: '比分速報' },
    { key: 'pbp',   label: '文字速報' },
    { key: 'stats', label: '成績' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* 頂部導覽 */}
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
        <button onClick={() => navigate('/npb')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">← NPB</button>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {isLive && <span className="flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />LIVE</span>}
          <span className="text-gray-600">{lastRefresh.toLocaleTimeString('zh-TW')}</span>
          <button onClick={fetchAll} className="hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* 比分頭部 */}
      <div className="bg-gray-900 pb-3">
        <div className="flex items-center justify-center gap-6 px-4 py-3">
          <div className="flex items-center gap-2 flex-1 justify-end">
            {awayTeam?.logo_url ? <img src={awayTeam.logo_url} alt={awayName} className="w-10 h-10 object-contain" /> : <TeamLogo name={awayName} size={40} />}
            <div className="text-right">
              <div className="text-white font-bold text-base">{awayName}</div>
              <div className="text-xs text-gray-400">客隊</div>
            </div>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-black ${game.score_away !== null && game.score_home !== null && game.score_away > game.score_home ? 'text-yellow-400' : 'text-white'}`}>
                {game.score_away ?? '—'}
              </span>
              <div className="text-center">
                <div className={`text-xs font-bold px-2 py-0.5 rounded ${isFinal ? 'bg-gray-600 text-gray-300' : isLive ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
                  {isFinal ? '終了' : isLive ? 'LIVE' : '預告'}
                </div>
                {game.venue && <div className="text-gray-500 text-[10px] mt-1 max-w-[80px] truncate">{game.venue}</div>}
              </div>
              <span className={`text-4xl font-black ${game.score_away !== null && game.score_home !== null && game.score_home > game.score_away ? 'text-yellow-400' : 'text-white'}`}>
                {game.score_home ?? '—'}
              </span>
            </div>
            <div className="text-gray-500 text-[10px] mt-1">{formatDate(game.game_date)}</div>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-start">
            <div className="text-left">
              <div className="text-white font-bold text-base">{homeName}</div>
              <div className="text-xs text-gray-400">主隊</div>
            </div>
            {homeTeam?.logo_url ? <img src={homeTeam.logo_url} alt={homeName} className="w-10 h-10 object-contain" /> : <TeamLogo name={homeName} size={40} />}
          </div>
        </div>
      </div>

      {/* Tab 切換 */}
      <div className="flex border-b border-gray-200 bg-white">
        {TAB_LABELS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === key ? 'text-red-600 border-b-2 border-red-600 -mb-[2px]' : 'text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab 內容 */}
      {tab === 'score' && (
        <div>
          <InningScoreTable innings={innings} stats={gameStats} awayName={awayName} homeName={homeName} awayTeam={awayTeam} homeTeam={homeTeam} game={game} />
          {pitchData.length > 0 ? (
            <FieldReplayPanel
              pitchData={pitchData}
              awayName={awayName}
              homeName={homeName}
              batters={batters}
              pitchers={pitchers}
              innings={innings}
              isFinal={isFinal}
              isLive={isLive}
              initialAbIdx={Math.max(0, atBats.length - 1)}
            />
          ) : isLive ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm bg-gray-50 border-t">
              比賽進行中，執行 Docomo 爬蟲後顯示逐球回顧
            </div>
          ) : null}
          {/* 勝敗資訊 */}
          {gameStats && (gameStats.win_pitcher || gameStats.attendance) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-xs text-gray-500 border-t bg-gray-50">
              {gameStats.win_pitcher && <span><span className="text-green-600 font-bold">勝</span> {gameStats.win_pitcher}</span>}
              {gameStats.loss_pitcher && <span><span className="text-red-500 font-bold">敗</span> {gameStats.loss_pitcher}</span>}
              {gameStats.save_pitcher && <span><span className="text-blue-500 font-bold">救</span> {gameStats.save_pitcher}</span>}
              {gameStats.attendance && <span>{gameStats.attendance.toLocaleString()} 人</span>}
              {gameStats.game_time && <span>{gameStats.game_time}</span>}
            </div>
          )}
        </div>
      )}

      {tab === 'pbp' && (
        <div className="bg-white">
          <PBPCards events={pbp} awayName={awayName} homeName={homeName} batters={batters}
            pitchData={pitchData} pitchers={pitchers} />
        </div>
      )}

      {tab === 'stats' && (
        <div className="bg-white divide-y divide-gray-100">
          {awayBatters.length > 0 && <BatterTable batters={awayBatters} label={`${awayName} 打者`} />}
          {homeBatters.length > 0 && <BatterTable batters={homeBatters} label={`${homeName} 打者`} />}
          {awayPitchers.length > 0 && <PitcherTable pitchers={awayPitchers} label={`${awayName} 投手`} />}
          {homePitchers.length > 0 && <PitcherTable pitchers={homePitchers} label={`${homeName} 投手`} />}
          {batters.length === 0 && pitchers.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">尚無成績資料</div>
          )}
        </div>
      )}
    </div>
  );
}
