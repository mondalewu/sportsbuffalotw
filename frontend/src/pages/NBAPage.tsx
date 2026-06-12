import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import type { Article, AdPlacement } from '../types';

const CONFERENCES = [
  {
    conf: '東區',
    divisions: [
      {
        name: '大西洋組',
        teams: [
          { rank: 1, team: '波士頓塞爾提克', abbr: 'BOS', w: 61, l: 21 },
          { rank: 2, team: '紐約尼克',       abbr: 'NYK', w: 51, l: 31 },
          { rank: 3, team: '費城76人',       abbr: 'PHI', w: 34, l: 48 },
          { rank: 4, team: '布魯克林籃網',   abbr: 'BKN', w: 26, l: 56 },
          { rank: 5, team: '多倫多暖龍',     abbr: 'TOR', w: 25, l: 57 },
        ],
      },
      {
        name: '中央組',
        teams: [
          { rank: 1, team: '克里夫蘭騎士',   abbr: 'CLE', w: 64, l: 18 },
          { rank: 2, team: '密爾瓦基公鹿',   abbr: 'MIL', w: 49, l: 33 },
          { rank: 3, team: '印第安那溜馬',   abbr: 'IND', w: 48, l: 34 },
          { rank: 4, team: '芝加哥公牛',     abbr: 'CHI', w: 39, l: 43 },
          { rank: 5, team: '底特律活塞',     abbr: 'DET', w: 28, l: 54 },
        ],
      },
      {
        name: '東南組',
        teams: [
          { rank: 1, team: '邁阿密熱火',     abbr: 'MIA', w: 46, l: 36 },
          { rank: 2, team: '奧蘭多魔術',     abbr: 'ORL', w: 44, l: 38 },
          { rank: 3, team: '亞特蘭大老鷹',   abbr: 'ATL', w: 37, l: 45 },
          { rank: 4, team: '夏洛特黃蜂',     abbr: 'CHA', w: 24, l: 58 },
          { rank: 5, team: '華盛頓巫師',     abbr: 'WAS', w: 18, l: 64 },
        ],
      },
    ],
  },
  {
    conf: '西區',
    divisions: [
      {
        name: '西北組',
        teams: [
          { rank: 1, team: '奧克拉荷馬雷霆', abbr: 'OKC', w: 68, l: 14 },
          { rank: 2, team: '明尼蘇達灰狼',   abbr: 'MIN', w: 56, l: 26 },
          { rank: 3, team: '丹佛金塊',       abbr: 'DEN', w: 53, l: 29 },
          { rank: 4, team: '猶他爵士',       abbr: 'UTA', w: 22, l: 60 },
          { rank: 5, team: '波特蘭拓荒者',   abbr: 'POR', w: 19, l: 63 },
        ],
      },
      {
        name: '太平洋組',
        teams: [
          { rank: 1, team: '洛杉磯湖人',     abbr: 'LAL', w: 50, l: 32 },
          { rank: 2, team: '金州勇士',       abbr: 'GSW', w: 48, l: 34 },
          { rank: 3, team: '洛杉磯快艇',     abbr: 'LAC', w: 43, l: 39 },
          { rank: 4, team: '菲尼克斯太陽',   abbr: 'PHX', w: 39, l: 43 },
          { rank: 5, team: '沙加緬度國王',   abbr: 'SAC', w: 38, l: 44 },
        ],
      },
      {
        name: '西南組',
        teams: [
          { rank: 1, team: '聖安東尼奧馬刺', abbr: 'SAS', w: 58, l: 24 },
          { rank: 2, team: '達拉斯獨行俠',   abbr: 'DAL', w: 49, l: 33 },
          { rank: 3, team: '曼菲斯灰熊',     abbr: 'MEM', w: 41, l: 41 },
          { rank: 4, team: '休士頓火箭',     abbr: 'HOU', w: 52, l: 30 },
          { rank: 5, team: '紐奧良鵜鶘',     abbr: 'NOP', w: 23, l: 59 },
        ],
      },
    ],
  },
];

type Tab = 'east' | 'west';

export default function NBAPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const [news, setNews]           = useState<Article[]>([]);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);
  const [tab, setTab]             = useState<Tab>('east');

  useEffect(() => {
    getArticles({ category: 'NBA', limit: 3 }).then(setNews).catch(() => {});
    getAds('nba_header').then(setHeaderAds).catch(() => {});
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

  const confData = tab === 'east' ? CONFERENCES[0] : CONFERENCES[1];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Helmet>
        <title>NBA - 水牛體育</title>
      </Helmet>

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

      {/* Standings */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {([['east', '東區'], ['west', '西區']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-3 px-4 text-sm font-bold transition border-b-2 -mb-px ${tab === k ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {confData.divisions.map(div => (
            <div key={div.name}>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{div.name}</p>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
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
                    {div.teams.map(r => (
                      <tr key={r.abbr} className={`hover:bg-gray-50 transition ${r.rank === 1 ? 'bg-orange-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center
                            ${r.rank === 1 ? 'bg-yellow-400 text-white' : r.rank === 2 ? 'bg-gray-300 text-white' : r.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                            {r.rank}
                          </span>
                        </td>
                        <td className="px-2 py-3 font-bold text-gray-800 text-xs">{r.team}</td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-gray-700">{r.w}</td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">{r.l}</td>
                        <td className="px-3 py-3 text-center text-xs font-black text-red-600">
                          {(r.w / (r.w + r.l)).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">* 資料為模擬數據，實際積分請參考 NBA 官方網站</p>
      </div>
    </main>
  );
}
