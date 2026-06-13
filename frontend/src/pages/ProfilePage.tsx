import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Lock, LogOut, ChevronRight, ShieldCheck, Pencil, Check, X, Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { updateProfile, changePassword, logout, updatePreferences } from '../api/auth';

interface SportConfig {
  key: string;
  label: string;
  emoji: string;
  teams: string[];
}

const SPORTS_CONFIG: SportConfig[] = [
  {
    key: 'cpbl', label: 'CPBL 中華職棒', emoji: '⚾',
    teams: ['富邦悍將', '味全龍', '中信兄弟', '台鋼雄鷹', '樂天桃猿', '統一獅'],
  },
  {
    key: 'npb', label: 'NPB 日本職棒', emoji: '⚾',
    teams: ['巨人', '阪神', 'DeNA', '広島', '中日', 'ヤクルト', '日本ハム', '楽天', 'ロッテ', '西武', 'ソフトバンク', 'オリックス'],
  },
  {
    key: 'mlb', label: 'MLB 美國職棒', emoji: '🇺🇸',
    teams: [],
  },
  {
    key: 'nba', label: 'NBA', emoji: '🏀',
    teams: [],
  },
  {
    key: 'pleague', label: 'P.LEAGUE+ 台灣職籃', emoji: '🏀',
    teams: ['新北國王', '台北富邦勇士', '桃園領航猿', '新竹攻城獅', '高雄鋼鐵人', '台灣啤酒英雄'],
  },
  {
    key: 'soccer', label: '足球', emoji: '⚽',
    teams: [],
  },
];

export default function ProfilePage() {
  const { currentUser, setCurrentUser, preferences, setPreferences } = useApp();
  const navigate = useNavigate();

  // ── Account editing ──────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Password ─────────────────────────────────────────────────────────
  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── Preferences ──────────────────────────────────────────────────────
  const [localSports, setLocalSports] = useState<string[]>(preferences.sports);
  const [localFavTeams, setLocalFavTeams] = useState<Record<string, string[]>>(preferences.fav_teams);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState(false);

  if (!currentUser) { navigate('/'); return null; }

  const ROLE_LABEL: Record<string, string> = { member: '一般會員', editor: '編輯', admin: '管理員' };
  const ROLE_COLOR: Record<string, string> = {
    member: 'bg-gray-100 text-gray-600',
    editor: 'bg-blue-100 text-blue-700',
    admin:  'bg-red-100 text-red-700',
  };

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!newUsername.trim() || newUsername.trim() === currentUser.username) { setEditingName(false); return; }
    setNameLoading(true); setNameError('');
    try {
      const updated = await updateProfile({ username: newUsername.trim() });
      setCurrentUser(updated); setNameSuccess(true); setEditingName(false);
      setTimeout(() => setNameSuccess(false), 2500);
    } catch (e: unknown) {
      setNameError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '更新失敗');
    } finally { setNameLoading(false); }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!currentPw || !newPw || !confirmPw) { setPwError('請填寫所有欄位'); return; }
    if (newPw !== confirmPw) { setPwError('新密碼與確認密碼不一致'); return; }
    if (newPw.length < 6) { setPwError('新密碼至少 6 個字元'); return; }
    setPwLoading(true);
    try {
      await changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true); setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwSuccess(false); setShowPwSection(false); }, 2500);
    } catch (e: unknown) {
      setPwError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '密碼更新失敗');
    } finally { setPwLoading(false); }
  };

  const toggleSport = (key: string) => {
    setLocalSports(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
    // Remove fav teams if sport deselected
    if (localSports.includes(key)) {
      setLocalFavTeams(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const toggleFavTeam = (sportKey: string, team: string) => {
    setLocalFavTeams(prev => {
      const current = prev[sportKey] ?? [];
      return {
        ...prev,
        [sportKey]: current.includes(team)
          ? current.filter(t => t !== team)
          : [...current, team],
      };
    });
  };

  const handleSavePrefs = async () => {
    setPrefSaving(true);
    try {
      const saved = await updatePreferences({ sports: localSports, fav_teams: localFavTeams });
      setPreferences(saved);
      setPrefSuccess(true);
      setTimeout(() => setPrefSuccess(false), 2000);
    } catch { /* silent */ } finally { setPrefSaving(false); }
  };

  const handleLogout = async () => {
    await logout(); setCurrentUser(null); navigate('/');
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-8 min-h-screen">
      <Helmet><title>會員設定 - 水牛體育</title></Helmet>

      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5" /> 返回
      </button>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mb-3 shadow-lg">
          <span className="text-3xl font-black text-white">{currentUser.username.charAt(0).toUpperCase()}</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1 ${ROLE_COLOR[currentUser.role]}`}>
          {ROLE_LABEL[currentUser.role]}
        </span>
        <p className="text-lg font-black text-gray-900">{currentUser.username}</p>
        <p className="text-sm text-gray-400">{currentUser.email}</p>
      </div>

      <div className="space-y-4">

        {/* ── 帳號資訊 ── */}
        <section>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">帳號資訊</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-400 font-bold">電子信箱</p>
                <p className="text-sm font-bold text-gray-700 truncate">{currentUser.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-400 font-bold">使用者名稱</p>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input autoFocus value={newUsername} onChange={e => setNewUsername(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                      className="flex-1 text-sm font-bold border-b-2 border-red-400 outline-none bg-transparent py-0.5" maxLength={30} />
                    <button onClick={handleSaveName} disabled={nameLoading} className="text-green-500 hover:text-green-600"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <p className={`text-sm font-bold ${nameSuccess ? 'text-green-600' : 'text-gray-700'}`}>
                    {nameSuccess ? '✓ 已更新' : currentUser.username}
                  </p>
                )}
                {nameError && <p className="text-[11px] text-red-500 mt-0.5">{nameError}</p>}
              </div>
              {!editingName && (
                <button onClick={() => { setNewUsername(currentUser.username); setNameError(''); setEditingName(true); }}
                  className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── 興趣與最愛 ── */}
        <section>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">興趣與最愛</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-3">選擇你關注的運動項目，並設定最愛球隊</p>

            {SPORTS_CONFIG.map(sport => {
              const isSelected = localSports.includes(sport.key);
              const favTeams = localFavTeams[sport.key] ?? [];
              return (
                <div key={sport.key} className="mb-3 last:mb-0">
                  {/* Sport toggle */}
                  <button
                    onClick={() => toggleSport(sport.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition border ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <span>{sport.emoji}</span>
                    <span>{sport.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Team chips */}
                  {isSelected && sport.teams.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-2">
                      {sport.teams.map(team => {
                        const isFav = favTeams.includes(team);
                        return (
                          <button
                            key={team}
                            onClick={() => toggleFavTeam(sport.key, team)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition border ${
                              isFav
                                ? 'bg-red-50 text-red-600 border-red-300'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-red-200'
                            }`}
                          >
                            {isFav && <Heart className="w-2.5 h-2.5 fill-red-500 text-red-500" />}
                            {team}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {isSelected && sport.teams.length === 0 && (
                    <p className="text-[11px] text-gray-400 mt-1 ml-2">敬請期待球隊選擇</p>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleSavePrefs}
              disabled={prefSaving}
              className="mt-4 w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-black rounded-xl transition"
            >
              {prefSaving ? '儲存中...' : prefSuccess ? '✓ 已儲存' : '儲存設定'}
            </button>
          </div>
        </section>

        {/* ── 安全性 ── */}
        <section>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">安全性</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => { setShowPwSection(v => !v); setPwError(''); setPwSuccess(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
              <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-sm font-bold text-gray-700">變更密碼</span>
              <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${showPwSection ? 'rotate-90' : ''}`} />
            </button>
            {showPwSection && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
                {(['目前密碼', '新密碼', '確認新密碼'] as const).map((label, i) => {
                  const val = [currentPw, newPw, confirmPw][i];
                  const setter = [setCurrentPw, setNewPw, setConfirmPw][i];
                  return (
                    <div key={label}>
                      <label className="text-[11px] font-bold text-gray-400">{label}</label>
                      <input type="password" value={val} onChange={e => setter(e.target.value)}
                        placeholder={i === 1 ? '至少 6 個字元' : ''}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-red-400 transition" />
                    </div>
                  );
                })}
                {pwError && <p className="text-[12px] text-red-500 font-bold">{pwError}</p>}
                {pwSuccess && <p className="text-[12px] text-green-600 font-bold">✓ 密碼已成功更新</p>}
                <button onClick={handleChangePassword} disabled={pwLoading}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-black rounded-xl transition">
                  {pwLoading ? '更新中...' : '確認變更'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── 後台 ── */}
        {(currentUser.role === 'admin' || currentUser.role === 'editor') && (
          <section>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">管理</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="flex-1 text-sm font-bold text-gray-700">進入後台管理</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </section>
        )}

        {/* ── 登出 ── */}
        <section>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition text-left group">
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500 flex-shrink-0 transition" />
              <span className="flex-1 text-sm font-bold text-gray-700 group-hover:text-red-600 transition">登出</span>
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
