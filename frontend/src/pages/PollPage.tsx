import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import PollVote from '../components/PollVote';
import { getPolls } from '../api/polls';
import type { Poll } from '../api/polls';

export default function PollPage() {
  const { currentUser, setAuthModal } = useApp();
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(true);

  useEffect(() => {
    setPollsLoading(true);
    getPolls().then(setPolls).finally(() => setPollsLoading(false));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center text-gray-400 hover:text-black font-black transition">
        <ArrowLeft className="w-5 h-5 mr-2" /> 返回首頁
      </button>
      <h1 className="text-4xl font-black italic mb-2">球迷 <span className="text-red-600">投票</span></h1>
      <p className="text-gray-500 text-sm mb-8">針對最新棒球議題，表達您的看法！</p>

      {pollsLoading ? (
        <div className="text-center py-16 text-gray-400 font-bold">載入中...</div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 font-bold text-lg">目前沒有進行中的投票</p>
          <p className="text-gray-300 text-sm mt-2">請稍後再回來查看</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {polls.map(poll => (
            <PollVote
              key={poll.id}
              poll={poll}
              onVoted={updated => setPolls(prev => prev.map(p => p.id === updated.id ? updated : p))}
              currentUser={currentUser}
              onRequireAuth={() => setAuthModal('login')}
            />
          ))}
        </div>
      )}
    </main>
  );
}
