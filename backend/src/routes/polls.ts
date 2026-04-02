import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// Helper: get poll with options + vote counts
async function getPollWithCounts(pollId: number) {
  const pollRes = await pool.query(
    `SELECT p.*, u.username AS created_by_name
     FROM polls p LEFT JOIN users u ON u.id = p.created_by
     WHERE p.id = $1`,
    [pollId]
  );
  if (!pollRes.rows[0]) return null;

  const optionsRes = await pool.query(
    `SELECT o.id, o.option_text, o.display_order,
            COUNT(v.id)::INT AS vote_count
     FROM poll_options o
     LEFT JOIN poll_votes v ON v.option_id = o.id
     WHERE o.poll_id = $1
     GROUP BY o.id
     ORDER BY o.display_order ASC, o.id ASC`,
    [pollId]
  );

  const totalVotes = optionsRes.rows.reduce((s: number, r: any) => s + r.vote_count, 0);

  return {
    ...pollRes.rows[0],
    options: optionsRes.rows.map((o: any) => ({
      ...o,
      percentage: totalVotes > 0 ? Math.round((o.vote_count / totalVotes) * 100) : 0,
    })),
    total_votes: totalVotes,
  };
}

// GET /api/v1/polls — list active polls
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id FROM polls WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 20`
    );
    const polls = await Promise.all(result.rows.map((r: any) => getPollWithCounts(r.id)));
    res.json(polls.filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// GET /api/v1/polls/all — admin: all polls including inactive
router.get('/all', verifyToken, requireRole('editor', 'admin'), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id FROM polls ORDER BY created_at DESC`
    );
    const polls = await Promise.all(result.rows.map((r: any) => getPollWithCounts(r.id)));
    res.json(polls.filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// GET /api/v1/polls/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const poll = await getPollWithCounts(Number(req.params.id));
    if (!poll) return res.status(404).json({ message: '投票不存在' });
    res.json(poll);
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// POST /api/v1/polls — admin: create poll
router.post('/', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response) => {
  const { question, category = 'general', allow_multiple = false, ends_at, options } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ message: '需要題目和至少兩個選項' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pollRes = await client.query(
      `INSERT INTO polls (question, category, allow_multiple, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [question, category, allow_multiple, ends_at || null, req.user!.userId]
    );
    const pollId = pollRes.rows[0].id;
    for (let i = 0; i < options.length; i++) {
      await client.query(
        `INSERT INTO poll_options (poll_id, option_text, display_order) VALUES ($1, $2, $3)`,
        [pollId, options[i], i]
      );
    }
    await client.query('COMMIT');
    const poll = await getPollWithCounts(pollId);
    res.status(201).json(poll);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: '建立投票失敗' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/polls/:id — admin: update poll settings
router.put('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response) => {
  const { question, category, is_active, ends_at } = req.body;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (question !== undefined) { fields.push(`question = $${idx++}`); values.push(question); }
  if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
  if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
  if (ends_at !== undefined) { fields.push(`ends_at = $${idx++}`); values.push(ends_at || null); }
  if (!fields.length) return res.status(400).json({ message: '沒有要更新的欄位' });
  values.push(Number(req.params.id));
  try {
    await pool.query(`UPDATE polls SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    const poll = await getPollWithCounts(Number(req.params.id));
    res.json(poll);
  } catch (err) {
    res.status(500).json({ message: '更新失敗' });
  }
});

// POST /api/v1/polls/:id/options — admin: add option to existing poll
router.post('/:id/options', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response) => {
  const { option_text } = req.body;
  if (!option_text) return res.status(400).json({ message: '選項文字不可為空' });
  try {
    const maxOrder = await pool.query(
      `SELECT COALESCE(MAX(display_order), -1) AS max_order FROM poll_options WHERE poll_id = $1`,
      [Number(req.params.id)]
    );
    await pool.query(
      `INSERT INTO poll_options (poll_id, option_text, display_order) VALUES ($1, $2, $3)`,
      [Number(req.params.id), option_text, maxOrder.rows[0].max_order + 1]
    );
    const poll = await getPollWithCounts(Number(req.params.id));
    res.status(201).json(poll);
  } catch (err) {
    res.status(500).json({ message: '新增選項失敗' });
  }
});

// DELETE /api/v1/polls/:id/options/:optionId — admin
router.delete('/:id/options/:optionId', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response) => {
  try {
    await pool.query(
      `DELETE FROM poll_options WHERE id = $1 AND poll_id = $2`,
      [Number(req.params.optionId), Number(req.params.id)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: '刪除選項失敗' });
  }
});

// POST /api/v1/polls/:id/vote
router.post('/:id/vote', async (req: Request, res: Response) => {
  const { option_id } = req.body;
  if (!option_id) return res.status(400).json({ message: '請選擇投票選項' });

  const pollId = Number(req.params.id);
  const optionId = Number(option_id);

  try {
    // Verify option belongs to this poll
    const optCheck = await pool.query(
      `SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2`,
      [optionId, pollId]
    );
    if (!optCheck.rows[0]) return res.status(400).json({ message: '選項不存在' });

    // Check poll is active
    const pollCheck = await pool.query(
      `SELECT is_active, ends_at FROM polls WHERE id = $1`,
      [pollId]
    );
    if (!pollCheck.rows[0]?.is_active) return res.status(403).json({ message: '此投票已關閉' });
    if (pollCheck.rows[0]?.ends_at && new Date(pollCheck.rows[0].ends_at) < new Date()) {
      return res.status(403).json({ message: '投票已截止' });
    }

    const voterIp = req.ip || '';
    const userId = req.user?.userId || null;

    if (userId) {
      // Logged in: enforce one vote per user per poll
      try {
        await pool.query(
          `INSERT INTO poll_votes (poll_id, option_id, user_id, voter_ip) VALUES ($1, $2, $3, $4)`,
          [pollId, optionId, userId, voterIp]
        );
      } catch (err: any) {
        if (err.code === '23505') return res.status(409).json({ message: '您已投票過' });
        throw err;
      }
    } else {
      // Anonymous: track by IP, allow re-vote (update)
      const existing = await pool.query(
        `SELECT id FROM poll_votes WHERE poll_id = $1 AND voter_ip = $2 AND user_id IS NULL`,
        [pollId, voterIp]
      );
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE poll_votes SET option_id = $1 WHERE id = $2`,
          [optionId, existing.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO poll_votes (poll_id, option_id, user_id, voter_ip) VALUES ($1, $2, NULL, $3)`,
          [pollId, optionId, voterIp]
        );
      }
    }

    const poll = await getPollWithCounts(pollId);
    res.json(poll);
  } catch (err) {
    res.status(500).json({ message: '投票失敗' });
  }
});

// DELETE /api/v1/polls/:id — admin
router.delete('/:id', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response) => {
  try {
    await pool.query(`DELETE FROM polls WHERE id = $1`, [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: '刪除失敗' });
  }
});

export default router;
