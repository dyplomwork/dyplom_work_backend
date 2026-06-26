import jwt from 'jsonwebtoken';
import pool from '../db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT role, status, token_version FROM users WHERE id = $1`,
      [payload.id]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ ok: false, error: 'Invalid token' });
    if (u.status === 'banned') return res.status(403).json({ ok: false, error: 'Account banned' });
    if (Number(payload.tv ?? 0) !== Number(u.token_version)) {
      return res.status(401).json({ ok: false, error: 'Session expired' });
    }
    req.user = { ...payload, role: u.role };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    next();
  });
}
