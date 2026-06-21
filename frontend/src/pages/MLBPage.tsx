import { useState, useEffect, useCallback, Fragment } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import MLBGameDetail from '../components/MLBGameDetail';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import {
  getMLBSchedule, getMLBStandings, getMLBTaiwanPlayers, getMLBTaiwanMinors,
  MLB_TEAM_ZH, MLB_DIVISION_ORDER,
  type MLBGame, type MLBStandingDivision, type MLBTWPlayer, type MLBTWMinorPlayer,
} from '../api/mlb';
import type { Article, AdPlacement } from '../types';

// ── 球隊顏色（主色）─ ─────────────────────────────────────────────────────────
const TEAM_COLORS: Record<string, string> = {
  NYY: '#003087', BOS: '#BD3039', TOR: '#134A8E', TB: '#092C5C', BAL: '#DF4601',
  CLE: '#E31937', MIN: '#002B5C', DET: '#0C2340', CWS: '#27251F', KC: '#004687',
  HOU: '#002D62', LAA: '#BA0021', SEA: '#005C5C', ATH: '#003831', TEX: '#003278',
  ATL: '#CE1141', NYM: '#002D72', PHI: '#E81828', MIA: '#00A3E0', WSH: '#AB0003',
  MIL: '#FFC52F', CHC: '#0E3386', CIN: '#C6011F', STL: '#C41E3A', PIT: '#FDB827',
  LAD: '#005A9C', SF:  '#FD5A1E', SD:  '#2F241D', AZ:  '#A71930', COL: '#333366',
};

type StandingsTab = 'AL' | 'NL';

// ── 賽程卡 ───────────────────────────────────────────────────────────────────
function GameCard({ game, onClick }: { game: MLBGame; onClick: () => void }) {
  const isLive = game.status.abstractGameState === 'Live';
  const isFinal = game.status.abstractGameState === 'Final';
  const isPreview = !isLive && !isFinal;

  const awayAbbr = game.teams.away.team.abbreviation;
  const homeAbbr = game.teams.home.team.abbreviation;
  const awayColor = TEAM_COLORS[awayAbbr] ?? '#374151';
  const homeColor = TEAM_COLORS[homeAbbr] ?? '#374151';
  const awayScore = game.teams.away.score ?? 0;
  const homeScore = game.teams.home.score ?? 0;
  const awayWin = isFinal && awayScore > homeScore;
  const homeWin = isFinal && homeScore > awayScore;

  const gameTime = new Date(game.gameDate).toLocaleTimeString('zh-TW', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei',
  });

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all text-left w-full
        ${isLive ? 'border-red-300 shadow-red-50' : 'border-gray-100'}`}
    >
      {/* Status bar */}
      <div className={`px-3 py-1.5 rounded-t-2xl text-[10px] font-black flex items-center justify-between
        ${isLive ? 'bg-red-50 text-red-600' : isFinal ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
        {isLive ? (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {game.linescore?.inningHalf === 'Top' ? '上' : '下'}
            {game.linescore?.currentInningOrdinal} 局 &nbsp;
            {game.linescore?.outs ?? 0} 出局
          </span>
        ) : isFinal ? (
          <span>終場</span>
        ) : (
          <span>今日 {gameTime}</span>
        )}
        <ChevronRight className="w-3 h-3 opacity-50" />
      </div>

      {/* Teams + Scores */}
      <div className="px-3 py-3 space-y-2">
        {[
          { abbr: awayAbbr, color: awayColor, score: awayScore, isWinner: awayWin, label: '' },
          { abbr: homeAbbr, color: homeColor, score: homeScore, isWinner: homeWin, label: '主' },
        ].map(({ abbr, color, score, isWinner, label }) => (
          <div key={abbr} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-black text-white"
                style={{ background: color }}
              >
                {abbr.slice(0, 2)}
              </div>
              <span className={`text-sm font-bold truncate ${isWinner ? 'text-gray-900' : isFinal ? 'text-gray-400' : 'text-gray-700'}`}>
                {MLB_TEAM_ZH[abbr] ?? abbr}
                {label && <span className="ml-1 text-[10px] text-gray-400 font-normal">{label}</span>}
              </span>
            </div>
            {(isLive || isFinal) && (
              <span className={`text-xl font-black flex-shrink-0 ${isWinner ? 'text-gray-900' : 'text-gray-400'}`}>
                {score}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Decisions */}
      {isFinal && game.decisions?.winner && (
        <div className="px-3 pb-2.5 text-[10px] text-gray-400 flex gap-3">
          <span>勝 {game.decisions.winner.fullName.split(' ').slice(-1)[0]}</span>
          {game.decisions.loser && <span>敗 {game.decisions.loser.fullName.split(' ').slice(-1)[0]}</span>}
          {game.decisions.save && <span>救 {game.decisions.save.fullName.split(' ').slice(-1)[0]}</span>}
        </div>
      )}
    </button>
  );
}

// ── 積分榜單一分區 ────────────────────────────────────────────────────────────
function DivisionStandings({ division, expanded, onToggle }: {
  division: MLBStandingDivision;
  expanded: boolean;
  onToggle: () => void;
}) {
  const divName = division.division.name
    .replace('American League ', 'AL ')
    .replace('National League ', 'NL ');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
      >
        <span className="text-xs font-black text-gray-700 uppercase tracking-wide">{divName}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="overflow-x-auto border-t border-gray-50">
          <table className="w-full text-xs min-w-[340px]">
            <thead>
              <tr className="bg-gray-50 text-gray-400 font-bold">
                <th className="text-left py-2 pl-4 pr-2">球隊</th>
                <th className="py-2 px-2 text-center">勝</th>
                <th className="py-2 px-2 text-center">敗</th>
                <th className="py-2 px-2 text-center">勝率</th>
                <th className="py-2 px-2 text-center">差距</th>
                <th className="py-2 px-2 text-center">近10</th>
                <th className="py-2 px-2 text-center">連勝敗</th>
              </tr>
            </thead>
            <tbody>
              {division.teams.map((t, i) => (
                <tr
                  key={t.teamId}
                  className={`border-t border-gray-50 ${i === 0 ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2 pl-4 pr-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ background: TEAM_COLORS[t.teamAbbrev] ?? '#374151' }}
                      />
                      <span className={`font-bold ${i === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                        {MLB_TEAM_ZH[t.teamAbbrev] ?? t.teamName}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center font-bold text-gray-800">{t.wins}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{t.losses}</td>
                  <td className="py-2 px-2 text-center text-gray-600">{t.pct}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{t.gb === '-' ? '—' : t.gb}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{t.last10 ?? '-'}</td>
                  <td className={`py-2 px-2 text-center font-bold text-[10px]
                    ${t.streak?.startsWith('W') ? 'text-green-600' : t.streak?.startsWith('L') ? 'text-red-500' : 'text-gray-400'}`}>
                    {t.streak ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 小聯盟台灣選手表格 ────────────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, string> = {
  AAA: 'bg-purple-50 text-purple-700',
  AA: 'bg-blue-50 text-blue-700',
  'High-A': 'bg-green-50 text-green-700',
  A: 'bg-yellow-50 text-yellow-700',
  Rk: 'bg-gray-100 text-gray-500',
};
const LEVEL_ORDER = ['AAA', 'AA', 'High-A', 'A', 'Rk'];

function MinorLeaguePlayers({ players }: { players: MLBTWMinorPlayer[] }) {
  if (players.length === 0) return null;

  const grouped = LEVEL_ORDER.reduce<Record<string, MLBTWMinorPlayer[]>>((acc, lv) => {
    acc[lv] = players.filter(p => p.level === lv);
    return acc;
  }, {});

  return (
    <section className="mb-10">
      <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">小聯盟台灣選手</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="py-2.5 pl-4 pr-2 text-left">球員</th>
                <th className="py-2.5 px-2 text-center w-14">層級</th>
                <th className="py-2.5 px-2 text-left">球隊</th>
                <th className="py-2.5 px-2 text-center w-8">位</th>
                <th className="py-2.5 px-3 text-left">今年成績</th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_ORDER.map(lv => {
                const group = grouped[lv];
                if (!group || group.length === 0) return null;
                return (
                  <Fragment key={lv}>
                    <tr className="bg-gray-50/70">
                      <td colSpan={5} className="py-1 pl-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{lv}</td>
                    </tr>
                    {group.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="py-2.5 pl-4 pr-2">
                          <span className="font-black text-gray-900 text-sm">{p.nameZh ?? p.fullName}</span>
                          {p.nameZh && <span className="ml-1.5 text-[10px] text-gray-400">{p.fullName}</span>}
                          {p.jerseyNumber && <span className="ml-1.5 text-[10px] text-gray-300">#{p.jerseyNumber}</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${LEVEL_COLORS[p.level] ?? 'bg-gray-100 text-gray-500'}`}>
                            {p.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-gray-600">{p.currentTeam}</td>
                        <td className="py-2.5 px-2 text-center text-xs font-bold text-gray-500">{p.primaryPosition}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-600">
                          {p.pitching?.era ? (
                            <span className="flex gap-3 flex-wrap">
                              <span>ERA <strong className="text-gray-800">{p.pitching.era}</strong></span>
                              <span><strong className="text-gray-800">{p.pitching.wins ?? 0}</strong>勝<strong className="text-gray-800">{p.pitching.losses ?? 0}</strong>敗</span>
                              <span>K <strong className="text-gray-800">{p.pitching.strikeOuts ?? 0}</strong></span>
                              <span>IP <strong className="text-gray-800">{p.pitching.inningsPitched ?? 0}</strong></span>
                            </span>
                          ) : p.batting?.avg ? (
                            <span className="flex gap-3 flex-wrap">
                              <span>打率 <strong className="text-gray-800">{p.batting.avg}</strong></span>
                              <span>HR <strong className="text-gray-800">{p.batting.homeRuns ?? 0}</strong></span>
                              <span>RBI <strong className="text-gray-800">{p.batting.rbi ?? 0}</strong></span>
                              <span>安打 <strong className="text-gray-800">{p.batting.hits ?? 0}</strong></span>
                            </span>
                          ) : (
                            <span className="text-gray-300">賽季資料待更新</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── 主頁 ──────────────────────────────────────────────────────────────────────
export default function MLBPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [games, setGames] = useState<MLBGame[]>([]);
  const [standings, setStandings] = useState<MLBStandingDivision[]>([]);
  const [twPlayers, setTwPlayers] = useState<MLBTWPlayer[]>([]);
  const [twMinors, setTwMinors] = useState<MLBTWMinorPlayer[]>([]);
  const [mlbNews, setMlbNews] = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);

  const [gamesLoading, setGamesLoading] = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [gamesRefreshing, setGamesRefreshing] = useState(false);

  const [selectedGame, setSelectedGame] = useState<MLBGame | null>(null);
  const [standingsTab, setStandingsTab] = useState<StandingsTab>('AL');
  const [expandedDivs, setExpandedDivs] = useState<Record<string, boolean>>({});

  // 初始展開今天所有分區
  useEffect(() => {
    if (standings.length && !Object.keys(expandedDivs).length) {
      const init: Record<string, boolean> = {};
      standings.forEach(d => { init[d.division.name] = true; });
      setExpandedDivs(init);
    }
  }, [standings]);

  const loadGames = useCallback(async (isRefresh = false) => {
    if (isRefresh) setGamesRefreshing(true);
    try {
      const data = await getMLBSchedule();
      setGames(data);
    } catch {
      // silent
    } finally {
      setGamesLoading(false);
      setGamesRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
    getMLBStandings()
      .then(data => { setStandings(data); setStandingsLoading(false); })
      .catch(() => setStandingsLoading(false));
    getMLBTaiwanPlayers().then(setTwPlayers).catch(() => {});
    getMLBTaiwanMinors().then(setTwMinors).catch(() => {});
    getArticles({ category: 'MLB', limit: 6 }).then(setMlbNews).catch(() => {});
    getAds('mlb_header').then(setHeaderAds).catch(() => {});

    // 每 60 秒刷新賽程（若有進行中）
    const timer = setInterval(() => loadGames(true), 60_000);
    return () => clearInterval(timer);
  }, [loadGames]);

  const handleSelectArticle = async (article: Article) => {
    try {
      const full = await getArticleBySlug(article.slug);
      setSelectedArticle(full);
    } catch {
      setSelectedArticle(article);
    }
    navigate(`/article/${article.slug}`);
  };

  const alDivisions = standings.filter(d => d.division.name.startsWith('American'));
  const nlDivisions = standings.filter(d => d.division.name.startsWith('National'));
  const displayDivisions = standingsTab === 'AL' ? alDivisions : nlDivisions;

  // 今日日期台北時間
  const todayTW = new Date().toLocaleDateString('zh-TW', {
    month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Taipei',
  });

  const liveGames = games.filter(g => g.status.abstractGameState === 'Live');
  const finalGames = games.filter(g => g.status.abstractGameState === 'Final');
  const scheduledGames = games.filter(g => g.status.abstractGameState === 'Preview');

  return (
    <>
      <Helmet>
        <title>MLB 美國職棒 — 水牛體育</title>
        <meta name="description" content="MLB 美國職棒今日賽程、即時比分、積分榜與最新消息" />
      </Helmet>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
          <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
        </button>

        {/* 頁首 */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
            MLB <span className="text-red-600">美國職棒</span>
          </h1>
          <div className="hidden md:flex flex-col w-1/2 shrink-0 gap-1">
            <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-200" style={{ minHeight: 90 }}>
              {headerAds.length > 0 ? (
                <AdBanner ads={headerAds} />
              ) : (
                <div className="flex items-center justify-center h-full" style={{ minHeight: 90 }}>
                  <span className="text-gray-400 font-bold text-sm tracking-widest uppercase">廣告版位</span>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="flex justify-end">
                <button onClick={() => navigate('/admin?tab=ad')}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-bold transition">
                  <Settings className="w-3 h-3" /> 編輯廣告
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 今日賽程 */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-gray-800 border-l-4 border-red-600 pl-3">
              今日賽程
              <span className="ml-2 text-sm font-bold text-gray-400">{todayTW}</span>
            </h2>
            <button
              onClick={() => loadGames(true)}
              disabled={gamesRefreshing}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 font-bold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gamesRefreshing ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>

          {gamesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-bold bg-gray-50 rounded-2xl">
              今日無 MLB 比賽
            </div>
          ) : (
            <div className="space-y-4">
              {/* 進行中 */}
              {liveGames.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> 進行中
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {liveGames.map(g => <GameCard key={g.gamePk} game={g} onClick={() => setSelectedGame(g)} />)}
                  </div>
                </div>
              )}

              {/* 賽前 */}
              {scheduledGames.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">即將開打</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {scheduledGames.map(g => <GameCard key={g.gamePk} game={g} onClick={() => setSelectedGame(g)} />)}
                  </div>
                </div>
              )}

              {/* 終場 */}
              {finalGames.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">終場</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {finalGames.map(g => <GameCard key={g.gamePk} game={g} onClick={() => setSelectedGame(g)} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 積分榜 */}
        <section className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-black text-gray-800 border-l-4 border-red-600 pl-3">積分榜</h2>
            <div className="flex bg-gray-100 rounded-xl p-0.5">
              {(['AL', 'NL'] as StandingsTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStandingsTab(tab)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-black transition ${
                    standingsTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {standingsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-100 rounded-2xl h-14 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {displayDivisions.map(div => (
                <DivisionStandings
                  key={div.division.id}
                  division={div}
                  expanded={!!expandedDivs[div.division.name]}
                  onToggle={() => setExpandedDivs(prev => ({ ...prev, [div.division.name]: !prev[div.division.name] }))}
                />
              ))}
            </div>
          )}
        </section>

        {/* 旅美台灣選手 */}
        {twPlayers.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">旅美台灣選手</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {twPlayers.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🇹🇼</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900">{p.nameZh || p.fullName}</p>
                    <p className="text-xs text-gray-500 mb-2">{p.currentTeam} #{p.jerseyNumber ?? '-'}</p>
                    {p.batting && (
                      <div className="flex gap-3 text-xs text-gray-600">
                        <span>打率 <strong>{p.batting.avg ?? '-'}</strong></span>
                        <span>HR <strong>{p.batting.homeRuns ?? 0}</strong></span>
                        <span>RBI <strong>{p.batting.rbi ?? 0}</strong></span>
                      </div>
                    )}
                    {p.pitching && (
                      <div className="flex gap-3 text-xs text-gray-600">
                        <span>ERA <strong>{p.pitching.era ?? '-'}</strong></span>
                        <span>{p.pitching.wins ?? 0}勝{p.pitching.losses ?? 0}敗</span>
                        <span>K <strong>{p.pitching.strikeOuts ?? 0}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 小聯盟台灣選手 */}
        <MinorLeaguePlayers players={twMinors} />

        {/* 最新消息 */}
        {mlbNews.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">最新消息</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <button
                onClick={() => handleSelectArticle(mlbNews[0])}
                className="md:col-span-3 text-left flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group"
              >
                {mlbNews[0].image_url ? (
                  <img src={mlbNews[0].image_url} alt={mlbNews[0].title}
                    className="w-44 sm:w-56 h-40 object-cover flex-shrink-0 group-hover:scale-105 transition duration-500"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(mlbNews[0].title)}/400/300`; }}
                  />
                ) : (
                  <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 flex-shrink-0">
                    <span className="text-4xl">⚾</span>
                  </div>
                )}
                <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                  <span className="text-[10px] font-black text-red-600 mb-1.5">MLB 最新消息</span>
                  <p className="font-black text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug">{mlbNews[0].title}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{new Date(mlbNews[0].published_at).toLocaleDateString('zh-TW')}</p>
                </div>
              </button>

              <div className="md:col-span-2 flex flex-col gap-3">
                {mlbNews.slice(1, 3).map(a => (
                  <button key={a.id} onClick={() => handleSelectArticle(a)}
                    className="flex-1 text-left flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group p-2">
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.title}
                        className="w-20 h-16 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/400/300`; }}
                      />
                    ) : (
                      <div className="w-20 h-16 flex items-center justify-center bg-blue-50 rounded-lg flex-shrink-0">
                        <span className="text-2xl">⚾</span>
                      </div>
                    )}
                    <div className="flex flex-col justify-center min-w-0">
                      <p className="text-xs font-black text-gray-800 line-clamp-3 leading-snug">{a.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString('zh-TW')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {mlbNews.length > 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {mlbNews.slice(3, 6).map(a => (
                  <button key={a.id} onClick={() => handleSelectArticle(a)}
                    className="text-left flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-3 hover:shadow-md hover:border-red-200 transition group">
                    {a.image_url && (
                      <img src={a.image_url} alt={a.title}
                        className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
                        referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/200/150`; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-800 line-clamp-2 leading-snug">{a.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(a.published_at).toLocaleDateString('zh-TW')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Game Detail Modal */}
      {selectedGame && (
        <MLBGameDetail game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </>
  );
}
