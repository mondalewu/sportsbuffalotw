import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import { getTournaments, getTournamentGames, getTournamentRosters } from '../api/taiwanBaseball';
import type { TwTournament, TwGame, TwRosterPlayer } from '../api/taiwanBaseball';
import type { Article, AdPlacement } from '../types';

const LEVELS = [
  { key: 'adult',  label: '成棒',   desc: '社會／大專階段' },
  { key: 'senior', label: '青棒',   desc: '高中階段（18歲以下）' },
  { key: 'junior', label: '青少棒', desc: '國中階段（15歲以下）' },
  { key: 'youth',  label: '少棒',   desc: '國小階段（12歲以下）' },
];

type LevelKey = 'adult' | 'senior' | 'junior' | 'youth';

interface TimelineEvent {
  name: string;
  start: number;
  end: number;
  bg: string;
  text: string;
  border?: string;
}

const TIMELINE_EVENTS: Record<LevelKey, TimelineEvent[]> = {
  adult: [
    { name: '全國成棒甲組春季聯賽', start: 3, end: 6, bg: 'bg-purple-100', text: 'text-purple-800', border: 'border border-purple-200' },
    { name: '全國成棒錦標賽',       start: 8, end: 9, bg: 'bg-purple-600',  text: 'text-white' },
    { name: '全國成棒甲組秋季聯賽', start: 9, end: 11, bg: 'bg-purple-100', text: 'text-purple-800', border: 'border border-purple-200' },
  ],
  senior: [
    { name: '春季甲組聯賽',         start: 3, end: 6, bg: 'bg-red-100',    text: 'text-red-700',   border: 'border border-red-200' },
    { name: '鳳凰旗',               start: 4, end: 4, bg: 'bg-red-500',    text: 'text-white' },
    { name: '玉山盃全國青棒錦標賽', start: 6, end: 7, bg: 'bg-red-600',    text: 'text-white' },
    { name: '黑豹旗',               start: 7, end: 8, bg: 'bg-red-800',    text: 'text-white' },
    { name: '全中運',               start: 10, end: 10, bg: 'bg-gray-600', text: 'text-white' },
  ],
  junior: [
    { name: '大魯閣盃',             start: 3, end: 3,  bg: 'bg-blue-400',  text: 'text-white' },
    { name: '謝國城盃',             start: 4, end: 4,  bg: 'bg-blue-500',  text: 'text-white' },
    { name: '全國青少棒錦標賽',     start: 7, end: 8,  bg: 'bg-blue-600',  text: 'text-white' },
    { name: '全中運',               start: 10, end: 10, bg: 'bg-gray-600', text: 'text-white' },
  ],
  youth: [
    { name: '統一盃',               start: 4, end: 5,  bg: 'bg-green-400', text: 'text-white' },
    { name: '全國少棒錦標賽',       start: 6, end: 7,  bg: 'bg-green-500', text: 'text-white' },
    { name: '威廉波特台灣賽',       start: 7, end: 7,  bg: 'bg-green-600', text: 'text-white' },
    { name: 'LLWS',                 start: 8, end: 8,  bg: 'bg-emerald-700', text: 'text-white' },
    { name: '全中運',               start: 10, end: 10, bg: 'bg-gray-600', text: 'text-white' },
  ],
};

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

  const [activeLevel, setActiveLevel] = useState<LevelKey>('adult');
  const [tournaments, setTournaments] = useState<TwTournament[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [games, setGames]             = useState<TwGame[]>([]);
  const [rosters, setRosters]         = useState<TwRosterPlayer[]>([]);
  const [detailTab, setDetailTab]     = useState<'games' | 'rosters'>('games');
  const [loadingT, setLoadingT] = useState(false);
  const [loadingG, setLoadingG] = useState(false);
  const [loadingR, setLoadingR] = useState(false);

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
    if (!selectedId) { setGames([]); setRosters([]); return; }
    setLoadingG(true);
    getTournamentGames(selectedId)
      .then(setGames)
      .catch(() => setGames([]))
      .finally(() => setLoadingG(false));
    setLoadingR(true);
    getTournamentRosters(selectedId)
      .then(setRosters)
      .catch(() => setRosters([]))
      .finally(() => setLoadingR(false));
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
              onClick={() => setActiveLevel(level.key as LevelKey)}
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

        {/* Timeline for the active level */}
        <div className="mb-6 overflow-x-auto">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">年度賽事時間軸</p>
          <div className="min-w-[480px]">
            <div className="flex mb-1">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="flex-1 text-center text-[10px] font-bold text-gray-300">{i + 1}月</div>
              ))}
            </div>
            {TIMELINE_EVENTS[activeLevel].map((ev, i) => (
              <div key={i} className="relative h-6 mb-1 last:mb-0">
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: 12 }, (_, j) => (
                    <div key={j} className="flex-1 border-l border-gray-100 first:border-l-0 h-full" />
                  ))}
                </div>
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded flex items-center px-2 text-[10px] font-bold truncate ${ev.bg} ${ev.text} ${ev.border ?? ''}`}
                  style={{
                    left: `${(ev.start - 1) / 12 * 100}%`,
                    width: `${(ev.end - ev.start + 1) / 12 * 100}%`,
                    minWidth: '2.5rem',
                  }}
                >
                  {ev.name}
                </div>
              </div>
            ))}
          </div>
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

            {/* Right panel */}
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

              {/* Sub-tabs */}
              <div className="flex gap-1 mb-4 border-b border-gray-200">
                {(['games', 'rosters'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`pb-2 px-3 text-sm font-bold transition border-b-2 -mb-px ${
                      detailTab === tab
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'games' ? '賽程' : '選手名單'}
                  </button>
                ))}
              </div>

              {/* 賽程 */}
              {detailTab === 'games' && (
                loadingG ? (
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
                )
              )}

              {/* 選手名單 */}
              {detailTab === 'rosters' && (
                loadingR ? (
                  <div className="py-12 text-center text-gray-400 text-sm">載入名單中...</div>
                ) : rosters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-sm font-bold">尚無選手名單</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      rosters.reduce<Record<string, TwRosterPlayer[]>>((acc, p) => {
                        if (!acc[p.team_name]) acc[p.team_name] = [];
                        acc[p.team_name].push(p);
                        return acc;
                      }, {})
                    ).map(([team, players]) => (
                      <div key={team} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                          <span className="font-black text-sm text-gray-800">{team}</span>
                          <span className="text-xs text-gray-400">{players.length} 人</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {players.map(p => (
                            <div key={p.id} className="flex items-center px-4 py-2 gap-3 text-sm">
                              {p.jersey_number && (
                                <span className="w-6 text-center font-black text-xs text-gray-400">{p.jersey_number}</span>
                              )}
                              <span className="font-bold text-gray-800 flex-1">{p.player_name}</span>
                              {p.position && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{p.position}</span>
                              )}
                              {p.school && (
                                <span className="text-xs text-gray-400">{p.school}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
