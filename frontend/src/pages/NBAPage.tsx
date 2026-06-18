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
type StandingTab = 'conf' | 'div';

const DIV_ORDER: Record<string, string[]> = {
  East: ['Atlantic', 'Central', 'Southeast'],
  West: ['Northwest', 'Pacific', 'Southwest'],
};

function parseGameClock(clock: string): string {
  // "PT08M30.00S" → "8:30"
  const m = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!m) return clock;
  const min = parseInt(m[1]);
  const sec = Math.floor(parseFloat(m[2]));
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function NBAPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]             = useState<Article[]>([]);
  const [headerAds, setHeaderAds]   = useState<AdPlacement[]>([]);
  const [tab, setTab]               = useState<Tab>('east');
  const [standingTab, setStandingTab] = useState<StandingTab>('conf');

  const [scoreboard, setScoreboard]   = useState<NbaGame[]>([]);
  const [standings, setStandings]     = useState<NbaStanding[]>([]);
  const [loadingScore, setLoadingScore] = useState(true);
  const [loadingStand, setLoadingStand] = useState(true);

  useEffect(() => {
    getArticles({ category: 'NBA', limit: 3 }).then(setNews).catch(() => {});
    getAds('nba_header').then(setHeaderAds).catch(() => {});

    getNbaScoreboard()
      .then(setScoreboard)
      .catch(() => {})
      .finally(() => setLoadingScore(false));

    getNbaStandings()
      .then(setStandings)
      .catch(() => {})
      .finally(() => setLoadingStand(false));
  }, []);

  const handleSelectArticle = async (article: Article) => {
    try {
      const full = await getArticleBySlug(article.slug);
      setSelectedArticle(full);
    } catch {
      setSelectedArticle(article);
    }
    navigate(`/article/${article.slug}`);
  };

  // 依東/西區過濾
  const confTeams = useMemo(() => {
    const conf = tab === 'east' ? 'East' : 'West';
    return standings
      .filter(s => s.conference === conf)
      .sort((a, b) => a.confRank - b.confRank);
  }, [standings, tab]);

  // 依組別分群
  const divGroups = useMemo(() => {
    const conf = tab === 'east' ? 'East' : 'West';
    return DIV_ORDER[conf].map(div => ({
      div,
      divZh: standings.find(s => s.division === div)?.divisionZh ?? div,
      teams: standings
        .filter(s => s.conference === conf && s.division === div)
        .sort((a, b) => a.divRank - b.divRank),
    }));
  }, [standings, tab]);

  const hasStandings = standings.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Helmet><title>NBA - 水牛體育</title></Helmet>

      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          2025–26 NBA <span className="text-red-600">美國職籃</span>
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
        {loadingScore ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : scoreboard.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-gray-400 font-bold text-sm">
            今日暫無 NBA 賽事
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {scoreboard.map(g => {
              const isLive  = g.gameStatus === 2;
              const isFinal = g.gameStatus === 3;
              const startTime = g.gameTimeUTC
                ? new Date(g.gameTimeUTC).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
                : '';
              return (
                <div key={g.gameId} className={`bg-white rounded-2xl border shadow-sm p-4 ${isLive ? 'border-red-300' : 'border-gray-100'}`}>
                  {isLive && (
                    <div className="flex items-center gap-1 mb-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-red-500">
                        {g.period}節 {parseGameClock(g.gameClock)}
                      </span>
                    </div>
                  )}
                  {isFinal && <p className="text-[10px] font-black text-gray-400 mb-2">終場</p>}
                  {!isLive && !isFinal && startTime && (
                    <p className="text-[10px] font-bold text-gray-400 mb-2">{startTime}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-500">{g.awayTeam.tricode}</p>
                      <p className="text-xs font-bold text-gray-700 truncate">{g.awayTeam.nameZh}</p>
                    </div>
                    {(isLive || isFinal) ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xl font-black tabular-nums ${g.awayTeam.score > g.homeTeam.score ? 'text-gray-900' : 'text-gray-400'}`}>
                          {g.awayTeam.score}
                        </span>
                        <span className="text-gray-300 text-sm">-</span>
                        <span className={`text-xl font-black tabular-nums ${g.homeTeam.score > g.awayTeam.score ? 'text-gray-900' : 'text-gray-400'}`}>
                          {g.homeTeam.score}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-sm flex-shrink-0">vs</span>
                    )}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs font-black text-gray-500">{g.homeTeam.tricode}</p>
                      <p className="text-xs font-bold text-gray-700 truncate">{g.homeTeam.nameZh}</p>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* 積分榜 */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-gray-800">積分榜</h2>
          {hasStandings && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['conf', '分區'] , ['div', '組別']] as [StandingTab, string][]).map(([k, label]) => (
                <button key={k} onClick={() => setStandingTab(k)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${standingTab === k ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 東/西區切換 */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {([['east', '東區'], ['west', '西區']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 -mb-px ${tab === k ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>

        {loadingStand ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : !hasStandings ? (
          <p className="text-center text-gray-400 text-sm py-6">積分榜資料載入失敗，請稍後再試</p>
        ) : standingTab === 'conf' ? (
          /* 分區排行 */
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
                  <th className="px-2 py-2 text-center hidden md:table-cell">主場</th>
                  <th className="px-2 py-2 text-center hidden md:table-cell">客場</th>
                  <th className="px-2 py-2 text-center hidden lg:table-cell">近10場</th>
                  <th className="px-2 py-2 text-center hidden lg:table-cell">連勝敗</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {confTeams.map(s => (
                  <tr key={s.tricode} className={`hover:bg-gray-50 transition ${s.confRank <= 6 ? '' : s.confRank <= 10 ? 'bg-yellow-50/40' : ''}`}>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center
                        ${s.confRank === 1 ? 'bg-yellow-400 text-white' : s.confRank === 2 ? 'bg-gray-300 text-white' : s.confRank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                        {s.confRank}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div>
                        <span className="text-xs font-black text-gray-800">{s.nameZh}</span>
                        <span className="text-[10px] text-gray-400 ml-1">{s.tricode}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-bold text-gray-700">{s.wins}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500">{s.losses}</td>
                    <td className="px-2 py-2.5 text-center text-xs font-black text-red-600">{s.winPct.toFixed(3)}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden sm:table-cell">{s.gamesBehind === 0 ? '-' : s.gamesBehind}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden md:table-cell">{s.homeRecord}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden md:table-cell">{s.roadRecord}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden lg:table-cell">{s.last10}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500 hidden lg:table-cell">{s.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* 組別排行 */
          <div className="space-y-6">
            {divGroups.map(({ div, divZh, teams }) => (
              <div key={div}>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{divZh}</p>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-black text-gray-400 border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-2 w-8">#</th>
                        <th className="text-left px-2 py-2">球隊</th>
                        <th className="px-2 py-2 text-center">勝</th>
                        <th className="px-2 py-2 text-center">敗</th>
                        <th className="px-2 py-2 text-center">勝率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {teams.map(s => (
                        <tr key={s.tricode} className="hover:bg-gray-50 transition">
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center
                              ${s.divRank === 1 ? 'bg-yellow-400 text-white' : s.divRank === 2 ? 'bg-gray-300 text-white' : s.divRank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                              {s.divRank}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="text-xs font-black text-gray-800">{s.nameZh}</span>
                            <span className="text-[10px] text-gray-400 ml-1">{s.tricode}</span>
                          </td>
                          <td className="px-2 py-2.5 text-center text-xs font-bold text-gray-700">{s.wins}</td>
                          <td className="px-2 py-2.5 text-center text-xs text-gray-500">{s.losses}</td>
                          <td className="px-2 py-2.5 text-center text-xs font-black text-red-600">{s.winPct.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasStandings && (
          <div className="mt-3 text-xs text-gray-400 text-center space-y-0.5">
            <p>前 6 名直接晉級季後賽；7-10 名進入附加賽（黃底）</p>
            <p>資料來源：NBA.com 官方 API</p>
          </div>
        )}
      </div>
    </main>
  );
}
