import React, { useRef, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../api/client';

interface UploadedVideo {
  url: string;
  name: string;
  duration: number; // seconds
}

interface Props {
  uploadedVideos: UploadedVideo[];
  setUploadedVideos: React.Dispatch<React.SetStateAction<UploadedVideo[]>>;
  uploadingVideo: boolean;
  setUploadingVideo: React.Dispatch<React.SetStateAction<boolean>>;
  videoDragOver: boolean;
  setVideoDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  copiedUrl: string | null;
  copyUrl: (url: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadVideo: (file: File) => void;
  showMsg: (msg: string) => void;
  onVideoReady: (url: string) => void;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const ms = Math.floor((sec % 1) * 10);
  return `${m}:${s}.${ms}`;
}

// ─── Trim Panel ───────────────────────────────────────────────────────────────
interface TrimPanelProps {
  video: UploadedVideo;
  onDone: (newUrl: string) => void;
  onClose: () => void;
  showMsg: (msg: string) => void;
}

function TrimPanel({ video, onDone, onClose, showMsg }: TrimPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(video.duration || 0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(video.duration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimming, setTrimming] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'start' | 'end' | 'playhead' | null>(null);

  // When video metadata loads, update duration
  const onMeta = useCallback(() => {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    setEnd(d);
  }, []);

  // Sync video currentTime when start handle moves (for preview)
  const seekTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  // Clamp playback to [start, end]
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const tick = () => {
      setCurrentTime(el.currentTime);
      if (el.currentTime >= end) { el.pause(); el.currentTime = start; }
    };
    el.addEventListener('timeupdate', tick);
    return () => el.removeEventListener('timeupdate', tick);
  }, [start, end]);

  // ── Drag logic ───────────────────────────────────────────────────────────────
  const xToTime = (clientX: number) => {
    if (!trackRef.current || !duration) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const t = xToTime(e.clientX);
    if (dragging.current === 'start') {
      const v = Math.min(t, end - 0.5);
      setStart(Math.max(0, v));
      seekTo(Math.max(0, v));
    } else if (dragging.current === 'end') {
      const v = Math.max(t, start + 0.5);
      setEnd(Math.min(duration, v));
      seekTo(Math.min(duration, v));
    } else if (dragging.current === 'playhead') {
      const v = Math.max(start, Math.min(end, t));
      seekTo(v);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, duration]);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const startTrim = async () => {
    setTrimming(true);
    try {
      const filename = video.url.split('/').pop()!;
      const r = await fetch(`${API_BASE}/api/v1/stories/trim`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, start, end }),
      });
      if (!r.ok) throw new Error('裁切失敗');
      const { url } = await r.json();
      showMsg('✅ 裁切完成');
      onDone(url);
    } catch {
      showMsg('❌ 裁切失敗');
    } finally {
      setTrimming(false);
    }
  };

  const pct = (t: number) => duration ? `${(t / duration) * 100}%` : '0%';
  const trimWidth = duration ? `${((end - start) / duration) * 100}%` : '0%';
  const trimLeft = duration ? `${(start / duration) * 100}%` : '0%';

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-black text-base">✂️ 裁切影片</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-black text-lg">✕</button>
        </div>

        {/* Video preview */}
        <div className="bg-black">
          <video
            ref={videoRef}
            src={video.url}
            onLoadedMetadata={onMeta}
            className="w-full max-h-64 object-contain"
            playsInline
          />
        </div>

        <div className="p-5 space-y-4">
          {/* Timeline track */}
          <div>
            <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
              <span>{fmt(start)}</span>
              <span className="text-gray-700 font-bold">{fmt(end - start)} 片段</span>
              <span>{fmt(end)}</span>
            </div>

            <div
              ref={trackRef}
              className="relative h-10 rounded-xl overflow-visible cursor-crosshair select-none"
              style={{ background: '#e5e7eb' }}
            >
              {/* Selected range highlight */}
              <div
                className="absolute top-0 bottom-0 bg-yellow-300 rounded-xl"
                style={{ left: trimLeft, width: trimWidth }}
              />

              {/* Start handle */}
              <div
                className="absolute top-0 bottom-0 w-4 bg-yellow-500 rounded-l-xl cursor-ew-resize flex items-center justify-center z-10"
                style={{ left: trimLeft, transform: 'translateX(-50%)' }}
                onPointerDown={e => { e.preventDefault(); dragging.current = 'start'; }}
              >
                <div className="w-0.5 h-4 bg-white rounded-full" />
              </div>

              {/* End handle */}
              <div
                className="absolute top-0 bottom-0 w-4 bg-yellow-500 rounded-r-xl cursor-ew-resize flex items-center justify-center z-10"
                style={{ left: pct(end), transform: 'translateX(-50%)' }}
                onPointerDown={e => { e.preventDefault(); dragging.current = 'end'; }}
              >
                <div className="w-0.5 h-4 bg-white rounded-full" />
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-pointer"
                style={{ left: pct(currentTime), transform: 'translateX(-50%)' }}
                onPointerDown={e => { e.preventDefault(); dragging.current = 'playhead'; }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-gray-400 rounded-full" />
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => { if (videoRef.current) { videoRef.current.currentTime = start; videoRef.current.play(); } }}
                className="px-4 py-1.5 bg-gray-800 text-white rounded-xl font-bold text-xs hover:bg-gray-900 transition"
              >
                ▶ 預覽片段
              </button>
              <button
                onClick={() => { if (videoRef.current) videoRef.current.pause(); }}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-300 transition"
              >
                ⏸ 暫停
              </button>
            </div>
          </div>

          {/* Start / End inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">開始時間（秒）</label>
              <input
                type="number" min={0} max={end - 0.1} step={0.1}
                value={start.toFixed(1)}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setStart(v); seekTo(v); } }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1">結束時間（秒）</label>
              <input
                type="number" min={start + 0.1} max={duration} step={0.1}
                value={end.toFixed(1)}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setEnd(v); seekTo(v); } }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={startTrim}
              disabled={trimming}
              className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-black hover:bg-yellow-600 transition disabled:opacity-50"
            >
              {trimming ? '裁切中...' : `✂️ 裁切（${fmt(end - start)}）`}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-500 hover:border-gray-400 transition"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function VideoUploadTrimmer({
  uploadedVideos, setUploadedVideos,
  uploadingVideo, setUploadingVideo,
  videoDragOver, setVideoDragOver,
  copiedUrl, copyUrl,
  uploadVideo, showMsg,
}: Props) {
  const [trimTarget, setTrimTarget] = useState<UploadedVideo | null>(null);

  const handleFile = (file: File) => {
    setUploadingVideo(true);
    const fd = new FormData();
    fd.append('video', file);
    fetch(`${API_BASE}/api/v1/stories/upload`, { method: 'POST', credentials: 'include', body: fd })
      .then(r => r.json())
      .then(({ url, duration }) => {
        setUploadedVideos(prev => [{ url, name: file.name, duration: duration ?? 0 }, ...prev]);
        showMsg('✅ 影片上傳成功');
      })
      .catch(() => showMsg('❌ 影片上傳失敗'))
      .finally(() => setUploadingVideo(false));
  };

  const handleTrimDone = (newUrl: string) => {
    setUploadedVideos(prev => [{ url: newUrl, name: `✂️ ${trimTarget?.name ?? '裁切片段'}`, duration: 0 }, ...prev]);
    copyUrl(newUrl);
    setTrimTarget(null);
  };

  return (
    <>
      {trimTarget && (
        <TrimPanel
          video={trimTarget}
          onDone={handleTrimDone}
          onClose={() => setTrimTarget(null)}
          showMsg={showMsg}
        />
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black mb-4">🎥 影片上傳 &amp; 裁切</h2>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setVideoDragOver(true); }}
          onDragLeave={() => setVideoDragOver(false)}
          onDrop={e => { e.preventDefault(); setVideoDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${videoDragOver ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}
        >
          {uploadingVideo ? (
            <div className="space-y-2">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-yellow-500 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 font-bold text-sm">上傳中...</p>
            </div>
          ) : (
            <>
              <p className="text-3xl mb-2">🎬</p>
              <p className="font-black text-sm text-gray-600 mb-1">拖曳影片到此區域</p>
              <p className="text-xs text-gray-400 mb-4">支援 MP4、WebM、MOV（最大 200 MB）</p>
              <label className="cursor-pointer px-5 py-2 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition">
                選擇檔案
                <input
                  type="file" accept="video/mp4,video/webm,video/quicktime,video/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
              </label>
            </>
          )}
        </div>

        {/* Uploaded video list */}
        {uploadedVideos.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-black text-gray-500 mb-2">已上傳影片</p>
            {uploadedVideos.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <video src={v.url} className="w-20 h-12 rounded-lg object-cover bg-black flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-700 truncate">{v.name}</p>
                  <button
                    onClick={() => copyUrl(v.url)}
                    className="text-xs font-mono text-blue-600 hover:text-blue-800 truncate block max-w-full text-left"
                  >
                    {copiedUrl === v.url ? '✅ 已複製！' : v.url}
                  </button>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => setTrimTarget(v)}
                    className="text-xs font-bold px-3 py-1 rounded-lg border border-yellow-300 text-yellow-600 hover:bg-yellow-50 transition"
                  >
                    ✂️ 裁切
                  </button>
                  <button
                    onClick={() => copyUrl(v.url)}
                    className="text-xs font-bold px-3 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                  >
                    {copiedUrl === v.url ? '已複製' : '複製'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
