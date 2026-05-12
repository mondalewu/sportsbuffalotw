import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { verifyToken } from '../middleware/auth';

const router = Router();

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 24 * 60 * 60 * 1000,
};

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    res.status(400).json({ message: '請填寫所有必填欄位' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ message: '密碼需至少 8 個字元' });
    return;
  }
  if (username.length < 3 || username.length > 50) {
    res.status(400).json({ message: '使用者名稱需為 3-50 個字元' });
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ message: '此 Email 已被使用' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, username, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role',
      [email, password_hash, username, 'member']
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '24h' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: '請填寫 Email 與密碼' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, email, username, role, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ message: '帳號或密碼錯誤' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: '帳號或密碼錯誤' });
      return;
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, email: user.email, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax' });
  res.json({ message: '已成功登出' });
});

// GET /api/v1/auth/me
router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '用戶不存在' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

export default router;
