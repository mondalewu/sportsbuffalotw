import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import { getNbaScoreboard, getNbaStandings } from '../api/nba';
import type { NbaGame, NbaStanding } from '../api/nba';
import type { Article, AdPlacement } from '../types';

type Tab = 'east' | 'west';
type ViewMode = 'conf' | 'div';

const DIV_ORDER: Record<string, string[]> = {
  East: ['Atlantic', 'Central', 'Southeast'],
  West: ['Northwest', 'Pacific', 'Southwest'],
};

const DIV_ZH: Record<string, string> = {
  Atlantic: '大西洋', Central: '中部', Southeast: '東南',
  Northwest: '西北', Pacific: '太平洋', Southwest: '西南',
};

function parseGameClock(clock: string): string {
  const m = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!m) return clock;
  const mins = parseInt(m[1], 10);
  const secs = Math.floor(parseFloat(m[2]));
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function GameCard({ game }: { game: NbaGame }) {
  const navigate = useNavigate();
  const isLive = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const homeWin = isFinal && game.homeTeam.score > game.awayTeam.score;
  const awayWin = isFinal && game.awayTeam.score > game.homeTeam.score;

  const gameTime = game.gameTimeUTC
    ? new Date(game.gameTimeUTC).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
    : '';

  return (
    <div
      onClick={() => navigate(`/nba/game/${game.gameId}`)}
      className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col gap-3 cursor-pointer hover:shadow-md transition
        ${isLive ? 'border-red-300 shadow-red-100' : 'border-gray-100 hover:border-red-200'}`}>
      {/* Status */}
      <div className="flex items-center justify-between">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs font-black text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Q{game.period} {parseGameClock(game.gameClock)}
          </span>
        ) : isFinal ? (
          <span className="text-xs font-bold text-gray-400">終場</span>
        ) : (
          <span className="text-xs font-bold text-blue-500">{gameTime}</span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        {/* Away */}
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${awayWin ? 'text-gray-900' : 'text-gray-500'}`}>
            {game.awayTeam.nameZh}
          </span>
          {(isLive || isFinal) && (
            <span className={`text-lg font-black ${awayWin ? 'text-gray-900' : 'text-gray-400'}`}>
              {game.awayTeam.score}
            </span>
          )}
        </div>
        {/* Home */}
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${homeWin ? 'text-gray-900' : 'text-gray-500'}`}>
            {game.homeTeam.nameZh}
            <span className="ml-1 text-[10px] text-gray-400 font-normal">主</span>
          </span>
          {(isLive || isFinal) && (
            <span className={`text-lg font-black ${homeWin ? 'text-gray-900' : 'text-gray-400'}`}>
              {game.homeTeam.score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StandingsTable({ teams, viewMode }: { teams: NbaStanding[]; viewMode: ViewMode }) {
  const rankKey = viewMode === 'conf' ? 'confRank' : 'divRank';

  if (viewMode === 'div') {
    const confName = teams[0]?.conference ?? 'East';
    const divKeys = DIV_ORDER[confName] ?? [];
    const grouped = divKeys.map(div => ({
      div,
      divZh: DIV_ZH[div] ?? div,
      rows: teams.filter(t => t.division === div).sort((a, b) => a.divRank - b.divRank),
    })).filter(g => g.rows.length > 0);

    return (
      <div className="space-y-6">
        {grouped.map(({ div, divZh, rows }) => (
          <div key={div}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{divZh}組</p>
            <TableBody teams={rows} rankKey="divRank" showPlayoff={false} />
          </div>
        ))}
      </div>
    );
  }

  return <TableBody teams={teams} rankKey={rankKey} showPlayoff />;
}

function TableBody({ teams, rankKey, showPlayoff }: { teams: NbaStanding[]; rankKey: 'confRank' | 'divRank'; showPlayoff: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] font-black text-gray-400 border-b border-gray-100 bg-gray-50">
            <th className="text-left px-3 py-2 w-8">#</th>
            <th className="text-left px-2 py-2">球隊</th>
            <th className="px-2 py-2 text-center">勝</th>
            <th className="px-2 py-2 text-center">敗</th>
            <th className="px-2 py-2 text-center">勝率</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">差距</th>
            <th className="px-2 py-2 text-center hidden md:table-cell">近10場</th>
            <th className="px-2 py-2 text-center hidden md:table-cell">連勝敗</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {teams.map((t) => {
            const rank = t[rankKey];
            const isPlayin = showPlayoff && rank >= 7 && rank <= 10;
            const isDirect = showPlayoff && rank <= 6;
            return (
              <tr key={t.tricode}
                className={`hover:bg-gray-50 transition
                  ${isDirect ? 'bg-blue-50/30' : ''}
                  ${isPlayin ? 'bg-yellow-50/50' : ''}`}>
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center
                    ${rank === 1 ? 'bg-yellow-400 text-white' : rank === 2 ? 'bg-gray-300 text-white' : rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                    {rank}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <span className="font-bold text-gray-800 text-xs">{t.nameZh}</span>
                  {isPlayin && <span className="ml-1 text-[9px] text-yellow-600 font-black">附加賽</span>}
                </td>
                <td className="px-2 py-2.5 text-center text-xs font-bold text-gray-700">{t.wins}</td>
                <td className="px-2 py-2.5 text-center text-xs text-gray-500">{t.losses}</td>
                <td className="px-2 py-2.5 text-center text-xs font-black text-red-600">
                  {t.winPct.toFixed(3)}
                </td>
                <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden sm:table-cell">
                  {rank === 1 ? '-' : `+${t.gamesBehind}`}
                </td>
                <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden md:table-cell">{t.last10}</td>
                <td className="px-2 py-2.5 text-center text-xs hidden md:table-cell">
                  <span className={`font-bold ${t.streak.startsWith('W') ? 'text-green-600' : 'text-red-500'}`}>{t.streak}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function NBAPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]             = useState<Article[]>([]);
  const [headerAds, setHeaderAds]   = useState<AdPlacement[]>([]);
  const [games, setGames]           = useState<NbaGame[]>([]);
  const [standings, setStandings]   = useState<NbaStanding[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>('east');
  const [viewMode, setViewMode]     = useState<ViewMode>('conf');

  useEffect(() => {
    getArticles({ category: 'NBA', limit: 3 }).then(setNews).catch(() => {});
    getAds('nba_header').then(setHeaderAds).catch(() => {});
    Promise.all([getNbaScoreboard(), getNbaStandings()])
      .then(([g, s]) => { setGames(g); setStandings(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const confTeams = useMemo(() => {
    const key = tab === 'east' ? 'East' : 'West';
    return standings.filter(t => t.conference === key).sort((a, b) => a.confRank - b.confRank);
  }, [standings, tab]);

  const handleSelectArticle = async (article: Article) => {
    try {
      const full = await getArticleBySlug(article.slug);
      setSelectedArticle(full);
    } catch {
      setSelectedArticle(article);
    }
    navigate(`/article/${article.slug}`);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Helmet><title>NBA - 水牛體育</title></Helmet>

      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          2024–25 NBA <span className="text-red-600">美國職籃</span>
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
              <button onClick={() => navigate('/admin?tab=ad')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-bold transition">
                <Settings className="w-3 h-3" /> 編輯廣告
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 今日比賽 */}
      <div className="mb-8">
        <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">今日賽事</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 font-bold">今日無賽事</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {games.map(g => <GameCard key={g.gameId} game={g} />)}
          </div>
        )}
      </div>

      {/* 最新消息 */}
      {news.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">最新消息</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <button onClick={() => handleSelectArticle(news[0])}
              className="md:col-span-3 text-left flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group">
              {news[0].image_url ? (
                <img src={news[0].image_url} alt={news[0].title}
                  className="w-44 sm:w-56 h-40 object-cover flex-shrink-0 group-hover:scale-105 transition duration-500"
                  referrerPolicy="no-referrer"
                  onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(news[0].title)}/400/300`; }} />
              ) : (
                <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 flex-shrink-0">
                  <span className="text-4xl">🏀</span>
                </div>
              )}
              <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                <span className="text-[10px] font-black text-red-600 mb-1.5">NBA 最新消息</span>
                <p className="font-black text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug">{news[0].title}</p>
                <p className="text-[10px] text-gray-400 mt-2">{new Date(news[0].published_at).toLocaleDateString('zh-TW')}</p>
              </div>
            </button>
            <div className="md:col-span-2 flex flex-col gap-3">
              {news.slice(1, 3).map(a => (
                <button key={a.id} onClick={() => handleSelectArticle(a)}
                  className="flex-1 text-left flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group p-2">
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.title}
                      className="w-20 h-16 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition duration-500"
                      referrerPolicy="no-referrer"
                      onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/400/300`; }} />
                  ) : (
                    <div className="w-20 h-16 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex-shrink-0">
                      <span className="text-2xl">🏀</span>
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
        </div>
      )}

      {/* Standings */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 border-b border-gray-200 flex-1">
            {([['east', '東區'], ['west', '西區']] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`pb-3 px-4 text-sm font-bold transition border-b-2 -mb-px ${tab === k ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-4 mb-3 shrink-0">
            {([['conf', '聯盟排名'], ['div', '分區排名']] as [ViewMode, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setViewMode(k)}
                className={`text-xs px-3 py-1 rounded-full font-bold transition ${viewMode === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : confTeams.length === 0 ? (
          <p className="text-center text-gray-400 py-8">載入中...</p>
        ) : (
          <StandingsTable teams={confTeams} viewMode={viewMode} />
        )}

        <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-50 border border-blue-100 rounded inline-block" /> 直接晉級（前6）</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-50 border border-yellow-100 rounded inline-block" /> 附加賽（7–10）</span>
          <span className="ml-auto">資料來源：ESPN</span>
        </div>
      </div>
    </main>
  );
}
