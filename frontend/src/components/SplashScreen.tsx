import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    const alreadyShown = sessionStorage.getItem('splash_shown');

    if (isStandalone && !alreadyShown) {
      setVisible(true);
      sessionStorage.setItem('splash_shown', '1');

      const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
      const hideTimer = setTimeout(() => setVisible(false), 2800);

      return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-950 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Logo 圖片 */}
      <div className="flex flex-col items-center gap-6 animate-[splashIn_0.6s_ease-out]">
        <img
          src="/icons/icon-512.png"
          alt="水牛體育"
          className="w-28 h-28 rounded-3xl shadow-2xl"
        />

        {/* App 名稱 */}
        <div className="text-center">
          <div className="flex items-baseline justify-center font-black italic text-3xl tracking-tighter mb-1">
            <span className="text-white">SPORTS</span>
            <span className="text-red-500 ml-2">BUFFALO</span>
          </div>
          <p className="text-gray-400 text-sm font-medium tracking-widest">水牛體育</p>
        </div>

        {/* 載入指示器 */}
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-red-500"
              style={{ animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>

      <p className="absolute bottom-10 text-gray-600 text-xs tracking-widest">台灣最即時的體育新聞平台</p>

      <style>{`
        @keyframes splashIn {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
