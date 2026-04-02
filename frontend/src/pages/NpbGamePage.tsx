/**
 * NpbGamePage — /npb/game/:id
 * 取得比賽資料後，以 NpbGameDetail standalone 模式顯示（同 modal 版面，但為獨立頁）
 * NPB2 (farm) 比賽使用 FarmGameDetail
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NpbGameDetail from '../components/NpbGameDetail';
import FarmGameDetail from '../components/FarmGameDetail';

// team name → code mapping (inverse of NpbGameDetail's CODE_TO_NAME)
const NAME_TO_CODE: Record<string, string> = {
  '巨人': 'g', 'DeNA': 'db', '横浜DeNA': 'db', '阪神': 't', '広島': 'c',
  '中日': 'd', 'ヤクルト': 's', 'ソフトバンク': 'h', '日本ハム': 'f',
  'オリックス': 'b', '楽天': 'e', '西武': 'l', 'ロッテ': 'm',
};

interface Game {
  id: number;
  league: string;
  team_home: string;
  team_away: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  game_detail: string | null;
  venue: string | null;
  game_date: string;
}

export default function NpbGamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/games/${id}`)
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

  // NPB2 (farm) games use FarmGameDetail
  if (game.league === 'NPB2') {
    return (
      <FarmGameDetail
        game={game}
        onClose={() => navigate(-1)}
        standalone={true}
      />
    );
  }

  const awayCode = NAME_TO_CODE[game.team_away] ?? 'g';
  const homeCode = NAME_TO_CODE[game.team_home] ?? 'g';

  return (
    <NpbGameDetail
      game={game}
      awayCode={awayCode}
      homeCode={homeCode}
      onClose={() => navigate(-1)}
      standalone={true}
    />
  );
}
