import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import type { Article, AdPlacement } from '../types';

const STANDINGS = [
  { rank: 1, team: '璞園建築台北',   w: 22, l: 6,  pct: .786 },
  { rank: 2, team: '中信特攻',       w: 19, l: 9,  pct: .679 },
  { rank: 3, team: '達欣工程',       w: 17, l: 11, pct: .607 },
  { rank: 4, team: '台灣啤酒英熊',   w: 16, l: 12, pct: .571 },
  { rank: 5, team: '國泰Dreamers',   w: 13, l: 15, pct: .464 },
  { rank: 6, team: '彰化銀行',       w: 8,  l: 20, pct: .286 },
];

const TPBL_INFO = [
  { label: '聯賽全名', value: '台灣籃球超級聯賽（TPBL）' },
  { label: '主辦單位', value: '中華民國籃球協會（CTBA）' },
  { label: '參賽隊伍', value: '6支球隊' },
  { label: '賽制', value: '單循環賽 + 季後賽' },
  { label: '2025–26賽季', value: '2025年10月 — 2026年4月' },
  { label: '冠軍獎項', value: 'TPBL 總冠軍盃' },
];

type Tab = 'standings' | 'info';

export default function TPBLPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]           = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);
  const [tab, setTab]             = useState<Tab>('standings');

  useEffect(() => {
    getArticles({ category: '籃球', limit: 3 }).then(setNews).catch(() => {});
    getAds('tpbl_header').then(setHeaderAds).catch(() => {});
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
        <title>TPBL 台灣籃球超級聯賽 - 水牛體育</title>
      </Helmet>

      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          2025–26 TPBL <span className="text-red-600">超級聯賽</span>
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
                <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 flex-shrink-0">
                  <span className="text-4xl">🏀</span>
                </div>
              )}
              <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                <span className="text-[10px] font-black text-red-600 mb-1.5">TPBL 最新消息</span>
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
                    <div className="w-20 h-16 flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg flex-shrink-0">
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

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {([['standings', '積分榜'], ['info', '聯賽資訊']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 -mb-px ${tab === k ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'standings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-black text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 w-8">#</th>
                  <th className="text-left px-2 py-2">球隊</th>
                  <th className="px-3 py-2 text-center">勝</th>
                  <th className="px-3 py-2 text-center">敗</th>
                  <th className="px-3 py-2 text-center">勝率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {STANDINGS.map(r => (
                  <tr key={r.team} className={`hover:bg-gray-50 transition ${r.rank <= 4 ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center
                        ${r.rank === 1 ? 'bg-yellow-400 text-white' : r.rank === 2 ? 'bg-gray-300 text-white' : r.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                        {r.rank}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-bold text-gray-800 text-xs">{r.team}</td>
                    <td className="px-3 py-3 text-center text-xs font-bold text-gray-700">{r.w}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500">{r.l}</td>
                    <td className="px-3 py-3 text-center text-xs font-black text-red-600">{r.pct.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 px-2 py-2 bg-orange-50 border border-orange-100 rounded-xl">
              <span className="text-[10px] text-orange-600 font-bold">🏆 前4名晉級季後賽</span>
            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TPBL_INFO.map(info => (
              <div key={info.label} className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 mb-1">{info.label}</p>
                <p className="text-sm font-bold text-gray-800">{info.value}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">* 資料為模擬數據，實際積分請參考中華民國籃球協會官方網站</p>
      </div>
    </main>
  );
}
