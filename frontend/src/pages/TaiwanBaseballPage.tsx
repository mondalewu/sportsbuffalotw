import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import { getTournaments, getTournamentGames } from '../api/taiwanBaseball';
import type { TwTournament, TwGame } from '../api/taiwanBaseball';
import type { Article, AdPlacement } from '../types';

const LEVELS = [
  { key: 'senior', label: '青棒',   desc: '高中階段（18歲以下）' },
  { key: 'junior', label: '青少棒', desc: '國中階段（15歲以下）' },
  { key: 'youth',  label: '少棒',   desc: '國小階段（12歲以下）' },
];

const STATUS_LABEL: Record<TwTournament['status'], string> = {
  upcoming:  '即將開始',
  ongoing:   '進行中',
  completed: '已結束',
};

const STATUS_COLOR: Record<TwTournament['status'], string> = {
  upcoming:  'bg-gray-100 text-gray-500',
  ongoing:   'bg-green-100 text-green-700',
  completed: 'bg-red-50 text-red-400',
};

const GAME_STATUS_COLOR: Record<TwGame['status'], string> = {
  scheduled: 'text-gray-400',
  live:      'text-red-600',
  final:     'text-gray-500',
  cancelled: 'text-blue-400',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatGameTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return '';
  if (!end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export default function TaiwanBaseballPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]           = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);

  const [activeLevel, setActiveLevel] = useState<'senior' | 'junior' | 'youth'>('senior');
  const [tournaments, setTournaments] = useState<TwTournament[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [games, setGames]             = useState<TwGame[]>([]);
  const [loadingT, setLoadingT] = useState(false);
  const [loadingG, setLoadingG] = useState(false);

  useEffect(() => {
    getArticles({ category: '三級棒球', limit: 3 }).then(setNews).catch(() => {});
    getAds('taiwan_baseball_header').then(setHeaderAds).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingT(true);
    setSelectedId(null);
    setGames([]);
    getTournaments({ level: activeLevel, year: 2026 })
      .then(data => { setTournaments(data); if (data.length) setSelectedId(data[0].id); })
      .catch(() => setTournaments([]))
      .finally(() => setLoadingT(false));
  }, [activeLevel]);

  useEffect(() => {
    if (!selectedId) { setGames([]); return; }
    setLoadingG(true);
    getTournamentGames(selectedId)
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoadingG(false));
  }, [selectedId]);

  const handleSelectArticle = async (article: Article) => {
    try {
      const full = await getArticleBySlug(article.slug);
      setSelectedArticle(full);
    } catch {
      setSelectedArticle(article);
    }
    navigate(`/article/${article.slug}`);
  };

  const selected = tournaments.find(t => t.id === selectedId) ?? null;

  const rounds = games.reduce<Record<string, TwGame[]>>((acc, g) => {
    const key = g.round || '賽程';
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Helmet>
        <title>台灣三級棒球 - 水牛體育</title>
      </Helmet>

      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          台灣 <span className="text-red-600">三級棒球</span>
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
              <button
                onClick={() => navigate('/admin?tab=ad')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-bold transition"
              >
                <Settings className="w-3 h-3" /> 編輯廣告
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 最新消息 */}
      {news.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">最新消息</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <button
              onClick={() => handleSelectArticle(news[0])}
              className="md:col-span-3 text-left flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group"
            >
              {news[0].image_url ? (
                <img src={news[0].image_url} alt={news[0].title}
                  className="w-44 sm:w-56 h-40 object-cover flex-shrink-0 group-hover:scale-105 transition duration-500"
                  referrerPolicy="no-referrer"
                  onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(news[0].title)}/400/300`; }}
                />
              ) : (
                <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 flex-shrink-0">
                  <span className="text-4xl">⚾</span>
                </div>
              )}
              <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                <span className="text-[10px] font-black text-red-600 mb-1.5">三級棒球 最新消息</span>
                <p className="font-black text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug">{news[0].title}</p>
                <p className="text-[10px] text-gray-400 mt-2">{new Date(news[0].published_at).toLocaleDateString('zh-TW')}</p>
              </div>
            </button>

            <div className="md:col-span-2 flex flex-col gap-3">
              {news.slice(1, 3).map(a => (
                <button
                  key={a.id}
                  onClick={() => handleSelectArticle(a)}
                  className="flex-1 text-left flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group p-2"
                >
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.title}
                      className="w-20 h-16 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition duration-500"
                      referrerPolicy="no-referrer"
                      onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/400/300`; }}
                    />
                  ) : (
                    <div className="w-20 h-16 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex-shrink-0">
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
        </div>
      )}

      {/* Level Tabs + Tournament Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
        {/* Level Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {LEVELS.map(level => (
            <button
              key={level.key}
              onClick={() => setActiveLevel(level.key as typeof activeLevel)}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 -mb-px ${
                activeLevel === level.key
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>

        {loadingT ? (
          <div className="flex justify-center py-16 text-gray-400 text-sm">載入中...</div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-14 h-14 mb-4 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M5.5 7.5c1.5 1 2.5 2.8 2.5 4.5s-1 3.5-2.5 4.5M18.5 7.5c-1.5 1-2.5 2.8-2.5 4.5s1 3.5 2.5 4.5" />
            </svg>
            <p className="text-sm font-bold">目前無賽事資料</p>
            <p className="text-xs mt-1">賽程資訊整合中，敬請期待</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Tournament list */}
            <div className="md:w-56 flex-shrink-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">2026 賽事</p>
              <div className="space-y-2">
                {tournaments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      selectedId === t.id
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    <p className={`text-sm font-bold leading-snug ${selectedId === t.id ? 'text-red-700' : 'text-gray-800'}`}>
                      {t.name}
                    </p>
                    {(t.start_date || t.end_date) && (
                      <p className="text-xs text-gray-400 mt-1">{formatDateRange(t.start_date, t.end_date)}</p>
                    )}
                    {t.format && <p className="text-xs text-gray-400">{t.format}</p>}
                  </button>
                ))}
              </div>
            </div>

            {/* Games panel */}
            <div className="flex-1 min-w-0">
              {selected && (
                <div className="mb-4">
                  <h2 className="text-lg font-black">{selected.name}</h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[selected.status]}`}>
                      {STATUS_LABEL[selected.status]}
                    </span>
                    {(selected.start_date || selected.end_date) && (
                      <span>{formatDateRange(selected.start_date, selected.end_date)}</span>
                    )}
                    {selected.format && <span>{selected.format}</span>}
                  </div>
                </div>
              )}

              {loadingG ? (
                <div className="py-12 text-center text-gray-400 text-sm">載入賽程中...</div>
              ) : games.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                  <p className="text-sm font-bold">尚無賽程資料</p>
                  <p className="text-xs mt-1">賽程公告後將即時更新</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(rounds).map(([round, roundGames]) => (
                    <div key={round}>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{round}</p>
                      <div className="space-y-2">
                        {roundGames.map(g => {
                          const isLive    = g.status === 'live';
                          const isFinal   = g.status === 'final';
                          const isCancelled = g.status === 'cancelled';
                          const homeWin = isFinal && g.score_home !== null && g.score_away !== null && g.score_home > g.score_away;
                          const awayWin = isFinal && g.score_home !== null && g.score_away !== null && g.score_away > g.score_home;
                          return (
                            <div key={g.id} className={`border rounded-xl p-4 ${isLive ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  {g.game_date && <span>{formatDate(g.game_date)}{!isFinal && !isCancelled && ` ${formatGameTime(g.game_date)}`}</span>}
                                  {g.venue && <span>· {g.venue}</span>}
                                </div>
                                <span className={`text-[11px] font-bold ${GAME_STATUS_COLOR[g.status]}`}>
                                  {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1 align-middle" />}
                                  {isCancelled ? '取消' : isLive ? (g.game_detail || 'LIVE') : isFinal ? '終場' : ''}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className={`flex items-center justify-between ${homeWin ? 'font-black' : ''}`}>
                                  <span className="text-sm">{g.team_home}</span>
                                  <span className="text-sm font-black tabular-nums">
                                    {isFinal || isLive ? (g.score_home ?? '—') : '—'}
                                  </span>
                                </div>
                                <div className={`flex items-center justify-between ${awayWin ? 'font-black' : ''}`}>
                                  <span className="text-sm">{g.team_away}</span>
                                  <span className="text-sm font-black tabular-nums">
                                    {isFinal || isLive ? (g.score_away ?? '—') : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
