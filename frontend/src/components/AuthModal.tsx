import React, { useState } from 'react';
import { X } from 'lucide-react';
import { login, register } from '../api/auth';
import type { User as UserType } from '../types';

interface Props {
  mode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserType) => void;
}

export default function AuthModal({ mode, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState(mode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user: UserType;
      if (currentMode === 'login') {
        user = await login({ email: form.email, password: form.password });
      } else {
        user = await register(form);
      }
      onSuccess(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失敗，請再試一次';
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black">{currentMode === 'login' ? '登入' : '註冊'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4 font-bold">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={form.email} required
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
          {currentMode === 'register' && (
            <input type="text" placeholder="使用者名稱（3-50字）" value={form.username} required minLength={3}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
          )}
          <input type="password" placeholder="密碼（最少8字）" value={form.password} required minLength={8}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-black hover:bg-red-700 transition disabled:opacity-50">
            {loading ? '處理中...' : currentMode === 'login' ? '登入' : '建立帳號'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          {currentMode === 'login' ? '還沒有帳號？' : '已有帳號？'}
          <button className="text-red-600 font-bold ml-1"
            onClick={() => setCurrentMode(m => m === 'login' ? 'register' : 'login')}>
            {currentMode === 'login' ? '立即註冊' : '前往登入'}
          </button>
        </p>
      </div>
    </div>
  );
}
