import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import type { Article, AdPlacement } from '../types';

const MLB_TEAMS = [
  { div: 'AL East',   teams: ['紐約洋基', '波士頓紅襪', '多倫多藍鳥', '坦帕灣光芒', '巴爾的摩金鶯'] },
  { div: 'AL Central',teams: ['克里夫蘭守護者', '明尼蘇達雙城', '底特律老虎', '芝加哥白襪', '堪薩斯皇家'] },
  { div: 'AL West',   teams: ['休士頓太空人', '洛杉磯天使', '西雅圖水手', '奧克蘭運動家', '德州遊騎兵'] },
  { div: 'NL East',   teams: ['亞特蘭大勇士', '紐約大都會', '費城費城人', '邁阿密馬林魚', '華盛頓國民'] },
  { div: 'NL Central',teams: ['密爾瓦基釀酒人', '芝加哥小熊', '辛辛那提紅人', '聖路易紅雀', '匹茲堡海盜'] },
  { div: 'NL West',   teams: ['洛杉磯道奇', '舊金山巨人', '聖地牙哥教士', '亞利桑那響尾蛇', '科羅拉多洛磯'] },
];

const TW_MLB_PLAYERS = [
  { name: '陳偉殷', team: '前水手/馬林魚（已退役）' },
  { name: '林子偉', team: '前紅襪/勇士' },
  { name: '王建民', team: '前洋基（已退役）' },
];

export default function MLBPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const [mlbNews, setMlbNews] = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  useEffect(() => {
    getArticles({ category: 'MLB', limit: 3 }).then(setMlbNews).catch(() => {});
    getAds('mlb_header').then(setHeaderAds).catch(() => {});
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

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          2026 MLB <span className="text-red-600">美國職棒</span>
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
      {mlbNews.length > 0 && (
        <div className="mb-8">
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
                    <div className="w-20 h-16 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex-shrink-0">
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

      {/* 台灣旅美選手 */}
      <div className="mb-8">
        <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">旅美台灣選手</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TW_MLB_PLAYERS.map(p => (
            <div key={p.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <span className="text-2xl">🇹🇼</span>
              <div>
                <p className="font-black text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.team}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 分區球隊 */}
      <div>
        <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">30 支球隊</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MLB_TEAMS.map(({ div, teams }) => (
            <div key={div} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{div}</p>
              <ul className="space-y-1.5">
                {teams.map(t => (
                  <li key={t} className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
