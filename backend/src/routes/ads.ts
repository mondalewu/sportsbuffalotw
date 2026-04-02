import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/v1/ads
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { position } = req.query;

  try {
    let query = `
      SELECT * FROM ad_placements
      WHERE is_active = true
        AND (start_date IS NULL OR start_date <= CURRENT_DATE)
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    `;
    const params: string[] = [];

    if (position) {
      params.push(position as string);
      query += ` AND position = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get ads error:', err);
    res.status(500).json({ message: '無法取得廣告版位' });
  }
});

// POST /api/v1/ads  [admin]
router.post('/', verifyToken, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const { name, type, position, ad_code, image_url, link_url, client_name, start_date, end_date } = req.body;

  if (!name || !type || !position) {
    res.status(400).json({ message: '名稱、類型、版位為必填' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO ad_placements (name, type, position, ad_code, image_url, link_url, client_name, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, type, position, ad_code || null, image_url || null, link_url || null, client_name || null, start_date || null, end_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create ad error:', err);
    res.status(500).json({ message: '建立廣告版位失敗' });
  }
});

// PUT /api/v1/ads/:id  [admin]
router.put('/:id', verifyToken, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const { name, type, position, ad_code, image_url, link_url, client_name, start_date, end_date, is_active } = req.body;

  try {
    const result = await pool.query(
      `UPDATE ad_placements
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           position = COALESCE($3, position),
           ad_code = COALESCE($4, ad_code),
           image_url = COALESCE($5, image_url),
           link_url = COALESCE($6, link_url),
           client_name = COALESCE($7, client_name),
           start_date = COALESCE($8, start_date),
           end_date = COALESCE($9, end_date),
           is_active = COALESCE($10, is_active)
       WHERE id = $11
       RETURNING *`,
      [name, type, position, ad_code, image_url, link_url, client_name, start_date, end_date, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: '廣告版位不存在' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update ad error:', err);
    res.status(500).json({ message: '更新廣告版位失敗' });
  }
});

export default router;
