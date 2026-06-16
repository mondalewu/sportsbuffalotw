import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Trash2, LogIn } from 'lucide-react';
import { getArticleComments, postArticleComment, deleteArticleComment } from '../api/articles';
import type { ArticleComment } from '../types';
import type { User } from '../types';

interface Props {
  articleId: number;
  currentUser: User | null;
  onRequireAuth: () => void;
}

export default function ArticleComments({ articleId, currentUser, onRequireAuth }: Props) {
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    getArticleComments(articleId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) { onRequireAuth(); return; }
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError('');
    try {
      const newComment = await postArticleComment(articleId, trimmed);
      setComments(prev => [...prev, newComment]);
      setText('');
    } catch (err: any) {
      setError(err?.response?.data?.message || '留言失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('確定要刪除此留言？')) return;
    try {
      await deleteArticleComment(articleId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      alert('刪除失敗，請稍後再試');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

  return (
    <section className="mt-12 border-t border-gray-100 pt-10">
      <h2 className="text-xl font-black mb-6 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-red-600" />
        留言區
        <span className="text-sm font-normal text-gray-400 ml-1">({comments.length})</span>
      </h2>

      {/* 留言輸入框 */}
      <form onSubmit={handleSubmit} className="mb-8">
        {currentUser ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-sm font-black text-white">{currentUser.username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="留下你的看法..."
                maxLength={500}
                rows={3}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{text.length}/500</span>
                <div className="flex items-center gap-3">
                  {error && <span className="text-xs text-red-500">{error}</span>}
                  <button
                    type="submit"
                    disabled={submitting || !text.trim()}
                    className="flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? '送出中...' : '送出'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRequireAuth}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-4 text-gray-400 hover:border-red-300 hover:text-red-500 transition text-sm font-bold"
          >
            <LogIn className="w-4 h-4" />
            登入後即可留言
          </button>
        )}
      </form>

      {/* 留言列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">尚無留言，成為第一個留言的人！</p>
      ) : (
        <ul className="space-y-5">
          {comments.map(c => {
            const canDelete = currentUser && (currentUser.id === c.user_id || currentUser.role === 'admin');
            return (
              <li key={c.id} className="flex gap-3 group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-white">{c.author_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black">{c.author_name}</span>
                    <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition p-1"
                        title="刪除留言"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
