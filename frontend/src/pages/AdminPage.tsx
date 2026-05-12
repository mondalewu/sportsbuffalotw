import React, { useState, useEffect } from 'react';
import VideoUploadTrimmer from '../components/VideoUploadTrimmer';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ScraperStatusCard from '../components/ScraperStatusCard';
import { getArticles, createArticle, updateArticle, deleteArticle, fetchExternalNews, uploadArticleImages, deleteArticleImage } from '../api/articles';
import { getGames, updateGame, addPlayByPlay } from '../api/games';
import { getAllPolls, createPoll, updatePoll, deletePoll, addPollOption, deletePollOption, getAdminAnalytics } from '../api/polls';
import type { Poll, AdminAnalytics } from '../api/polls';
import { getScraperStatus, triggerScraper, triggerNpbScraper, triggerPbpBackfill, importGames, triggerYahooFarmScraper, triggerYahooFarmScheduleScraper, backfillDocomoPitch, backfillYahooBatterStats, triggerBatchYahooBackfill, getBatchYahooBackfillStatus } from '../api/scraper';
import type { BatchYahooBackfillStatus } from '../api/scraper';
import type { AllScraperStatus, ImportGameItem } from '../api/scraper';
import { getAds, createAd, updateAd } from '../api/ads';
import type { Article, ArticleImage, Game, AdPlacement } from '../types';

export default function AdminPage() {
  const { currentUser, setAuthModal } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [adminTab, setAdminTab] = useState<'article' | 'game' | 'pbp' | 'poll' | 'analytics' | 'scraper' | 'ad' | 'stories' | 'videos'>('article');

  // 支援 ?tab= URL 參數直接切換 tab
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['article','game','pbp','poll','analytics','scraper','ad','stories','videos'].includes(t)) {
      setAdminTab(t as typeof adminTab);
    }
  }, [searchParams]);

  // Stories
  interface StoryClipForm { id?: number; background_image_url: string; video_url: string; score: string; situation: string; key_play: string; ai_insight: string; duration_ms: number; clip_order: number; }
  interface StoryForm { id?: number; home_team: string; away_team: string; home_abbr: string; away_abbr: string; home_color: string; away_color: string; league: string; is_live: boolean; is_active: boolean; sort_order: number; clips: StoryClipForm[]; }
  const BLANK_CLIP: StoryClipForm = { background_image_url: '', video_url: '', score: '', situation: '', key_play: '', ai_insight: '', duration_ms: 6000, clip_order: 0 };
  const BLANK_STORY: StoryForm = { home_team: '', away_team: '', home_abbr: '', away_abbr: '', home_color: '#CC0000', away_color: '#002D72', league: 'CPBL', is_live: true, is_active: true, sort_order: 0, clips: [{ ...BLANK_CLIP }] };
  const [stories, setStories] = useState<StoryForm[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [editingStory, setEditingStory] = useState<StoryForm | null>(null);
  const [showStoryForm, setShowStoryForm] = useState(false);
  // Video upload zone state
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadedVideos, setUploadedVideos] = useState<{ url: string; name: string; duration: number }[]>([]);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [adminMsg, setAdminMsg] = useState('');

  // Article state
  const [articles, setArticles] = useState<Article[]>([]);
  const [newArticle, setNewArticle] = useState({ title: '', category: 'CPBL', imageUrl: '', summary: '', content: '' });
  const [editingAdminArticle, setEditingAdminArticle] = useState<Article | null>(null);
  const [articleFilterCat, setArticleFilterCat] = useState('全部');
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);
  const [expandedContent, setExpandedContent] = useState('');
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [articleImages, setArticleImages] = useState<ArticleImage[]>([]);
  const [imgUploading, setImgUploading] = useState(false);

  // Game state
  const [adminGames, setAdminGames] = useState<Game[]>([]);
  const [adminGamesLoading, setAdminGamesLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gameUpdate, setGameUpdate] = useState({ score_home: '', score_away: '', status: '', game_detail: '' });
  const [pbpForm, setPbpForm] = useState({
    inning: 1, is_top: true, batter_name: '', pitcher_name: '', situation: '', result_text: '', score_home: 0, score_away: 0
  });

  // Poll state
  const [adminPolls, setAdminPolls] = useState<Poll[]>([]);
  const [newPollForm, setNewPollForm] = useState({ question: '', category: 'general', ends_at: '', options: ['', ''] });
  const [editingPollId, setEditingPollId] = useState<number | null>(null);
  const [newOptionText, setNewOptionText] = useState('');

  // Analytics state
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Scraper state
  const [scraperStatus, setScraperStatus] = useState<AllScraperStatus | null>(null);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperMsg, setScraperMsg] = useState('');
  const [scraperLogs, setScraperLogs] = useState<Array<{ time: string; msg: string; type: 'success' | 'error' | 'warn' }>>([]);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [showBackfillDocomo, setShowBackfillDocomo] = useState(false);
  const [backfillDocomoForm, setBackfillDocomoForm] = useState({ docomoGameId: '', dbGameId: '' });
  const [backfillDocomoLoading, setBackfillDocomoLoading] = useState(false);
  const [showBackfillYahoo, setShowBackfillYahoo] = useState(false);
  const [backfillYahooForm, setBackfillYahooForm] = useState({ yahooGameId: '', dbGameId: '' });
  const [backfillYahooLoading, setBackfillYahooLoading] = useState(false);
  const [batchYahooLoading, setBatchYahooLoading] = useState(false);
  const [batchYahooStatus, setBatchYahooStatus] = useState<BatchYahooBackfillStatus | null>(null);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameSearchResults, setGameSearchResults] = useState<Array<{ id: number; team_home: string; team_away: string; game_date: string; yahoo_game_id: string | null }>>([]);

  // Ad state
  const [ads, setAds] = useState<AdPlacement[]>([]);
  const [adForm, setAdForm] = useState({ name: '', type: 'CPD' as 'CPD' | 'CPM', position: 'sidebar', image_url: '', link_url: '', client_name: '', ad_code: '', start_date: '', end_date: '' });
  const [editingAdId, setEditingAdId] = useState<number | null>(null);

  const loadAds = () => getAds().then(setAds).catch(() => {});

  const loadStories = () => {
    setStoriesLoading(true);
    fetch('/api/v1/stories/admin', { credentials: 'include' })
      .then(r => r.json()).then(d => setStories(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setStoriesLoading(false));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveStory = async (form: any) => {
    const headers = { 'Content-Type': 'application/json' };
    try {
      let storyId = form.id;
      if (storyId) {
        await fetch(`/api/v1/stories/${storyId}`, { method: 'PUT', headers, credentials: 'include', body: JSON.stringify(form) });
      } else {
        const r = await fetch('/api/v1/stories', { method: 'POST', headers, credentials: 'include', body: JSON.stringify(form) });
        storyId = (await r.json()).id;
      }
      if (!storyId) throw new Error('無法取得 ID');
      const existing = (stories.find((s: StoryForm) => s.id === storyId)?.clips ?? []) as StoryClipForm[];
      for (const c of existing) {
        if (c.id) await fetch(`/api/v1/stories/${storyId}/clips/${c.id}`, { method: 'DELETE', headers, credentials: 'include' });
      }
      for (let i = 0; i < form.clips.length; i++) {
        const c = form.clips[i];
        if (!c.background_image_url.trim()) continue;
        await fetch(`/api/v1/stories/${storyId}/clips`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ ...c, clip_order: i }) });
      }
      showMsg('✅ Story 已儲存'); setShowStoryForm(false); setEditingStory(null); loadStories();
    } catch { showMsg('❌ 儲存失敗'); }
  };

  const deleteStory = async (id: number) => {
    if (!confirm('確定刪除？')) return;
    await fetch(`/api/v1/stories/${id}`, { method: 'DELETE', credentials: 'include' });
    showMsg('✅ 已刪除'); loadStories();
  };

  const uploadVideo = async (file: File) => {
    if (!file) return;
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      const r = await fetch('/api/v1/stories/upload', { method: 'POST', credentials: 'include', body: fd });
      if (!r.ok) throw new Error('上傳失敗');
      const { url } = await r.json();
      setUploadedVideos(prev => [{ url, name: file.name, duration: 0 }, ...prev]);
      showMsg('✅ 影片上傳成功');
    } catch {
      showMsg('❌ 影片上傳失敗');
    } finally {
      setUploadingVideo(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const showMsg = (msg: string) => { setAdminMsg(msg); setTimeout(() => setAdminMsg(''), 3000); };

  const loadArticles = () => {
    getArticles({ limit: 50 }).then(setArticles).catch(() => {});
  };

  const loadAdminGames = () => {
    setAdminGamesLoading(true);
    getGames({ league: 'CPBL' }).then(data => {
      setAdminGames(data.slice(0, 50));
      setAdminGamesLoading(false);
    }).catch(() => setAdminGamesLoading(false));
  };

  const addLog = (msg: string, type: 'success' | 'error' | 'warn' = 'success') => {
    const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setScraperLogs(prev => [{ time, msg, type }, ...prev].slice(0, 60));
  };

  const handleTabChange = (tab: typeof adminTab) => {
    setAdminTab(tab);
    setAdminMsg('');
    if (tab === 'article') loadArticles();
    if (tab === 'game' || tab === 'pbp') loadAdminGames();
    if (tab === 'poll') getAllPolls().then(setAdminPolls).catch(() => {});
    if (tab === 'analytics') { setAnalyticsLoading(true); getAdminAnalytics().then(setAnalytics).finally(() => setAnalyticsLoading(false)); }
    if (tab === 'scraper') { setScraperLoading(true); getScraperStatus().then(setScraperStatus).finally(() => setScraperLoading(false)); }
    if (tab === 'ad') loadAds();
    if (tab === 'stories') loadStories();
  };

  const handlePublishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAdminArticle) {
        await updateArticle(editingAdminArticle.id, {
          title: newArticle.title, category: newArticle.category,
          summary: newArticle.summary, content: newArticle.content, image_url: newArticle.imageUrl,
        });
        setEditingAdminArticle(null);
        showMsg('✅ 文章已更新');
      } else {
        await createArticle({
          title: newArticle.title, category: newArticle.category,
          summary: newArticle.summary, content: newArticle.content, image_url: newArticle.imageUrl,
        });
        showMsg('✅ 文章已發布');
      }
      setNewArticle({ title: '', category: 'CPBL', imageUrl: '', summary: '', content: '' });
      loadArticles();
    } catch {
      showMsg('❌ 操作失敗，請確認登入狀態');
    }
  };

  const handleGameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGameId) return;
    try {
      const payload: Record<string, unknown> = {};
      if (gameUpdate.score_home !== '') payload.score_home = Number(gameUpdate.score_home);
      if (gameUpdate.score_away !== '') payload.score_away = Number(gameUpdate.score_away);
      if (gameUpdate.status !== '') payload.status = gameUpdate.status;
      if (gameUpdate.game_detail !== '') payload.game_detail = gameUpdate.game_detail;
      await updateGame(selectedGameId, payload);
      showMsg('✅ 比賽資料已更新');
      loadAdminGames();
    } catch {
      showMsg('❌ 更新失敗，請確認登入狀態');
    }
  };

  const handleAddPbp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGameId) return;
    try {
      await addPlayByPlay(selectedGameId, {
        inning: pbpForm.inning, is_top: pbpForm.is_top,
        batter_name: pbpForm.batter_name || undefined,
        pitcher_name: pbpForm.pitcher_name || undefined,
        situation: pbpForm.situation || undefined,
        result_text: pbpForm.result_text,
        score_home: pbpForm.score_home, score_away: pbpForm.score_away,
      });
      showMsg('✅ 速報事件已新增');
      setPbpForm(f => ({ ...f, result_text: '', situation: '' }));
    } catch {
      showMsg('❌ 新增失敗，請確認登入狀態');
    }
  };

  const handleFetchExternalNews = async () => {
    setIsFetchingNews(true);
    try {
      await fetchExternalNews();
      loadArticles();
      showMsg('✅ 外部新聞已拉取');
    } catch {
      showMsg('❌ 拉取失敗');
    } finally {
      setIsFetchingNews(false);
    }
  };

  if (!currentUser) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
          <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
        </button>
        <div className="bg-yellow-50 border border-yellow-200 p-8 rounded-3xl text-center">
          <p className="font-black text-lg mb-4">請先登入才能使用後台功能</p>
          <button onClick={() => setAuthModal('login')} className="bg-red-600 text-white px-8 py-3 rounded-full font-black hover:bg-red-700 transition">立即登入</button>
        </div>
      </main>
    );
  }

  if (currentUser.role === 'member') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
          <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
        </button>
        <div className="bg-red-50 border border-red-200 p-8 rounded-3xl text-center">
          <p className="font-black text-lg text-red-600">您的帳號沒有編輯權限</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>
      <h1 className="text-4xl font-black italic mb-8">後台管理 <span className="text-red-600">CMS</span></h1>

      <div className="space-y-6">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {([['article','📰 文章管理'], ['game','⚾ 比賽管理'], ['pbp','📡 文本速報'], ['poll','🗳️ 投票管理'], ['analytics','📊 數據分析'], ['scraper','🤖 爬蟲控制'], ['ad','📢 廣告管理'], ['stories','🎬 限時動態'], ['videos','▶️ 影片管理']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`px-5 py-2 rounded-xl font-black text-sm border transition-all ${adminTab === tab ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>

        {adminMsg && (
          <div className={`px-4 py-3 rounded-xl font-bold text-sm ${adminMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {adminMsg}
          </div>
        )}

        {/* === 文章管理 === */}
        {adminTab === 'article' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black">{editingAdminArticle ? '✏️ 編輯文章' : '發布新文章'}</h2>
                <div className="flex items-center gap-3">
                  {editingAdminArticle && (
                    <button onClick={() => { setEditingAdminArticle(null); setNewArticle({ title: '', category: 'CPBL', imageUrl: '', summary: '', content: '' }); setArticleImages([]); }}
                      className="text-sm font-bold text-gray-400 hover:text-red-600 transition">✕ 取消編輯</button>
                  )}
                  {!editingAdminArticle && (
                    <button onClick={handleFetchExternalNews} disabled={isFetchingNews} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-red-600 transition border border-gray-200 px-4 py-2 rounded-xl">
                      <RefreshCw className={`w-4 h-4 ${isFetchingNews ? 'animate-spin' : ''}`} />
                      {isFetchingNews ? '拉取中...' : '從外部拉取新聞'}
                    </button>
                  )}
                </div>
              </div>
              <form onSubmit={handlePublishNews} className="space-y-4">
                <input type="text" placeholder="文章標題" value={newArticle.title} required
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
                  <img src={newArticle.imageUrl} alt="預覽" className="w-full h-40 object-cover rounded-xl"
                    referrerPolicy="no-referrer" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <textarea placeholder="文章摘要" value={newArticle.summary} rows={2}
                  onChange={e => setNewArticle(f => ({ ...f, summary: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none" />
                <textarea placeholder="文章內文（支援 Markdown）" value={newArticle.content} required rows={8}
                  onChange={e => setNewArticle(f => ({ ...f, content: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none font-mono" />
                <button type="submit" className={`w-full py-3 rounded-xl font-black transition ${editingAdminArticle ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                  {editingAdminArticle ? '儲存更新' : '發布文章'}
                </button>
              </form>

              {/* ─── 多圖管理（僅編輯現有文章時顯示）─────────────── */}
              {editingAdminArticle && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="font-black text-gray-700 mb-3">相關圖片管理</h3>

                  {/* 已上傳圖片預覽 */}
                  {articleImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {articleImages.map(img => (
                        <div key={img.id} className="relative group aspect-video bg-gray-100 rounded-xl overflow-hidden">
                          <img src={img.image_url} alt={img.caption || ''} className="w-full h-full object-cover" />
                          <button
                            onClick={async () => {
                              if (!confirm('刪除此圖片？')) return;
                              try {
                                await deleteArticleImage(editingAdminArticle.id, img.id);
                                setArticleImages(prev => prev.filter(i => i.id !== img.id));
                                showMsg('✅ 圖片已刪除');
                              } catch { showMsg('❌ 刪除失敗'); }
                            }}
                            className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 上傳按鈕 */}
                  <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed cursor-pointer transition
                    ${imgUploading ? 'border-gray-200 text-gray-300' : 'border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-500'}`}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <span className="text-sm font-bold">{imgUploading ? '上傳中...' : '選擇圖片上傳（最多 10 張）'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={imgUploading}
                      className="hidden"
                      onChange={async e => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        setImgUploading(true);
                        try {
                          const newImgs = await uploadArticleImages(editingAdminArticle.id, files);
                          setArticleImages(prev => [...prev, ...newImgs]);
                          showMsg(`✅ 上傳 ${newImgs.length} 張圖片成功`);
                        } catch { showMsg('❌ 圖片上傳失敗'); }
                        finally { setImgUploading(false); e.target.value = ''; }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black">已發布文章（{articles.filter(a => articleFilterCat === '全部' || a.category === articleFilterCat).length}）</h2>
                <button onClick={loadArticles} className="text-sm font-bold text-gray-400 hover:text-red-600 transition">↻ 重新整理</button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['全部', 'CPBL', 'NPB', 'WBC', 'MLB', 'NBA', '其他'].map(cat => (
                  <button key={cat} onClick={() => setArticleFilterCat(cat)}
                    className={`text-xs font-black px-3 py-1.5 rounded-full border transition ${articleFilterCat === cat ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-600'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {articles.filter(a => articleFilterCat === '全部' || a.category === articleFilterCat).map(a => (
                  <div key={a.id} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                      onClick={() => {
                        if (expandedArticleId === a.id) { setExpandedArticleId(null); }
                        else { setExpandedArticleId(a.id); setExpandedContent(a.content || ''); }
                      }}>
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
                          <span className="text-[10px] text-gray-300 ml-auto">{expandedArticleId === a.id ? '▲' : '▼'}</span>
                        </div>
                        <p className="font-bold text-sm text-gray-800 truncate">{a.title}</p>
                        {a.summary && <p className="text-xs text-gray-400 truncate mt-0.5">{a.summary}</p>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={async () => {
                          setEditingAdminArticle(a);
                          setNewArticle({ title: a.title, category: a.category, imageUrl: a.image_url || '', summary: a.summary || '', content: a.content || '' });
                          // load existing images
                          try {
                            const res = await fetch(`/api/v1/articles/${a.id}/images`, { credentials: 'include' });
                            const imgs = await res.json();
                            setArticleImages(Array.isArray(imgs) ? imgs : []);
                          } catch { setArticleImages([]); }
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} className="text-xs font-bold px-3 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">✏️ 編輯</button>
                        <button onClick={async () => {
                          if (!confirm('確定刪除此文章？')) return;
                          try {
                            await deleteArticle(a.id);
                            showMsg('✅ 文章已刪除');
                            loadArticles();
                            if (editingAdminArticle?.id === a.id) setEditingAdminArticle(null);
                            if (expandedArticleId === a.id) setExpandedArticleId(null);
                          } catch { showMsg('❌ 刪除失敗'); }
                        }} className="text-xs font-bold px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">🗑 刪除</button>
                      </div>
                    </div>
                    {expandedArticleId === a.id && (
                      <div className="bg-white p-4 border-t border-gray-100">
                        <p className="text-xs font-black text-gray-400 mb-2">內文（直接編輯後儲存）</p>
                        <textarea value={expandedContent} onChange={e => setExpandedContent(e.target.value)} rows={8}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none font-mono" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={async () => {
                            try {
                              await updateArticle(a.id, { content: expandedContent });
                              showMsg('✅ 內文已更新');
                              loadArticles();
                              setExpandedArticleId(null);
                            } catch { showMsg('❌ 更新失敗'); }
                          }} className="text-xs font-black px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">💾 儲存內文</button>
                          <button onClick={() => setExpandedArticleId(null)} className="text-xs font-bold px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition">取消</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {articles.filter(a => articleFilterCat === '全部' || a.category === articleFilterCat).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">尚無文章</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === 比賽管理 === */}
        {adminTab === 'game' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-4">選擇比賽</h2>
              {adminGamesLoading ? (
                <p className="text-gray-400 text-sm">載入中...</p>
              ) : (
                <select value={selectedGameId ?? ''} onChange={e => {
                  const id = Number(e.target.value);
                  setSelectedGameId(id || null);
                  const g = adminGames.find(g => g.id === id);
                  if (g) setGameUpdate({ score_home: g.score_home?.toString() ?? '', score_away: g.score_away?.toString() ?? '', status: g.status, game_detail: g.game_detail ?? '' });
                }} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                  <option value="">— 請選擇 CPBL 比賽 —</option>
                  {adminGames.map(g => (
                    <option key={g.id} value={g.id}>
                      #{g.game_detail || '?'} {new Date(g.game_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} {g.team_away} vs {g.team_home} [{g.status}]
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedGameId && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black mb-6">更新比分 / 狀態</h2>
                <form onSubmit={handleGameUpdate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">客隊得分</label>
                      <input type="number" min={0} value={gameUpdate.score_away} onChange={e => setGameUpdate(f => ({ ...f, score_away: e.target.value }))} placeholder="客隊得分" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">主隊得分</label>
                      <input type="number" min={0} value={gameUpdate.score_home} onChange={e => setGameUpdate(f => ({ ...f, score_home: e.target.value }))} placeholder="主隊得分" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">比賽狀態</label>
                      <select value={gameUpdate.status} onChange={e => setGameUpdate(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                        <option value="scheduled">賽前 (scheduled)</option>
                        <option value="live">進行中 (live)</option>
                        <option value="final">終場 (final)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">局面說明</label>
                      <input type="text" value={gameUpdate.game_detail} onChange={e => setGameUpdate(f => ({ ...f, game_detail: e.target.value }))} placeholder="例：7局上、延長10局" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-gray-800 text-white py-3 rounded-xl font-black hover:bg-black transition">更新比賽資料</button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* === 文本速報 === */}
        {adminTab === 'pbp' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-4">選擇比賽</h2>
              {adminGamesLoading ? <p className="text-gray-400 text-sm">載入中...</p> : (
                <select value={selectedGameId ?? ''} onChange={e => setSelectedGameId(Number(e.target.value) || null)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                  <option value="">— 請選擇比賽 —</option>
                  {adminGames.filter(g => g.status === 'live' || g.status === 'final').map(g => (
                    <option key={g.id} value={g.id}>
                      #{g.game_detail || '?'} {new Date(g.game_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} {g.team_away} vs {g.team_home} [{g.status}]
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedGameId && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black mb-6">新增速報事件</h2>
                <form onSubmit={handleAddPbp} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">局數</label>
                      <input type="number" min={1} max={15} value={pbpForm.inning} onChange={e => setPbpForm(f => ({ ...f, inning: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">上/下半局</label>
                      <select value={pbpForm.is_top ? 'top' : 'bot'} onChange={e => setPbpForm(f => ({ ...f, is_top: e.target.value === 'top' }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                        <option value="top">上半局（客隊攻）</option>
                        <option value="bot">下半局（主隊攻）</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">局面</label>
                      <input type="text" value={pbpForm.situation} placeholder="例：一死一三壘" onChange={e => setPbpForm(f => ({ ...f, situation: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">打者</label>
                      <input type="text" value={pbpForm.batter_name} placeholder="打者姓名" onChange={e => setPbpForm(f => ({ ...f, batter_name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">投手</label>
                      <input type="text" value={pbpForm.pitcher_name} placeholder="投手姓名" onChange={e => setPbpForm(f => ({ ...f, pitcher_name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">事件描述 *</label>
                    <textarea value={pbpForm.result_text} required placeholder="例：林子傑 右外野三壘打，陳重羽 得分" rows={2} onChange={e => setPbpForm(f => ({ ...f, result_text: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">客隊當前得分</label>
                      <input type="number" min={0} value={pbpForm.score_away} onChange={e => setPbpForm(f => ({ ...f, score_away: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-1">主隊當前得分</label>
                      <input type="number" min={0} value={pbpForm.score_home} onChange={e => setPbpForm(f => ({ ...f, score_home: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition">新增速報事件</button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* === 投票管理 === */}
        {adminTab === 'poll' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-6">新增投票主題</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const opts = newPollForm.options.filter(o => o.trim());
                if (opts.length < 2) { showMsg('❌ 至少需要兩個選項'); return; }
                try {
                  await createPoll({ question: newPollForm.question, category: newPollForm.category, ends_at: newPollForm.ends_at || undefined, options: opts });
                  setNewPollForm({ question: '', category: 'general', ends_at: '', options: ['', ''] });
                  showMsg('✅ 投票已建立');
                  getAllPolls().then(setAdminPolls);
                } catch { showMsg('❌ 建立失敗'); }
              }} className="space-y-4">
                <input type="text" required placeholder="投票題目" value={newPollForm.question} onChange={e => setNewPollForm(f => ({ ...f, question: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">分類</label>
                    <select value={newPollForm.category} onChange={e => setNewPollForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                      {['general', 'CPBL', 'NPB', 'WBC', 'MLB'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">截止時間（選填）</label>
                    <input type="datetime-local" value={newPollForm.ends_at} onChange={e => setNewPollForm(f => ({ ...f, ends_at: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black text-gray-500">選項（至少2項）</label>
                  {newPollForm.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={opt} placeholder={`選項 ${i + 1}`} onChange={e => setNewPollForm(f => { const o = [...f.options]; o[i] = e.target.value; return { ...f, options: o }; })} className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400" />
                      {newPollForm.options.length > 2 && (
                        <button type="button" onClick={() => setNewPollForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 px-2 font-bold">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewPollForm(f => ({ ...f, options: [...f.options, ''] }))} className="text-sm font-bold text-gray-500 hover:text-red-600 transition">+ 新增選項</button>
                </div>
                <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition">建立投票</button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black">投票清單 ({adminPolls.length})</h2>
                <button onClick={() => getAllPolls().then(setAdminPolls)} className="text-sm font-bold text-gray-400 hover:text-red-600 transition flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" /> 重新整理
                </button>
              </div>
              <div className="space-y-4">
                {adminPolls.map(poll => (
                  <div key={poll.id} className="p-4 border border-gray-100 rounded-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${poll.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{poll.is_active ? '進行中' : '已關閉'}</span>
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
                                  getAllPolls().then(setAdminPolls);
                                }
                              }} className="text-red-300 hover:text-red-500 ml-1">✕</button>
                            </div>
                          ))}
                        </div>
                        {editingPollId === poll.id && (
                          <div className="mt-2 flex gap-2">
                            <input type="text" value={newOptionText} placeholder="新選項文字" onChange={e => setNewOptionText(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                            <button onClick={async () => {
                              if (!newOptionText.trim()) return;
                              await addPollOption(poll.id, newOptionText);
                              setNewOptionText(''); setEditingPollId(null);
                              getAllPolls().then(setAdminPolls);
                            }} className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">新增</button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={async () => { await updatePoll(poll.id, { is_active: !poll.is_active }); getAllPolls().then(setAdminPolls); }} className={`text-xs font-bold px-3 py-1 rounded-lg border transition ${poll.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>{poll.is_active ? '關閉' : '開啟'}</button>
                        <button onClick={() => setEditingPollId(editingPollId === poll.id ? null : poll.id)} className="text-xs font-bold px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition">+ 選項</button>
                        <button onClick={async () => {
                          if (confirm('確定刪除此投票及所有票數？')) {
                            await deletePoll(poll.id);
                            getAllPolls().then(setAdminPolls);
                            showMsg('✅ 投票已刪除');
                          }
                        }} className="text-xs font-bold px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">刪除</button>
                      </div>
                    </div>
                  </div>
                ))}
                {adminPolls.length === 0 && <p className="text-gray-400 text-sm text-center py-8">尚無投票</p>}
              </div>
            </div>
          </div>
        )}

        {/* === 爬蟲控制 === */}
        {adminTab === 'scraper' && (
          <div className="space-y-5">
            {/* 頂部操作列 */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900">爬蟲控制台</h2>
              <button
                onClick={() => { setScraperLoading(true); getScraperStatus().then(setScraperStatus).finally(() => setScraperLoading(false)); }}
                className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition"
              >
                <RefreshCw className={`w-4 h-4 ${scraperLoading ? 'animate-spin' : ''}`} />
                重新整理狀態
              </button>
            </div>

            {/* 活動紀錄 */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-white font-black text-sm">活動紀錄</span>
                  {scraperLogs.length > 0 && <span className="text-gray-500 text-xs">({scraperLogs.length})</span>}
                </div>
                {scraperLogs.length > 0 && (
                  <button onClick={() => setScraperLogs([])} className="text-xs text-gray-500 hover:text-gray-300 transition">清除</button>
                )}
              </div>
              <div className="h-36 overflow-y-auto space-y-0.5 pr-1">
                {scraperLogs.length === 0 ? (
                  <p className="text-gray-500 text-xs py-4 text-center">觸發爬蟲後，執行紀錄將顯示於此</p>
                ) : scraperLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-xs font-mono leading-5">
                    <span className="text-gray-500 flex-shrink-0 tabular-nums">{log.time}</span>
                    <span className={log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-300' : 'text-green-300'}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 錯誤面板（只在有錯誤時顯示） */}
            {scraperStatus && (() => {
              const errs = Object.entries(scraperStatus).filter(([, v]) => v && typeof v === 'object' && (v as Record<string, unknown>).lastError);
              if (!errs.length) return null;
              return (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <h3 className="font-black text-red-700 text-sm mb-2 flex items-center gap-2">⚠ 爬蟲發生錯誤</h3>
                  <div className="space-y-1">
                    {errs.map(([key, v]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="font-bold text-red-600 flex-shrink-0 w-28">{key}</span>
                        <span className="text-red-500 truncate">{(v as Record<string, unknown>).lastError as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── CPBL 欄位 ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-sm">中</div>
                <div>
                  <h2 className="text-white font-black text-base">CPBL 中華職棒</h2>
                  <p className="text-red-200 text-xs">資料來源：cpbl.com.tw</p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">

                {/* CPBL 比分爬蟲 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.cpbl?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.cpbl?.lastError ? 'bg-red-500' : scraperStatus?.cpbl?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">比分爬蟲</span>
                      {scraperStatus?.cpbl?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">今日 CPBL 一軍比賽即時比分</p>
                    {scraperStatus?.cpbl?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.cpbl.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.cpbl?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.cpbl.lastError}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.cpbl?.isRunning} onClick={async () => {
                    addLog('▶ CPBL 比分爬蟲啟動', 'warn');
                    try { const res = await triggerScraper(); addLog(res.message, 'success'); getScraperStatus().then(setScraperStatus); }
                    catch { addLog('✗ CPBL 比分爬蟲執行失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.cpbl?.isRunning ? 'animate-spin' : ''}`} /> 立即執行
                  </button>
                </div>

                {/* CPBL 二軍賽程 — 手動匯入（CPBL API 不提供二軍資料） */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                        <span className="font-bold text-sm text-gray-800">二軍賽程（手動匯入）</span>
                      </div>
                      <p className="text-xs text-gray-400 ml-4 mt-0.5">CPBL 官方 API 不提供二軍資料，請貼上 JSON 手動匯入</p>
                    </div>
                    <button onClick={() => setShowImportPanel(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition flex-shrink-0">
                      {showImportPanel ? '關閉' : '匯入資料'}
                    </button>
                  </div>

                  {showImportPanel && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono leading-relaxed">
                        <p className="font-bold text-gray-800 mb-1">JSON 格式範例：</p>
                        <pre className="whitespace-pre-wrap text-[11px]">{`[
  { "date":"2026-03-26","time":"14:05","away":"統一獅","home":"台鋼雄鷹","venue":"皇鷹學院","gameNo":"001" },
  { "date":"2026-03-26","time":"14:05","away":"富邦悍將","home":"味全龍","venue":"斗六","gameNo":"002" }
]`}</pre>
                        <p className="mt-1 text-gray-500">league 預設為 CPBL-B。球隊名稱：中信兄弟、統一獅、富邦悍將、樂天桃猿、台鋼雄鷹、味全龍</p>
                      </div>
                      <textarea
                        value={importJson}
                        onChange={e => setImportJson(e.target.value)}
                        placeholder="在此貼上 JSON 陣列..."
                        className="w-full h-40 text-xs font-mono border border-gray-300 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={importLoading || !importJson.trim()}
                          onClick={async () => {
                            try {
                              const games: ImportGameItem[] = JSON.parse(importJson);
                              setImportLoading(true);
                              const result = await importGames(games);
                              addLog(`✓ 二軍匯入：${result.message}`, 'success');
                              setImportJson('');
                              setShowImportPanel(false);
                            } catch (e) {
                              addLog(`✗ 匯入失敗：${(e as Error).message}`, 'error');
                            } finally {
                              setImportLoading(false);
                            }
                          }}
                          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition">
                          {importLoading ? '匯入中...' : '確認匯入'}
                        </button>
                        <button onClick={() => { setImportJson(''); setShowImportPanel(false); }}
                          className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 transition">
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* CPBL 整季賽程 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.cpblSchedule?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.cpblSchedule?.lastError ? 'bg-red-500' : scraperStatus?.cpblSchedule?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">整季賽程</span>
                      {scraperStatus?.cpblSchedule?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">3〜11 月完整熱身賽及例行賽賽程</p>
                    {scraperStatus?.cpblSchedule?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.cpblSchedule.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.cpblSchedule?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.cpblSchedule.lastError}</p>}
                    <p className="text-xs text-orange-500 ml-4 font-bold">⚠ 背景執行，逐日查詢（3〜5 分鐘）</p>
                  </div>
                  <button disabled={!!scraperStatus?.cpblSchedule?.isRunning} onClick={async () => {
                    addLog('▶ CPBL 整季賽程爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-cpbl-schedule', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ CPBL 賽程爬蟲啟動失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white rounded-xl text-xs font-bold hover:bg-red-800 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.cpblSchedule?.isRunning ? 'animate-spin' : ''}`} /> 抓取賽程
                  </button>
                </div>

                {/* CPBL 積分榜 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                      <span className="font-bold text-sm text-gray-800">積分榜</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">熱身賽及例行賽 6 支球隊積分榜</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ CPBL 積分榜更新', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-cpbl-standings', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ CPBL 積分榜更新失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 更新積分榜
                  </button>
                </div>

                {/* CPBL 打者賽季成績 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                      <span className="font-bold text-sm text-gray-800">打者賽季成績</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">爬取 CPBL 全體打者當季打擊率、OBP、SLG、OPS</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ CPBL 打者賽季成績更新', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-cpbl-player-stats', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ year: 2026 }),
                      });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ CPBL 打者賽季成績更新失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 更新成績
                  </button>
                </div>

                {/* CPBL 歷史打者成績重刷 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
                      <span className="font-bold text-sm text-gray-800">重刷所有 CPBL 歷史打者成績</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">重新從 CPBL API 抓取所有已結束場次的打者資料（修正打率錯誤用）</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ CPBL 歷史打者成績重刷中...', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/rescrape-cpbl-all', {
                        method: 'POST', credentials: 'include',
                      });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ 重刷失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 重刷全部
                  </button>
                </div>

                {/* CPBL 投手賽季成績 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                      <span className="font-bold text-sm text-gray-800">投手賽季成績</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">爬取/聚合 CPBL 全體投手當季防禦率、勝敗救、局數</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ CPBL 投手賽季成績更新', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-cpbl-pitcher-stats', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ year: 2026 }),
                      });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ CPBL 投手賽季成績更新失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 更新成績
                  </button>
                </div>

                {/* CPBL 球員名冊 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.cpblRoster?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.cpblRoster?.lastError ? 'bg-red-500' : scraperStatus?.cpblRoster?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">球員名冊</span>
                      {scraperStatus?.cpblRoster?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">從 TWBS Wiki 爬取 6 支球隊現役球員資料（含打/投習慣）</p>
                    {scraperStatus?.cpblRoster?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.cpblRoster.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.cpblRoster?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.cpblRoster.lastError}</p>}
                    <p className="text-xs text-orange-500 ml-4 font-bold">⚠ 背景執行，每隊逐一爬取（含個人頁，約 5 分鐘）</p>
                  </div>
                  <button disabled={!!scraperStatus?.cpblRoster?.isRunning} onClick={async () => {
                    addLog('▶ CPBL 球員名冊爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-cpbl-roster', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ CPBL 名冊爬蟲啟動失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.cpblRoster?.isRunning ? 'animate-spin' : ''}`} /> 更新名冊
                  </button>
                </div>
              </div>
            </div>

            {/* ── NPB 欄位 ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-700 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-sm">日</div>
                <div>
                  <h2 className="text-white font-black text-base">NPB 日本職棒</h2>
                  <p className="text-blue-200 text-xs">資料來源：npb.jp</p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">

                {/* NPB 一軍比分 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.npb?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.npb?.lastError ? 'bg-red-500' : scraperStatus?.npb?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">一軍比分爬蟲</span>
                      {scraperStatus?.npb?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">今日 NPB 一軍比賽比分及速報</p>
                    {scraperStatus?.npb?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.npb.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.npb?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.npb.lastError}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.npb?.isRunning} onClick={async () => {
                    addLog('▶ NPB 一軍比分爬蟲啟動', 'warn');
                    try { const res = await triggerNpbScraper(); addLog(res.message, 'success'); getScraperStatus().then(setScraperStatus); }
                    catch { addLog('✗ NPB 爬蟲執行失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.npb?.isRunning ? 'animate-spin' : ''}`} /> 立即執行
                  </button>
                </div>

                {/* NPB 二軍比分 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.npbFarm?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.npbFarm?.lastError ? 'bg-red-500' : scraperStatus?.npbFarm?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">二軍比分爬蟲</span>
                      {scraperStatus?.npbFarm?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">今日 NPB 二軍比賽比分及數據</p>
                    {scraperStatus?.npbFarm?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.npbFarm.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.npbFarm?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.npbFarm.lastError}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.npbFarm?.isRunning} onClick={async () => {
                    addLog('▶ NPB 二軍比分爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-npb-farm', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success'); getScraperStatus().then(setScraperStatus);
                    } catch { addLog('✗ 二軍爬蟲執行失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.npbFarm?.isRunning ? 'animate-spin' : ''}`} /> 立即執行
                  </button>
                </div>

                {/* Yahoo 二軍比分爬蟲 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.yahooFarm?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.yahooFarm?.lastResult?.startsWith('❌') ? 'bg-red-500' : scraperStatus?.yahooFarm?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">Yahoo 二軍比分爬蟲</span>
                      {scraperStatus?.yahooFarm?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">從 Yahoo Baseball 抓取今日二軍各局比分、安打、失策</p>
                    {scraperStatus?.yahooFarm?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.yahooFarm.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.yahooFarm?.lastResult && <p className="text-xs text-gray-500 ml-4 truncate">{scraperStatus.yahooFarm.lastResult}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.yahooFarm?.isRunning} onClick={async () => {
                    addLog('▶ Yahoo 二軍比分爬蟲啟動', 'warn');
                    try {
                      const res = await triggerYahooFarmScraper();
                      addLog(res.message, 'success');
                      getScraperStatus().then(setScraperStatus);
                    } catch { addLog('✗ Yahoo 二軍爬蟲執行失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.yahooFarm?.isRunning ? 'animate-spin' : ''}`} /> 立即執行
                  </button>
                </div>

                {/* Yahoo 二軍月賽程爬蟲 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.yahooFarmSchedule?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.yahooFarmSchedule?.lastError ? 'bg-red-500' : scraperStatus?.yahooFarmSchedule?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">Yahoo 二軍賽程爬蟲</span>
                      {scraperStatus?.yahooFarmSchedule?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">從 Yahoo Baseball 抓取當月 NPB 二軍完整賽程（含已排定場次）</p>
                    {scraperStatus?.yahooFarmSchedule?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.yahooFarmSchedule.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.yahooFarmSchedule?.lastResult && <p className="text-xs text-gray-500 ml-4 truncate">{scraperStatus.yahooFarmSchedule.lastResult}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.yahooFarmSchedule?.isRunning} onClick={async () => {
                    addLog('▶ Yahoo 二軍賽程爬蟲啟動', 'warn');
                    try {
                      const res = await triggerYahooFarmScheduleScraper();
                      addLog(res.message, 'success');
                      getScraperStatus().then(setScraperStatus);
                    } catch { addLog('✗ Yahoo 二軍賽程爬蟲執行失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.yahooFarmSchedule?.isRunning ? 'animate-spin' : ''}`} /> 爬取賽程
                  </button>
                </div>

                {/* NPB 一軍積分榜 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                      <span className="font-bold text-sm text-gray-800">一軍積分榜</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">セントラル・パシフィック聯盟積分榜</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ NPB 積分榜更新', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-npb-standings', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ NPB 積分榜更新失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 更新積分榜
                  </button>
                </div>

                {/* NPB 整季賽程 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.npbSchedule?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.npbSchedule?.lastError ? 'bg-red-500' : scraperStatus?.npbSchedule?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">整季賽程</span>
                      {scraperStatus?.npbSchedule?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">3〜11 月完整例行賽賽程（含開幕戦）</p>
                    {scraperStatus?.npbSchedule?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.npbSchedule.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.npbSchedule?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.npbSchedule.lastError}</p>}
                    <p className="text-xs text-orange-500 ml-4 font-bold">⚠ 耗時較長</p>
                  </div>
                  <button disabled={!!scraperStatus?.npbSchedule?.isRunning} onClick={async () => {
                    addLog('▶ NPB 整季賽程爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-npb-schedule', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ NPB 賽程爬蟲失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.npbSchedule?.isRunning ? 'animate-spin' : ''}`} /> 抓取賽程
                  </button>
                </div>

                {/* NPB 一軍名冊 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.npbRoster?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.npbRoster?.lastError ? 'bg-red-500' : scraperStatus?.npbRoster?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">一軍球員名冊</span>
                      {scraperStatus?.npbRoster?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">12 支球隊現役名冊</p>
                    {scraperStatus?.npbRoster?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.npbRoster.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.npbRoster?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.npbRoster.lastError}</p>}
                    <p className="text-xs text-orange-500 ml-4 font-bold">⚠ 耗時較長（約 60 秒）</p>
                  </div>
                  <button disabled={!!scraperStatus?.npbRoster?.isRunning} onClick={async () => {
                    addLog('▶ NPB 一軍名冊爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-npb-roster', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ NPB 名冊爬蟲失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.npbRoster?.isRunning ? 'animate-spin' : ''}`} /> 更新名冊
                  </button>
                </div>

                {/* NPB 二軍獨立球隊名冊 Yahoo */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.npbFarmRoster?.isRunning ? 'bg-yellow-400 animate-pulse' : scraperStatus?.npbFarmRoster?.lastError ? 'bg-red-500' : scraperStatus?.npbFarmRoster?.lastRun ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">二軍獨立球隊名冊</span>
                      {scraperStatus?.npbFarmRoster?.isRunning && <span className="text-xs text-yellow-600 font-bold animate-pulse">執行中...</span>}
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">從 baseball.yahoo.co.jp 爬取 ハヤテ・オイシックス 名冊</p>
                    {scraperStatus?.npbFarmRoster?.lastRun && <p className="text-xs text-gray-400 ml-4">上次：{new Date(scraperStatus.npbFarmRoster.lastRun).toLocaleString('zh-TW')}</p>}
                    {scraperStatus?.npbFarmRoster?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.npbFarmRoster.lastError}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.npbFarmRoster?.isRunning} onClick={async () => {
                    addLog('▶ 二軍獨立球隊名冊爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-npb-farm-roster', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ 二軍名冊爬蟲失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white rounded-xl text-xs font-bold hover:bg-sky-600 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.npbFarmRoster?.isRunning ? 'animate-spin' : ''}`} /> 更新名冊
                  </button>
                </div>

                {/* Docomo 二軍爬蟲（投球位置 + 打投成績）*/}
                <div className="flex items-center gap-4 px-6 py-4 bg-teal-50/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${scraperStatus?.docomoFarm?.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
                      <span className="font-bold text-sm text-gray-800">Docomo 二軍（今日比分 + 投球位置）</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">抓取今日二軍比賽比分、打投成績、投球位置圖資料</p>
                    {scraperStatus?.docomoFarm?.lastResult && <p className="text-xs text-gray-500 ml-4 truncate">{scraperStatus.docomoFarm.lastResult}</p>}
                    {scraperStatus?.docomoFarm?.lastError && <p className="text-xs text-red-500 ml-4 truncate">{scraperStatus.docomoFarm.lastError}</p>}
                  </div>
                  <button disabled={!!scraperStatus?.docomoFarm?.isRunning} onClick={async () => {
                    addLog('▶ Docomo 二軍爬蟲啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/trigger-docomo-farm', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ Docomo 爬蟲失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition flex-shrink-0 disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${scraperStatus?.docomoFarm?.isRunning ? 'animate-spin' : ''}`} /> 更新今日
                  </button>
                </div>

                {/* Docomo 二軍逐球補完 */}
                <div className="px-6 py-4 bg-teal-50/60">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                        <span className="font-bold text-sm text-gray-800">Docomo 二軍逐球補完</span>
                      </div>
                      <p className="text-xs text-gray-400 ml-4 mt-0.5">指定場次補抓全場每個打席的逐球資料（需 Docomo game_id 與 DB game_id）</p>
                    </div>
                    <button onClick={() => setShowBackfillDocomo(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-800 transition flex-shrink-0">
                      {showBackfillDocomo ? '關閉' : '補完逐球'}
                    </button>
                  </div>
                  {showBackfillDocomo && (
                    <div className="mt-3 ml-4 space-y-2">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-500 font-bold">Docomo game_id</label>
                          <input
                            type="number"
                            placeholder="例：2021040364"
                            value={backfillDocomoForm.docomoGameId}
                            onChange={e => setBackfillDocomoForm(f => ({ ...f, docomoGameId: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-500 font-bold">DB game_id</label>
                          <input
                            type="number"
                            placeholder="例：123"
                            value={backfillDocomoForm.dbGameId}
                            onChange={e => setBackfillDocomoForm(f => ({ ...f, dbGameId: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </div>
                        <button
                          disabled={backfillDocomoLoading || !backfillDocomoForm.docomoGameId || !backfillDocomoForm.dbGameId}
                          onClick={async () => {
                            const dId = parseInt(backfillDocomoForm.docomoGameId, 10);
                            const dbId = parseInt(backfillDocomoForm.dbGameId, 10);
                            if (!dId || !dbId) return;
                            setBackfillDocomoLoading(true);
                            addLog(`▶ Docomo 逐球補完 (docomoId=${dId}, dbId=${dbId})`, 'warn');
                            try {
                              const res = await backfillDocomoPitch(dId, dbId);
                              addLog(`${res.success ? '✓' : '✗'} ${res.message}（共 ${res.saved} 筆）`, res.success ? 'success' : 'error');
                            } catch { addLog('✗ 逐球補完失敗', 'error'); }
                            finally { setBackfillDocomoLoading(false); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition disabled:opacity-50">
                          <RefreshCw className={`w-3.5 h-3.5 ${backfillDocomoLoading ? 'animate-spin' : ''}`} />
                          {backfillDocomoLoading ? '補完中...' : '執行補完'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">Docomo game_id 從 URL <code className="bg-gray-100 px-1 rounded">game_id=XXXXXXX</code> 取得；DB game_id 是我們資料庫的 farm_games.id</p>
                    </div>
                  )}
                </div>

                {/* Yahoo 二軍打者逐回成績補完 */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
                        <span className="font-bold text-sm text-gray-800">Yahoo 二軍打者逐回成績補完</span>
                      </div>
                      <p className="text-xs text-gray-400 ml-4 mt-0.5">從 baseball.yahoo.co.jp 補抓指定比賽的打者逐回打席結果（at_bat_results）</p>
                    </div>
                    <button onClick={() => setShowBackfillYahoo(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition flex-shrink-0">
                      {showBackfillYahoo ? '關閉' : '補完逐回'}
                    </button>
                  </div>
                  {showBackfillYahoo && (
                    <div className="mt-3 ml-4 space-y-2">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Yahoo Game ID</label>
                          <input
                            type="text"
                            placeholder="例：2021040475"
                            value={backfillYahooForm.yahooGameId}
                            onChange={e => setBackfillYahooForm(f => ({ ...f, yahooGameId: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">DB Game ID</label>
                          <input
                            type="number"
                            placeholder="例：123"
                            value={backfillYahooForm.dbGameId}
                            onChange={e => setBackfillYahooForm(f => ({ ...f, dbGameId: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <button
                          disabled={backfillYahooLoading || !backfillYahooForm.yahooGameId || !backfillYahooForm.dbGameId}
                          onClick={async () => {
                            const dbId = parseInt(backfillYahooForm.dbGameId, 10);
                            if (!backfillYahooForm.yahooGameId || !dbId) return;
                            setBackfillYahooLoading(true);
                            addLog(`▶ Yahoo 逐回成績補完 (yahooId=${backfillYahooForm.yahooGameId}, dbId=${dbId})`, 'warn');
                            try {
                              const res = await backfillYahooBatterStats(backfillYahooForm.yahooGameId, dbId);
                              addLog(`${res.success ? '✓' : '✗'} ${res.message}`, res.success ? 'success' : 'error');
                            } catch { addLog('✗ Yahoo 逐回成績補完失敗', 'error'); }
                            finally { setBackfillYahooLoading(false); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition disabled:opacity-50">
                          <RefreshCw className={`w-3.5 h-3.5 ${backfillYahooLoading ? 'animate-spin' : ''}`} />
                          {backfillYahooLoading ? '補完中...' : '執行補完'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">Yahoo Game ID 可從 <code className="bg-gray-100 px-1 rounded">baseball.yahoo.co.jp/npb/game/XXXXXXX/stats</code> URL 取得（與 Docomo game_id 相同）</p>
                    </div>
                  )}
                </div>

                {/* Yahoo 二軍逐回成績批量補完 */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-red-400" />
                        <span className="font-bold text-sm text-gray-800">Yahoo 二軍逐回成績批量補完</span>
                      </div>
                      <p className="text-xs text-gray-400 ml-4 mt-0.5">一鍵補完所有過去缺少 at_bat_results 的已完賽二軍比賽（2026年 3~5 月）</p>
                      <p className="text-xs text-red-500 ml-4 font-bold">⚠ 背景執行（約 10~20 分鐘，可隨時查詢進度）</p>
                    </div>
                    <button
                      disabled={batchYahooLoading || batchYahooStatus?.isRunning}
                      onClick={async () => {
                        setBatchYahooLoading(true);
                        addLog('▶ 開始批量補完 Yahoo 二軍逐回成績', 'warn');
                        try {
                          const res = await triggerBatchYahooBackfill();
                          setBatchYahooStatus(res.status);
                          addLog(res.message, 'success');
                        } catch { addLog('✗ 批量補完啟動失敗', 'error'); }
                        finally { setBatchYahooLoading(false); }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 flex-shrink-0">
                      <RefreshCw className={`w-3.5 h-3.5 ${batchYahooLoading || batchYahooStatus?.isRunning ? 'animate-spin' : ''}`} />
                      {batchYahooStatus?.isRunning ? '補完中...' : '一鍵補完所有'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await getBatchYahooBackfillStatus();
                          setBatchYahooStatus(res.status);
                          addLog(`進度：${res.status.done}/${res.status.total} — ${res.status.message}`, 'success');
                        } catch { addLog('✗ 查詢進度失敗', 'error'); }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300 transition flex-shrink-0">
                      查詢進度
                    </button>
                  </div>
                  {batchYahooStatus && (
                    <div className="mt-3 ml-4 bg-gray-50 rounded-lg px-3 py-2 text-xs space-y-1">
                      <div className="flex gap-4">
                        <span>總計：<strong>{batchYahooStatus.total}</strong></span>
                        <span>已完成：<strong className="text-green-600">{batchYahooStatus.done}</strong></span>
                        <span>失敗：<strong className="text-red-500">{batchYahooStatus.failed}</strong></span>
                        <span className={`font-bold ${batchYahooStatus.isRunning ? 'text-orange-500' : 'text-gray-500'}`}>
                          {batchYahooStatus.isRunning ? '執行中' : '已停止'}
                        </span>
                      </div>
                      <p className="text-gray-500">{batchYahooStatus.message}</p>
                      {batchYahooStatus.total > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-red-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.round((batchYahooStatus.done / batchYahooStatus.total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* NPB 二軍全季賽程補抓 */}
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                      <span className="font-bold text-sm text-gray-800">二軍全季賽程補抓</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">從 npb.jp/farm 補抓 3〜11 月完整賽程及順位表</p>
                    <p className="text-xs text-orange-500 ml-4 font-bold">⚠ 背景執行（約 5 分鐘）</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ NPB 二軍全季賽程補抓啟動', 'warn');
                    try {
                      const res = await fetch('/api/v1/scraper/backfill-npb-farm', { method: 'POST', credentials: 'include' });
                      const data = await res.json(); addLog(data.message, 'success');
                    } catch { addLog('✗ 二軍全季補抓啟動失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 補抓全季
                  </button>
                </div>

                {/* NPB 文字速報補抓 */}
                <div className="flex items-center gap-4 px-6 py-4 bg-orange-50/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                      <span className="font-bold text-sm text-gray-800">文字速報補抓</span>
                    </div>
                    <p className="text-xs text-gray-400 ml-4 mt-0.5">從 npb.jp 重新補抓所有已完賽場次的速報資料</p>
                    <p className="text-xs text-orange-500 ml-4 font-bold">⚠ 耗時較長（每場約 1 秒），背景執行</p>
                  </div>
                  <button onClick={async () => {
                    addLog('▶ 文字速報補抓啟動', 'warn');
                    try { const res = await triggerPbpBackfill(); addLog(res.message, 'success'); }
                    catch { addLog('✗ 文字速報補抓啟動失敗', 'error'); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" /> 補抓速報
                  </button>
                </div>
              </div>
            </div>

            {/* 自動排程 */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
              <h3 className="font-black text-gray-700 mb-3 flex items-center gap-1.5"><span>⏰</span> 自動排程</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  ['CPBL 一軍比分', '每 1 分鐘（TWN 14:00–23:00）'],
                  ['CPBL 二軍比分', '每 1 分鐘（TWN 11:00–20:00）'],
                  ['NPB 一軍比分', '每 1 分鐘（JST 13:00–22:00）'],
                  ['NPB 二軍比分', '每 1 分鐘（JST 11:00–19:00）'],
                  ['NPB 即時速報', '每 30 秒（JST 13:00–23:00）'],
                  ['CPBL+NPB 賽程', '每日 02:00 UTC'],
                  ['CPBL 名冊', '每週一 00:00 UTC'],
                ].map(([label, timing]) => (
                  <div key={label} className="flex justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-bold text-gray-700">{timing}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === 數據分析 === */}
        {adminTab === 'analytics' && (
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
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${analytics.total_votes > 0 ? Math.round((p.total_votes / Math.max(...analytics.top_polls.map(x => x.total_votes))) * 100) : 0}%` }} />
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
                          <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count}票`}>
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
              <div className="text-center py-16 text-gray-400 font-bold">無法載入數據，請確認登入狀態</div>
            )}
          </div>
        )}
        {/* === 廣告管理 === */}
        {adminTab === 'ad' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-black mb-6">{editingAdId ? '✏️ 編輯廣告' : '➕ 新增廣告版位'}</h2>
              <form onSubmit={async e => {
                e.preventDefault();
                try {
                  if (editingAdId) {
                    await updateAd(editingAdId, { ...adForm, is_active: true });
                    showMsg('✅ 廣告已更新');
                  } else {
                    await createAd({ ...adForm, is_active: true });
                    showMsg('✅ 廣告已建立');
                  }
                  setAdForm({ name: '', type: 'CPD', position: 'sidebar', image_url: '', link_url: '', client_name: '', ad_code: '', start_date: '', end_date: '' });
                  setEditingAdId(null);
                  loadAds();
                } catch { showMsg('❌ 操作失敗，請確認登入狀態'); }
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">廣告名稱 *</label>
                    <input value={adForm.name} onChange={e => setAdForm(p => ({...p, name: e.target.value}))} required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="例：首頁側欄 Banner" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">廣告主</label>
                    <input value={adForm.client_name} onChange={e => setAdForm(p => ({...p, client_name: e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="廣告主名稱" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">廣告類型 *</label>
                    <select value={adForm.type} onChange={e => setAdForm(p => ({...p, type: e.target.value as 'CPD'|'CPM'}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                      <option value="CPD">CPD（圖片廣告）</option>
                      <option value="CPM">CPM（程式碼，如 Google AdSense）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">版位 *</label>
                    <select value={adForm.position} onChange={e => setAdForm(p => ({...p, position: e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                      <option value="sidebar">sidebar（首頁側欄）</option>
                      <option value="cpbl_header">cpbl_header（CPBL 頁橫幅）</option>
                      <option value="npb_header">npb_header（NPB 頁橫幅）</option>
                      <option value="banner">banner（頁首橫幅）</option>
                      <option value="article">article（文章頁）</option>
                    </select>
                  </div>
                  {adForm.type === 'CPD' && (
                    <>
                      <div>
                        <label className="block text-xs font-black text-gray-500 mb-1">圖片網址</label>
                        <input value={adForm.image_url} onChange={e => setAdForm(p => ({...p, image_url: e.target.value}))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 mb-1">點擊連結</label>
                        <input value={adForm.link_url} onChange={e => setAdForm(p => ({...p, link_url: e.target.value}))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="https://..." />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">開始日期</label>
                    <input type="date" value={adForm.start_date} onChange={e => setAdForm(p => ({...p, start_date: e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">結束日期</label>
                    <input type="date" value={adForm.end_date} onChange={e => setAdForm(p => ({...p, end_date: e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>
                {adForm.type === 'CPM' && (
                  <div>
                    <label className="block text-xs font-black text-gray-500 mb-1">廣告程式碼（HTML）</label>
                    <textarea value={adForm.ad_code} onChange={e => setAdForm(p => ({...p, ad_code: e.target.value}))} rows={4}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" placeholder="貼上 Google AdSense 或其他廣告程式碼..." />
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition">
                    {editingAdId ? '更新廣告' : '建立廣告'}
                  </button>
                  {editingAdId && (
                    <button type="button" onClick={() => { setEditingAdId(null); setAdForm({ name: '', type: 'CPD', position: 'sidebar', image_url: '', link_url: '', client_name: '', ad_code: '', start_date: '', end_date: '' }); }}
                      className="px-6 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold text-sm hover:border-red-400 hover:text-red-500 transition">
                      取消
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-black mb-4">現有廣告版位</h2>
              {ads.length === 0 ? (
                <p className="text-gray-400 text-sm font-bold text-center py-8">尚無廣告版位，請新增第一筆</p>
              ) : (
                <div className="space-y-3">
                  {ads.map(ad => (
                    <div key={ad.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${ad.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <p className="font-black text-sm text-gray-800">{ad.name}</p>
                          <p className="text-xs text-gray-400">{ad.position} · {ad.type} {ad.client_name ? `· ${ad.client_name}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={async () => { await updateAd(ad.id, { is_active: !ad.is_active }); loadAds(); }}
                          className={`text-xs font-bold px-3 py-1 rounded-lg border transition ${ad.is_active ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                          {ad.is_active ? '停用' : '啟用'}
                        </button>
                        <button onClick={() => {
                          setEditingAdId(ad.id);
                          setAdForm({ name: ad.name, type: ad.type as 'CPD'|'CPM', position: ad.position, image_url: ad.image_url || '', link_url: ad.link_url || '', client_name: ad.client_name || '', ad_code: ad.ad_code || '', start_date: ad.start_date || '', end_date: ad.end_date || '' });
                        }} className="text-xs font-bold px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400 transition">
                          編輯
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === 限時動態管理 === */}
        {adminTab === 'stories' && (
          <div className="space-y-6">
            {/* 影片上傳 + 裁切區 */}
            <VideoUploadTrimmer
              onVideoReady={(url) => { copyUrl(url); showMsg(`✅ 已複製網址：${url}`); }}
              uploadedVideos={uploadedVideos}
              setUploadedVideos={setUploadedVideos}
              uploadingVideo={uploadingVideo}
              setUploadingVideo={setUploadingVideo}
              videoDragOver={videoDragOver}
              setVideoDragOver={setVideoDragOver}
              copiedUrl={copiedUrl}
              copyUrl={copyUrl}
              uploadVideo={uploadVideo}
              showMsg={showMsg}
            />

            {/* Modal: 新增/編輯 Story */}
            {showStoryForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black">{editingStory?.id ? '✏️ 編輯限時動態' : '➕ 新增限時動態'}</h2>
                    <button onClick={() => { setShowStoryForm(false); setEditingStory(null); }} className="text-gray-400 hover:text-red-500 font-black text-lg">✕</button>
                  </div>
                  {(() => {
                    const form = editingStory ?? { ...BLANK_STORY };
                    const setForm = (updater: (f: typeof BLANK_STORY) => typeof BLANK_STORY) =>
                      setEditingStory(prev => updater(prev ?? BLANK_STORY));
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">主隊全名</label>
                            <input value={form.home_team} onChange={e => setForm(f => ({ ...f, home_team: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="富邦悍將" />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">客隊全名</label>
                            <input value={form.away_team} onChange={e => setForm(f => ({ ...f, away_team: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="樂天桃猿" />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">主隊縮寫</label>
                            <input value={form.home_abbr} onChange={e => setForm(f => ({ ...f, home_abbr: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="FUB" />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">客隊縮寫</label>
                            <input value={form.away_abbr} onChange={e => setForm(f => ({ ...f, away_abbr: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="RAK" />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">主隊顏色</label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={form.home_color} onChange={e => setForm(f => ({ ...f, home_color: e.target.value }))}
                                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                              <input value={form.home_color} onChange={e => setForm(f => ({ ...f, home_color: e.target.value }))}
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">客隊顏色</label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={form.away_color} onChange={e => setForm(f => ({ ...f, away_color: e.target.value }))}
                                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                              <input value={form.away_color} onChange={e => setForm(f => ({ ...f, away_color: e.target.value }))}
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">聯盟</label>
                            <select value={form.league} onChange={e => setForm(f => ({ ...f, league: e.target.value }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                              <option value="CPBL">CPBL</option>
                              <option value="NPB">NPB</option>
                              <option value="NPB2">NPB 二軍</option>
                              <option value="MLB">MLB</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-black text-gray-500 mb-1">排序</label>
                            <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                            <input type="checkbox" checked={form.is_live} onChange={e => setForm(f => ({ ...f, is_live: e.target.checked }))} className="w-4 h-4" />
                            🔴 直播中
                          </label>
                          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
                            ✅ 顯示中
                          </label>
                        </div>

                        {/* Clips */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-black text-sm text-gray-700">Clips（畫格）</h3>
                            <button type="button" onClick={() => setForm(f => ({ ...f, clips: [...f.clips, { ...BLANK_CLIP, clip_order: f.clips.length }] }))}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1 rounded-lg">
                              ＋ 新增 Clip
                            </button>
                          </div>
                          <div className="space-y-4">
                            {form.clips.map((clip, idx) => (
                              <div key={idx} className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-gray-500">Clip {idx + 1}</span>
                                  <button type="button" onClick={() => setForm(f => ({ ...f, clips: f.clips.filter((_, i) => i !== idx) }))}
                                    className="text-xs text-red-400 hover:text-red-600 font-bold">✕ 刪除</button>
                                </div>
                                <div>
                                  <label className="block text-xs font-black text-gray-500 mb-1">影片網址（從上方上傳後複製）</label>
                                  <input value={clip.video_url}
                                    onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, video_url: e.target.value } : c) }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" placeholder="/uploads/stories/..." />
                                  {clip.video_url && (
                                    <video src={clip.video_url} className="mt-2 w-full h-24 object-cover rounded-xl bg-black" controls />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-xs font-black text-gray-500 mb-1">背景圖片網址（選填，沒有影片時顯示）</label>
                                  <input value={clip.background_image_url}
                                    onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, background_image_url: e.target.value } : c) }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="https://..." />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs font-black text-gray-500 mb-1">比分</label>
                                    <input value={clip.score}
                                      onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, score: e.target.value } : c) }))}
                                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="3-1" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-black text-gray-500 mb-1">局況</label>
                                    <input value={clip.situation}
                                      onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, situation: e.target.value } : c) }))}
                                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="7局上，滿壘" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-black text-gray-500 mb-1">關鍵事件</label>
                                  <input value={clip.key_play}
                                    onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, key_play: e.target.value } : c) }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="陳傑憲 3 分砲" />
                                </div>
                                <div>
                                  <label className="block text-xs font-black text-gray-500 mb-1">AI 分析（選填）</label>
                                  <textarea value={clip.ai_insight}
                                    onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, ai_insight: e.target.value } : c) }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" rows={2} placeholder="AI 見解..." />
                                </div>
                                <div>
                                  <label className="block text-xs font-black text-gray-500 mb-1">顯示時長 (ms)</label>
                                  <input type="number" value={clip.duration_ms}
                                    onChange={e => setForm(f => ({ ...f, clips: f.clips.map((c, i) => i === idx ? { ...c, duration_ms: Number(e.target.value) } : c) }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button onClick={() => saveStory(form)}
                            className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-black hover:bg-gray-900 transition">
                            {form.id ? '更新' : '建立'}
                          </button>
                          <button onClick={() => { setShowStoryForm(false); setEditingStory(null); }}
                            className="px-6 py-3 border border-gray-200 text-gray-500 rounded-xl font-bold hover:border-red-300 hover:text-red-500 transition">
                            取消
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black">🎬 限時動態管理</h2>
                <button onClick={() => { setEditingStory({ ...BLANK_STORY }); setShowStoryForm(true); }}
                  className="px-5 py-2 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition">
                  ＋ 新增動態
                </button>
              </div>
              {storiesLoading ? (
                <p className="text-gray-400 text-sm font-bold text-center py-8">載入中...</p>
              ) : stories.length === 0 ? (
                <p className="text-gray-400 text-sm font-bold text-center py-8">尚無限時動態，請新增第一筆</p>
              ) : (
                <div className="space-y-3">
                  {(stories as unknown as (typeof BLANK_STORY & { id: number; clips: (typeof BLANK_CLIP & { id?: number })[] })[]).map(story => (
                    <div key={story.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ background: story.home_color }} />
                          <span className="w-3 h-3 rounded-full inline-block" style={{ background: story.away_color }} />
                        </div>
                        <div>
                          <p className="font-black text-sm text-gray-800">
                            {story.home_abbr} vs {story.away_abbr}
                            {story.is_live && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">LIVE</span>}
                            {!story.is_active && <span className="ml-2 text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full">停用</span>}
                          </p>
                          <p className="text-xs text-gray-400">{story.league} · {story.home_team} vs {story.away_team} · {story.clips.length} clips</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingStory({ ...story }); setShowStoryForm(true); }}
                          className="text-xs font-bold px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400 transition">
                          編輯
                        </button>
                        <button onClick={() => deleteStory(story.id)}
                          className="text-xs font-bold px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">
                          刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === 影片管理 === */}
        {adminTab === 'videos' && (
          <VideoManagerTab showMsg={showMsg} />
        )}

      </div>
    </main>
  );
}

// ─── 影片管理 Tab（獨立元件避免主元件過長）────────────────────────────────────
function VideoManagerTab({ showMsg }: { showMsg: (m: string) => void }) {
  const [videos, setVideos] = useState<{ id: number; title: string; type: string; url: string; thumbnail_url: string | null; is_active: boolean }[]>([]);
  const [ytUrl, setYtUrl] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytCategory, setYtCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch('/api/v1/videos/admin', { credentials: 'include' })
      .then(r => r.json()).then(d => Array.isArray(d) && setVideos(d)).catch(() => {});

  React.useEffect(() => { load(); }, []);

  const addYoutube = async () => {
    if (!ytUrl.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/v1/videos', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ytTitle, type: 'youtube', url: ytUrl, category: ytCategory }),
      });
      if (!r.ok) throw new Error('新增失敗');
      setYtUrl(''); setYtTitle(''); setYtCategory(''); load();
      showMsg('✅ YouTube 影片已新增');
    } catch { showMsg('❌ 新增失敗'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('確定刪除？')) return;
    await fetch(`/api/v1/videos/${id}`, { method: 'DELETE', credentials: 'include' });
    load(); showMsg('✅ 已刪除');
  };

  const toggle = async (id: number, is_active: boolean) => {
    await fetch(`/api/v1/videos/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      {/* 新增 YouTube */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black mb-4">▶️ 新增 YouTube 影片</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">YouTube 網址</label>
            <input
              type="url" placeholder="https://www.youtube.com/watch?v=..."
              value={ytUrl} onChange={e => setYtUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">標題（選填）</label>
            <input
              type="text" placeholder="影片標題..."
              value={ytTitle} onChange={e => setYtTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-1">分類（選填，用於前台篩選）</label>
            <input
              type="text" placeholder="例：精華、NPB、CPBL..."
              value={ytCategory} onChange={e => setYtCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <button
            onClick={addYoutube} disabled={saving || !ytUrl.trim()}
            className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition disabled:opacity-50"
          >
            {saving ? '新增中...' : '➕ 新增'}
          </button>
        </div>
      </div>

      {/* 影片列表 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black mb-4">影片列表（{videos.length} 部）</h2>
        {videos.length === 0 ? (
          <p className="text-gray-400 text-sm font-bold text-center py-8">尚無影片</p>
        ) : (
          <div className="space-y-3">
            {videos.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                {v.thumbnail_url && (
                  <img src={v.thumbnail_url} alt="" className="w-20 h-12 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-800 truncate">{v.title || '（無標題）'}</p>
                  <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                    {v.type === 'youtube' ? `youtube.com/watch?v=${v.url}` : v.url}
                  </p>
                  <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full mt-1 ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {v.is_active ? '✅ 顯示中' : '⏸ 隱藏'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => toggle(v.id, !v.is_active)}
                    className="text-xs font-bold px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400 transition">
                    {v.is_active ? '隱藏' : '顯示'}
                  </button>
                  <button onClick={() => del(v.id)}
                    className="text-xs font-bold px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
