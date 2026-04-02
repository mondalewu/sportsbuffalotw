import React, { useState } from 'react';
import { votePoll } from '../api/polls';
import type { Poll } from '../api/polls';

interface Props {
  poll: Poll;
  onVoted: (updated: Poll) => void;
  currentUser?: { id: number; role: string } | null;
  onRequireAuth?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  CPBL: 'bg-red-100 text-red-700',
  NPB: 'bg-blue-100 text-blue-700',
  WBC: 'bg-indigo-100 text-indigo-700',
  MLB: 'bg-green-100 text-green-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function PollVote({ poll, onVoted, currentUser, onRequireAuth }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Poll>(poll);

  const handleVote = async () => {
    if (!selectedId) return;
    if (!currentUser) {
      onRequireAuth?.();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updated = await votePoll(poll.id, selectedId);
      setResult(updated);
      setVoted(true);
      onVoted(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || '投票失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const catColor = CATEGORY_COLORS[result.category] ?? CATEGORY_COLORS.general;
  const isExpired = result.ends_at && new Date(result.ends_at) < new Date();
  const showResults = voted || !result.is_active || isExpired;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mr-2 ${catColor}`}>
            {result.category.toUpperCase()}
          </span>
          {!result.is_active && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">已關閉</span>
          )}
          {isExpired && result.is_active && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">已截止</span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 font-bold shrink-0">{result.total_votes} 票</span>
      </div>

      <h3 className="font-black text-lg leading-snug mb-5">{result.question}</h3>

      {/* Options */}
      <div className="space-y-3 mb-5">
        {result.options.map(opt => (
          <div key={opt.id}>
            {showResults ? (
              // Result bar
              <div>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span className={opt.id === selectedId ? 'text-red-600' : 'text-gray-700'}>{opt.option_text}</span>
                  <span className="text-gray-500">{opt.percentage}% ({opt.vote_count}票)</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${opt.id === selectedId ? 'bg-red-500' : 'bg-gray-300'}`}
                    style={{ width: `${opt.percentage}%` }}
                  />
                </div>
              </div>
            ) : (
              // Selectable option
              <button
                onClick={() => {
                  if (!currentUser) { onRequireAuth?.(); return; }
                  setSelectedId(opt.id);
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 font-bold text-sm transition-all ${
                  selectedId === opt.id
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-400 text-gray-700'
                }`}
              >
                <span className={`inline-block w-4 h-4 rounded-full border-2 mr-2 align-middle transition-all ${
                  selectedId === opt.id ? 'border-red-500 bg-red-500' : 'border-gray-300'
                }`} />
                {opt.option_text}
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-xs font-bold mb-3">{error}</p>}

      {!showResults && (
        <button
          onClick={handleVote}
          disabled={!selectedId || loading}
          className="w-full bg-red-600 text-white py-2.5 rounded-xl font-black text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {loading ? '投票中...' : '送出投票'}
        </button>
      )}

      {voted && (
        <p className="text-center text-xs text-green-600 font-bold mt-2">✓ 感謝您的投票！</p>
      )}

      {result.ends_at && !isExpired && (
        <p className="text-center text-[10px] text-gray-400 mt-3">
          截止：{new Date(result.ends_at).toLocaleDateString('zh-TW')}
        </p>
      )}
    </div>
  );
}
