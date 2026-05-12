import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getNpbRoster, NpbPlayer, NpbTeam } from '../api/npb';

const POSITION_ORDER = ['投手', '捕手', '内野手', '外野手'];

interface Props {
  team: NpbTeam;
  onClose: () => void;
}

export default function NpbRosterModal({ team, onClose }: Props) {
  const [players, setPlayers] = useState<NpbPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPos, setFilterPos] = useState<string>('全部');

  useEffect(() => {
    getNpbRoster(team.code)
      .then(data => { setPlayers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [team.code]);

  const positions = ['全部', ...POSITION_ORDER.filter(p => players.some(pl => pl.position?.includes(p.replace('手', ''))))];

  const filtered = filterPos === '全部'
    ? players
    : players.filter(p => p.position?.includes(filterPos.replace('全部', '')));

  const grouped: Record<string, NpbPlayer[]> = {};
  if (filterPos === '全部') {
    for (const pos of POSITION_ORDER) {
      const group = players.filter(p => p.position?.includes(pos.replace('手', '')) || p.position === pos);
      if (group.length > 0) grouped[pos] = group;
    }
    const others = players.filter(p => !POSITION_ORDER.some(pos => p.position?.includes(pos.replace('手', ''))));
    if (others.length > 0) grouped['その他'] = others;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img
              src={team.logo_url}
              alt={team.name}
              className="w-10 h-10 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <h2 className="font-black text-lg">{team.name_full}</h2>
              <p className="text-xs text-gray-500">{
                team.npb_league === 'Central' ? 'セントラル・リーグ（中央聯盟）' :
                team.npb_league === 'Pacific' ? 'パシフィック・リーグ（太平洋聯盟）' :
                '二軍独立球団'
              }</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Position filter */}
        {!loading && players.length > 0 && (
          <div className="flex gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto">
            {POSITION_ORDER.concat(['全部']).reverse().map(pos => (
              <button
                key={pos}
                onClick={() => setFilterPos(pos)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  filterPos === pos
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        )}

        {/* Player list */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-bold">名冊載入中...</span>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="font-bold">尚無名冊資料</p>
              <p className="text-sm mt-1">請至管理後台觸發「NPB 名冊爬蟲」</p>
            </div>
          ) : filterPos === '全部' ? (
            Object.entries(grouped).map(([pos, group]) => (
              <div key={pos} className="mb-5">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 px-1">{pos}</h3>
                <PlayerTable players={group} />
              </div>
            ))
          ) : (
            <PlayerTable players={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerTable({ players }: { players: NpbPlayer[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-1.5 px-2 text-xs font-black text-gray-400 w-10">#</th>
          <th className="text-left py-1.5 px-2 text-xs font-black text-gray-400">選手名</th>
          <th className="py-1.5 px-2 text-xs font-black text-gray-400 text-center">投打</th>
          <th className="py-1.5 px-2 text-xs font-black text-gray-400 text-right">身長</th>
          <th className="py-1.5 px-2 text-xs font-black text-gray-400 text-right">体重</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => (
          <tr key={p.id ?? i} className="border-b border-gray-50 hover:bg-gray-50 transition">
            <td className="py-2 px-2 text-xs text-gray-400 font-mono">{p.number}</td>
            <td className="py-2 px-2">
              <div className="font-bold text-gray-800">{p.name_jp}</div>
              {p.name_kana && <div className="text-[10px] text-gray-400">{p.name_kana}</div>}
            </td>
            <td className="py-2 px-2 text-center text-xs text-gray-600">
              {p.throwing && p.batting ? `${p.throwing}投${p.batting}打` : p.throwing || p.batting || '–'}
            </td>
            <td className="py-2 px-2 text-right text-xs text-gray-600">{p.height ? `${p.height}cm` : '–'}</td>
            <td className="py-2 px-2 text-right text-xs text-gray-600">{p.weight ? `${p.weight}kg` : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
