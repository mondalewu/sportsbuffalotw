import { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Youtube } from 'lucide-react';
import { API_BASE } from '../api/client';

interface HomeVideo {
  id: number;
  title: string;
  type: 'youtube' | 'upload';
  url: string;
  thumbnail_url: string | null;
  category: string;
}

function YoutubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
        className="absolute inset-0 w-full h-full rounded-2xl"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function UploadEmbed({ url }: { url: string }) {
  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <video
        className="absolute inset-0 w-full h-full rounded-2xl object-contain bg-black"
        src={url}
        controls
        autoPlay
        playsInline
      />
    </div>
  );
}

export default function VideoPlayer() {
  const [videos, setVideos] = useState<HomeVideo[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/videos`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setVideos(data); })
      .catch(() => {});
  }, []);

  const cats = useMemo(() => {
    const filled = videos.map(v => v.category).filter(Boolean);
    return filled.length > 0 ? ['all', ...Array.from(new Set(filled))] : [];
  }, [videos]);

  const filtered = useMemo(
    () => selectedCat === 'all' ? videos : videos.filter(v => v.category === selectedCat),
    [videos, selectedCat]
  );

  if (videos.length === 0) return null;

  const safeIdx = Math.min(activeIdx, filtered.length - 1);
  const active = filtered[safeIdx] ?? filtered[0];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Player */}
      <div className="p-3 pb-0">
        {active.type === 'youtube' ? (
          <YoutubeEmbed key={active.id} videoId={active.url} />
        ) : (
          <UploadEmbed key={active.id} url={active.url} />
        )}
      </div>

      {/* Title */}
      {active.title && (
        <div className="px-4 pt-3 pb-1">
          <p className="font-black text-sm text-gray-800 leading-snug line-clamp-2">{active.title}</p>
        </div>
      )}

      {/* Category filter */}
      {cats.length > 1 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {cats.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedCat(cat); setActiveIdx(0); }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border transition ${
                selectedCat === cat
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {cat === 'all' ? '全部' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Playlist */}
      {filtered.length > 1 && (
        <div className="px-4 pb-4 pt-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">播放清單</p>
          <div ref={scrollRef} className="space-y-2 max-h-48 overflow-y-auto">
            {filtered.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl transition text-left ${
                  i === safeIdx ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 relative">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <Play className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {i === safeIdx && (
                    <div className="absolute inset-0 bg-red-600/30 flex items-center justify-center">
                      <Play className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${i === activeIdx ? 'text-red-700' : 'text-gray-700'}`}>
                    {v.title || '（無標題）'}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {v.type === 'youtube' ? (
                      <Youtube className="w-3 h-3 text-red-500" />
                    ) : (
                      <Play className="w-3 h-3 text-gray-400" />
                    )}
                    <span className="text-[9px] text-gray-400 font-bold">
                      {v.type === 'youtube' ? 'YouTube' : '上傳影片'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
