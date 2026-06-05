import { Router } from 'express';
import pool from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { ticketDto } from './tickets.js';

const router = Router();

function userDto(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    discord: row.discord,
    role: row.role,
    balance: parseFloat(row.balance),
  };
}

// GET /api/v1/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
    res.json({ ok: true, users: rows.map(userDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/users/:id
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const { nickname, role, balance } = req.body;
  if (!nickname?.trim()) return res.status(400).json({ ok: false, error: 'nickname required' });
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ ok: false, error: 'invalid role' });
  if (!Number.isFinite(Number(balance))) return res.status(400).json({ ok: false, error: 'invalid balance' });

  try {
    const { rows } = await pool.query(
      `UPDATE users SET nickname = $1, role = $2, balance = $3 WHERE id = $4 RETURNING *`,
      [nickname.trim(), role, balance, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: userDto(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Nickname already taken' });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ ok: false, error: 'Cannot delete your own account' });
  }
  try {
    const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/v1/admin/tickets — note: frontend expects key "ticket" (singular)
router.get('/tickets', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.nickname, u.discord FROM tickets t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC`
    );
    res.json({ ok: true, ticket: rows.map(ticketDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/tickets/:id
router.patch('/tickets/:id', requireAdmin, async (req, res) => {
  const { status, note } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status must be APPROVED or REJECTED' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE tickets SET status = $1, note = $2, resolved_at = NOW()
       WHERE id = $3 AND status = 'PENDING' RETURNING *`,
      [status, note ?? null, req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Ticket not found or already resolved' });
    }
    const ticket = rows[0];
    if (status === 'APPROVED') {
      const delta = ticket.type === 'DEPOSIT' ? ticket.amount : -ticket.amount;
      await client.query(
        `UPDATE users SET balance = balance + $1 WHERE id = $2`,
        [delta, ticket.user_id]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
