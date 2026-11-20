import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, ChevronLeft, Volume2, VolumeX, Share2 } from 'lucide-react';
import { API_BASE } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryClip {
  backgroundImage: string;
  videoUrl?: string;       // 優先使用影片
  score: string;
  situation: string;
  keyPlay: string;
  aiInsight?: string;
  duration: number; // ms
}

interface GameStory {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
  league: string;
  isLive: boolean;
  clips: StoryClip[];
}

// ─── API response → GameStory 轉換 ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiStory(s: any): GameStory {
  return {
    id: s.id,
    homeTeam: s.home_team,
    awayTeam: s.away_team,
    homeAbbr: s.home_abbr,
    awayAbbr: s.away_abbr,
    homeColor: s.home_color,
    awayColor: s.away_color,
    league: s.league,
    isLive: s.is_live,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clips: (s.clips ?? []).map((c: any) => ({
      backgroundImage: c.background_image_url,
      videoUrl: c.video_url ?? undefined,
      score: c.score,
      situation: c.situation,
      keyPlay: c.key_play,
      aiInsight: c.ai_insight ?? undefined,
      duration: c.duration_ms,
    })),
  };
}

// ─── League sport icons ───────────────────────────────────────────────────────

function LeagueIcon({ league, className }: { league: string; className?: string }) {
  const cls = className ?? 'text-lg';
  switch (league) {
    case 'CPBL': case 'NPB': case 'NPB2': case 'MLB': case 'WBC':
      return <span className={cls}>⚾</span>;
    case 'NBA': case 'PLG': case 'TPBL': case '籃球':
      return <span className={cls}>🏀</span>;
    case '足球':
      return <span className={cls}>⚽</span>;
    default:
      return <span className={cls}>🏅</span>;
  }
}

// ─── Story Circle ──────────────────────────────────────────────────────────────

interface StoryCircleProps {
  story: GameStory;
  seen: boolean;
  onClick: () => void;
}

function StoryCircle({ story, seen, onClick }: StoryCircleProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 flex-shrink-0 group focus:outline-none"
      aria-label={`${story.homeTeam} vs ${story.awayTeam}`}
    >
      {/* Outer ring */}
      <div
        className="p-[2.5px] rounded-full transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
        style={{
          background: story.isLive && !seen
            ? 'linear-gradient(135deg, #ef4444 0%, #a855f7 50%, #ef4444 100%)'
            : seen
              ? '#d1d5db'
              : 'linear-gradient(135deg, #6b7280, #9ca3af)',
        }}
      >
        {/* White gap ring */}
        <div className="p-[2px] rounded-full bg-white">
          {/* Circle content */}
          <div
            className="w-[60px] h-[60px] rounded-full flex flex-col items-center justify-center text-white relative overflow-hidden"
            style={{
              background: `linear-gradient(145deg, ${story.homeColor} 0%, ${story.awayColor} 100%)`,
            }}
          >
            <span className="text-[9px] font-black leading-none tracking-tight drop-shadow">
              {story.homeAbbr}
            </span>
            <span className="text-[7px] text-white/60 font-bold my-[2px]">vs</span>
            <span className="text-[9px] font-black leading-none tracking-tight drop-shadow">
              {story.awayAbbr}
            </span>
          </div>
        </div>
      </div>

      {/* LIVE badge */}
      {story.isLive ? (
        <span className="bg-red-600 text-white text-[8px] font-black px-2 py-[2px] rounded-full -mt-2.5 z-10 shadow animate-pulse">
          LIVE
        </span>
      ) : (
        <span className="bg-gray-200 text-gray-500 text-[8px] font-black px-2 py-[2px] rounded-full -mt-2.5 z-10">
          終場
        </span>
      )}

      {/* League label with sport icon */}
      <span className="text-[9px] font-bold text-gray-500 max-w-[72px] text-center leading-tight flex items-center gap-0.5">
        <LeagueIcon league={story.league} className="text-[11px]" />
        {story.league}
      </span>
    </button>
  );
}

// ─── Story Viewer (full-screen overlay) ──────────────────────────────────────

interface StoryViewerProps {
  initialStoryIndex: number;
  stories: GameStory[];
  onClose: () => void;
  onStorySeen: (storyId: number) => void;
}

function StoryViewer({ initialStoryIndex, stories, onClose, onStorySeen }: StoryViewerProps) {
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [clipIndex, setClipIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const story = stories[storyIndex];
  const clip = story?.clips[clipIndex];
  const isVideo = !!clip?.videoUrl;
  const hasBackground = !!(clip?.backgroundImage && clip.backgroundImage.trim());

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goToNextClip = useCallback(() => {
    setProgress(0);
    setImageLoaded(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    if (clipIndex < story.clips.length - 1) {
      setClipIndex(c => c + 1);
    } else if (storyIndex < stories.length - 1) {
      const nextIdx = storyIndex + 1;
      setStoryIndex(nextIdx);
      setClipIndex(0);
      onStorySeen(stories[nextIdx].id);
    } else {
      onClose();
    }
  }, [clipIndex, storyIndex, story?.clips.length, stories, onClose, onStorySeen]);

  const goToPrevClip = useCallback(() => {
    setProgress(0);
    setImageLoaded(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    if (clipIndex > 0) {
      setClipIndex(c => c - 1);
    } else if (storyIndex > 0) {
      const prevIdx = storyIndex - 1;
      setStoryIndex(prevIdx);
      setClipIndex(0);
    }
  }, [clipIndex, storyIndex]);

  // 若沒有背景圖（純影片 clip）或圖片已不需要等待，立刻標記已載入
  useEffect(() => {
    if (!hasBackground) setImageLoaded(true);
  }, [hasBackground, storyIndex, clipIndex]);

  // ── Progress timer (image clips only) ───────────────────────────────────────

  useEffect(() => {
    if (isVideo || paused || !imageLoaded || !clip) return;
    const TICK = 50;
    const increment = (TICK / (clip.duration || 6000)) * 100;

    const id = setInterval(() => {
      setProgress(p => {
        if (p + increment >= 100) { clearInterval(id); return 100; }
        return p + increment;
      });
    }, TICK);

    return () => clearInterval(id);
  }, [storyIndex, clipIndex, paused, imageLoaded, isVideo, clip.duration]);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(goToNextClip, 80);
      return () => clearTimeout(t);
    }
  }, [progress, goToNextClip]);

  // ── Video clip progress ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isVideo) return;
    const el = videoRef.current;
    if (!el) return;
    // reset & play
    setProgress(0);
    el.currentTime = 0;
    if (!paused) el.play().catch(() => {});

    const onTimeUpdate = () => {
      if (el.duration) setProgress((el.currentTime / el.duration) * 100);
    };
    const onEnded = () => { setProgress(100); goToNextClip(); };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIndex, clipIndex, isVideo]);

  // pause/resume video when paused state changes
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    if (paused) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  }, [paused, isVideo]);

  // sync muted state to video
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, storyIndex, clipIndex]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goToNextClip();
      if (e.key === 'ArrowLeft') goToPrevClip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goToNextClip, goToPrevClip]);

  // ── Lock body scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Pointer-hold pause logic ─────────────────────────────────────────────────

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHolding = useRef(false);

  const handlePointerDown = () => {
    holdTimer.current = setTimeout(() => {
      isHolding.current = true;
      setPaused(true);
    }, 150);
  };

  const handlePointerUp = (action: () => void) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (isHolding.current) {
      isHolding.current = false;
      setPaused(false);
    } else {
      action();
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?story=${story?.id ?? ''}` : '';
  const shareText = `${story?.homeTeam} vs ${story?.awayTeam} — ${clip?.keyPlay ?? ''} | 水牛體育`;

  const fallbackCopy = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  };

  const shareToFB = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };
  const shareToIG = () => {
    const content = `${shareText}\n${shareUrl}`;
    if (navigator.clipboard) navigator.clipboard.writeText(content).catch(() => fallbackCopy(content));
    else fallbackCopy(content);
    alert('已複製連結與文字！請開啟 Instagram 貼上分享');
    setShowShareMenu(false);
  };
  const shareToLine = () => {
    window.open(`https://line.me/R/share?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };
  const shareToX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };
  const shareToThreads = () => {
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };
  const copyLink = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).catch(() => fallbackCopy(shareUrl));
    else fallbackCopy(shareUrl);
    alert('已複製連結！');
    setShowShareMenu(false);
  };

  // 點擊分享選單外部時關閉
  useEffect(() => {
    if (!showShareMenu) return;
    const handler = () => setShowShareMenu(false);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [showShareMenu]);

  // 若 story 無 clips，直接關閉避免 crash (白螢幕根本原因)
  if (!story || !clip) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      {/* 9:16 story container */}
      <div
        className="relative bg-black overflow-hidden shadow-2xl"
        style={{
          aspectRatio: '9 / 16',
          height: '100dvh',
          maxHeight: '100dvh',
          maxWidth: 'calc(100dvh * 9 / 16)',
          width: '100%',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Background: video or image */}
        {isVideo ? (
          <video
            ref={videoRef}
            key={`v-${storyIndex}-${clipIndex}`}
            src={clip.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted={muted}
            onCanPlay={() => setImageLoaded(true)}
          />
        ) : hasBackground ? (
          <img
            key={`img-${storyIndex}-${clipIndex}`}
            src={clip.backgroundImage}
            alt=""
            onLoad={() => setImageLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-700" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent via-40% to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 via-50% to-transparent pointer-events-none" />

        {/* Shimmer while loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-900 animate-pulse" />
        )}

        {/* ── Progress bars ──────────────────────────────────────────────────── */}
        <div className="absolute top-4 left-3 right-3 flex gap-[3px] z-30 pointer-events-none">
          {story.clips.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < clipIndex ? '100%' : i === clipIndex ? `${progress}%` : '0%',
                  transition: i === clipIndex ? 'none' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* ── Top bar: league + story dots + close ──────────────────────────── */}
        <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[9px] border border-white/30"
              style={{
                background: `linear-gradient(135deg, ${story.homeColor}, ${story.awayColor})`,
              }}
            >
              {story.homeAbbr[0]}
            </div>
            <div>
              <p className="text-white font-black text-xs leading-none">
                {story.homeTeam} <span className="text-white/50">vs</span> {story.awayTeam}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-white/60 text-[9px] font-bold">{story.league}</span>
                {story.isLive && (
                  <span className="flex items-center gap-1 bg-red-600 text-white text-[8px] font-black px-1.5 py-px rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
                    LIVE
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Mute / Unmute */}
            <button
              onClick={() => setMuted(m => !m)}
              className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-black/70 transition"
              aria-label={muted ? '取消靜音' : '靜音'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {/* Share */}
            <button
              onClick={() => setShowShareMenu(v => !v)}
              className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-black/70 transition"
              aria-label="分享"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-black/70 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Share menu popup ────────────────────────────────────────────── */}
        {showShareMenu && (
          <div className="absolute top-[72px] right-3 z-40 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-2 space-y-1 min-w-[170px] animate-in fade-in slide-in-from-top-2">
            <button onClick={shareToFB} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition">
              <span className="w-5 h-5 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </span>
              Facebook
            </button>
            <button onClick={shareToIG} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </span>
              Instagram
            </button>
            <button onClick={shareToLine} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition">
              <span className="w-5 h-5 rounded-full bg-[#06C755] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              </span>
              LINE
            </button>
            <button onClick={shareToThreads} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition">
              <span className="w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 192 192" className="w-3.5 h-3.5 fill-white"><path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.24-38.37 34.76.384 9.812 5.08 18.253 13.22 23.768 6.88 4.66 15.736 7.016 24.924 6.635 12.14-.503 21.647-5.175 28.263-13.882 5.022-6.613 8.188-15.14 9.6-25.916 5.754 3.472 10.034 8.082 12.467 13.72 4.08 9.46 4.322 25.03-7.264 36.615-10.189 10.182-22.44 14.583-40.896 14.72-20.432-.153-35.886-6.713-45.924-19.498C65.49 142.603 59.816 125.273 59.63 105c.186-20.273 5.86-37.604 16.874-51.504C86.541 40.712 102 34.153 122.432 34c20.6.157 36.213 6.804 46.374 19.756C178.657 65.633 183.882 82.206 184 101.5l16.5.5c-.169-22.735-6.47-42.658-18.738-57.258C168.34 28.252 149.142 19.74 125 18h-5.25c-24.027.173-43.126 8.676-56.722 25.236C50.482 59.058 43.72 80.063 43.5 105v.5c.22 24.938 6.982 45.942 19.528 61.764C76.622 183.561 95.72 192.064 119.747 192.237h2.686c22.28-.163 39.14-6.17 51.58-18.377 16.84-16.52 17.33-37.187 11.524-50.872-4.166-9.817-12.21-17.78-23.267-23.04l-.733-.96zM99.684 130.885c-10.18.588-20.774-4.006-21.278-14.244-.368-7.49 5.313-15.84 25.473-17.003 2.228-.128 4.41-.19 6.55-.19 6.274 0 12.146.56 17.456 1.656-1.988 23.42-14.058 29.194-28.201 29.781z"/></svg>
              </span>
              Threads
            </button>
            <button onClick={shareToX} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition">
              <span className="w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </span>
              X (Twitter)
            </button>
            <div className="border-t border-white/10 my-1" />
            <button onClick={copyLink} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
              </span>
              複製連結
            </button>
          </div>
        )}

        {/* ── Left nav zone ─────────────────────────────────────────────────── */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1/3 z-20 flex items-center pl-2 select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={() => handlePointerUp(goToPrevClip)}
          onPointerLeave={() => {
            if (isHolding.current) { isHolding.current = false; setPaused(false); }
            if (holdTimer.current) clearTimeout(holdTimer.current);
          }}
        >
          {(clipIndex > 0 || storyIndex > 0) && (
            <div className="opacity-0 group-hover:opacity-100 w-7 h-7 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center pointer-events-none">
              <ChevronLeft className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* ── Right nav zone ────────────────────────────────────────────────── */}
        <div
          className="absolute right-0 top-0 bottom-0 left-1/3 z-20 flex items-center justify-end pr-2 select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={() => handlePointerUp(goToNextClip)}
          onPointerLeave={() => {
            if (isHolding.current) { isHolding.current = false; setPaused(false); }
            if (holdTimer.current) clearTimeout(holdTimer.current);
          }}
        />

        {/* ── Bottom content ────────────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-30 pointer-events-none space-y-3">

          {/* AI Insight card */}
          {clip.aiInsight && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-purple-300 text-[9px] font-black uppercase tracking-widest mb-0.5">
                  AI 數據解析
                </p>
                <p className="text-white/90 text-[11px] font-semibold leading-relaxed">
                  {clip.aiInsight}
                </p>
              </div>
            </div>
          )}

          {/* Score */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-white/80 font-black text-xs text-right leading-tight max-w-[80px]">
              {story.homeTeam}
            </span>
            <span className="text-white font-black text-[40px] tracking-tight leading-none tabular-nums">
              {clip.score}
            </span>
            <span className="text-white/80 font-black text-xs text-left leading-tight max-w-[80px]">
              {story.awayTeam}
            </span>
          </div>

          {/* Situation */}
          <p className="text-white/60 text-[11px] font-bold text-center tracking-wide">
            {clip.situation}
          </p>

          {/* Key Play banner */}
          <div className="bg-red-600/90 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center border border-red-500/50">
            <p className="text-white font-black text-[13px] leading-snug">
              {clip.keyPlay}
            </p>
          </div>

          {/* Pause indicator */}
          {paused && (
            <div className="text-center">
              <span className="text-white/50 text-[10px] font-bold tracking-widest uppercase">
                ⏸ 已暫停
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function LiveStories() {
  const [stories, setStories] = useState<GameStory[]>([]);
  const [openStoryIndex, setOpenStoryIndex] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());

  // 從 API 載入，每 60 秒自動更新
  useEffect(() => {
    const load = () => {
      fetch(`${API_BASE}/api/v1/stories`)
        .then(r => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((data: any[]) => Array.isArray(data) ? setStories(data.map(mapApiStory)) : null)
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleOpen = (index: number) => {
    setOpenStoryIndex(index);
    setSeenIds(prev => new Set(prev).add(stories[index].id));
  };

  const handleStorySeen = (storyId: number) => {
    setSeenIds(prev => new Set(prev).add(storyId));
  };

  // 無資料時不顯示整列
  if (stories.length === 0) return null;

  return (
    <>
      {/* ── Story row ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4">
          <div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-hide">
            {/* Section label */}
            <div className="flex flex-col items-center justify-center flex-shrink-0 mr-2 pr-3 border-r border-gray-200">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">Live</span>
              <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none">Stories</span>
            </div>

            {stories.map((story, i) => (
              <div key={story.id} className="px-1.5">
                <StoryCircle
                  story={story}
                  seen={seenIds.has(story.id)}
                  onClick={() => handleOpen(i)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Full-screen viewer ────────────────────────────────────────────── */}
      {openStoryIndex !== null && (
        <StoryViewer
          initialStoryIndex={openStoryIndex}
          stories={stories}
          onClose={() => setOpenStoryIndex(null)}
          onStorySeen={handleStorySeen}
        />
      )}
    </>
  );
}
