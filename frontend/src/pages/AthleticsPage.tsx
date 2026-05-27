/**
 * AthleticsPage — 田徑賽事頁
 * 首頁：2026 新北國際田徑公開賽
 */
import { useState } from 'react';

const EVENT_NAME = '2026 新北國際田徑公開賽';
const EVENT_SUBTITLE = '2026 New Taipei International Athletics Open';
const EVENT_DATE = '2026年7月5日（六）—7月6日（日）';
const EVENT_VENUE = '新北市立田徑場';
const EVENT_ORGANIZER = '中華民國田徑協會 × 新北市政府';

// 賽程項目
const SCHEDULE = [
  {
    day: '第一天｜7月5日（六）',
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
    day: '第二天｜7月6日（日）',
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Hero Banner */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 rounded-2xl overflow-hidden mb-8 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          {/* 跑道裝飾線 */}
          {[0,1,2,3,4,5,6,7].map(i => (
            <div key={i} className="absolute border-white border-t" style={{ top: `${12.5 * i}%`, left: 0, right: 0, opacity: 0.5 }} />
          ))}
        </div>
        <div className="relative z-10">
          <span className="inline-block bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full mb-3 tracking-widest uppercase">Athletics</span>
          <h1 className="text-3xl md:text-4xl font-black mb-1">{EVENT_NAME}</h1>
          <p className="text-gray-300 text-sm mb-4">{EVENT_SUBTITLE}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-red-400">📅</span>
              <span className="font-bold">{EVENT_DATE}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">📍</span>
              <span className="font-bold">{EVENT_VENUE}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">🏛</span>
              <span className="text-gray-300">{EVENT_ORGANIZER}</span>
            </div>
          </div>
        </div>
      </div>

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
              <li>🚇 交通：捷運新莊線</li>
              <li>🏟 場地：新北市立田徑場</li>
              <li>📺 轉播：華視體育</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
