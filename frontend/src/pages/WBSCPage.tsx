import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getGames } from '../api/games';
import { teamLogos } from '../data/staticData';
import type { Game } from '../types';

export default function WBSCPage() {
  const navigate = useNavigate();
  const [wbcGames, setWbcGames] = useState<Game[]>([]);
  const [currentPool, setCurrentPool] = useState('C');

  useEffect(() => {
    getGames({ league: 'WBC' }).then(setWbcGames).catch(() => {});
  }, []);

  const wbcByPool: Record<string, Game[]> = { A: [], B: [], C: [], D: [] };
  wbcGames.forEach(g => {
    if (g.venue?.includes('聖胡安')) wbcByPool['A'].push(g);
    else if (g.venue?.includes('休士頓')) wbcByPool['B'].push(g);
    else if (g.venue?.includes('東京')) wbcByPool['C'].push(g);
    else if (g.venue?.includes('邁阿密')) wbcByPool['D'].push(g);
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">2026 WBC<br /><span className="text-red-600">Global Schedule</span></h1>
        <span className="bg-blue-900 text-white px-4 py-2 rounded-lg font-black text-xs uppercase">March 5 - March 10, 2026</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {[
          { id: 'A', color: 'blue-600', location: 'San Juan, PR', teams: '波多黎各 / 古巴 / 加拿大...' },
          { id: 'B', color: 'red-600', location: 'Houston, USA', teams: '美國 / 墨西哥 / 義大利...' },
          { id: 'C', color: 'blue-900', location: 'Tokyo, JPN', teams: '日本 / 中華台北 / 南韓...' },
          { id: 'D', color: 'green-600', location: 'Miami, USA', teams: '委內瑞拉 / 多明尼加 / 荷蘭...' }
        ].map(pool => (
          <button key={pool.id} onClick={() => setCurrentPool(pool.id)}
            className={`text-left p-6 rounded-3xl shadow-sm border-2 transition-all ${currentPool === pool.id ? 'pool-btn-active border-transparent' : 'bg-white border-transparent hover:border-gray-200'}`}>
            <div className={`font-black text-lg mb-1 italic ${currentPool === pool.id ? 'text-white' : `text-${pool.color}`}`}>Pool {pool.id}</div>
            <div className={`text-[10px] font-bold mb-3 uppercase ${currentPool === pool.id ? 'text-blue-200' : 'text-gray-400'}`}>{pool.location}</div>
            <div className={`text-xs font-black ${currentPool === pool.id ? 'text-white' : 'text-gray-700'}`}>{pool.teams}</div>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {(wbcByPool[currentPool] || []).length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center text-gray-400 border border-gray-100">
            <p className="font-bold">尚無此組別賽程資料</p>
          </div>
        ) : (
          (wbcByPool[currentPool] || []).map((game, idx) => (
            <div key={game.id ?? idx} className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center hover:shadow-md transition-all ${game.team_home === '中華台北' || game.team_away === '中華台北' ? 'border-l-8 border-l-red-600' : ''}`}>
              <div className="md:w-32 text-center md:border-r border-gray-100 mb-4 md:mb-0">
                <div className="text-2xl font-black">{new Date(game.game_date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}</div>
                <div className="text-[10px] text-red-600 font-black mt-1">{new Date(game.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="flex-1 flex items-center justify-around px-8 w-full">
                <div className="text-center w-24 flex flex-col items-center">
                  <img src={teamLogos[game.team_home]} alt={game.team_home} className="w-12 h-12 object-cover rounded-full mb-2 shadow-sm border border-gray-200 bg-white" />
                  <span className="font-black text-xs">{game.team_home}</span>
                  {game.status !== 'scheduled' && <span className="font-black text-xl mt-1">{game.score_home}</span>}
                </div>
                <div className="text-2xl font-black italic text-gray-200 mx-4">VS</div>
                <div className="text-center w-24 flex flex-col items-center">
                  <img src={teamLogos[game.team_away]} alt={game.team_away} className="w-12 h-12 object-cover rounded-full mb-2 shadow-sm border border-gray-200 bg-white" />
                  <span className="font-black text-xs">{game.team_away}</span>
                  {game.status !== 'scheduled' && <span className="font-black text-xl mt-1">{game.score_away}</span>}
                </div>
              </div>
              <div className="text-[10px] font-black text-gray-400 md:ml-4 whitespace-nowrap mt-4 md:mt-0 uppercase tracking-widest">{game.venue}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
