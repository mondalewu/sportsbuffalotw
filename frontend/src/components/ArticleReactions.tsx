import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getCommentReactions, toggleCommentReaction } from '../api/articles';

interface Props {
  articleId: number;
  commentId: number;
}

const REACTIONS = [
  { key: 'empathy', emoji: '🥹', label: '有感' },
  { key: 'informative', emoji: '💡', label: '漲知識' },
  { key: 'hmm', emoji: '🤔', label: '嗯' },
] as const;

export default function CommentReactions({ articleId, commentId }: Props) {
  const { currentUser, setAuthModal } = useApp();
  const [counts, setCounts] = useState<Record<string, number>>({ empathy: 0, informative: 0, hmm: 0 });
  const [userReactions, setUserReactions] = useState<string[]>([]);

  useEffect(() => {
    getCommentReactions(articleId, commentId)
      .then(r => { setCounts(r.counts); setUserReactions(r.userReactions); })
      .catch(() => {});
  }, [articleId, commentId]);

  const handle = async (key: string) => {
    if (!currentUser) { setAuthModal('login'); return; }
    try {
      const r = await toggleCommentReaction(articleId, commentId, key);
      setCounts(r.counts);
      setUserReactions(r.userReactions);
    } catch {}
  };

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {REACTIONS.map(({ key, emoji, label }) => {
        const active = userReactions.includes(key);
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            onClick={() => handle(key)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition
              ${active
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-gray-50 text-gray-400 border border-transparent hover:bg-gray-100'
              }`}
          >
            <span className="text-xs">{emoji}</span>
            {count > 0 && <span className="font-bold tabular-nums">{count}</span>}
            {count === 0 && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
