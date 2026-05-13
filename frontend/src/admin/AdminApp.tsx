import React, { useState, useEffect } from 'react';
import { getMe, login, logout } from '../api/auth';
import { getArticles, createArticle, updateArticle, deleteArticle } from '../api/articles';
import { getGames, createGame, updateGame, deleteGame, addPlayByPlay, deletePlayByPlay } from '../api/games';
import { getAllPolls, createPoll, updatePoll, deletePoll, addPollOption, deletePollOption, getAdminAnalytics } from '../api/polls';
import { getScraperStatus, triggerScraper } from '../api/scraper';
import type { Article, Game, User } from '../types';
import type { Poll, AdminAnalytics } from '../api/polls';
import type { ScraperStatus } from '../api/scraper';
import { API_BASE } from '../api/client';

type AdminTab = 'article' | 'game' | 'pbp' | 'scraper' | 'poll' | 'analytics' | 'stories';

// ── Stories 型別 ──────────────────────────────────────────
interface StoryClipForm {
  id?: number;
  background_image_url: string;
  score: string;
  situation: string;
  key_play: string;
  ai_insight: string;
  duration_ms: number;
  clip_order: number;
}

interface StoryForm {
  id?: number;
  home_team: string;
  away_team: string;
  home_abbr: string;
  away_abbr: string;
  home_color: string;
  away_color: string;
  league: string;
  is_live: boolean;
  is_active: boolean;
  sort_order: number;
  clips: StoryClipForm[];
}

const BLANK_CLIP: StoryClipForm = {
  background_image_url: '', score: '', situation: '', key_play: '',
  ai_insight: '', duration_ms: 6000, clip_order: 0,
};

const BLANK_STORY: StoryForm = {
  home_team: '', away_team: '', home_abbr: '', away_abbr: '',
  home_color: '#CC0000', away_color: '#002D72',
  league: 'CPBL', is_live: true, is_active: true, sort_order: 0,
  clips: [{ ...BLANK_CLIP }],
};

const CPBL_TEAMS = ['中信兄弟', '統一獅', '富邦悍將', '樂天桃猿', '台鋼雄鷹', '味全龍'];
const CPBL_VENUES = ['大巨蛋', '天母棒球場', '洲際棒球場', '新莊棒球場', '桃園棒球場', '亞太棒球場', '澄清湖棒球場', '斗六棒球場'];

// ── 登入頁面 ──────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const user = await login({ email: form.email, password: form.password });
      onLogin(user);
    } catch {
      setErr('帳號或密碼錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-lg p-10 w-full max-w-sm">
        <div className="flex items-baseline font-black italic text-2xl mb-8">
          <span>SPORTS</span><span className="text-red-600 ml-1">BUFFALO</span>
          <span className="text-gray-400 ml-2 text-sm not-italic font-normal">後台</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required placeholder="管理員 Email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
          <input type="password" required placeholder="密碼" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
          {err && <p className="text-red-500 text-sm font-bold">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition disabled:opacity-50">
            {loading ? '登入中...' : '登入後台'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-red-600 transition">← 返回網站</a>
        </div>
      </div>
    </div>
  );
}

// ── 主後台 ────────────────────────────────────────────────
export default function AdminApp() {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<AdminTab>('scraper');
  const [msg, setMsg] = useState('');

  // 文章
  const [articles, setArticles] = useState<Article[]>([]);
  const [newArticle, setNewArticle] = useState({ title: '', category: 'CPBL', imageUrl: '', summary: '', content: '' });
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  // 比賽
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gameUpdate, setGameUpdate] = useState({ score_home: '', score_away: '', status: '', game_detail: '' });
  const [newGame, setNewGame] = useState({
    league: 'CPBL', team_home: '', team_away: '', venue: '', game_date: '', status: 'scheduled', score_home: '', score_away: '', game_detail: '',
  });
  const [showNewGameForm, setShowNewGameForm] = useState(false);

  // 文本速報
  const [pbpForm, setPbpForm] = useState({ inning: 1, is_top: true, batter_name: '', pitcher_name: '', situation: '', result_text: '', score_home: 0, score_away: 0 });

  // 爬蟲
  const [scraperSt, setScraperSt] = useState<ScraperStatus | null>(null);
  const [scraperLoading, setScraperLoading] = useState(false);

  // 投票
  const [polls, setPolls] = useState<Poll[]>([]);
  const [newPollForm, setNewPollForm] = useState({ question: '', category: 'general', ends_at: '', options: ['', ''] });
  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [newOptionText, setNewOptionText] = useState('');

  // 數據
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Stories
  const [stories, setStories] = useState<StoryForm[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [editingStory, setEditingStory] = useState<StoryForm | null>(null);
  const [showStoryForm, setShowStoryForm] = useState(false);

  useEffect(() => {
    getMe().then(u => setCurrentUser(u)).catch(() => setCurrentUser(null));
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const loadGames = () => {
    setGamesLoading(true);
    getGames({ league: 'CPBL' }).then(data => {
      setGames(data.slice(0, 80));
      setGamesLoading(false);
    }).catch(() => setGamesLoading(false));
  };

  const loadScraperStatus = () => {
    getScraperStatus().then(data => setScraperSt(data.cpbl ?? null)).catch(() => {});
  };

  useEffect(() => {
    if (!currentUser) return;
    if (tab === 'article') getArticles({ limit: 30 }).then(setArticles).catch(() => {});
    if (tab === 'game' || tab === 'pbp') loadGames();
    if (tab === 'scraper') loadScraperStatus();
    if (tab === 'poll') getAllPolls().then(setPolls).catch(() => {});
    if (tab === 'analytics') {
      setAnalyticsLoading(true);
      getAdminAnalytics().then(setAnalytics).finally(() => setAnalyticsLoading(false));
    }
    if (tab === 'stories') loadStories();
  }, [tab, currentUser]);

  const loadStories = () => {
    setStoriesLoading(true);
    fetch(`${API_BASE}/api/v1/stories/admin`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') ?? ''}` },
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => setStories(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setStoriesLoading(false));
  };

  const saveStory = async (form: StoryForm) => {
    const token = localStorage.getItem('token') ?? '';
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    try {
      let storyId = form.id;

      // Upsert story
      if (storyId) {
        await fetch(`${API_BASE}/api/v1/stories/${storyId}`, {
          method: 'PUT', headers, credentials: 'include',
          body: JSON.stringify({
            home_team: form.home_team, away_team: form.away_team,
            home_abbr: form.home_abbr, away_abbr: form.away_abbr,
            home_color: form.home_color, away_color: form.away_color,
            league: form.league, is_live: form.is_live,
            is_active: form.is_active, sort_order: form.sort_order,
          }),
        });
      } else {
        const r = await fetch(`${API_BASE}/api/v1/stories`, {
          method: 'POST', headers, credentials: 'include',
          body: JSON.stringify({
            home_team: form.home_team, away_team: form.away_team,
            home_abbr: form.home_abbr, away_abbr: form.away_abbr,
            home_color: form.home_color, away_color: form.away_color,
            league: form.league, is_live: form.is_live,
            is_active: form.is_active, sort_order: form.sort_order,
          }),
        });
        const data = await r.json();
        storyId = data.id;
      }

      if (!storyId) throw new Error('無法取得 Story ID');

      // 刪除舊 clips，重新建立（簡單直觀）
      const existingClips = await fetch(`${API_BASE}/api/v1/stories/admin`, { headers, credentials: 'include' })
        .then(r => r.json())
        .then((arr: StoryForm[]) => arr.find(s => s.id === storyId)?.clips ?? []);

      for (const c of existingClips) {
        if (c.id) {
          await fetch(`${API_BASE}/api/v1/stories/${storyId}/clips/${c.id}`, { method: 'DELETE', headers, credentials: 'include' });
        }
      }

      for (let i = 0; i < form.clips.length; i++) {
        const c = form.clips[i];
        if (!c.background_image_url.trim()) continue;
        await fetch(`${API_BASE}/api/v1/stories/${storyId}/clips`, {
          method: 'POST', headers, credentials: 'include',
          body: JSON.stringify({ ...c, clip_order: i }),
        });
      }

      flash('✅ Story 已儲存');
      setShowStoryForm(false);
      setEditingStory(null);
      loadStories();
    } catch (err) {
      flash('❌ 儲存失敗');
    }
  };

  const deleteStory = async (id: number) => {
    if (!confirm('確定刪除此 Story？')) return;
    await fetch(`${API_BASE}/api/v1/stories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') ?? ''}` },
      credentials: 'include',
    });
    flash('✅ 已刪除');
    loadStories();
  };

  // 初始化時載入爬蟲狀態
  useEffect(() => {
    if (currentUser && (currentUser.role === 'editor' || currentUser.role === 'admin')) {
      loadScraperStatus();
    }
  }, [currentUser]);

  if (currentUser === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold">載入中...</div>;
  }

  if (currentUser === null) {
    return <LoginPage onLogin={u => setCurrentUser(u)} />;
  }

  if (currentUser.role === 'member') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-12">
          <p className="text-2xl font-black text-red-600 mb-4">權限不足</p>
          <p className="text-gray-500 mb-6">您的帳號沒有後台管理權限</p>
          <a href="/" className="text-sm font-bold text-gray-400 hover:text-red-600">← 返回網站</a>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'scraper', label: '🤖 爬蟲控制' },
    { key: 'game', label: '⚾ 比賽管理' },
    { key: 'pbp', label: '📡 文本速報' },
    { key: 'stories', label: '🎬 限時動態' },
    { key: 'article', label: '📰 文章管理' },
    { key: 'poll', label: '🗳️ 投票管理' },
    { key: 'analytics', label: '📊 數據分析' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-red-600 text-sm font-bold transition">← 網站</a>
            <span className="text-gray-200">|</span>
            <div className="font-black italic text-lg">
              <span>SPORTS</span><span className="text-red-600 ml-1">BUFFALO</span>
              <span className="text-gray-400 ml-2 text-xs not-italic font-normal">後台管理</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-bold">{currentUser.username} <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{currentUser.role}</span></span>
            <button onClick={async () => { await logout(); setCurrentUser(null); }}
              className="text-xs font-bold text-gray-400 hover:text-red-600 transition">登出</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl font-black text-sm border transition-all ${tab === t.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Flash message */}
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-xl font-bold text-sm ${msg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg}
          </div>
        )}

        {/* ── 爬蟲控制 ── */}
        {tab === 'scraper' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-2">CPBL 比分爬蟲</h2>
              <p className="text-gray-500 text-sm mb-6">自動從 CPBL 官網抓取今日賽事比分，每 2 分鐘執行一次（台灣時間 17:00–23:00）。</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: '執行狀態', value: scraperSt?.isRunning ? '🔄 執行中' : '⏸ 待機' },
                  { label: '上次執行', value: scraperSt?.lastRun ? new Date(scraperSt.lastRun).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '尚未執行' },
                  { label: '更新場次', value: `${scraperSt?.gamesUpdated ?? 0} 場` },
                  { label: '執行結果', value: scraperSt?.lastResult ?? '—' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-2xl p-4">
                    <div className="text-xs font-black text-gray-400 mb-1">{item.label}</div>
                    <div className="text-sm font-bold text-gray-800 break-all">{item.value}</div>
                  </div>
                ))}
              </div>

              {scraperSt?.lastError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-bold">
                  錯誤：{scraperSt.lastError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setScraperLoading(true);
                    try {
                      const res = await triggerScraper();
                      setScraperSt(res.status);
                      flash(res.updated > 0 ? `✅ ${res.message}` : `⚠️ ${res.message}`);
                    } catch {
                      flash('❌ 爬蟲觸發失敗');
                    } finally {
                      setScraperLoading(false);
                    }
                  }}
                  disabled={scraperLoading || scraperSt?.isRunning}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-black hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2">
                  {scraperLoading ? '🔄 執行中...' : '▶ 立即抓取比分'}
                </button>
                <button onClick={loadScraperStatus}
                  className="bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-xl font-black hover:border-gray-400 transition">
                  ↻ 重新整理狀態
                </button>
              </div>
            </div>

            {/* NPB 二軍爬蟲 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-2">NPB 二軍賽程爬蟲</h2>
              <p className="text-gray-500 text-sm mb-6">從 Yahoo Baseball 抓取前後 3 週的二軍賽程與比分，儲存為 NPB2 聯盟。</p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={async () => {
                    setScraperLoading(true);
                    try {
                      const { triggerNpbFarmScraper } = await import('../api/scraper');
                      const res = await triggerNpbFarmScraper();
                      flash(res.added > 0 ? `✅ ${res.message}` : `⚠️ ${res.message}`);
                    } catch { flash('❌ 二軍爬蟲觸發失敗'); }
                    finally { setScraperLoading(false); }
                  }}
                  disabled={scraperLoading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                  {scraperLoading ? '🔄 執行中...' : '▶ 抓取二軍賽程（前後3週）'}
                </button>
              </div>
            </div>

            {/* NPB 整季賽程 + 清除重複 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-2">NPB 賽程工具</h2>
              <p className="text-gray-500 text-sm mb-6">一軍整季賽程爬蟲（npb.jp）、清除重複比賽記錄。</p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={async () => {
                    setScraperLoading(true);
                    try {
                      const { triggerNpbScheduleScraper } = await import('../api/scraper');
                      const res = await triggerNpbScheduleScraper(2026);
                      flash(res.added > 0 ? `✅ ${res.message}` : `⚠️ ${res.message}`);
                    } catch { flash('❌ 整季賽程爬蟲失敗'); }
                    finally { setScraperLoading(false); }
                  }}
                  disabled={scraperLoading}
                  className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black hover:bg-black transition disabled:opacity-50">
                  📅 爬取 2026 整季一軍賽程
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('確定清除所有重複比賽記錄？每日同對戰組合僅保留一筆。')) return;
                    setScraperLoading(true);
                    try {
                      const { cleanupDuplicates } = await import('../api/scraper');
                      const res = await cleanupDuplicates();
                      flash(`✅ ${res.message}`);
                    } catch { flash('❌ 清除失敗'); }
                    finally { setScraperLoading(false); }
                  }}
                  disabled={scraperLoading}
                  className="bg-orange-500 text-white px-6 py-3 rounded-xl font-black hover:bg-orange-600 transition disabled:opacity-50">
                  🗑 清除重複比賽記錄
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-black mb-3">爬蟲說明</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span>策略 1：CPBL 官方排程 API（POST）</li>
                <li className="flex gap-2"><span className="text-green-500 font-bold">✓</span>策略 2：解析 CPBL 首頁即時比分 widget</li>
                <li className="flex gap-2"><span className="text-blue-500 font-bold">✓</span>NPB 二軍：Yahoo Baseball /npb/schedule/farm/all</li>
                <li className="flex gap-2"><span className="text-gray-400 font-bold">i</span>若官網改版導致爬蟲失效，可手動在「比賽管理」更新比分</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── 比賽管理 ── */}
        {tab === 'game' && (
          <div className="space-y-6">
            {/* 新增比賽 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black">新增比賽</h2>
                <button onClick={() => setShowNewGameForm(v => !v)}
                  className="text-sm font-bold text-gray-400 hover:text-red-600 transition">
                  {showNewGameForm ? '▲ 收起' : '▼ 展開'}
                </button>
              </div>
              {showNewGameForm && (
                <form onSubmit={async e => {
                  e.preventDefault();
                  try {
                    await createGame({
                      league: newGame.league,
                      team_home: newGame.team_home,
                      team_away: newGame.team_away,
                      venue: newGame.venue || undefined,
                      game_date: newGame.game_date,
                      status: newGame.status as 'scheduled' | 'live' | 'final',
                      score_home: newGame.score_home !== '' ? Number(newGame.score_home) : undefined,
                      score_away: newGame.score_away !== '' ? Number(newGame.score_away) : undefined,
                      game_detail: newGame.game_detail || undefined,
                    });
                    setNewGame({ league: 'CPBL', team_home: '', team_away: '', venue: '', game_date: '', status: 'scheduled', score_home: '', score_away: '', game_detail: '' });
                    setShowNewGameForm(false);
                    flash('✅ 比賽已新增');
                    loadGames();
                  } catch { flash('❌ 新增失敗'); }
                }} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">聯盟</label>
                      <select value={newGame.league} onChange={e => setNewGame(f => ({ ...f, league: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                        {['CPBL', 'NPB', 'WBC', 'MLB'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">客隊</label>
                      <select value={newGame.team_away} onChange={e => setNewGame(f => ({ ...f, team_away: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                        <option value="">— 選擇客隊 —</option>
                        {CPBL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">主隊</label>
                      <select value={newGame.team_home} onChange={e => setNewGame(f => ({ ...f, team_home: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                        <option value="">— 選擇主隊 —</option>
                        {CPBL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">比賽時間</label>
                      <input type="datetime-local" required value={newGame.game_date}
                        onChange={e => setNewGame(f => ({ ...f, game_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">球場</label>
                      <select value={newGame.venue} onChange={e => setNewGame(f => ({ ...f, venue: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                        <option value="">— 選擇球場 —</option>
                        {CPBL_VENUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">狀態</label>
                      <select value={newGame.status} onChange={e => setNewGame(f => ({ ...f, status: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                        <option value="scheduled">賽前</option>
                        <option value="live">進行中</option>
                        <option value="final">終場</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">客隊得分</label>
                      <input type="number" min={0} value={newGame.score_away}
                        onChange={e => setNewGame(f => ({ ...f, score_away: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">主隊得分</label>
                      <input type="number" min={0} value={newGame.score_home}
                        onChange={e => setNewGame(f => ({ ...f, score_home: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">局面說明</label>
                      <input type="text" value={newGame.game_detail} placeholder="例：7局上"
                        onChange={e => setNewGame(f => ({ ...f, game_detail: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <button type="submit" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-black hover:bg-black transition">
                    新增比賽
                  </button>
                </form>
              )}
            </div>

            {/* 比賽列表 + 編輯 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black">比賽列表</h2>
                <button onClick={loadGames} className="text-sm font-bold text-gray-400 hover:text-red-600 transition">↻ 重新整理</button>
              </div>
              {gamesLoading ? (
                <p className="text-gray-400 text-sm">載入中...</p>
              ) : (
                <div className="space-y-2">
                  <select value={selectedGameId ?? ''} onChange={e => {
                    const id = Number(e.target.value);
                    setSelectedGameId(id || null);
                    const g = games.find(g => g.id === id);
                    if (g) setGameUpdate({ score_home: g.score_home?.toString() ?? '', score_away: g.score_away?.toString() ?? '', status: g.status, game_detail: g.game_detail ?? '' });
                  }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                    <option value="">— 選擇要編輯的比賽 —</option>
                    {games.map(g => (
                      <option key={g.id} value={g.id}>
                        [{g.status === 'live' ? '🔴' : g.status === 'final' ? '✓' : '○'}]
                        {new Date(g.game_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                        {' '}{g.team_away} {g.score_away ?? '-'} : {g.score_home ?? '-'} {g.team_home}
                        {g.game_detail ? ` (${g.game_detail})` : ''}
                      </option>
                    ))}
                  </select>

                  {selectedGameId && (
                    <div className="mt-4 p-6 bg-gray-50 rounded-2xl">
                      <h3 className="font-black mb-4">更新比分 / 狀態</h3>
                      <form onSubmit={async e => {
                        e.preventDefault();
                        try {
                          await updateGame(selectedGameId, {
                            score_home: gameUpdate.score_home !== '' ? Number(gameUpdate.score_home) : undefined,
                            score_away: gameUpdate.score_away !== '' ? Number(gameUpdate.score_away) : undefined,
                            status: gameUpdate.status as 'scheduled' | 'live' | 'final' || undefined,
                            game_detail: gameUpdate.game_detail || undefined,
                          });
                          flash('✅ 比賽資料已更新');
                          loadGames();
                        } catch { flash('❌ 更新失敗'); }
                      }} className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">客隊得分</label>
                            <input type="number" min={0} value={gameUpdate.score_away}
                              onChange={e => setGameUpdate(f => ({ ...f, score_away: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">主隊得分</label>
                            <input type="number" min={0} value={gameUpdate.score_home}
                              onChange={e => setGameUpdate(f => ({ ...f, score_home: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">狀態</label>
                            <select value={gameUpdate.status} onChange={e => setGameUpdate(f => ({ ...f, status: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                              <option value="scheduled">賽前</option>
                              <option value="live">進行中</option>
                              <option value="final">終場</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">局面說明</label>
                            <input type="text" value={gameUpdate.game_detail} placeholder="例：7局上"
                              onChange={e => setGameUpdate(f => ({ ...f, game_detail: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button type="submit" className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-black hover:bg-black transition text-sm">
                            儲存更新
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={async () => {
                              if (!confirm('確定刪除此比賽？這將同時刪除所有速報記錄。')) return;
                              try {
                                await deleteGame(selectedGameId);
                                setSelectedGameId(null);
                                flash('✅ 比賽已刪除');
                                loadGames();
                              } catch { flash('❌ 刪除失敗（需要 admin 權限）'); }
                            }}
                              className="bg-red-50 text-red-500 border border-red-200 px-6 py-2.5 rounded-xl font-black hover:bg-red-100 transition text-sm">
                              刪除比賽
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 文本速報 ── */}
        {tab === 'pbp' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-4">選擇比賽</h2>
              {gamesLoading ? <p className="text-gray-400 text-sm">載入中...</p> : (
                <select value={selectedGameId ?? ''} onChange={e => setSelectedGameId(Number(e.target.value) || null)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                  <option value="">— 選擇比賽（進行中或終場）—</option>
                  {games.filter(g => g.status === 'live' || g.status === 'final').map(g => (
                    <option key={g.id} value={g.id}>
                      [{g.status === 'live' ? '🔴進行中' : '終場'}]
                      {new Date(g.game_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                      {' '}{g.team_away} {g.score_away ?? '-'} : {g.score_home ?? '-'} {g.team_home}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedGameId && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black mb-6">新增速報事件</h2>
                <form onSubmit={async e => {
                  e.preventDefault();
                  try {
                    await addPlayByPlay(selectedGameId, {
                      inning: pbpForm.inning,
                      is_top: pbpForm.is_top,
                      batter_name: pbpForm.batter_name || undefined,
                      pitcher_name: pbpForm.pitcher_name || undefined,
                      situation: pbpForm.situation || undefined,
                      result_text: pbpForm.result_text,
                      score_home: pbpForm.score_home,
                      score_away: pbpForm.score_away,
                    });
                    flash('✅ 速報事件已新增');
                    setPbpForm(f => ({ ...f, result_text: '', situation: '' }));
                  } catch { flash('❌ 新增失敗'); }
                }} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">局數</label>
                      <input type="number" min={1} max={15} value={pbpForm.inning}
                        onChange={e => setPbpForm(f => ({ ...f, inning: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">上/下半局</label>
                      <select value={pbpForm.is_top ? 'top' : 'bot'} onChange={e => setPbpForm(f => ({ ...f, is_top: e.target.value === 'top' }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400">
                        <option value="top">上半局（客隊攻）</option>
                        <option value="bot">下半局（主隊攻）</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">局面</label>
                      <input type="text" value={pbpForm.situation} placeholder="例：一死一三壘"
                        onChange={e => setPbpForm(f => ({ ...f, situation: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">打者</label>
                      <input type="text" value={pbpForm.batter_name} placeholder="打者姓名"
                        onChange={e => setPbpForm(f => ({ ...f, batter_name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">投手</label>
                      <input type="text" value={pbpForm.pitcher_name} placeholder="投手姓名"
                        onChange={e => setPbpForm(f => ({ ...f, pitcher_name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">事件描述 *</label>
                    <textarea required value={pbpForm.result_text} rows={2}
                      placeholder="例：林子傑 右外野三壘打，陳重羽 得分"
                      onChange={e => setPbpForm(f => ({ ...f, result_text: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">客隊當前得分</label>
                      <input type="number" min={0} value={pbpForm.score_away}
                        onChange={e => setPbpForm(f => ({ ...f, score_away: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">主隊當前得分</label>
                      <input type="number" min={0} value={pbpForm.score_home}
                        onChange={e => setPbpForm(f => ({ ...f, score_home: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition">
                    新增速報事件
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── 文章管理 ── */}
        {tab === 'article' && (
          <div className="space-y-6">
            {/* 新增 / 編輯表單 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black">{editingArticle ? '✏️ 編輯文章' : '發布新文章'}</h2>
                {editingArticle && (
                  <button onClick={() => setEditingArticle(null)}
                    className="text-sm font-bold text-gray-400 hover:text-red-600 transition">✕ 取消編輯</button>
                )}
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                try {
                  if (editingArticle) {
                    await updateArticle(editingArticle.id, {
                      title: newArticle.title, category: newArticle.category,
                      summary: newArticle.summary, content: newArticle.content, image_url: newArticle.imageUrl,
                    });
                    setEditingArticle(null);
                    flash('✅ 文章已更新');
                  } else {
                    await createArticle({ title: newArticle.title, category: newArticle.category, summary: newArticle.summary, content: newArticle.content, image_url: newArticle.imageUrl });
                    flash('✅ 文章已發布');
                  }
                  setNewArticle({ title: '', category: 'CPBL', imageUrl: '', summary: '', content: '' });
                  getArticles({ limit: 30 }).then(setArticles);
                } catch { flash(editingArticle ? '❌ 更新失敗' : '❌ 發布失敗'); }
              }} className="space-y-4">
                <input type="text" required placeholder="文章標題" value={newArticle.title}
                  onChange={e => setNewArticle(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newArticle.category} onChange={e => setNewArticle(f => ({ ...f, category: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                    {['CPBL', 'NPB', 'WBC', 'MLB', 'NBA', '其他'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder="封面圖 URL（選填）" value={newArticle.imageUrl}
                    onChange={e => setNewArticle(f => ({ ...f, imageUrl: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                </div>
                {newArticle.imageUrl && (
                  <img src={newArticle.imageUrl} alt="預覽" className="w-full h-40 object-cover rounded-xl" referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <textarea placeholder="文章摘要" value={newArticle.summary} rows={2}
                  onChange={e => setNewArticle(f => ({ ...f, summary: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none" />
                <textarea required placeholder="文章內文（支援 Markdown）" value={newArticle.content} rows={8}
                  onChange={e => setNewArticle(f => ({ ...f, content: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none font-mono" />
                <button type="submit" className={`w-full py-3 rounded-xl font-black transition ${editingArticle ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                  {editingArticle ? '儲存更新' : '發布文章'}
                </button>
              </form>
            </div>

            {/* 文章清單 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black">已發布文章（{articles.length}）</h2>
                <button onClick={() => getArticles({ limit: 30 }).then(setArticles)} className="text-sm font-bold text-gray-400 hover:text-red-600 transition">↻ 重新整理</button>
              </div>
              <div className="space-y-3">
                {articles.map(a => (
                  <div key={a.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                    {/* 封面縮圖 */}
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.title} className="w-16 h-16 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg shrink-0 flex items-center justify-center text-gray-400 text-xs font-bold">無圖</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-gray-200 px-2 py-0.5 rounded shrink-0">{a.category}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{a.published_at?.split('T')[0]}</span>
                      </div>
                      <p className="font-bold text-sm text-gray-800 truncate">{a.title}</p>
                      {a.summary && <p className="text-xs text-gray-400 truncate mt-0.5">{a.summary}</p>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingArticle(a);
                          setNewArticle({ title: a.title, category: a.category, imageUrl: a.image_url || '', summary: a.summary || '', content: a.content || '' });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-xs font-bold px-3 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                        ✏️ 編輯
                      </button>
                      <button onClick={async () => {
                        if (!confirm('確定刪除此文章？')) return;
                        try { await deleteArticle(a.id); flash('✅ 文章已刪除'); getArticles({ limit: 30 }).then(setArticles); if (editingArticle?.id === a.id) setEditingArticle(null); }
                        catch { flash('❌ 刪除失敗'); }
                      }} className="text-xs font-bold px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">
                        🗑 刪除
                      </button>
                    </div>
                  </div>
                ))}
                {articles.length === 0 && <p className="text-gray-400 text-sm text-center py-8">尚無文章</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── 投票管理 ── */}
        {tab === 'poll' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-6">新增投票主題</h2>
              <form onSubmit={async e => {
                e.preventDefault();
                const opts = newPollForm.options.filter(o => o.trim());
                if (opts.length < 2) { flash('❌ 至少需要兩個選項'); return; }
                try {
                  await createPoll({ question: newPollForm.question, category: newPollForm.category, ends_at: newPollForm.ends_at || undefined, options: opts });
                  setNewPollForm({ question: '', category: 'general', ends_at: '', options: ['', ''] });
                  flash('✅ 投票已建立');
                  getAllPolls().then(setPolls);
                } catch { flash('❌ 建立失敗'); }
              }} className="space-y-4">
                <input type="text" required placeholder="投票題目" value={newPollForm.question}
                  onChange={e => setNewPollForm(f => ({ ...f, question: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newPollForm.category} onChange={e => setNewPollForm(f => ({ ...f, category: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                    {['general', 'CPBL', 'NPB', 'WBC', 'MLB'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="datetime-local" value={newPollForm.ends_at}
                    onChange={e => setNewPollForm(f => ({ ...f, ends_at: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500">選項（至少2項）</label>
                  {newPollForm.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={opt} placeholder={`選項 ${i + 1}`}
                        onChange={e => setNewPollForm(f => { const o = [...f.options]; o[i] = e.target.value; return { ...f, options: o }; })}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400" />
                      {newPollForm.options.length > 2 && (
                        <button type="button" onClick={() => setNewPollForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                          className="text-red-400 hover:text-red-600 px-2 font-bold">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewPollForm(f => ({ ...f, options: [...f.options, ''] }))}
                    className="text-sm font-bold text-gray-400 hover:text-red-600 transition">+ 新增選項</button>
                </div>
                <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition">建立投票</button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black">投票清單（{polls.length}）</h2>
                <button onClick={() => getAllPolls().then(setPolls)} className="text-sm font-bold text-gray-400 hover:text-red-600 transition">↻ 重新整理</button>
              </div>
              <div className="space-y-4">
                {polls.map(poll => (
                  <div key={poll.id} className="p-4 border border-gray-100 rounded-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${poll.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {poll.is_active ? '進行中' : '已關閉'}
                          </span>
                          <span className="text-[10px] text-gray-400">{poll.total_votes} 票</span>
                        </div>
                        <p className="font-bold text-sm">{poll.question}</p>
                        <div className="mt-2 space-y-1">
                          {poll.options.map(opt => (
                            <div key={opt.id} className="flex items-center gap-2 text-xs text-gray-500">
                              <div className="h-1.5 bg-gray-100 rounded-full flex-1 max-w-24 overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full" style={{ width: `${opt.percentage}%` }} />
                              </div>
                              <span>{opt.option_text}</span>
                              <span className="text-gray-400">{opt.percentage}%</span>
                              <button onClick={async () => {
                                if (confirm(`刪除選項「${opt.option_text}」？`)) {
                                  await deletePollOption(poll.id, opt.id);
                                  getAllPolls().then(setPolls);
                                }
                              }} className="text-red-300 hover:text-red-500 ml-1">✕</button>
                            </div>
                          ))}
                        </div>
                        {editingPollId === poll.id && (
                          <div className="mt-2 flex gap-2">
                            <input type="text" value={newOptionText} placeholder="新選項文字"
                              onChange={e => setNewOptionText(e.target.value)}
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                            <button onClick={async () => {
                              if (!newOptionText.trim()) return;
                              await addPollOption(poll.id, newOptionText);
                              setNewOptionText(''); setEditingPollId(null);
                              getAllPolls().then(setPolls);
                            }} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">新增</button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={async () => { await updatePoll(poll.id, { is_active: !poll.is_active }); getAllPolls().then(setPolls); }}
                          className={`text-xs font-bold px-3 py-1 rounded-lg border transition ${poll.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {poll.is_active ? '關閉' : '開啟'}
                        </button>
                        <button onClick={() => setEditingPollId(editingPollId === poll.id ? null : poll.id)}
                          className="text-xs font-bold px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition">
                          + 選項
                        </button>
                        <button onClick={async () => {
                          if (confirm('確定刪除此投票及所有票數？')) {
                            await deletePoll(poll.id);
                            getAllPolls().then(setPolls);
                            flash('✅ 投票已刪除');
                          }
                        }} className="text-xs font-bold px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">刪除</button>
                      </div>
                    </div>
                  </div>
                ))}
                {polls.length === 0 && <p className="text-gray-400 text-sm text-center py-8">尚無投票</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── 限時動態管理 ── */}
        {tab === 'stories' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">🎬 限時動態管理</h2>
              <button onClick={() => { setEditingStory({ ...BLANK_STORY }); setShowStoryForm(true); }}
                className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-red-700 transition">
                ＋ 新增 Story
              </button>
            </div>

            {/* Story 表單 Modal */}
            {showStoryForm && editingStory && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowStoryForm(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                  onClick={e => e.stopPropagation()}>
                  <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-black text-lg">{editingStory.id ? '編輯 Story' : '新增 Story'}</h3>
                    <button onClick={() => setShowStoryForm(false)} className="text-gray-400 hover:text-gray-700 font-black text-lg">✕</button>
                  </div>
                  <div className="p-6 space-y-5">

                    {/* 基本資訊 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">主場球隊（全名）</label>
                        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          placeholder="中信兄弟" value={editingStory.home_team}
                          onChange={e => setEditingStory({ ...editingStory, home_team: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">客場球隊（全名）</label>
                        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          placeholder="統一獅" value={editingStory.away_team}
                          onChange={e => setEditingStory({ ...editingStory, away_team: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">主場縮寫</label>
                        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          placeholder="兄弟" value={editingStory.home_abbr}
                          onChange={e => setEditingStory({ ...editingStory, home_abbr: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">客場縮寫</label>
                        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          placeholder="統一" value={editingStory.away_abbr}
                          onChange={e => setEditingStory({ ...editingStory, away_abbr: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">主場顏色</label>
                        <div className="flex items-center gap-2">
                          <input type="color" className="w-10 h-9 rounded border border-gray-200 cursor-pointer"
                            value={editingStory.home_color}
                            onChange={e => setEditingStory({ ...editingStory, home_color: e.target.value })} />
                          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono"
                            value={editingStory.home_color}
                            onChange={e => setEditingStory({ ...editingStory, home_color: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">客場顏色</label>
                        <div className="flex items-center gap-2">
                          <input type="color" className="w-10 h-9 rounded border border-gray-200 cursor-pointer"
                            value={editingStory.away_color}
                            onChange={e => setEditingStory({ ...editingStory, away_color: e.target.value })} />
                          <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono"
                            value={editingStory.away_color}
                            onChange={e => setEditingStory({ ...editingStory, away_color: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">聯盟</label>
                        <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          value={editingStory.league}
                          onChange={e => setEditingStory({ ...editingStory, league: e.target.value })}>
                          {['CPBL','NPB','MLB','WBC','NBA','WS'].map(l => <option key={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">排序（數字越小越前）</label>
                        <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                          value={editingStory.sort_order}
                          onChange={e => setEditingStory({ ...editingStory, sort_order: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>

                    {/* 開關 */}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-red-600"
                          checked={editingStory.is_live}
                          onChange={e => setEditingStory({ ...editingStory, is_live: e.target.checked })} />
                        <span className="text-sm font-bold">LIVE 顯示</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-green-600"
                          checked={editingStory.is_active}
                          onChange={e => setEditingStory({ ...editingStory, is_active: e.target.checked })} />
                        <span className="text-sm font-bold">啟用顯示</span>
                      </label>
                    </div>

                    {/* Clips */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black text-gray-500">Clips（畫面）</label>
                        <button
                          onClick={() => setEditingStory({ ...editingStory, clips: [...editingStory.clips, { ...BLANK_CLIP, clip_order: editingStory.clips.length }] })}
                          className="text-xs font-black text-red-600 hover:underline">
                          ＋ 新增 Clip
                        </button>
                      </div>
                      <div className="space-y-4">
                        {editingStory.clips.map((clip, ci) => (
                          <div key={ci} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-gray-400">Clip {ci + 1}</span>
                              {editingStory.clips.length > 1 && (
                                <button onClick={() => setEditingStory({ ...editingStory, clips: editingStory.clips.filter((_, i) => i !== ci) })}
                                  className="text-xs text-red-500 hover:underline font-bold">刪除</button>
                              )}
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-gray-400 block mb-1">背景圖片網址 *</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                placeholder="https://..." value={clip.background_image_url}
                                onChange={e => { const c = [...editingStory.clips]; c[ci] = { ...c[ci], background_image_url: e.target.value }; setEditingStory({ ...editingStory, clips: c }); }} />
                              {clip.background_image_url && (
                                <img src={clip.background_image_url} className="mt-2 h-20 w-full object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-bold text-gray-400 block mb-1">比分（如 3 - 2）</label>
                                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  placeholder="3 - 2" value={clip.score}
                                  onChange={e => { const c = [...editingStory.clips]; c[ci] = { ...c[ci], score: e.target.value }; setEditingStory({ ...editingStory, clips: c }); }} />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-gray-400 block mb-1">顯示秒數（毫秒）</label>
                                <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  value={clip.duration_ms}
                                  onChange={e => { const c = [...editingStory.clips]; c[ci] = { ...c[ci], duration_ms: parseInt(e.target.value) || 6000 }; setEditingStory({ ...editingStory, clips: c }); }} />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-gray-400 block mb-1">局況（如 7局上 無人出局）</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                placeholder="7局上  ●  無人出局" value={clip.situation}
                                onChange={e => { const c = [...editingStory.clips]; c[ci] = { ...c[ci], situation: e.target.value }; setEditingStory({ ...editingStory, clips: c }); }} />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-gray-400 block mb-1">關鍵事件（紅底白字大字）</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                                placeholder="林智勝 敲出關鍵雙打！" value={clip.key_play}
                                onChange={e => { const c = [...editingStory.clips]; c[ci] = { ...c[ci], key_play: e.target.value }; setEditingStory({ ...editingStory, clips: c }); }} />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-gray-400 block mb-1">AI 數據解析（選填）</label>
                              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none" rows={2}
                                placeholder="數據顯示，中信兄弟在7局後領先時擁有 82% 的勝率。" value={clip.ai_insight}
                                onChange={e => { const c = [...editingStory.clips]; c[ci] = { ...c[ci], ai_insight: e.target.value }; setEditingStory({ ...editingStory, clips: c }); }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 儲存 */}
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => saveStory(editingStory)}
                        className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-black hover:bg-black transition">
                        儲存
                      </button>
                      <button onClick={() => { setShowStoryForm(false); setEditingStory(null); }}
                        className="px-6 py-3 border border-gray-200 rounded-xl font-black text-gray-500 hover:border-gray-400 transition">
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stories 列表 */}
            {storiesLoading ? (
              <div className="text-center py-12 text-gray-400 font-bold">載入中...</div>
            ) : stories.length === 0 ? (
              <div className="text-center py-12 text-gray-400 font-bold bg-white rounded-2xl border border-gray-100">
                尚無 Stories，點擊右上角新增
              </div>
            ) : (
              <div className="grid gap-3">
                {stories.map(s => (
                  <div key={s.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${s.is_active ? 'border-gray-100' : 'border-gray-200 opacity-50'}`}>
                    {/* 預覽圓圈 */}
                    <div className="w-12 h-12 rounded-full flex-shrink-0 flex flex-col items-center justify-center text-white text-[9px] font-black border-2 border-red-500"
                      style={{ background: `linear-gradient(135deg, ${s.home_color}, ${s.away_color})` }}>
                      <span>{s.home_abbr}</span>
                      <span className="opacity-60">vs</span>
                      <span>{s.away_abbr}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm">{s.home_team} vs {s.away_team}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{s.league}</span>
                        {s.is_live && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>}
                        {!s.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">停用</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{(s.clips as StoryClipForm[]).length} 個 Clip · 排序 {s.sort_order}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setEditingStory(s); setShowStoryForm(true); }}
                        className="text-xs font-black px-3 py-1.5 border border-gray-200 rounded-lg hover:border-gray-400 transition">
                        編輯
                      </button>
                      <button onClick={() => s.id && deleteStory(s.id)}
                        className="text-xs font-black px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 數據分析 ── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            {analyticsLoading ? (
              <div className="text-center py-16 text-gray-400 font-bold">載入中...</div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: '文章數', value: analytics.articles, color: 'bg-blue-50 text-blue-700' },
                    { label: '會員數', value: analytics.users, color: 'bg-purple-50 text-purple-700' },
                    { label: 'CPBL場次', value: analytics.cpbl_games, color: 'bg-red-50 text-red-700' },
                    { label: '投票主題', value: analytics.polls, color: 'bg-green-50 text-green-700' },
                    { label: '總投票數', value: analytics.total_votes, color: 'bg-orange-50 text-orange-700' },
                  ].map(stat => (
                    <div key={stat.label} className={`${stat.color} rounded-2xl p-4 text-center`}>
                      <div className="text-3xl font-black">{stat.value.toLocaleString()}</div>
                      <div className="text-xs font-bold mt-1 opacity-70">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h2 className="text-xl font-black mb-4">熱門投票 Top 5</h2>
                  <div className="space-y-3">
                    {analytics.top_polls.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-bold text-sm truncate">{p.question}</p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full"
                              style={{ width: `${analytics.top_polls[0]?.total_votes > 0 ? Math.round((p.total_votes / analytics.top_polls[0].total_votes) * 100) : 0}%` }} />
                          </div>
                        </div>
                        <span className={`text-sm font-black ${p.is_active ? 'text-green-600' : 'text-gray-400'}`}>{p.total_votes} 票</span>
                      </div>
                    ))}
                    {analytics.top_polls.length === 0 && <p className="text-gray-400 text-sm">尚無投票資料</p>}
                  </div>
                </div>

                {analytics.votes_by_day.length > 0 && (
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-black mb-4">近30日投票趨勢</h2>
                    <div className="flex items-end gap-1 h-24">
                      {(() => {
                        const max = Math.max(...analytics.votes_by_day.map(d => d.count), 1);
                        return analytics.votes_by_day.map(d => (
                          <div key={d.day} className="flex-1 flex flex-col items-center" title={`${d.day}: ${d.count}票`}>
                            <div className="w-full bg-red-400 rounded-t" style={{ height: `${(d.count / max) * 80}px`, minHeight: '2px' }} />
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{analytics.votes_by_day[0]?.day?.slice(5)}</span>
                      <span>{analytics.votes_by_day[analytics.votes_by_day.length - 1]?.day?.slice(5)}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-gray-400 font-bold">無法載入數據</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
