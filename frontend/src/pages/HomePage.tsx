import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, RefreshCw, Tag, Clock, ChevronRight, ChevronLeft, Flame, TrendingUp, Newspaper, X, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import PollVote from '../components/PollVote';
import LiveStories from '../components/LiveStories';
import VideoPlayer from '../components/VideoPlayer';
import { getArticles, getArticleBySlug, fetchExternalNews, getTrendingArticles, getStoryCards } from '../api/articles';
import type { StoryCard } from '../api/articles';
import { getAds } from '../api/ads';
import { getPolls } from '../api/polls';
import type { Poll } from '../api/polls';
import type { Article, AdPlacement } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  CPBL: 'bg-blue-600',
  NPB: 'bg-red-700',
  MLB: 'bg-blue-900',
  NBA: 'bg-orange-600',
  WBC: 'bg-indigo-700',
  籃球: 'bg-amber-600',
  足球: 'bg-green-700',
  田徑: 'bg-teal-600',
  三級棒球: 'bg-cyan-700',
  其他: 'bg-gray-600',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ─── Reels Viewer (full-screen overlay) ──────────────────────────────────────

function ReelsViewer({ cards, initialIndex, onClose }: {
  cards: StoryCard[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number>(0);

  const card = cards[index];
  const ytId = getYouTubeId(card?.video_url);
  const isVideo = !!card?.video_url && !ytId;
  const isYouTube = !!ytId;

  const goNext = () => {
    if (index < cards.length - 1) { setIndex(i => i + 1); setProgress(0); }
    else onClose();
  };
  const goPrev = () => {
    if (index > 0) { setIndex(i => i - 1); setProgress(0); }
  };

  // image timer
  useEffect(() => {
    if (!card || isVideo || isYouTube || paused) return;
    const dur = card.duration_ms || 6000;
    const interval = 50;
    timerRef.current = window.setInterval(() => {
      setProgress(p => {
        const next = p + (interval / dur) * 100;
        if (next >= 100) { goNext(); return 0; }
        return next;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [index, paused, isVideo, card]);

  // video progress
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    v.currentTime = 0;
    if (!paused) v.play().catch(() => {});
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnd = () => goNext();
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnd); };
  }, [index, isVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => {});
  }, [paused]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [index]);

  // lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-4 pt-3 z-20">
        {cards.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Top controls */}
      <div className="absolute top-6 right-4 z-20 flex items-center gap-3">
        <button onClick={() => setPaused(p => !p)} className="text-white/80 hover:text-white">
          {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>
        {isVideo && (
          <button onClick={() => setMuted(m => !m)} className="text-white/80 hover:text-white">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        )}
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Nav arrows */}
      {index > 0 && (
        <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {index < cards.length - 1 && (
        <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Content */}
      <div
        className="relative w-full max-w-[420px] aspect-[9/16] rounded-2xl overflow-hidden mx-auto"
        onClick={() => { if (!isYouTube) setPaused(p => !p); }}
      >
        {isYouTube ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=0&loop=0&controls=1&playsinline=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : isVideo ? (
          <video
            ref={videoRef}
            src={card.video_url}
            className="w-full h-full object-cover"
            playsInline
            muted={muted}
            loop={false}
          />
        ) : (
          <img
            src={card.image_url}
            alt={card.title}
            className="w-full h-full object-cover"
          />
        )}
        {!isYouTube && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {card.category && (
            <span className="inline-block bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full mb-2 uppercase">
              {card.category}
            </span>
          )}
          <h3 className="text-white text-lg font-black leading-snug drop-shadow">{card.title}</h3>
          {card.link_url && (
            <a
              href={card.link_url}
              onClick={e => e.stopPropagation()}
              className="inline-block mt-3 bg-white text-black text-sm font-black px-5 py-2 rounded-full hover:bg-gray-200 transition"
            >
              查看更多
            </a>
          )}
        </div>

        {(isVideo || isYouTube) && (
          <div className="absolute top-3 left-3 bg-black/40 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
            <Play className="w-3 h-3" /> 影片
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stories Carousel ────────────────────────────────────────────────────────

function StoriesCarousel({ cards, onCardClick, categoryColors }: {
  cards: StoryCard[];
  onCardClick: (index: number) => void;
  categoryColors: Record<string, string>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => { checkScroll(); }, [cards]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth * 0.7 : el.clientWidth * 0.7, behavior: 'smooth' });
  };

  const isNew = (dateStr?: string) => {
    if (!dateStr) return false;
    return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border-l-8 border-red-600 pl-4 mb-4">
        <h3 className="font-black text-lg uppercase tracking-wide">Stories</h3>
      </div>

      <div className="relative group/carousel">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-white transition opacity-0 group-hover/carousel:opacity-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/80 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-black transition text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((c, i) => (
            <div
              key={c.id}
              onClick={() => onCardClick(i)}
              className="flex-shrink-0 w-[180px] sm:w-[200px] group cursor-pointer snap-start"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 aspect-[3/4]">
                <img
                  src={c.image_url}
                  alt={c.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {isNew(c.created_at) && (
                  <span className="absolute top-3 left-3 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow">
                    New
                  </span>
                )}

                {c.category && (
                  <span className={`absolute top-3 right-3 ${categoryColors[c.category] ?? 'bg-gray-600'} text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow`}>
                    {c.category}
                  </span>
                )}

                {c.video_url && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h4 className="text-white text-sm font-black leading-snug line-clamp-2 drop-shadow-sm">
                    {c.title}
                  </h4>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { currentUser, setAuthModal, setSelectedArticle } = useApp();
  const navigate = useNavigate();

  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [newsCategory, setNewsCategory] = useState<string>('all');
  const filteredArticles = useMemo(
    () => newsCategory === 'all' ? articles : articles.filter(a => a.category === newsCategory),
    [articles, newsCategory]
  );
  const [sidebarAds, setSidebarAds] = useState<AdPlacement[]>([]);
  const [homePoll, setHomePoll] = useState<Poll | null>(null);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [trendingArticles, setTrendingArticles] = useState<(Article & { week_views: number })[]>([]);
  const [storyCards, setStoryCards] = useState<StoryCard[]>([]);
  const [reelsViewerIndex, setReelsViewerIndex] = useState<number | null>(null);

  const loadArticles = () => {
    setArticlesLoading(true);
    getArticles({ limit: 20 }).then(data => {
      setArticles(data);
      setArticlesLoading(false);
    }).catch(() => setArticlesLoading(false));
  };

  useEffect(() => {
    loadArticles();
    getTrendingArticles(5).then(setTrendingArticles).catch(() => {});
    getStoryCards().then(setStoryCards).catch(() => {});
    getAds('sidebar').then(setSidebarAds).catch(() => {});
    getPolls().then(data => { if (data.length > 0) setHomePoll(data[0]); }).catch(() => {});
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

  const handleFetchExternalNews = async () => {
    setIsFetchingNews(true);
    try {
      const newArticles = await fetchExternalNews();
      setArticles(prev => [...newArticles, ...prev]);
    } catch {
      loadArticles();
    } finally {
      setIsFetchingNews(false);
    }
  };

  const categoryGroups = useMemo(() => {
    const groups: Record<string, Article[]> = {};
    articles.forEach(a => {
      if (!groups[a.category]) groups[a.category] = [];
      if (groups[a.category].length < 4) groups[a.category].push(a);
    });
    return Object.entries(groups).filter(([, arr]) => arr.length >= 2);
  }, [articles]);

  const pinnedArticles = filteredArticles.filter(a => a.placement === 'pinned');
  const heroArticle = filteredArticles.find(a => a.placement === 'hero');
  const featuredArticles = filteredArticles.filter(a => a.placement === 'featured');
  const normalArticles = filteredArticles.filter(a => !a.placement || a.placement === 'default');

  const hero = heroArticle || pinnedArticles[0] || normalArticles[0];
  const heroListPool = [...pinnedArticles, ...normalArticles].filter(a => a.id !== hero?.id);
  const heroList = heroListPool.slice(0, 6);
  const belowHero = featuredArticles.length > 0
    ? featuredArticles.slice(0, 4)
    : heroListPool.slice(6, 10);
  const topRow = filteredArticles.slice(2, 5);
  const usedIds = new Set([hero?.id, ...heroList.map(a => a.id), ...belowHero.map(a => a.id)].filter(Boolean));
  const remaining = filteredArticles.filter(a => !usedIds.has(a.id));
  const midArticles = remaining.slice(0, 4);
  const restArticles = remaining.slice(4);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <LiveStories />

      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 border-l-8 border-red-600 pl-4">
          <h3 className="font-black text-2xl uppercase italic">Latest Headlines</h3>
        </div>
        <button onClick={handleFetchExternalNews} disabled={isFetchingNews} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-red-600 transition">
          <RefreshCw className={`w-4 h-4 ${isFetchingNews ? 'animate-spin' : ''}`} />
          {isFetchingNews ? '更新中...' : '獲取最新新聞'}
        </button>
      </div>

      {/* ── Category Filter ── */}
      {!articlesLoading && articles.length > 0 && (() => {
        const cats = ['all', ...Array.from(new Set(articles.map(a => a.category).filter(Boolean)))];
        return (
          <div className="flex flex-wrap gap-2">
            {cats.map(cat => (
              <button
                key={cat}
                onClick={() => setNewsCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black border transition ${
                  newsCategory === cat
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>
        );
      })()}

      {articlesLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8"><div className="h-96 bg-gray-100 rounded-3xl animate-pulse" /></div>
          <div className="lg:col-span-4 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-gray-400 border border-gray-100">
          <p className="font-bold">尚無新聞資料</p>
          <p className="text-sm mt-2">請登入後台發布第一篇文章</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center text-gray-400 border border-gray-100">
          <p className="font-bold">此分類暫無文章</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ═══════ SECTION 1: Hero + Headline List + Sidebar ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Hero image + compact headline list + below-hero cards */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {/* Hero + Headline row */}
              <div className="flex flex-col sm:flex-row sm:max-h-[320px]">
                {/* Hero Card */}
                {hero && (
                  <div
                    className="sm:w-1/2 group cursor-pointer rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl overflow-hidden relative shadow-sm hover:shadow-xl transition-all duration-300"
                    onClick={() => handleSelectArticle(hero)}
                  >
                    <div className="h-40 sm:h-full overflow-hidden">
                      <img
                        src={hero.image_url || ''}
                        alt={hero.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                        style={{ objectPosition: hero.image_position || 'center' }}
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`${CATEGORY_COLORS[hero.category] ?? 'bg-gray-600'} text-white text-[10px] font-black px-2.5 py-1 rounded-full`}>
                          {hero.category}
                        </span>
                        {hero.is_hot && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                            <Flame className="w-3 h-3" /> HOT
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-white leading-snug mb-1">{hero.title}</h2>
                      {hero.published_at && (
                        <span className="text-white/60 text-xs font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeAgo(hero.published_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Compact Headline List */}
                {heroList.length > 0 && (
                  <div className="sm:w-1/2 bg-white rounded-b-3xl sm:rounded-b-none sm:rounded-r-3xl border border-gray-100 sm:border-l-0 divide-y divide-gray-50 flex flex-col justify-center overflow-y-auto">
                    {heroList.map(a => (
                      <div
                        key={a.id}
                        onClick={() => handleSelectArticle(a)}
                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-gray-50 transition group"
                      >
                        <h4 className="flex-1 text-sm font-bold leading-snug truncate group-hover:text-red-600 transition">{a.title}</h4>
                        <span className={`${CATEGORY_COLORS[a.category] ?? 'bg-gray-600'} text-white text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0`}>
                          {a.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Below Hero: extra news cards */}
              {belowHero.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {belowHero.map(a => (
                    <div
                      key={a.id}
                      onClick={() => handleSelectArticle(a)}
                      className="group cursor-pointer rounded-2xl overflow-hidden relative shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-gray-200">
                        {a.image_url ? (
                          <img src={a.image_url} alt={a.title} referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                            style={{ objectPosition: a.image_position || 'center' }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">無圖片</div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <span className={`${CATEGORY_COLORS[a.category] ?? 'bg-gray-600'} text-white text-[9px] font-black px-2 py-0.5 rounded-full`}>
                          {a.category}
                        </span>
                        <h4 className="text-base sm:text-lg font-black text-white leading-snug mt-1.5">{a.title}</h4>
                        {a.published_at && (
                          <span className="text-white/60 text-[10px] font-bold flex items-center gap-1 mt-1">
                            <Clock className="w-2.5 h-2.5" /> {timeAgo(a.published_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: Video + Trending list + Poll */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Video Player */}
              <VideoPlayer />

              {/* Trending Headlines List */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1">
                <div className="px-5 pt-4 pb-2 border-b border-gray-50">
                  <h4 className="font-black text-sm flex items-center gap-2 text-gray-700">
                    <TrendingUp className="w-4 h-4 text-red-500" /> 熱門焦點
                    <span className="text-[10px] font-bold text-gray-400 ml-auto">近 7 天</span>
                  </h4>
                </div>
                <div className="divide-y divide-gray-50">
                  {(trendingArticles.length > 0 ? trendingArticles : topRow).map((a, i) => {
                    const views = 'week_views' in a ? (a as any).week_views : 0;
                    return (
                      <div
                        key={a.id}
                        onClick={() => handleSelectArticle(a)}
                        className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition group"
                      >
                        <span className={`text-2xl font-black leading-none mt-0.5 w-6 text-center flex-shrink-0 ${i < 3 ? 'text-red-500' : 'text-gray-300'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-red-600 transition">{a.title}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`${CATEGORY_COLORS[a.category] ?? 'bg-gray-600'} text-white text-[9px] font-black px-1.5 py-0.5 rounded`}>
                              {a.category}
                            </span>
                            {views > 0 && (
                              <span className="text-orange-500 text-[10px] font-bold">{views} 次瀏覽</span>
                            )}
                            {a.published_at && (
                              <span className="text-gray-400 text-[10px]">{timeAgo(a.published_at)}</span>
                            )}
                          </div>
                        </div>
                        {a.image_url && (
                          <img
                            src={a.image_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-20 h-14 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Poll */}
              <div>
                <h4 className="font-black text-sm mb-2 flex items-center gap-2 px-1 text-gray-700">
                  <BarChart2 className="w-4 h-4 text-red-500" /> 水牛調查局
                </h4>
                {homePoll ? (
                  <PollVote
                    key={homePoll.id}
                    poll={homePoll}
                    onVoted={updated => setHomePoll(updated)}
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModal('login')}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-gray-400 text-sm font-bold">
                    目前尚無進行中的投票
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════ STORIES: NBA-style horizontal card carousel ═══════ */}
          {storyCards.length > 0 && (
            <StoriesCarousel
              cards={storyCards}
              onCardClick={(i) => setReelsViewerIndex(i)}
              categoryColors={CATEGORY_COLORS}
            />
          )}

          {/* ═══════ SECTION 2: Mixed 3-col cards ═══════ */}
          {midArticles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {midArticles.map(a => {
                const color = CATEGORY_COLORS[a.category] ?? 'bg-gray-600';
                return (
                  <div
                    key={a.id}
                    onClick={() => handleSelectArticle(a)}
                    className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col"
                  >
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={a.image_url || ''}
                        alt={a.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        style={{ objectPosition: a.image_position || 'center' }}
                      />
                      <span className={`absolute top-3 left-3 ${color} text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1`}>
                        <Tag className="w-2.5 h-2.5" /> {a.category}
                      </span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-base font-black leading-snug line-clamp-2 group-hover:text-red-600 transition mb-2">{a.title}</h3>
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 flex-1">{a.summary}</p>
                      {a.published_at && (
                        <div className="flex items-center gap-1.5 mt-3 text-gray-400 text-[10px]">
                          <Clock className="w-3 h-3" /> {timeAgo(a.published_at)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════ SECTION 3: Category Groups + Ads ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar Ads */}
            <div className="lg:col-span-5">
              {sidebarAds.length > 0 && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] text-gray-300 font-bold mb-2 text-right">廣告</p>
                  <AdBanner ads={sidebarAds} />
                </div>
              )}
            </div>

            {/* Category Group Cards */}
            <div className="lg:col-span-7 space-y-5">
              {categoryGroups.slice(0, 3).map(([cat, catArticles]) => (
                <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                    <h4 className="font-black text-sm flex items-center gap-2">
                      <span className={`${CATEGORY_COLORS[cat] ?? 'bg-gray-600'} w-2 h-5 rounded-full inline-block`} />
                      {cat}
                    </h4>
                    <button
                      onClick={() => setNewsCategory(cat)}
                      className="text-xs font-bold text-gray-400 hover:text-red-600 transition flex items-center gap-0.5"
                    >
                      更多 <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {catArticles.slice(0, 3).map(a => (
                      <div
                        key={a.id}
                        onClick={() => handleSelectArticle(a)}
                        className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition group"
                      >
                        {a.image_url && (
                          <img
                            src={a.image_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-24 h-16 rounded-xl object-cover flex-shrink-0"
                            style={{ objectPosition: a.image_position || 'center' }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-red-600 transition">{a.title}</h5>
                          {a.published_at && (
                            <span className="text-[10px] text-gray-400 mt-1 inline-block">{timeAgo(a.published_at)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════ SECTION 4: Remaining articles - compact list ═══════ */}
          {restArticles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 border-l-8 border-gray-800 pl-4 mb-5">
                <h3 className="font-black text-lg uppercase italic flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-red-500" /> 更多新聞
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {restArticles.map(a => (
                  <div
                    key={a.id}
                    onClick={() => handleSelectArticle(a)}
                    className="group cursor-pointer flex gap-4 bg-white rounded-2xl p-4 border border-gray-100 hover:shadow-md transition-all"
                  >
                    {a.image_url && (
                      <img
                        src={a.image_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-28 h-20 rounded-xl object-cover flex-shrink-0"
                        style={{ objectPosition: a.image_position || 'center' }}
                      />
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <h4 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-red-600 transition">{a.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`${CATEGORY_COLORS[a.category] ?? 'bg-gray-600'} text-white text-[9px] font-black px-1.5 py-0.5 rounded`}>
                          {a.category}
                        </span>
                        {a.published_at && (
                          <span className="text-gray-400 text-[10px]">{timeAgo(a.published_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Reels Viewer overlay */}
      {reelsViewerIndex !== null && storyCards.length > 0 && (
        <ReelsViewer
          cards={storyCards}
          initialIndex={reelsViewerIndex}
          onClose={() => setReelsViewerIndex(null)}
        />
      )}
    </main>
  );
}
