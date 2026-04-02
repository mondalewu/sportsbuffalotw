import type { ScraperStatus } from '../api/scraper';

export default function ScraperStatusCard({ status }: { status: ScraperStatus }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-400 font-bold mb-1">上次執行</p>
        <p className="font-bold text-gray-700 truncate">
          {status.lastRun ? new Date(status.lastRun).toLocaleString('zh-TW') : '—'}
        </p>
      </div>
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-400 font-bold mb-1">更新場次</p>
        <p className="font-black text-gray-800">{status.gamesUpdated} 場</p>
      </div>
      <div className={`rounded-xl p-3 col-span-2 ${status.isRunning ? 'bg-yellow-50' : status.lastError ? 'bg-red-50' : 'bg-green-50'}`}>
        <p className="text-xs font-bold mb-1 text-gray-500">最後結果</p>
        <p className={`font-bold text-sm ${status.isRunning ? 'text-yellow-700' : status.lastError ? 'text-red-700' : 'text-green-700'}`}>
          {status.isRunning ? '⏳ 執行中...' : status.lastResult || '—'}
        </p>
        {status.lastError && <p className="text-xs text-red-500 mt-1">{status.lastError}</p>}
      </div>
    </div>
  );
}
