import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { teamLogos } from '../data/staticData';

interface Player {
  acnt: string;
  uniform_no: string | null;
  name: string;
  position: string | null;
  bats: string | null;
  throws: string | null;
  height: string | null;
  weight: string | null;
  birth_date: string | null;
}

const POSITION_ORDER = ['投手', '捕手', '內野手', '外野手', '指定打擊', '其他'];

export default function CPBLRosterModal({
  team,
  onClose,
}: {
  team: { code: string; name: string; color: string };
  onClose: () => void;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/cpbl/players?teamCode=${team.code}`)
      .then(r => r.json())
      .then(d => setPlayers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [team.code]);

  const grouped: Record<string, Player[]> = {};
  for (const p of players) {
    const pos = p.position ?? '其他';
    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push(p);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {teamLogos[team.name] ? (
              <img
                src={teamLogos[team.name]}
                alt={team.name}
                className="w-9 h-9 object-contain shrink-0"
              />
            ) : (
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0"
                style={{ backgroundColor: team.color }}
              >
                {team.name.slice(0, 1)}
              </span>
            )}
            <div>
              <h2 className="font-black text-gray-900">{team.name}</h2>
              <p className="text-xs text-gray-400">{players.length} 名球員</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[2rem_1fr_3rem_3rem] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
          <span className="text-center">#</span>
          <span>姓名</span>
          <span className="text-center">打</span>
          <span className="text-center">投</span>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <p className="text-center py-8 text-gray-400">載入中...</p>
          ) : players.length === 0 ? (
            <p className="text-center py-8 text-gray-400">
              尚無名冊資料，請先至管理後台執行爬蟲
            </p>
          ) : (
            <div className="space-y-4">
              {POSITION_ORDER.map(pos => {
                const list = grouped[pos];
                if (!list?.length) return null;
                return (
                  <div key={pos}>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pb-1 border-b border-gray-100">
                      {pos}
                    </h3>
                    <div className="space-y-0.5">
                      {list.map(p => (
                        <div
                          key={`${p.uniform_no}-${p.name}`}
                          className="grid grid-cols-[2rem_1fr_3rem_3rem] gap-2 items-center py-1.5 px-1 rounded-lg hover:bg-gray-50"
                        >
                          <span className="text-right font-black text-gray-400 text-xs tabular-nums">
                            {p.uniform_no ?? '–'}
                          </span>
                          <span className="font-bold text-sm text-gray-800">{p.name}</span>
                          <span className="text-xs text-gray-500 text-center">
                            {p.bats ?? '–'}
                          </span>
                          <span className="text-xs text-gray-500 text-center">
                            {p.throws ?? '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
