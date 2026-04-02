import fs from 'fs';
import path from 'path';
import pool from './pool';

async function seedCPBL2026() {
  const client = await pool.connect();
  try {
    console.log('🌱 載入 CPBL 2026 完整賽程...');
    const sql = fs.readFileSync(path.join(__dirname, 'cpbl2026.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ CPBL 2026 賽程（326場）Seed 完成');
  } catch (err) {
    console.error('❌ CPBL 2026 Seed 失敗:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCPBL2026();

