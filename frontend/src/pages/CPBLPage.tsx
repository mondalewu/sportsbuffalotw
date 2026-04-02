import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import CPBLSchedule from '../components/CPBLSchedule';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import type { Article, AdPlacement } from '../types';

export default function CPBLPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const [cpblNews, setCpblNews] = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  useEffect(() => {
    getArticles({ category: 'CPBL', limit: 3 }).then(setCpblNews).catch(() => { });
    getAds('cpbl_header').then(setHeaderAds).catch(() => {});
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

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
          <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
            <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
          </button>

          <div className="flex items-start justify-between gap-6 mb-8">
            <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
              2026 CPBL <span className="text-red-600">中華職棒</span>
            </h1>
            {/* 半版廣告 */}
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
          {cpblNews.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">最新消息</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* 大卡：左側 */}
                <button
                  onClick={() => handleSelectArticle(cpblNews[0])}
                  className="md:col-span-3 text-left flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group"
                >
                  {cpblNews[0].image_url ? (
                    <img src={cpblNews[0].image_url} alt={cpblNews[0].title}
                      className="w-44 sm:w-56 h-40 object-cover flex-shrink-0 group-hover:scale-105 transition duration-500"
                      referrerPolicy="no-referrer"
                      onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(cpblNews[0].title)}/400/300`; }}
                    />
                  ) : (
                    <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 flex-shrink-0">
                      <span className="text-4xl">⚾</span>
                    </div>
                  )}
                  <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                    <span className="text-[10px] font-black text-red-600 mb-1.5">CPBL 最新消息</span>
                    <p className="font-black text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug">{cpblNews[0].title}</p>
                    <p className="text-[10px] text-gray-400 mt-2">{new Date(cpblNews[0].published_at).toLocaleDateString('zh-TW')}</p>
                  </div>
                </button>

                {/* 小卡：右側垂直堆疊 */}
                <div className="md:col-span-2 flex flex-col gap-3">
                  {cpblNews.slice(1, 3).map(a => (
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

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
            <CPBLSchedule />
          </div>

    </main>
  );
}

