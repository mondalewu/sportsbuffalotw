import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CPBLGameDetail from '../components/CPBLGameDetail';
import { API_BASE } from '../api/client';

interface CPBLGame {
  id: number;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  game_detail: string | null;
  venue: string | null;
  game_date: string;
}

export default function CpblGamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<CPBLGame | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/v1/games/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setGame)
      .catch(() => setError(true));
  }, [id]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-black text-gray-400 mb-4">找不到比賽資料</p>
        <button onClick={() => navigate(-1)} className="text-red-600 font-bold hover:underline">← 返回</button>
      </div>
    </div>
  );

  if (!game) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-gray-400 font-bold">載入中...</div>
    </div>
  );

  return (
    <CPBLGameDetail
      game={game}
      onClose={() => navigate(-1)}
      standalone={true}
    />
  );
}
