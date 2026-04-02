import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { teamLogos, playersData } from '../data/staticData';

export default function PlayersPage() {
  const navigate = useNavigate();
  const [currentTeam, setCurrentTeam] = useState<keyof typeof playersData>('中華隊');

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>
      <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight mb-8">2026 WBC<br /><span className="text-red-600">Player Rosters</span></h1>

      <div className="flex flex-wrap gap-4 mb-10">
        {(['中華隊', '日本武士隊', '南韓', '澳洲', '捷克'] as const).map(team => (
          <button key={team} onClick={() => setCurrentTeam(team)}
            className={`px-6 py-3 rounded-2xl font-black text-md transition-all shadow-sm border-2 ${currentTeam === team ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-600 border-transparent hover:border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <img src={teamLogos[team === '中華隊' ? '中華台北' : team]} className="w-6 h-6 rounded-full object-cover" alt={team} />
              {team}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-10">
        {(['投手', '捕手', '內野手', '外野手'] as const).map(position => (
          <div key={position} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-black italic text-gray-800">{position}</h2>
              <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">
                {playersData[currentTeam]?.[position]?.length ?? 0} 人
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {(playersData[currentTeam]?.[position] ?? []).map((player, idx) => (
                <div key={idx} className="p-4 rounded-2xl flex flex-col items-center text-center hover:-translate-y-1 hover:shadow-lg transition-all bg-white border border-gray-200 shadow-sm">
                  <div className="text-xl font-black mb-1 text-gray-800">{player.name}</div>
                  <div className="text-xs font-bold text-gray-500">{player.team || '自由球員'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
