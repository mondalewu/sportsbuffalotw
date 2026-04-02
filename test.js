const cron = require('node-cron');

console.log('--- 🛡️ 啟動測試程式，請等待 10 秒鐘 ---');

// 設定每 10 秒執行一次 (* 號代表秒時，Node-Cron 支援 6 位數)
cron.schedule('*/10 * * * * *', () => {
  console.log('✅ 叮咚！看到這行代表 Node-Cron 安裝成功且運作正常！');
});