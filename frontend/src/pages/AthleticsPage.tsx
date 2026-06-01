/**
 * AthleticsPage — 田徑賽事頁
 * 新北國際田徑公開賽 2026（World Athletics Continental Tour）
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getArticles } from '../api/articles';
import { useApp } from '../context/AppContext';
import type { Article } from '../types';

const EVENT_NAME = '新北國際田徑公開賽';
const EVENT_SUBTITLE = 'NEW TAIPEI CITY ATHLETICS OPEN 2026';
const EVENT_DATE = '2026年6月6日（六）—6月7日（日）';
const EVENT_VENUE = '板橋體育場';
const EVENT_VENUE_EN = 'New Taipei City, Banqiao Stadium';
const EVENT_ORGANIZER = '新北市體育處 × 中華民國田徑協會';

// 賽程項目
const SCHEDULE = [
  {
    day: '第一天｜6月6日（六）',
    events: [
      { time: '09:00', name: '男子 100 公尺 — 預賽', tag: '短跑' },
      { time: '09:30', name: '女子 100 公尺 — 預賽', tag: '短跑' },
      { time: '10:00', name: '男子 110 公尺跨欄 — 預賽', tag: '跨欄' },
      { time: '10:30', name: '女子 100 公尺跨欄 — 預賽', tag: '跨欄' },
      { time: '11:00', name: '男子 鉛球 — 資格賽', tag: '投擲' },
      { time: '11:30', name: '女子 鉛球 — 資格賽', tag: '投擲' },
      { time: '14:00', name: '男子 400 公尺 — 預賽', tag: '短跑' },
      { time: '14:30', name: '女子 400 公尺 — 預賽', tag: '短跑' },
      { time: '15:00', name: '男子 跳高 — 資格賽', tag: '跳躍' },
      { time: '15:30', name: '女子 跳高 — 資格賽', tag: '跳躍' },
      { time: '16:00', name: '男子 1500 公尺 — 決賽', tag: '中距離' },
      { time: '16:30', name: '女子 1500 公尺 — 決賽', tag: '中距離' },
    ],
  },
  {
    day: '第二天｜6月7日（日）',
    events: [
      { time: '09:00', name: '男子 100 公尺 — 決賽', tag: '短跑' },
      { time: '09:20', name: '女子 100 公尺 — 決賽', tag: '短跑' },
      { time: '09:50', name: '男子 110 公尺跨欄 — 決賽', tag: '跨欄' },
      { time: '10:10', name: '女子 100 公尺跨欄 — 決賽', tag: '跨欄' },
      { time: '10:40', name: '男子 鉛球 — 決賽', tag: '投擲' },
      { time: '11:00', name: '女子 鉛球 — 決賽', tag: '投擲' },
      { time: '11:30', name: '男子 跳高 — 決賽', tag: '跳躍' },
      { time: '14:00', name: '男子 400 公尺 — 決賽', tag: '短跑' },
      { time: '14:20', name: '女子 400 公尺 — 決賽', tag: '短跑' },
      { time: '14:50', name: '女子 跳高 — 決賽', tag: '跳躍' },
      { time: '15:30', name: '男子 4×100 公尺接力 — 決賽', tag: '接力' },
      { time: '15:50', name: '女子 4×100 公尺接力 — 決賽', tag: '接力' },
      { time: '16:20', name: '混合 4×400 公尺接力 — 決賽', tag: '接力' },
    ],
  },
];

// 注目選手
const ATHLETES = [
  { name: '楊俊瀚', country: '🇹🇼 台灣', event: '男子 100 / 200 公尺', pb: '10.03', note: '台灣百米紀錄保持人' },
  { name: '吳悅軒', country: '🇹🇼 台灣', event: '女子 跳高', pb: '1.89m', note: '亞洲錦標賽銅牌' },
  { name: '陳傑', country: '🇹🇼 台灣', event: '男子 400 公尺跨欄', pb: '48.96', note: '東京奧運代表' },
  { name: '許雅晴', country: '🇹🇼 台灣', event: '女子 100 公尺跨欄', pb: '12.99', note: '亞運代表隊成員' },
];

const TAG_COLORS: Record<string, string> = {
  短跑: 'bg-red-100 text-red-700',
  跨欄: 'bg-orange-100 text-orange-700',
  投擲: 'bg-blue-100 text-blue-700',
  跳躍: 'bg-green-100 text-green-700',
  中距離: 'bg-purple-100 text-purple-700',
  接力: 'bg-yellow-100 text-yellow-700',
};

export default function AthleticsPage() {
  const [activeDay, setActiveDay] = useState(0);
  const [news, setNews] = useState<Article[]>([]);
  const { setSelectedArticle } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    getArticles({ limit: 6 }).then(data => {
      const filtered = data.filter(a => a.category === '田徑' || a.category === 'athletics');
      setNews(filtered.length > 0 ? filtered : data.slice(0, 4));
    }).catch(() => {});
  }, []);

  const handleArticleClick = (article: Article) => {
    setSelectedArticle(article);
    navigate(`/article/${article.slug}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Hero Banner — 以官方海報圖為背景 */}
      <div className="relative rounded-2xl overflow-hidden mb-8 text-white" style={{ minHeight: 260 }}>
        {/* 背景：官方海報圖（若不存在則 fallback 漸層） */}
        <img
          src="/athletics-2026.jpg.jpg"
          alt="新北國際田徑公開賽 2026 官方海報"
          className="absolute inset-0 w-full h-full object-cover object-center"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {/* 漸層遮罩（確保文字可讀）*/}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />

        <div className="relative z-10 p-8 flex flex-col justify-end" style={{ minHeight: 260 }}>
          {/* World Athletics Continental Tour 標章 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block bg-yellow-400 text-black text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-widest uppercase">
              World Athletics Continental Tour 2026
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-0.5">{EVENT_NAME}</h1>
          <p className="text-gray-200 text-sm font-bold tracking-wider mb-4">{EVENT_SUBTITLE}</p>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span className="font-bold">{EVENT_DATE}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📍</span>
              <span className="font-bold">{EVENT_VENUE}</span>
              <span className="text-gray-300 text-xs hidden sm:inline">/ {EVENT_VENUE_EN}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🏛</span>
              <span className="text-gray-200 text-xs">{EVENT_ORGANIZER}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 相關新聞 */}
      {news.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-red-600 rounded-full inline-block" />
            相關新聞
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {news.map(article => (
              <div
                key={article.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition group"
                onClick={() => handleArticleClick(article)}
              >
                <div className="h-36 overflow-hidden">
                  <img
                    src={article.image_url || 'https://picsum.photos/seed/athletics/400/300'}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-3">
                  {article.category && (
                    <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full mb-1 inline-block">{article.category}</span>
                  )}
                  <h3 className="text-sm font-black text-gray-800 leading-tight line-clamp-2 group-hover:text-red-600 transition">{article.title}</h3>
                  <p className="text-[11px] text-gray-400 mt-1">{article.published_at?.split('T')[0]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">

        {/* 賽程表 */}
        <div className="md:col-span-2">
          <h2 className="text-lg font-black text-gray-800 mb-3">賽程表</h2>

          {/* Day Tab */}
          <div className="flex gap-2 mb-4">
            {SCHEDULE.map((s, i) => (
              <button key={i} onClick={() => setActiveDay(i)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeDay === i ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Day {i + 1}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
              <span className="font-black text-sm text-gray-700">{SCHEDULE[activeDay].day}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {SCHEDULE[activeDay].events.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                  <span className="text-xs font-black text-gray-400 w-12 flex-shrink-0">{ev.time}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TAG_COLORS[ev.tag] ?? 'bg-gray-100 text-gray-600'}`}>{ev.tag}</span>
                  <span className="text-sm font-bold text-gray-800">{ev.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 側欄：注目選手 */}
        <div>
          <h2 className="text-lg font-black text-gray-800 mb-3">注目選手</h2>
          <div className="flex flex-col gap-3">
            {ATHLETES.map((a, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-black text-gray-900">{a.name}</span>
                  <span className="text-xs text-gray-400">{a.country}</span>
                </div>
                <span className="text-xs text-gray-500 block mb-1">{a.event}</span>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">個人最佳</span>
                  <span className="text-sm font-black text-red-600">{a.pb}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{a.note}</p>
              </div>
            ))}
          </div>

          {/* 賽事資訊 */}
          <div className="mt-4 bg-red-50 rounded-2xl p-4">
            <h3 className="font-black text-sm text-red-800 mb-2">賽事資訊</h3>
            <ul className="text-xs text-red-700 space-y-1">
              <li>🎟 入場：免費開放</li>
              <li>🚇 交通：板橋車站步行可達</li>
              <li>🏟 場地：板橋體育場</li>
              <li>🌐 主辦：新北市體育處 × 中華民國田徑協會</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
