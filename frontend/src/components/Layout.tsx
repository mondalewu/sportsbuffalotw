import { useState, useEffect, useRef, useCallback } from 'react';
import BottomNav from './BottomNav';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown, LogOut, X as XIcon, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AuthModal from './AuthModal';
import { getGames } from '../api/games';
import { logout } from '../api/auth';
import { searchArticles } from '../api/articles';
import { teamLogos } from '../data/staticData';
import type { Game, Article } from '../types';

export default function Layout() {
  const { currentUser, setCurrentUser, authModal, setAuthModal, preferences, setSelectedArticle } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // ── 搜尋 ─────────────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchArticles(q);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen, closeSearch]);

  const handleSearchSelect = async (article: Article) => {
    closeSearch();
    try {
      const { getArticleBySlug } = await import('../api/articles');
      const full = await getArticleBySlug(article.slug);
      setSelectedArticle(full);
    } catch {
      setSelectedArticle(article);
    }
    navigate(`/article/${article.slug}`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  const [games, setGames] = useState<Game[]>([]);
  const [npbGames, setNpbGames] = useState<Game[]>([]);
  const [npb2Games, setNpb2Games] = useState<Game[]>([]);
  const [cpblGames, setCpblGames] = useState<Game[]>([]);
  const [scoreCategory, setScoreCategory] = useState('LIVE');
  const [isBaseballDropdownOpen, setIsBaseballDropdownOpen] = useState(false);
  const [isBasketballDropdownOpen, setIsBasketballDropdownOpen] = useState(false);
  const [isSoccerDropdownOpen, setIsSoccerDropdownOpen] = useState(false);
  const [scoreBarOpen, setScoreBarOpen] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  const baseballDropdownRef = useRef<HTMLDivElement>(null);
  const basketballDropdownRef = useRef<HTMLDivElement>(null);
  const soccerDropdownRef = useRef<HTMLDivElement>(null);

  const fetchLive = () => {
    const today = new Date().toISOString().slice(0, 10);
    getGames({ status: 'live', date: today }).then(setGames).catch(() => {});
    getGames({ league: 'NPB', date: today }).then(setNpbGames).catch(() => {});
    getGames({ league: 'NPB2', date: today }).then(setNpb2Games).catch(() => {});
    Promise.all([
      getGames({ league: 'CPBL-W', date: today }),
      getGames({ league: 'CPBL', date: today }),
    ]).then(([w, r]) => setCpblGames([...w, ...r].sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime()))).catch(() => {});
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsAppInstalled(true); setInstallPrompt(null); });
    if (window.matchMedia('(display-mode: standalone)').matches) setIsAppInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (baseballDropdownRef.current && !baseballDropdownRef.current.contains(e.target as Node))
        setIsBaseballDropdownOpen(false);
      if (basketballDropdownRef.current && !basketballDropdownRef.current.contains(e.target as Node))
        setIsBasketballDropdownOpen(false);
      if (soccerDropdownRef.current && !soccerDropdownRef.current.contains(e.target as Node))
        setIsSoccerDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const handleInstall = async () => {
    if (installPrompt) {
      (installPrompt as BeforeInstallPromptEvent).prompt();
      const { outcome } = await (installPrompt as BeforeInstallPromptEvent).userChoice;
      if (outcome === 'accepted') { setIsAppInstalled(true); setInstallPrompt(null); }
    } else {
      setShowInstallGuide(true);
    }
  };

  const filteredScores =
    scoreCategory === 'LIVE' ? games.filter(g => g.status === 'live' && g.league !== 'CPBL' && g.league !== 'CPBL-W') :
    scoreCategory === 'NPB'  ? npbGames :
    scoreCategory === 'NPB2' ? npb2Games :
    scoreCategory === 'CPBL' ? cpblGames :
    games.filter(g => g.league === scoreCategory);

  const handleScoreCardClick = (g: Game) => {
    if (g.league === 'NPB' || g.league === 'NPB2') navigate(`/npb/game/${g.id}`);
    else if (g.league === 'CPBL' || g.league === 'CPBL-W') navigate(`/cpbl/game/${g.id}`);
  };

  const path = location.pathname;

  return (
    <div className="min-h-screen">
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSuccess={user => { setCurrentUser(user); setAuthModal(null); }}
        />
      )}

      {showInstallGuide && (
        <div className="fixed inset-0 z-[9998] bg-black/50 flex items-end md:items-center justify-center" onClick={() => setShowInstallGuide(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">安裝水牛體育 APP</h3>
              <button onClick={() => setShowInstallGuide(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-2">📱 iPhone / iPad (Safari)</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>點擊下方工具列的「分享」按鈕 <span className="text-blue-500">⬆</span></li>
                  <li>選擇「加入主畫面」</li>
                  <li>點擊右上角「新增」</li>
                </ol>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-2">🤖 Android (Chrome)</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>點擊右上角選單 <span className="text-gray-500">⋮</span></li>
                  <li>選擇「新增至主畫面」</li>
                  <li>點擊「新增」確認</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="flex items-baseline font-black italic text-2xl tracking-tighter">
                <span className="text-black">SPORTS</span>
                <span className="text-red-600 ml-1">BUFFALO</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-800 ml-2 border-l pl-2 border-gray-300">水牛體育</span>
            </div>

            <nav className="hidden md:flex space-x-6 h-full items-center text-sm font-bold">
              <button onClick={() => navigate('/')} className={`h-full flex items-center px-2 transition ${path === '/' ? 'nav-active' : 'hover:text-red-600'}`}>首頁</button>
              <button onClick={() => navigate('/poll')} className={`h-full flex items-center px-2 transition ${path === '/poll' ? 'nav-active' : 'hover:text-red-600'}`}>球迷投票</button>

              <div className="relative h-full flex items-center" ref={baseballDropdownRef}>
                <button onClick={() => setIsBaseballDropdownOpen(!isBaseballDropdownOpen)} className={`h-full flex items-center px-2 transition gap-1 ${['/npb', '/cpbl', '/taiwan-baseball', '/mlb'].includes(path) ? 'nav-active' : 'hover:text-red-600'}`}>
                  棒球 <ChevronDown className="w-4 h-4" />
                </button>
                {isBaseballDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50">
                    <button onClick={() => { navigate('/npb'); setIsBaseballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/npb' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>NPB 日本職棒</button>
                    <button onClick={() => { navigate('/cpbl'); setIsBaseballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/cpbl' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>CPBL 中華職棒</button>
                    <button onClick={() => { navigate('/mlb'); setIsBaseballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/mlb' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>MLB 美國職棒</button>
                    <button onClick={() => { navigate('/taiwan-baseball'); setIsBaseballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/taiwan-baseball' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>台灣三級棒球</button>
                  </div>
                )}
              </div>

              <div className="relative h-full flex items-center" ref={basketballDropdownRef}>
                <button onClick={() => setIsBasketballDropdownOpen(!isBasketballDropdownOpen)} className={`h-full flex items-center px-2 transition gap-1 ${['/nba', '/pleague', '/tpbl', '/taiwan-basketball'].includes(path) ? 'nav-active' : 'hover:text-red-600'}`}>
                  籃球 <ChevronDown className="w-4 h-4" />
                </button>
                {isBasketballDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50">
                    <button onClick={() => { navigate('/nba'); setIsBasketballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/nba' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>NBA 美國職籃</button>
                    <button onClick={() => { navigate('/pleague'); setIsBasketballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/pleague' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>P.LEAGUE+ 台灣職籃</button>
                    <button onClick={() => { navigate('/tpbl'); setIsBasketballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/tpbl' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>TPBL 超級聯賽</button>
                    <button onClick={() => { navigate('/taiwan-basketball'); setIsBasketballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/taiwan-basketball' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>台灣三級籃球</button>
                  </div>
                )}
              </div>

              <div className="relative h-full flex items-center" ref={soccerDropdownRef}>
                <button onClick={() => setIsSoccerDropdownOpen(!isSoccerDropdownOpen)} className={`h-full flex items-center px-2 transition gap-1 ${path === '/soccer' ? 'nav-active' : 'hover:text-red-600'}`}>
                  足球 <ChevronDown className="w-4 h-4" />
                </button>
                {isSoccerDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50">
                    <button onClick={() => { navigate('/soccer?section=worldcup'); setIsSoccerDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition text-sm ${path === '/soccer' ? 'hover:text-red-600' : 'hover:text-red-600'}`}>
                      🌍 2026 FIFA 世界盃
                    </button>
                    <button onClick={() => { navigate('/soccer?section=jleague'); setIsSoccerDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 hover:text-red-600 transition text-sm">
                      🇯🇵 J League
                    </button>
                    <button onClick={() => { navigate('/tpsl'); setIsSoccerDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition text-sm ${path === '/tpsl' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>
                      🇹🇼 台灣企業甲級聯賽
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => navigate('/athletics')} className={`h-full flex items-center px-2 transition ${path === '/athletics' ? 'nav-active' : 'hover:text-red-600'}`}>田徑</button>
            </nav>

            <div className="flex items-center space-x-3">
              {!isAppInstalled && (
                <button
                  onClick={handleInstall}
                  className="hidden md:flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-red-700 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下載 APP
                </button>
              )}
              {currentUser ? (
                <div className="flex items-center gap-2">
                  {(currentUser.role === 'editor' || currentUser.role === 'admin') && (
                    <button onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-600 transition">進入後台</button>
                  )}
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition"
                    title="會員設定"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                      <span className="text-[11px] font-black text-white">{currentUser.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="hidden md:inline">{currentUser.username}</span>
                  </button>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition" title="登出">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAuthModal('login')} className="bg-gray-100 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-600 hover:text-white transition">登入</button>
              )}
              <button onClick={openSearch} className="text-gray-500 hover:text-black" title="搜尋文章">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 搜尋 Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-start justify-center pt-20 px-4"
          onClick={closeSearch}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 搜尋輸入框 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜尋體育新聞..."
                className="flex-1 text-base outline-none placeholder-gray-400"
              />
              <button onClick={closeSearch} className="text-gray-400 hover:text-gray-600 transition">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* 搜尋結果 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {searchLoading && (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">搜尋中...</div>
              )}

              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">
                  找不到「{searchQuery}」相關文章
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <ul>
                  {searchResults.map(article => (
                    <li key={article.id}>
                      <button
                        onClick={() => handleSearchSelect(article)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                      >
                        {article.image_url && (
                          <img
                            src={article.image_url}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black truncate">{article.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{article.category}</span>
                            <span className="text-[10px] text-gray-400">{article.published_at?.split('T')[0]}</span>
                          </div>
                          {article.summary && (
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{article.summary}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {searchQuery.trim().length < 2 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  輸入 2 個字以上開始搜尋
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Score Bar */}
      <div className="score-bar-container">
        {/* 收合切換列 */}
        <button
          onClick={() => setScoreBarOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition group border-b border-gray-100"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">即時比分</span>
            {games.some(g => g.status === 'live') && (
              <span className="flex items-center gap-1 text-[10px] font-black text-red-500">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <span className={`text-gray-400 group-hover:text-gray-600 transition-transform duration-300 ${scoreBarOpen ? 'rotate-0' : 'rotate-180'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </span>
        </button>

        {/* 收合內容 */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${scoreBarOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {(['LIVE', 'CPBL', 'NPB', 'NPB2', 'MLB', 'NBA'] as const).map(cat => (
              <button key={cat} onClick={() => setScoreCategory(cat)} className={`filter-btn ${scoreCategory === cat ? 'score-tab-active text-white' : 'text-gray-500'}`}>
                {cat === 'LIVE' ? '正在比賽' : cat === 'NPB2' ? 'NPB二軍' : cat}
              </button>
            ))}
          </div>
          <div className="flex overflow-x-auto scrollbar-hide flex-1 items-center py-1">
            {filteredScores.length === 0 && scoreCategory !== 'LIVE' && (
              <span className="text-xs text-gray-400 font-bold">目前無比賽資料</span>
            )}
            {filteredScores.length === 0 && scoreCategory === 'LIVE' && !cpblGames.some(g => g.status === 'live' || g.status === 'final') && (
              <span className="text-xs text-gray-400 font-bold">目前無比賽資料</span>
            )}
            {filteredScores.map((g, idx) => {
              const isRainout = g.game_detail?.includes('延賽') || g.game_detail?.includes('雨天');
              const allFavTeams = Object.values(preferences.fav_teams).flat();
              const isFavGame = allFavTeams.includes(g.team_home) || allFavTeams.includes(g.team_away);
              return (
              <button
                key={g.id ?? idx}
                onClick={() => handleScoreCardClick(g)}
                className={`score-card p-3 flex-shrink-0 text-left hover:shadow-md transition cursor-pointer ${isRainout ? 'border-blue-200 bg-blue-50' : isFavGame ? 'border-red-300 bg-red-50' : 'hover:border-red-300'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase italic">{g.league}</span>
                    {isFavGame && <span className="text-[9px]">❤️</span>}
                    {g.has_tw_player && <span className="text-[10px]" title="台灣選手出賽">🇹🇼</span>}
                  </div>
                  {isRainout
                    ? <span className="text-[9px] font-bold text-blue-500">🌧 因雨延賽</span>
                    : <span className={`text-[9px] font-bold ${g.status === 'live' ? 'text-red-600' : 'text-gray-400'}`}>
                        {g.status === 'live' && <span className="live-indicator"></span>}
                        {g.status === 'live' ? g.game_detail :
                         g.status === 'scheduled'
                           ? new Date(g.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
                           : g.game_detail}
                      </span>
                  }
                </div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <img src={teamLogos[g.team_home]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_home} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <span className="font-bold">{g.team_home}</span>
                  </div>
                  <span className="font-black">{isRainout ? '—' : (g.score_home ?? '-')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <img src={teamLogos[g.team_away]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_away} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <span className="font-bold">{g.team_away}</span>
                  </div>
                  <span className="font-black">{isRainout ? '—' : (g.score_away ?? '-')}</span>
                </div>
              </button>
              );
            })}
          </div>

          {/* CPBL games row shown below LIVE section */}
          {scoreCategory === 'LIVE' && cpblGames.some(g => g.status === 'live' || g.status === 'final') && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 inline-block">CPBL 中華職棒</span>
              <div className="flex overflow-x-auto scrollbar-hide items-center py-1">
                {cpblGames.map((g, idx) => {
                  const isRainout = g.game_detail?.includes('延賽') || g.game_detail?.includes('雨天');
                  return (
                  <button
                    key={g.id ?? idx}
                    onClick={() => handleScoreCardClick(g)}
                    className={`score-card p-3 flex-shrink-0 text-left hover:shadow-md transition cursor-pointer ${isRainout ? 'border-blue-200 bg-blue-50' : 'hover:border-red-300'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase italic">{g.league}</span>
                      {isRainout
                        ? <span className="text-[9px] font-bold text-blue-500">🌧 因雨延賽</span>
                        : <span className={`text-[9px] font-bold ${g.status === 'live' ? 'text-red-600' : 'text-gray-400'}`}>
                            {g.status === 'live' && <span className="live-indicator"></span>}
                            {g.status === 'live' ? g.game_detail :
                             g.status === 'scheduled'
                               ? new Date(g.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
                               : g.game_detail}
                          </span>
                      }
                    </div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <img src={teamLogos[g.team_home]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_home} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <span className="font-bold">{g.team_home}</span>
                      </div>
                      <span className="font-black">{isRainout ? '—' : (g.score_home ?? '-')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <img src={teamLogos[g.team_away]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_away} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <span className="font-bold">{g.team_away}</span>
                      </div>
                      <span className="font-black">{isRainout ? '—' : (g.score_away ?? '-')}</span>
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </div>{/* end 收合內容 */}
      </div>

      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>

      <BottomNav />

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-16 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-baseline justify-center font-black italic text-xl tracking-tighter mb-4">
            <span>SPORTS</span><span className="text-red-500 ml-1">BUFFALO</span>
            <span className="text-gray-400 ml-2 text-sm not-italic font-normal">水牛體育</span>
          </div>

          {/* Social & Contact */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <a href="https://www.instagram.com/sports_buffalo/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-400 hover:text-pink-400 transition-colors text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>@sports_buffalo</span>
            </a>

            <span className="text-gray-700 hidden sm:inline">|</span>

            <a href="https://x.com/sportsbuffalotw" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>@sportsbuffalotw</span>
            </a>

            <span className="text-gray-700 hidden sm:inline">|</span>

            <a href="mailto:sportsbuffalotw@gmail.com"
              className="flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span>聯絡我們：sportsbuffalotw@gmail.com</span>
            </a>
          </div>

          <p className="text-gray-600 text-xs">© 2026 水牛體育 All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
