import fs from 'fs';
import path from 'path';
import pool from './pool';

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
  try {
    await pool.query(sql);
    console.log('✅ Migration 完成');
  } catch (err) {
    console.error('❌ Migration 失敗:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
