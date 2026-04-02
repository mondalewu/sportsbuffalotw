import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import NPBSchedule from '../components/NPBSchedule';
import AdBanner from '../components/AdBanner';
import { getArticles, getArticleBySlug } from '../api/articles';
import { getAds } from '../api/ads';
import {
  getFarmStandings, getFarmRecentGames, getNpbOneStandings, getNpbPreseasonStandings, getNpbRecentGames,
  type FarmStandings, type FarmGame, type NpbOneStandings, type PreseasonStandings,
} from '../api/npb';
import type { Article, AdPlacement } from '../types';

export default function NPBPage() {
  const { setSelectedArticle, currentUser } = useApp();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const [npbNews, setNpbNews] = useState<Article[]>([]);
  const [farmStandings, setFarmStandings] = useState<FarmStandings | null>(null);
  const [oneStandings, setOneStandings] = useState<NpbOneStandings | null>(null);
  const [preseasonStandings, setPreseasonStandings] = useState<PreseasonStandings | null>(null);
  const [farmGames, setFarmGames] = useState<FarmGame[]>([]);
  const [oneGames, setOneGames] = useState<FarmGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [headerAds, setHeaderAds] = useState<AdPlacement[]>([]);

  // Tab state
  const [standingsTab, setStandingsTab] = useState<'preseason' | 'regular'>('preseason');
  const [gamesTab, setGamesTab] = useState<'one' | 'farm'>('one');

  // Collapsible days
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    getArticles({ category: 'NPB', limit: 3 }).then(setNpbNews).catch(() => {});
    getAds('npb_header').then(setHeaderAds).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getFarmStandings().then(setFarmStandings).catch(() => {}),
      getNpbOneStandings().then(setOneStandings).catch(() => {}),
      getNpbPreseasonStandings().then(setPreseasonStandings).catch(() => {}),
      getFarmRecentGames().then(setFarmGames).catch(() => {}),
      getNpbRecentGames().then(d => setOneGames(d as FarmGame[])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSelectArticle = async (article: Article) => {
    try {
      const full = await getArticleBySlug(article.slug);
      setSelectedArticle(full);
    } catch {
      setSelectedArticle(article);
    }
    navigate('/article');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const statusLabel = (g: FarmGame) => {
    if (g.status === 'final') return { text: '終了', cls: 'text-gray-400' };
    if (g.status === 'live')  return { text: g.game_detail ?? '進行中', cls: 'text-green-600 font-bold animate-pulse' };
    return { text: '預定', cls: 'text-blue-500' };
  };

  const toJST = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000);

  const formatTime = (iso: string) => {
    const d = toJST(iso);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };

  const dayKey = (iso: string) => {
    const d = toJST(iso);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  const toggleDay = (key: string) =>
    setCollapsedDays(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  // Group games by day
  const groupByDay = (games: FarmGame[]) => {
    const map = new Map<string, FarmGame[]>();
    for (const g of games) {
      const k = dayKey(g.game_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  };

  // Deduplicate farm teams
  const TEAM_NAME_MAP: Record<string, string> = {
    'ハヤテベンチャーズ静岡': 'くふうハヤテ',
    'くふうハヤテベンチャーズ静岡': 'くふうハヤテ',
    'オイシックス新潟アルビレックスBC': 'オイシックス',
    'オイシックス新潟': 'オイシックス',
  };
  type StandingRow = { team_name: string; games: number; wins: number; losses: number; draws: number; win_rate: number; games_behind: number | null };
  const normRow = (r: StandingRow) => ({ ...r, team_name: TEAM_NAME_MAP[r.team_name] ?? r.team_name });
  const deduplicateRows = (rows: StandingRow[]) => {
    const map = new Map<string, StandingRow>();
    for (const r of rows.map(normRow)) {
      const ex = map.get(r.team_name);
      if (!ex || r.games > ex.games) map.set(r.team_name, r);
    }
    return [...map.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  };

  // ── Sub-components ────────────────────────────────────────────────────────

  const NPB_LOGO_BASE = 'https://p.npb.jp/img/common/logo/2026';
  const NAME_TO_CODE: Record<string, string> = {
    '巨人': 'g', 'DeNA': 'db', '阪神': 't', '広島': 'c',
    '中日': 'd', 'ヤクルト': 's', 'ソフトバンク': 'h', '日本ハム': 'f',
    'オリックス': 'b', '楽天': 'e', '西武': 'l', 'ロッテ': 'm',
  };

  const StandingTable = ({ title, rows, showRank = false }: {
    title: string;
    rows: { team_name?: string; team?: string; wins: number | string; losses: number | string; draws: number | string; win_rate?: number; games_behind?: number | null; games?: number; rank?: number }[];
    showRank?: boolean;
  }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-blue-900 text-white">
        <h3 className="font-black text-sm">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs">
            {showRank && <th className="px-2 py-2 text-center font-bold">位</th>}
            <th className="px-3 py-2 text-left font-bold">球隊</th>
            <th className="px-2 py-2 text-center font-bold">勝</th>
            <th className="px-2 py-2 text-center font-bold">敗</th>
            <th className="px-2 py-2 text-center font-bold">分</th>
            {rows[0]?.win_rate !== undefined && <th className="px-2 py-2 text-center font-bold">勝率</th>}
            {rows[0]?.games_behind !== undefined && <th className="px-2 py-2 text-center font-bold">差</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400 text-xs">資料更新中...</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.team_name ?? r.team ?? i} className={`border-t border-gray-100 ${i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
              {showRank && <td className="px-2 py-2 text-center text-gray-500 text-xs font-bold">{i + 1}</td>}
              <td className="px-3 py-2 font-bold text-gray-800">{r.team_name ?? r.team}</td>
              <td className="px-2 py-2 text-center text-gray-800 font-bold">{r.wins}</td>
              <td className="px-2 py-2 text-center text-gray-600">{r.losses}</td>
              <td className="px-2 py-2 text-center text-gray-500">{r.draws}</td>
              {r.win_rate !== undefined && (
                <td className="px-2 py-2 text-center font-mono text-gray-700">
                  {Number(r.win_rate).toFixed(3)}
                </td>
              )}
              {r.games_behind !== undefined && (
                <td className="px-2 py-2 text-center text-gray-500">
                  {r.games_behind === null ? '-' : r.games_behind}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const PreseasonTable = ({ title, rows }: { title: string; rows: import('../api/npb').PreseasonTeam[] }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-blue-900 text-white">
        <h3 className="font-black text-sm">{title} 熱身賽</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
              <th className="px-2 py-2 text-center font-bold w-8">順位</th>
              <th className="px-3 py-2 text-left font-bold">球隊</th>
              <th className="px-2 py-2 text-center font-bold">試合</th>
              <th className="px-2 py-2 text-center font-bold">勝利</th>
              <th className="px-2 py-2 text-center font-bold">敗戦</th>
              <th className="px-2 py-2 text-center font-bold">引分</th>
              <th className="px-2 py-2 text-center font-bold">勝率</th>
              <th className="px-2 py-2 text-center font-bold">勝差</th>
              <th className="px-2 py-2 text-center font-bold">得点</th>
              <th className="px-2 py-2 text-center font-bold">失点</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-4 text-center text-gray-400 text-xs">資料更新中...</td></tr>
            ) : rows.map((r, i) => {
              const code = NAME_TO_CODE[r.team];
              return (
                <tr key={r.team} className={`border-t border-gray-100 ${i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-2 py-2 text-center text-gray-500 text-xs font-bold">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {code && (
                        <img src={`${NPB_LOGO_BASE}/logo_${code}_m.gif`} alt={r.team}
                          className="w-6 h-6 object-contain flex-shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <span className="font-bold text-gray-800">{r.team}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{r.games}</td>
                  <td className="px-2 py-2 text-center text-gray-800 font-bold">{r.wins}</td>
                  <td className="px-2 py-2 text-center text-gray-600">{r.losses}</td>
                  <td className="px-2 py-2 text-center text-gray-500">{r.draws}</td>
                  <td className="px-2 py-2 text-center font-mono text-gray-700">
                    {r.win_rate != null ? Number(r.win_rate).toFixed(3) : '-'}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-500">
                    {r.games_behind == null ? '-' : r.games_behind % 1 === 0 ? r.games_behind : r.games_behind.toFixed(1)}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-700">{r.runs_scored ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-gray-500">{r.runs_allowed ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const GamesList = ({ games }: { games: FarmGame[] }) => {
    const grouped = groupByDay(games);
    if (grouped.length === 0)
      return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 font-bold">本週暫無賽事資料</div>;

    return (
      <div className="space-y-2">
        {grouped.map(([dk, dayGames]) => {
          const collapsed = collapsedDays.has(dk);
          const d = new Date(dk + 'T00:00:00');
          const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
          const liveCount = dayGames.filter(g => g.status === 'live').length;
          return (
            <div key={dk} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Day header - clickable to collapse */}
              <button
                onClick={() => toggleDay(dk)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-gray-800">{`${d.getMonth() + 1}/${d.getDate()} (${weekday})`}</span>
                  {liveCount > 0 && <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">● LIVE</span>}
                  <span className="text-xs text-gray-400">{dayGames.length} 場</span>
                </div>
                {collapsed
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronUp className="w-4 h-4 text-gray-400" />}
              </button>

              {/* Games rows */}
              {!collapsed && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-[10px] border-b border-gray-100">
                      <th className="px-4 py-1.5 text-left font-bold">時間</th>
                      <th className="px-4 py-1.5 text-left font-bold">對戰</th>
                      <th className="px-4 py-1.5 text-center font-bold">比分</th>
                      <th className="px-4 py-1.5 text-center font-bold">狀態</th>
                      <th className="px-4 py-1.5 text-left font-bold hidden sm:table-cell">球場</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayGames.map(g => {
                      const { text, cls } = statusLabel(g);
                      return (
                        <tr key={g.id} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{formatTime(g.game_date)}</td>
                          <td className="px-4 py-2.5 font-bold text-gray-800 text-xs">
                            {g.team_away} <span className="text-gray-300 font-normal mx-1">@</span> {g.team_home}
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono font-black text-gray-800 text-sm">
                            {g.score_away !== null
                              ? `${g.score_away} - ${g.score_home}`
                              : <span className="text-gray-300 font-normal text-xs">vs</span>}
                          </td>
                          <td className={`px-4 py-2.5 text-center text-xs ${cls}`}>{text}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs hidden sm:table-cell">{g.venue ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>
      <div className="flex items-start justify-between gap-6 mb-8">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-tight">
          2026 NPB <span className="text-red-600">日本職棒</span>
        </h1>
        {/* 半版廣告 */}
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
              <button
                onClick={() => navigate('/admin?tab=ad')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-bold transition"
              >
                <Settings className="w-3 h-3" /> 編輯廣告
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 最新消息 */}
      {npbNews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-red-600 pl-3">最新消息</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <button
              onClick={() => handleSelectArticle(npbNews[0])}
              className="md:col-span-3 text-left flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group"
            >
              {npbNews[0].image_url ? (
                <img src={npbNews[0].image_url} alt={npbNews[0].title}
                  className="w-44 sm:w-56 h-40 object-cover flex-shrink-0 group-hover:scale-105 transition duration-500"
                  referrerPolicy="no-referrer"
                  onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(npbNews[0].title)}/400/300`; }}
                />
              ) : (
                <div className="w-44 sm:w-56 h-40 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 flex-shrink-0">
                  <span className="text-4xl">⚾</span>
                </div>
              )}
              <div className="flex flex-col justify-center py-3 pr-4 min-w-0">
                <span className="text-[10px] font-black text-red-600 mb-1.5">NPB 最新消息</span>
                <p className="font-black text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug">{npbNews[0].title}</p>
                <p className="text-[10px] text-gray-400 mt-2">{new Date(npbNews[0].published_at).toLocaleDateString('zh-TW')}</p>
              </div>
            </button>
            <div className="md:col-span-2 flex flex-col gap-3">
              {npbNews.slice(1, 3).map(a => (
                <button key={a.id} onClick={() => handleSelectArticle(a)}
                  className="flex-1 text-left flex gap-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-200 transition group p-2"
                >
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.title}
                      className="w-20 h-16 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition duration-500"
                      referrerPolicy="no-referrer"
                      onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(a.title)}/400/300`; }}
                    />
                  ) : (
                    <div className="w-20 h-16 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 rounded-lg flex-shrink-0">
                      <span className="text-2xl">⚾</span>
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

      {/* 比分速報 */}
      <div className="mb-12 bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <NPBSchedule />
      </div>

      {/* ─── 一軍順位表 ─────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-800 border-l-4 border-blue-900 pl-3">NPB 一軍順位表</h2>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setStandingsTab('preseason')}
              className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${standingsTab === 'preseason' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              熱身賽
            </button>
            <button onClick={() => setStandingsTab('regular')}
              className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${standingsTab === 'regular' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              例行賽
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8 font-bold">載入中...</div>
        ) : standingsTab === 'preseason' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PreseasonTable title="中央聯盟" rows={preseasonStandings?.central ?? []} />
            <PreseasonTable title="太平洋聯盟" rows={preseasonStandings?.pacific ?? []} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StandingTable title="中央聯盟" rows={oneStandings?.central ?? []} showRank />
            <StandingTable title="太平洋聯盟" rows={oneStandings?.pacific ?? []} showRank />
          </div>
        )}
      </div>

      {/* ─── 二軍分區順位表 ──────────────────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xl font-black text-gray-800 mb-4 border-l-4 border-blue-900 pl-3">2026 NPB 二軍分區順位表</h2>
        {loading ? (
          <div className="text-center text-gray-400 py-8 font-bold">載入中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StandingTable title="東地区" rows={deduplicateRows(farmStandings?.east ?? [])} />
            <StandingTable title="中地区" rows={deduplicateRows(farmStandings?.central ?? [])} />
            <StandingTable title="西地区" rows={deduplicateRows(farmStandings?.west ?? [])} />
          </div>
        )}
      </div>

      {/* ─── 近期賽事（一軍 / 二軍 Tab）──────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-800 border-l-4 border-red-600 pl-3">本週賽事</h2>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setGamesTab('one')}
              className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${gamesTab === 'one' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              一軍
            </button>
            <button onClick={() => setGamesTab('farm')}
              className={`px-4 py-1.5 rounded-lg text-sm font-black transition ${gamesTab === 'farm' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              二軍
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center text-gray-400 py-8 font-bold">載入中...</div>
        ) : (
          <GamesList games={gamesTab === 'one' ? oneGames : farmGames} />
        )}
      </div>
    </main>
  );
}
