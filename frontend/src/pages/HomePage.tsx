import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import PollVote from '../components/PollVote';
import LiveStories from '../components/LiveStories';
import VideoPlayer from '../components/VideoPlayer';
import { getArticles, getArticleBySlug, fetchExternalNews } from '../api/articles';
import { getAds } from '../api/ads';
import { getPolls } from '../api/polls';
import type { Poll } from '../api/polls';
import type { Article, AdPlacement } from '../types';

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

  const loadArticles = () => {
    setArticlesLoading(true);
    getArticles({ limit: 10 }).then(data => {
      setArticles(data);
      setArticlesLoading(false);
    }).catch(() => setArticlesLoading(false));
  };

  useEffect(() => {
    loadArticles();
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
    navigate('/article');
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

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <LiveStories />


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between border-l-8 border-red-600 pl-4">
            <h3 className="font-black text-2xl uppercase italic">Latest Headlines</h3>
            <button onClick={handleFetchExternalNews} disabled={isFetchingNews} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-600 transition">
              <RefreshCw className={`w-4 h-4 ${isFetchingNews ? 'animate-spin' : ''}`} />
              {isFetchingNews ? '更新中...' : '獲取最新新聞'}
            </button>
          </div>

          {/* 新聞分類篩選 */}
          {!articlesLoading && articles.length > 0 && (() => {
            const cats = ['all', ...Array.from(new Set(articles.map(a => a.category).filter(Boolean)))];
            return (
              <div className="flex flex-wrap gap-2">
                {cats.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewsCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-black border transition ${
                      newsCategory === cat
                        ? 'bg-red-600 text-white border-red-600'
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
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />)}
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
            <>
              <div className="group cursor-pointer bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 transition-all hover:shadow-xl" onClick={() => handleSelectArticle(filteredArticles[0])}>
                <div className="h-80 overflow-hidden relative">
                  <img src={filteredArticles[0].image_url || 'https://picsum.photos/seed/sports/800/400'} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="Headline" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded mb-3 inline-block">{filteredArticles[0].category}</span>
                    <h2 className="text-3xl font-black text-white leading-tight">{filteredArticles[0].title}</h2>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-500 text-sm leading-relaxed">{filteredArticles[0].summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredArticles.slice(1).map(news => (
                  <div key={news.id} className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all hover:shadow-md flex flex-col" onClick={() => handleSelectArticle(news)}>
                    <div className="h-48 overflow-hidden relative">
                      <img src={news.image_url || 'https://picsum.photos/seed/sports/400/300'} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={news.title} referrerPolicy="no-referrer" />
                      <div className="absolute top-3 left-3">
                        <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded">{news.category}</span>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-black leading-tight mb-2 group-hover:text-red-600 transition">{news.title}</h3>
                      <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-4 flex-1">{news.summary}</p>
                      <div className="text-gray-400 text-[10px] font-bold">{news.published_at?.split('T')[0]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          {/* 影片播放區 */}
          <VideoPlayer />

          <div>
            <h3 className="font-black text-lg mb-3 flex items-center italic px-1">
              <BarChart2 className="text-red-600 mr-2 w-5 h-5" /> 水牛調查局
            </h3>
            {homePoll ? (
              <PollVote
                key={homePoll.id}
                poll={homePoll}
                onVoted={updated => setHomePoll(updated)}
                currentUser={currentUser}
                onRequireAuth={() => setAuthModal('login')}
              />
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center text-gray-400 text-sm font-bold">
                目前尚無進行中的投票
              </div>
            )}
          </div>

          {sidebarAds.length > 0 && (
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-[10px] text-gray-300 font-bold mb-2 text-right">廣告</p>
              <AdBanner ads={sidebarAds} />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
