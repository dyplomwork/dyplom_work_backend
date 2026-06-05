import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function ticketDto(row) {
  return {
    id: Number(row.id),
    ownerId: row.user_id,
    type: row.type,
    amount: parseFloat(row.amount),
    status: row.status,
    note: row.note ?? null,
    nickname: row.nickname ?? null,
    discord: row.discord ?? null,
    createdAt: row.created_at,
    closedAt: row.resolved_at ?? null,
  };
}

// POST /api/v1/tickets/me — create deposit or withdraw request
router.post('/me', requireAuth, async (req, res) => {
  const { type, amount } = req.body;
  if (!['DEPOSIT', 'WITHDRAW'].includes(type)) {
    return res.status(400).json({ ok: false, error: 'type must be DEPOSIT or WITHDRAW' });
  }
  if (!amount || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'amount must be positive' });
  }
  try {
    if (type === 'WITHDRAW') {
      const { rows } = await pool.query(`SELECT balance FROM users WHERE id = $1`, [req.user.id]);
      if (parseFloat(rows[0]?.balance ?? 0) < amount) {
        return res.status(400).json({ ok: false, error: 'Insufficient balance' });
      }
    }
    await pool.query(
      `INSERT INTO tickets (user_id, type, amount) VALUES ($1, $2, $3)`,
      [req.user.id, type, amount]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/v1/tickets/me — list user's own tickets
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.nickname, u.discord FROM tickets t
       JOIN users u ON u.id = t.user_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json({ ok: true, tickets: rows.map(ticketDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export { ticketDto };
export default router;
