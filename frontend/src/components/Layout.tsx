import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown, LogOut, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AuthModal from './AuthModal';
import { getGames } from '../api/games';
import { logout } from '../api/auth';
import { teamLogos } from '../data/staticData';
import type { Game } from '../types';

export default function Layout() {
  const { currentUser, setCurrentUser, authModal, setAuthModal } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [games, setGames] = useState<Game[]>([]);
  const [npbGames, setNpbGames] = useState<Game[]>([]);
  const [npb2Games, setNpb2Games] = useState<Game[]>([]);
  const [cpblGames, setCpblGames] = useState<Game[]>([]);
  const [scoreCategory, setScoreCategory] = useState('LIVE');
  const [isBaseballDropdownOpen, setIsBaseballDropdownOpen] = useState(false);

  const baseballDropdownRef = useRef<HTMLDivElement>(null);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (baseballDropdownRef.current && !baseballDropdownRef.current.contains(e.target as Node))
        setIsBaseballDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
  };

  const filteredScores =
    scoreCategory === 'LIVE' ? games.filter(g => g.status === 'live' && g.league !== 'CPBL' && g.league !== 'CPBL-W') :
    scoreCategory === 'NPB' ? [...npbGames, ...npb2Games].sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime()) :
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
                <button onClick={() => setIsBaseballDropdownOpen(!isBaseballDropdownOpen)} className={`h-full flex items-center px-2 transition gap-1 ${['/npb', '/cpbl'].includes(path) ? 'nav-active' : 'hover:text-red-600'}`}>
                  棒球 <ChevronDown className="w-4 h-4" />
                </button>
                {isBaseballDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50">
                    <button onClick={() => { navigate('/npb'); setIsBaseballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/npb' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>NPB 日本職棒</button>
                    <button onClick={() => { navigate('/cpbl'); setIsBaseballDropdownOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition ${path === '/cpbl' ? 'text-red-600 font-black' : 'hover:text-red-600'}`}>CPBL 中華職棒</button>
                  </div>
                )}
              </div>

              <button className="hover:text-red-600 transition h-full flex items-center px-2">籃球</button>
            </nav>

            <div className="flex items-center space-x-3">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  {(currentUser.role === 'editor' || currentUser.role === 'admin') && (
                    <button onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-red-600 transition">進入後台</button>
                  )}
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline">{currentUser.username}</span>
                  </div>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition" title="登出">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAuthModal('login')} className="bg-gray-100 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-600 hover:text-white transition">登入</button>
              )}
              <button className="text-gray-500 hover:text-black"><Search className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      {/* Score Bar */}
      <div className="score-bar-container py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {['LIVE', 'CPBL', 'NPB', 'MLB', 'NBA'].map(cat => (
              <button key={cat} onClick={() => setScoreCategory(cat)} className={`filter-btn ${scoreCategory === cat ? 'score-tab-active text-white' : 'text-gray-500'}`}>
                {cat === 'LIVE' ? '正在比賽' : cat}
              </button>
            ))}
          </div>
          <div className="flex overflow-x-auto scrollbar-hide flex-1 items-center py-1">
            {filteredScores.length === 0 && scoreCategory !== 'LIVE' && (
              <span className="text-xs text-gray-400 font-bold">目前無比賽資料</span>
            )}
            {filteredScores.length === 0 && scoreCategory === 'LIVE' && cpblGames.length === 0 && (
              <span className="text-xs text-gray-400 font-bold">目前無比賽資料</span>
            )}
            {filteredScores.map((g, idx) => (
              <button
                key={g.id ?? idx}
                onClick={() => handleScoreCardClick(g)}
                className="score-card p-3 flex-shrink-0 text-left hover:border-red-300 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase italic">{g.league}</span>
                  <span className={`text-[9px] font-bold ${g.status === 'live' ? 'text-red-600' : 'text-gray-400'}`}>
                    {g.status === 'live' && <span className="live-indicator"></span>}
                    {g.status === 'live' ? g.game_detail :
                     g.status === 'scheduled'
                       ? new Date(g.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
                       : g.game_detail}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <img src={teamLogos[g.team_home]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_home} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <span className="font-bold">{g.team_home}</span>
                  </div>
                  <span className="font-black">{g.score_home ?? '-'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <img src={teamLogos[g.team_away]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_away} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <span className="font-bold">{g.team_away}</span>
                  </div>
                  <span className="font-black">{g.score_away ?? '-'}</span>
                </div>
              </button>
            ))}
          </div>

          {/* CPBL games row shown below LIVE section */}
          {scoreCategory === 'LIVE' && cpblGames.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 inline-block">CPBL 中華職棒</span>
              <div className="flex overflow-x-auto scrollbar-hide items-center py-1">
                {cpblGames.map((g, idx) => (
                  <button
                    key={g.id ?? idx}
                    onClick={() => handleScoreCardClick(g)}
                    className="score-card p-3 flex-shrink-0 text-left hover:border-red-300 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase italic">{g.league}</span>
                      <span className={`text-[9px] font-bold ${g.status === 'live' ? 'text-red-600' : 'text-gray-400'}`}>
                        {g.status === 'live' && <span className="live-indicator"></span>}
                        {g.status === 'live' ? g.game_detail :
                         g.status === 'scheduled'
                           ? new Date(g.game_date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
                           : g.game_detail}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <img src={teamLogos[g.team_home]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_home} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <span className="font-bold">{g.team_home}</span>
                      </div>
                      <span className="font-black">{g.score_home ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <img src={teamLogos[g.team_away]} className="w-5 h-5 object-contain flex-shrink-0" alt={g.team_away} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                        <span className="font-bold">{g.team_away}</span>
                      </div>
                      <span className="font-black">{g.score_away ?? '-'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Outlet />

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
