import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import type { Article, AdPlacement } from '../types';

const TPSL_STANDINGS = [
  { rank: 1, team: '台電足球隊',   badge: '⚡', played: 12, won: 9, drawn: 2, lost: 1, gf: 28, ga: 10, pts: 29 },
  { rank: 2, team: '台灣鋼鐵',     badge: '🔩', played: 12, won: 8, drawn: 2, lost: 2, gf: 24, ga: 12, pts: 26 },
  { rank: 3, team: '陸光足球隊',   badge: '🪖', played: 12, won: 7, drawn: 3, lost: 2, gf: 22, ga: 11, pts: 24 },
  { rank: 4, team: '航源FC',       badge: '✈️', played: 12, won: 6, drawn: 3, lost: 3, gf: 20, ga: 14, pts: 21 },
  { rank: 5, team: '勝利FC',       badge: '🏆', played: 12, won: 5, drawn: 3, lost: 4, gf: 18, ga: 16, pts: 18 },
  { rank: 6, team: '台北市立大學', badge: '🎓', played: 12, won: 4, drawn: 3, lost: 5, gf: 15, ga: 18, pts: 15 },
  { rank: 7, team: '玉山金控',     badge: '🏔️', played: 12, won: 3, drawn: 2, lost: 7, gf: 12, ga: 22, pts: 11 },
  { rank: 8, team: '中華電信FC',   badge: '📡', played: 12, won: 2, drawn: 2, lost: 8, gf: 10, ga: 28, pts: 8  },
];

const TPSL_INFO = [
  { label: '聯賽全名', value: '台灣企業甲級足球聯賽（TPSL）' },
  { label: '主辦單位', value: '中華民國足球協會（CTFA）' },
  { label: '參賽隊伍', value: '8支球隊' },
  { label: '賽制', value: '主客場雙循環制，共 14 輪' },
  { label: '2026賽季', value: '2026年3月 — 11月' },
  { label: '冠軍晉升', value: '亞足聯冠軍盃資格賽' },
];

type Tab = 'standings' | 'info';

export default function TPSLPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]           = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);
  const [tab, setTab]             = useState<Tab>('standings');

  useEffect(() => {
    getArticles({ category: '足球', limit: 3 }).then(setNews).catch(() => {});
    getAds('tpsl_header').then(setHeaderAds).catch(() => {});
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
      <Helmet>
        <title>台灣企業甲級聯賽 TPSL - 水牛體育</title>
      </Helmet>

      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          2026 TPSL <span className="text-red-600">企業甲聯賽</span>
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
                <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 flex-shrink-0">
                  <span className="text-4xl">⚽</span>
                </div>
              )}
              <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                <span className="text-[10px] font-black text-red-600 mb-1.5">TPSL 最新消息</span>
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
                    <div className="w-20 h-16 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex-shrink-0">
                      <span className="text-2xl">⚽</span>
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

      {/* Content Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {([['standings', '積分榜'], ['info', '聯賽資訊']] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 -mb-px ${
                tab === k ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 積分榜 */}
        {tab === 'standings' && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-black text-gray-400 border-b border-gray-100">
                    <th className="text-left px-4 py-2 w-8">#</th>
                    <th className="text-left px-2 py-2">球隊</th>
                    <th className="px-2 py-2 text-center">場</th>
                    <th className="px-2 py-2 text-center">勝</th>
                    <th className="px-2 py-2 text-center">平</th>
                    <th className="px-2 py-2 text-center">負</th>
                    <th className="px-2 py-2 text-center">進</th>
                    <th className="px-2 py-2 text-center">失</th>
                    <th className="px-2 py-2 text-center font-black text-gray-700">積分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {TPSL_STANDINGS.map(r => (
                    <tr key={r.rank} className={`hover:bg-gray-50 transition ${r.rank <= 2 ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center
                          ${r.rank === 1 ? 'bg-yellow-400 text-white' : r.rank === 2 ? 'bg-gray-300 text-white' : r.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span>{r.badge}</span>
                          <span className="font-bold text-gray-800 text-xs">{r.team}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.played}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-700">{r.won}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.drawn}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.lost}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.gf}</td>
                      <td className="px-2 py-3 text-center text-xs text-gray-500">{r.ga}</td>
                      <td className="px-2 py-3 text-center font-black text-red-600">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 px-2 py-2 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-[10px] text-blue-600 font-bold">🏆 前2名晉升亞足聯冠軍盃資格賽</span>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">* 資料為模擬數據，實際積分請參考中華民國足球協會官方網站</p>
          </div>
        )}

        {/* 聯賽資訊 */}
        {tab === 'info' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TPSL_INFO.map(info => (
              <div key={info.label} className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 mb-1">{info.label}</p>
                <p className="text-sm font-bold text-gray-800">{info.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
