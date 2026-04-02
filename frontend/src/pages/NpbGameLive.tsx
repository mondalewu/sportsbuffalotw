/**
 * NpbGameLive — NPB 一球速報頁面
 * Route: /npb/game/:id
 *
 * 版面結構
 * ┌────────────────────────────────────────┐
 * │  記分板（全寬）                         │
 * ├──────────────┬─────────────────────────┤
 * │  比賽狀況    │  文字速報（Play-by-Play） │
 * │  投打對決    │                          │
 * │  好球帶      │                          │
 * └──────────────┴─────────────────────────┘
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Clock, Users, MapPin, Trophy } from 'lucide-react';
import {
  NpbGame, NpbTeam, GameInning, GameStats, BatterStat, PitcherStat,
  PlayByPlayEvent, AtBat, Pitch,
  getGame, getNpbTeams, getGameInnings, getGameStats,
  getGameBatters, getGamePitchers, getGamePlayByPlay, getGameAtBats,
} from '../api/npb';

// ─── 工具函式 ────────────────────────────────────────────────────────────────

function matchTeam(teams: NpbTeam[], name: string): NpbTeam | undefined {
  if (!name) return undefined;
  return teams.find(
    t => t.name === name || t.name_full === name
      || name.includes(t.name) || t.name.includes(name)
  );
}

function formatGameDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} (${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]})`;
}

function innings漢字(n: number): string {
  const map: Record<number, string> = {
    1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
    6: '六', 7: '七', 8: '八', 9: '九', 10: '十',
    11: '十一', 12: '十二',
  };
  return map[n] ?? `第${n}`;
}

function halfLabel(isTop: boolean): string {
  return isTop ? '上半' : '下半';
}

// ─── 記分板 ──────────────────────────────────────────────────────────────────

interface ScoreboardProps {
  game: NpbGame;
  innings: GameInning[];
  stats: GameStats | null;
  awayTeam?: NpbTeam;
  homeTeam?: NpbTeam;
}

function Scoreboard({ game, innings, stats, awayTeam, homeTeam }: ScoreboardProps) {
  const maxInning = Math.max(9, ...innings.map(i => i.inning));
  const inningNums = Array.from({ length: maxInning }, (_, i) => i + 1);

  const awayScore = game.score_away;
  const homeScore = game.score_home;
  const isAwayWin = awayScore !== null && homeScore !== null && awayScore > homeScore;
  const isHomeWin = awayScore !== null && homeScore !== null && homeScore > awayScore;

  const statusLabel: Record<string, string> = {
    scheduled: '預告',
    live: 'LIVE',
    final: '終了',
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700">
      {/* 標題列 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <span className="text-xs text-slate-400">NPB 2026 熱身賽</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          game.status === 'live' ? 'bg-red-600 text-white animate-pulse' :
          game.status === 'final' ? 'bg-slate-600 text-slate-300' :
          'bg-blue-600 text-white'
        }`}>
          {statusLabel[game.status] ?? game.status}
        </span>
      </div>

      {/* 記分表 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <colgroup>
            <col style={{ minWidth: '140px' }} />
            {inningNums.map(n => <col key={n} style={{ width: '36px' }} />)}
            <col style={{ width: '44px' }} />
            <col style={{ width: '44px' }} />
            <col style={{ width: '44px' }} />
          </colgroup>
          <thead>
            <tr className="text-slate-400 text-xs">
              <th className="text-left pl-4 py-1">隊伍</th>
              {inningNums.map(n => (
                <th key={n} className="text-center py-1">{n}</th>
              ))}
              <th className="text-center py-1 border-l border-slate-700 text-yellow-400">R</th>
              <th className="text-center py-1 text-slate-300">H</th>
              <th className="text-center py-1 text-slate-300">E</th>
            </tr>
          </thead>
          <tbody>
            {/* 客隊 (Away) */}
            <tr className="border-t border-slate-700 hover:bg-slate-700/30">
              <td className="pl-4 py-2">
                <div className="flex items-center gap-2">
                  {awayTeam?.logo_url && (
                    <img src={awayTeam.logo_url} alt={awayTeam.name} className="w-7 h-7 object-contain" />
                  )}
                  <div>
                    <div className={`font-bold ${isAwayWin ? 'text-yellow-400' : 'text-white'}`}>
                      {game.team_away}
                    </div>
                    <div className="text-xs text-slate-400">客隊</div>
                  </div>
                </div>
              </td>
              {inningNums.map(n => {
                const inn = innings.find(i => i.inning === n);
                return (
                  <td key={n} className="text-center py-2 text-slate-200">
                    {inn?.score_away ?? ''}
                  </td>
                );
              })}
              <td className={`text-center py-2 font-bold text-lg border-l border-slate-700 ${isAwayWin ? 'text-yellow-400' : 'text-white'}`}>
                {awayScore ?? '-'}
              </td>
              <td className="text-center py-2 text-slate-300">{stats?.hits_away ?? '-'}</td>
              <td className="text-center py-2 text-slate-300">{stats?.errors_away ?? '-'}</td>
            </tr>
            {/* 主隊 (Home) */}
            <tr className="border-t border-slate-700 hover:bg-slate-700/30">
              <td className="pl-4 py-2">
                <div className="flex items-center gap-2">
                  {homeTeam?.logo_url && (
                    <img src={homeTeam.logo_url} alt={homeTeam.name} className="w-7 h-7 object-contain" />
                  )}
                  <div>
                    <div className={`font-bold ${isHomeWin ? 'text-yellow-400' : 'text-white'}`}>
                      {game.team_home}
                    </div>
                    <div className="text-xs text-slate-400">主隊</div>
                  </div>
                </div>
              </td>
              {inningNums.map(n => {
                const inn = innings.find(i => i.inning === n);
                return (
                  <td key={n} className="text-center py-2 text-slate-200">
                    {inn?.score_home ?? ''}
                  </td>
                );
              })}
              <td className={`text-center py-2 font-bold text-lg border-l border-slate-700 ${isHomeWin ? 'text-yellow-400' : 'text-white'}`}>
                {homeScore ?? '-'}
              </td>
              <td className="text-center py-2 text-slate-300">{stats?.hits_home ?? '-'}</td>
              <td className="text-center py-2 text-slate-300">{stats?.errors_home ?? '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 勝敗投手 + 比賽資訊 */}
      {stats && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-xs text-slate-400 border-t border-slate-700">
          {stats.win_pitcher && (
            <span><span className="text-green-400">勝</span> {stats.win_pitcher}</span>
          )}
          {stats.loss_pitcher && (
            <span><span className="text-red-400">敗</span> {stats.loss_pitcher}</span>
          )}
          {stats.save_pitcher && (
            <span><span className="text-blue-400">救</span> {stats.save_pitcher}</span>
          )}
          {stats.attendance && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{stats.attendance.toLocaleString()} 人
            </span>
          )}
          {stats.game_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{stats.game_time}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 比賽狀況面板 ─────────────────────────────────────────────────────────────

interface SituationPanelProps {
  game: NpbGame;
  pbp: PlayByPlayEvent[];
}

function BaseDiagram({ bases }: { bases: number }) {
  const has1B = (bases & 1) !== 0;
  const has2B = (bases & 2) !== 0;
  const has3B = (bases & 4) !== 0;

  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20">
      {/* 背景菱形框線 */}
      <polygon points="40,8 72,40 40,72 8,40" fill="none" stroke="#475569" strokeWidth="1.5" />
      {/* 二壘（上） */}
      <rect x="32" y="2" width="16" height="16" rx="2"
        fill={has2B ? '#f59e0b' : '#1e293b'} stroke="#475569" strokeWidth="1.5" />
      {/* 三壘（左） */}
      <rect x="2" y="32" width="16" height="16" rx="2"
        fill={has3B ? '#f59e0b' : '#1e293b'} stroke="#475569" strokeWidth="1.5" />
      {/* 一壘（右） */}
      <rect x="62" y="32" width="16" height="16" rx="2"
        fill={has1B ? '#f59e0b' : '#1e293b'} stroke="#475569" strokeWidth="1.5" />
      {/* 本壘（下，固定顯示） */}
      <polygon points="40,62 48,70 40,78 32,70" fill="#64748b" stroke="#475569" strokeWidth="1" />
    </svg>
  );
}

function BSOLights({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  return (
    <div className="flex gap-3 items-center">
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 w-3">B</span>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border ${
            i < balls ? 'bg-green-400 border-green-300' : 'bg-slate-700 border-slate-600'
          }`} />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 w-3">S</span>
        {[0, 1, 2].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border ${
            i < strikes ? 'bg-yellow-400 border-yellow-300' : 'bg-slate-700 border-slate-600'
          }`} />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 w-3">O</span>
        {[0, 1, 2].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border ${
            i < outs ? 'bg-red-400 border-red-300' : 'bg-slate-700 border-slate-600'
          }`} />
        ))}
      </div>
    </div>
  );
}

function SituationPanel({ game, pbp }: SituationPanelProps) {
  // 從最後一筆 play-by-play 推算當前局數
  const lastEvent = pbp[pbp.length - 1];
  const currentInning = lastEvent?.inning ?? 1;
  const currentIsTop = lastEvent?.is_top ?? true;

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">比賽狀況</h3>

      {game.status === 'final' ? (
        <div className="text-center py-2">
          <div className="text-2xl font-bold text-slate-300">比賽終了</div>
          {game.game_detail && (
            <div className="text-xs text-slate-500 mt-1">{game.game_detail}</div>
          )}
        </div>
      ) : game.status === 'scheduled' ? (
        <div className="text-center py-2 text-slate-400">
          <div className="text-lg">{formatGameDate(game.game_date)}</div>
          <div className="text-sm mt-1">尚未開始</div>
        </div>
      ) : (
        <>
          {/* 當前局數 */}
          <div className="text-center">
            <div className="text-xl font-bold text-white">
              {innings漢字(currentInning)}局{halfLabel(currentIsTop)}
            </div>
          </div>
          {/* BSO 燈號 */}
          <div className="flex justify-center">
            <BSOLights balls={0} strikes={0} outs={0} />
          </div>
          {/* 壘包圖 */}
          <div className="flex justify-center">
            <BaseDiagram bases={0} />
          </div>
        </>
      )}

      {/* 場地資訊 */}
      <div className="border-t border-slate-700 pt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {formatGameDate(game.game_date)}
        </div>
        {game.venue && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {game.venue}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 投打對決面板 ─────────────────────────────────────────────────────────────

interface MatchupPanelProps {
  game: NpbGame;
  batters: BatterStat[];
  pitchers: PitcherStat[];
  awayTeam?: NpbTeam;
  homeTeam?: NpbTeam;
}

function resultBadge(r: string): string {
  const map: Record<string, string> = {
    '安': 'bg-green-700 text-green-100',
    '本': 'bg-yellow-600 text-yellow-100',
    '三': 'bg-red-800 text-red-100',
    '四': 'bg-blue-700 text-blue-100',
    '死': 'bg-purple-700 text-purple-100',
  };
  const key = Object.keys(map).find(k => r.includes(k));
  return key ? map[key] : 'bg-slate-700 text-slate-200';
}

function MatchupPanel({ game, batters, pitchers, awayTeam, homeTeam }: MatchupPanelProps) {
  const awayCodes = new Set(awayTeam ? [awayTeam.code] : []);
  const awayPitchers = pitchers.filter(p => !awayCodes.has(p.team_code));
  const homePitchers = pitchers.filter(p => awayCodes.has(p.team_code));

  // 找勝投/敗投資訊
  const winPitcher = pitchers.find(p => p.result === '勝' || p.result === 'W');
  const lossPitcher = pitchers.find(p => p.result === '敗' || p.result === 'L');
  const savePitcher = pitchers.find(p => p.result === 'S' || p.result === 'SV');

  const renderPitcherRow = (p: PitcherStat) => (
    <div key={p.player_name + p.pitcher_order} className="flex justify-between items-center py-1 text-xs">
      <div className="flex items-center gap-1.5">
        {(p.result === '勝' || p.result === 'W') && <span className="text-green-400 font-bold">勝</span>}
        {(p.result === '敗' || p.result === 'L') && <span className="text-red-400 font-bold">敗</span>}
        {(p.result === 'S' || p.result === 'SV') && <span className="text-blue-400 font-bold">救</span>}
        {!['勝', '敗', 'S', 'W', 'L', 'SV'].includes(p.result ?? '') && (
          <span className="text-slate-500 w-4"></span>
        )}
        <span className="text-white">{p.player_name}</span>
      </div>
      <div className="text-slate-400 flex gap-2">
        <span>{p.innings_pitched}局</span>
        <span>{p.pitch_count}球</span>
        <span className="text-slate-300">{p.strikeouts}K</span>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">投手成績</h3>

      {/* 客隊投手 */}
      <div>
        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" className="w-4 h-4 object-contain" />}
          {game.team_away} 投手
        </div>
        {(homePitchers.length > 0 ? homePitchers : awayPitchers).map(renderPitcherRow)}
      </div>

      {/* 主隊投手 */}
      {homePitchers.length > 0 && awayPitchers.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
            {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" className="w-4 h-4 object-contain" />}
            {game.team_home} 投手
          </div>
          {awayPitchers.map(renderPitcherRow)}
        </div>
      )}

      {/* 打者亮點 */}
      {batters.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-t border-slate-700 pt-3">
            打者亮點
          </h3>
          <div className="space-y-1">
            {batters
              .filter(b => b.hits > 0 || b.home_runs > 0 || b.rbi > 0)
              .slice(0, 6)
              .map(b => (
                <div key={b.player_name + b.team_code} className="flex justify-between items-center text-xs">
                  <span className="text-white">{b.player_name}</span>
                  <div className="flex gap-1">
                    {b.at_bat_results?.slice(0, 5).map((r, i) => (
                      <span key={i} className={`px-1 py-0.5 rounded text-[10px] font-medium ${resultBadge(r)}`}>
                        {r.length > 2 ? r.slice(0, 2) : r}
                      </span>
                    ))}
                    {b.rbi > 0 && (
                      <span className="text-yellow-400 font-bold">{b.rbi}打點</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── 好球帶（Strike Zone）────────────────────────────────────────────────────

interface StrikeZoneProps {
  atBats: AtBat[];
  selectedAtBat?: AtBat | null;
  pitches: Pitch[];
}

const PITCH_RESULT_COLOR: Record<string, string> = {
  ball: '#3b82f6',
  called_strike: '#ef4444',
  swinging_strike: '#f97316',
  foul: '#eab308',
  in_play: '#22c55e',
  hbp: '#a855f7',
};

const PITCH_TYPE_LABEL: Record<string, string> = {
  FASTBALL: '直球',
  SLIDER: '滑球',
  CURVE: '曲球',
  CHANGEUP: '變速',
  CUTTER: '切球',
  SINKER: '沉球',
  SPLITTER: '叉球',
  OTHER: '其他',
};

function StrikeZonePanel({ atBats, selectedAtBat, pitches }: StrikeZoneProps) {
  const W = 200;
  const H = 210;
  // 好球帶內框：x ±0.83, y 1.5~3.5 → 映射到 SVG
  const szLeft = 20, szRight = 180, szTop = 30, szBottom = 180;
  const szW = szRight - szLeft;
  const szH = szBottom - szTop;

  const toSvgX = (x: number) => szLeft + ((x + 1) / 2) * szW;
  const toSvgY = (y: number) => szTop + ((3.5 - y) / 2) * szH;

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">好球帶</h3>

      {pitches.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <div className="text-2xl mb-2">⚾</div>
          <div>Phase 2：球路資料</div>
          <div className="text-xs mt-1 text-slate-600">爬取 Yahoo Baseball 球路資料後顯示</div>
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[220px] mx-auto">
            {/* 外框（追球區） */}
            <rect x="5" y="15" width="190" height="185" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3" />
            {/* 好球帶 */}
            <rect x={szLeft} y={szTop} width={szW} height={szH} fill="none" stroke="#64748b" strokeWidth="2" />
            {/* 9宮格格線 */}
            {[1, 2].map(i => (
              <line key={`h${i}`} x1={szLeft} y1={szTop + (szH / 3) * i} x2={szRight} y2={szTop + (szH / 3) * i}
                stroke="#334155" strokeWidth="1" />
            ))}
            {[1, 2].map(i => (
              <line key={`v${i}`} x1={szLeft + (szW / 3) * i} y1={szTop} x2={szLeft + (szW / 3) * i} y2={szBottom}
                stroke="#334155" strokeWidth="1" />
            ))}
            {/* 本壘板 */}
            <polygon points={`${W / 2 - 18},${H - 8} ${W / 2 + 18},${H - 8} ${W / 2 + 10},${H} ${W / 2 - 10},${H}`}
              fill="#475569" />
            {/* 各球落點 */}
            {pitches.map(p => {
              if (p.zone_x === null || p.zone_y === null) return null;
              const cx = toSvgX(p.zone_x);
              const cy = toSvgY(p.zone_y);
              const color = PITCH_RESULT_COLOR[p.result ?? ''] ?? '#6b7280';
              return (
                <g key={p.id}>
                  <circle cx={cx} cy={cy} r="10" fill={color} stroke="#0f172a" strokeWidth="1.5" opacity="0.9" />
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
                    {p.pitch_number}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* 圖例 */}
          <div className="mt-2 flex flex-wrap gap-2 justify-center text-[10px]">
            {Object.entries(PITCH_RESULT_COLOR).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1">
                <span style={{ backgroundColor: c }} className="w-2.5 h-2.5 rounded-full inline-block" />
                {({ ball: '壞球', called_strike: '見三振', swinging_strike: '揮三振', foul: '界外', in_play: '擊出', hbp: '死球' })[k]}
              </span>
            ))}
          </div>

          {/* 球路列表 */}
          <div className="mt-3 space-y-1 max-h-36 overflow-y-auto">
            {pitches.map(p => (
              <div key={p.id} className="flex justify-between text-xs text-slate-300 px-1">
                <span className="text-slate-400">#{p.pitch_number}</span>
                <span>{p.pitch_type ? PITCH_TYPE_LABEL[p.pitch_type] ?? p.pitch_type : '—'}</span>
                <span>{p.velocity_kmh ? `${p.velocity_kmh}km/h` : '—'}</span>
                <span style={{ color: PITCH_RESULT_COLOR[p.result ?? ''] ?? '#6b7280' }}>
                  {({ ball: '壞球', called_strike: '好球', swinging_strike: '揮空', foul: '界外', in_play: '擊出', hbp: '觸身' })[p.result ?? ''] ?? p.result}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── 文字速報（Play-by-Play）────────────────────────────────────────────────

interface PlayByPlayPanelProps {
  pbp: PlayByPlayEvent[];
  game: NpbGame;
  awayTeam?: NpbTeam;
  homeTeam?: NpbTeam;
}

function PlayByPlayPanel({ pbp, game, awayTeam, homeTeam }: PlayByPlayPanelProps) {
  // 依 (inning, is_top) 分組，由新到舊排列
  const groups: { inning: number; isTop: boolean; events: PlayByPlayEvent[] }[] = [];
  pbp.forEach(e => {
    const last = groups[groups.length - 1];
    if (!last || last.inning !== e.inning || last.isTop !== e.is_top) {
      groups.push({ inning: e.inning, isTop: e.is_top, events: [e] });
    } else {
      last.events.push(e);
    }
  });
  groups.reverse();

  const teamName = (isTop: boolean) =>
    isTop ? game.team_away : game.team_home;

  const teamLogo = (isTop: boolean) =>
    isTop ? awayTeam?.logo_url : homeTeam?.logo_url;

  return (
    <div className="bg-slate-800 rounded-lg flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">文字速報</h3>
        <span className="text-xs text-slate-500">{pbp.length} 事件</span>
      </div>

      <div className="overflow-y-auto flex-1 max-h-[600px]">
        {groups.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <div className="text-2xl mb-2">📋</div>
            尚無速報資料
          </div>
        ) : (
          groups.map(({ inning, isTop, events }) => (
            <div key={`${inning}-${isTop}`} className="border-b border-slate-700/50">
              {/* 局數標題 */}
              <div className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold sticky top-0 ${
                isTop ? 'bg-blue-900/60' : 'bg-green-900/60'
              }`}>
                {teamLogo(isTop) && (
                  <img src={teamLogo(isTop)} alt="" className="w-4 h-4 object-contain" />
                )}
                <span className="text-white">
                  {innings漢字(inning)}局{halfLabel(isTop)}
                </span>
                <span className={`text-xs ${isTop ? 'text-blue-300' : 'text-green-300'}`}>
                  {teamName(isTop)}
                </span>
              </div>
              {/* 該局事件（由下往上：最新在前） */}
              <div className="divide-y divide-slate-700/30">
                {[...events].reverse().map((e, i) => (
                  <div key={i} className="px-4 py-2.5 text-sm text-slate-200 leading-relaxed hover:bg-slate-700/30">
                    {e.description}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────

export default function NpbGameLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gameId = parseInt(id ?? '0', 10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [game, setGame] = useState<NpbGame | null>(null);
  const [teams, setTeams] = useState<NpbTeam[]>([]);
  const [innings, setInnings] = useState<GameInning[]>([]);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [batters, setBatters] = useState<BatterStat[]>([]);
  const [pitchers, setPitchers] = useState<PitcherStat[]>([]);
  const [pbp, setPbp] = useState<PlayByPlayEvent[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [pitches] = useState<Pitch[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchAll = useCallback(async () => {
    try {
      const [gameRes, teamsRes, inningsRes, statsRes, battersRes, pitchersRes, pbpRes, atBatsRes] =
        await Promise.allSettled([
          getGame(gameId),
          getNpbTeams(),
          getGameInnings(gameId),
          getGameStats(gameId),
          getGameBatters(gameId),
          getGamePitchers(gameId),
          getGamePlayByPlay(gameId),
          getGameAtBats(gameId),
        ]);

      if (gameRes.status === 'fulfilled') setGame(gameRes.value);
      else { setError('找不到比賽資料'); return; }
      if (teamsRes.status === 'fulfilled') setTeams(teamsRes.value);
      if (inningsRes.status === 'fulfilled') setInnings(inningsRes.value);
      if (statsRes.status === 'fulfilled') setGameStats(statsRes.value);
      if (battersRes.status === 'fulfilled') setBatters(battersRes.value);
      if (pitchersRes.status === 'fulfilled') setPitchers(pitchersRes.value);
      if (pbpRes.status === 'fulfilled') setPbp(pbpRes.value);
      if (atBatsRes.status === 'fulfilled') setAtBats(atBatsRes.value);
      setLastRefresh(new Date());
    } catch {
      setError('資料載入失敗');
    }
  }, [gameId]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // 自動刷新（live 比賽每 20 秒）
  useEffect(() => {
    if (game?.status === 'live') {
      timerRef.current = setInterval(fetchAll, 20000);
    }
    return () => clearInterval(timerRef.current);
  }, [game?.status, fetchAll]);

  const awayTeam = game ? matchTeam(teams, game.team_away) : undefined;
  const homeTeam = game ? matchTeam(teams, game.team_home) : undefined;

  // ── 載入中 ────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <div>載入比賽資料中...</div>
        </div>
      </div>
    );
  }

  // ── 錯誤 ────
  if (error || !game) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-4">⚾</div>
          <div className="text-lg">{error ?? '比賽不存在'}</div>
          <button onClick={() => navigate('/npb')} className="mt-4 text-blue-400 hover:underline text-sm">
            ← 回到賽程
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 頂部導覽 */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate('/npb')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          NPB 賽程
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {game.status === 'live' && (
            <span className="flex items-center gap-1 text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE · 自動刷新
            </span>
          )}
          <span>更新：{lastRefresh.toLocaleTimeString('zh-TW')}</span>
          <button onClick={fetchAll} className="hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 記分板 */}
      <Scoreboard
        game={game}
        innings={innings}
        stats={gameStats}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
      />

      {/* 主內容區 */}
      <div className="max-w-7xl mx-auto px-3 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左欄：狀況 + 投打 + 好球帶 */}
          <div className="space-y-4">
            <SituationPanel game={game} pbp={pbp} />
            <MatchupPanel
              game={game}
              batters={batters}
              pitchers={pitchers}
              awayTeam={awayTeam}
              homeTeam={homeTeam}
            />
            <StrikeZonePanel atBats={atBats} pitches={pitches} />
          </div>

          {/* 右欄：文字速報 */}
          <div className="lg:col-span-2">
            <PlayByPlayPanel
              pbp={pbp}
              game={game}
              awayTeam={awayTeam}
              homeTeam={homeTeam}
            />
          </div>
        </div>

        {/* 詳細打者成績（底部） */}
        {batters.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: `${game.team_away} 打者`, code: awayTeam?.code, list: batters.filter(b => awayTeam && b.team_code !== homeTeam?.code) },
              { label: `${game.team_home} 打者`, code: homeTeam?.code, list: batters.filter(b => homeTeam && b.team_code === homeTeam.code || (!awayTeam && !homeTeam)) },
            ].map(({ label, list }) => list.length > 0 && (
              <div key={label} className="bg-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-700 text-xs font-semibold text-slate-400">
                  {label}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="text-left pl-3 py-1.5 w-6">#</th>
                        <th className="text-left py-1.5">守位</th>
                        <th className="text-left py-1.5 min-w-[80px]">選手</th>
                        <th className="text-center py-1.5">打</th>
                        <th className="text-center py-1.5">安</th>
                        <th className="text-center py-1.5">打點</th>
                        <th className="text-center py-1.5">得分</th>
                        <th className="text-center py-1.5">本</th>
                        <th className="text-center py-1.5">振</th>
                        <th className="text-center py-1.5">四</th>
                        <th className="text-left py-1.5 pl-2">逐打席</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {list.map(b => (
                        <tr key={b.player_name + b.batting_order} className="hover:bg-slate-700/30">
                          <td className="pl-3 py-1.5 text-slate-500">{b.batting_order}</td>
                          <td className="py-1.5 text-slate-400">{b.position}</td>
                          <td className="py-1.5 text-white font-medium">{b.player_name}</td>
                          <td className="text-center py-1.5">{b.at_bats}</td>
                          <td className="text-center py-1.5 text-green-400">{b.hits}</td>
                          <td className="text-center py-1.5 text-yellow-400">{b.rbi}</td>
                          <td className="text-center py-1.5">{b.runs}</td>
                          <td className="text-center py-1.5 text-yellow-300">{b.home_runs || ''}</td>
                          <td className="text-center py-1.5 text-red-400">{b.strikeouts || ''}</td>
                          <td className="text-center py-1.5 text-blue-400">{b.walks || ''}</td>
                          <td className="py-1.5 pl-2">
                            <div className="flex gap-0.5">
                              {b.at_bat_results?.slice(0, 6).map((r, i) => (
                                <span key={i} className={`px-1 py-0.5 rounded text-[9px] ${resultBadge(r)}`}>
                                  {r.length > 3 ? r.slice(0, 3) : r}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
