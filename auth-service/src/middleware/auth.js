import jwt from 'jsonwebtoken';
import pool from '../db.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

// Always checks role from DB — not from JWT (prevents stale token issues)
export function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const { rows } = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.user.id]);
      if (!rows[0] || rows[0].role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      req.user.role = 'admin'; // sync in case JWT is stale
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}
