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
  { rank: 1, team: '新竹街口攻城獅',   abbr: 'Lioneers',  w: 28, l: 8,  pct: .778, color: 'bg-yellow-400' },
  { rank: 2, team: '台北富邦勇士',     abbr: 'Braves',    w: 25, l: 11, pct: .694, color: 'bg-gray-300' },
  { rank: 3, team: '高雄鋼鐵人',       abbr: 'Steelers',  w: 22, l: 14, pct: .611, color: 'bg-amber-600' },
  { rank: 4, team: '台南台鋼獵鷹',     abbr: 'Falcons',   w: 20, l: 16, pct: .556, color: 'bg-gray-200' },
  { rank: 5, team: '福爾摩沙夢想家',   abbr: 'Dreamers',  w: 18, l: 18, pct: .500, color: 'bg-gray-200' },
  { rank: 6, team: '桃園璞園領航猿',   abbr: 'Pilots',    w: 15, l: 21, pct: .417, color: 'bg-gray-200' },
];

const TOP_SCORERS = [
  { name: '林書豪', team: '桃園璞園領航猿', ppg: 22.4, flag: '🇹🇼' },
  { name: '查爾斯',  team: '新竹街口攻城獅', ppg: 21.8, flag: '🇺🇸' },
  { name: '戴維斯', team: '台北富邦勇士',   ppg: 20.5, flag: '🇺🇸' },
  { name: '賈布里',  team: '高雄鋼鐵人',     ppg: 19.2, flag: '🇺🇸' },
  { name: '簡浩',   team: '台南台鋼獵鷹',   ppg: 17.8, flag: '🇹🇼' },
];

type Tab = 'standings' | 'scorers';

export default function PLeaguePage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]           = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);
  const [tab, setTab]             = useState<Tab>('standings');

  useEffect(() => {
    getArticles({ category: '籃球', limit: 3 }).then(setNews).catch(() => {});
    getAds('pleague_header').then(setHeaderAds).catch(() => {});
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
        <title>P.LEAGUE+ 台灣職籃 - 水牛體育</title>
      </Helmet>

      <button onClick={() => navigate('/')} className="mb-6 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>

      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          P.LEAGUE+ <span className="text-red-600">台灣職籃</span>
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
                <span className="text-[10px] font-black text-red-600 mb-1.5">P.LEAGUE+ 最新消息</span>
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
          {([['standings', '積分榜'], ['scorers', '得分榜']] as [Tab, string][]).map(([k, label]) => (
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
                  <tr key={r.abbr} className={`hover:bg-gray-50 transition ${r.rank <= 4 ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ${r.color} ${r.rank <= 3 ? 'text-white' : 'text-gray-400'}`}>
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

        {tab === 'scorers' && (
          <div className="divide-y divide-gray-50">
            {TOP_SCORERS.map((p, i) => (
              <div key={p.name} className="flex items-center gap-4 px-2 py-3">
                <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                <span className="text-base shrink-0">{p.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.team}</p>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-2xl font-black text-red-600">{p.ppg}</span>
                  <span className="text-xs text-gray-400 font-bold">分/場</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">* 資料為模擬數據，實際積分請參考 P.LEAGUE+ 官方網站</p>
      </div>
    </main>
  );
}
