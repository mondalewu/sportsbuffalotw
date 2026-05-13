import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, ChevronLeft } from 'lucide-react';
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

      {/* League label */}
      <span className="text-[9px] font-bold text-gray-500 max-w-[72px] text-center leading-tight">
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
            muted
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
          <button
            onClick={onClose}
            className="pointer-events-auto w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-black/70 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-hide">
            {/* Section label */}
            <div className="flex flex-col items-center justify-center flex-shrink-0 mr-2 pr-3 border-r border-gray-100">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">Live</span>
              <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest leading-none">Stories</span>
            </div>

            {stories.map((story, i) => (
              <div key={story.id} className="px-2">
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
