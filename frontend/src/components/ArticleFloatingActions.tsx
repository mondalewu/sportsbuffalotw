import React, { useState, useEffect } from 'react';
import { ThumbsUp, MessageCircle, Share2, Bookmark, ArrowUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getArticleLike, toggleArticleLike, getArticleBookmark, toggleArticleBookmark } from '../api/articles';

interface Props {
  articleId: number;
  commentCount: number;
  onScrollToComments: () => void;
}

export default function ArticleFloatingActions({ articleId, commentCount, onScrollToComments }: Props) {
  const { currentUser, setAuthModal } = useApp();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    getArticleLike(articleId).then(r => { setLiked(r.liked); setLikeCount(r.count); }).catch(() => {});
    getArticleBookmark(articleId).then(r => setSaved(r.bookmarked)).catch(() => {});
  }, [articleId]);

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLike = async () => {
    if (!currentUser) {
      setAuthModal('login');
      return;
    }
    try {
      const r = await toggleArticleLike(articleId);
      setLiked(r.liked);
      setLikeCount(r.count);
    } catch {
      alert('操作失敗，請稍後再試');
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      setAuthModal('login');
      return;
    }
    try {
      const r = await toggleArticleBookmark(articleId);
      setSaved(r.bookmarked);
    } catch {
      alert('操作失敗，請稍後再試');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ url }); } catch {}
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); } catch {
        fallbackCopy(url);
      }
      setShowShare(true);
      setTimeout(() => setShowShare(false), 2000);
    } else {
      fallbackCopy(url);
      setShowShare(true);
      setTimeout(() => setShowShare(false), 2000);
    }
  };

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

  return (
    <>
      {/* ── Desktop: 左側浮動按鈕 ── */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-3">
        <div className="bg-white rounded-full shadow-lg border border-gray-100 flex flex-col items-center py-3 px-1.5 gap-1">
          {/* Like */}
          <button
            onClick={handleLike}
            className="group flex flex-col items-center gap-0.5 p-2 rounded-full hover:bg-red-50 transition"
            title="按讚"
          >
            <ThumbsUp
              className={`w-5 h-5 transition ${liked ? 'text-red-600 fill-red-600' : 'text-gray-400 group-hover:text-red-500'}`}
            />
            {likeCount > 0 && (
              <span className="text-[10px] font-bold text-red-600">{likeCount}</span>
            )}
          </button>

          {/* Comment */}
          <button
            onClick={onScrollToComments}
            className="group flex flex-col items-center gap-0.5 p-2 rounded-full hover:bg-blue-50 transition"
            title="留言"
          >
            <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition" />
            {commentCount > 0 && (
              <span className="text-[10px] font-bold text-gray-500">{commentCount}</span>
            )}
          </button>

          {/* Share */}
          <div className="relative">
            <button
              onClick={handleShare}
              className="group flex flex-col items-center p-2 rounded-full hover:bg-green-50 transition"
              title="分享"
            >
              <Share2 className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition" />
            </button>
            {showShare && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                已複製連結
              </div>
            )}
          </div>

          {/* Bookmark */}
          <button
            onClick={handleSave}
            className="group flex flex-col items-center p-2 rounded-full hover:bg-yellow-50 transition"
            title={saved ? '取消收藏' : '收藏'}
          >
            <Bookmark
              className={`w-5 h-5 transition ${saved ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 group-hover:text-yellow-500'}`}
            />
          </button>
        </div>

        {/* Back to top */}
        {showBackTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white rounded-full shadow-lg border border-gray-100 p-2.5 hover:bg-gray-50 transition"
            title="回到頂部"
          >
            <ArrowUp className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* ── Mobile: 底部固定工具列 ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
          {/* Like */}
          <button onClick={handleLike} className="flex flex-col items-center gap-0.5 py-1 px-3">
            <ThumbsUp className={`w-5 h-5 transition ${liked ? 'text-red-600 fill-red-600' : 'text-gray-400'}`} />
            <span className={`text-[10px] font-bold ${liked ? 'text-red-600' : 'text-gray-400'}`}>
              {likeCount > 0 ? likeCount : '按讚'}
            </span>
          </button>

          {/* Comment */}
          <button onClick={onScrollToComments} className="flex flex-col items-center gap-0.5 py-1 px-3">
            <MessageCircle className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400">
              {commentCount > 0 ? commentCount : '留言'}
            </span>
          </button>

          {/* Share */}
          <button onClick={handleShare} className="flex flex-col items-center gap-0.5 py-1 px-3 relative">
            <Share2 className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400">分享</span>
            {showShare && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg">
                已複製連結
              </div>
            )}
          </button>

          {/* Bookmark */}
          <button onClick={handleSave} className="flex flex-col items-center gap-0.5 py-1 px-3">
            <Bookmark className={`w-5 h-5 transition ${saved ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
            <span className={`text-[10px] font-bold ${saved ? 'text-yellow-600' : 'text-gray-400'}`}>
              {saved ? '已收藏' : '收藏'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
