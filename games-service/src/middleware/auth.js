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

export async function deductBalance(userId, amount) {
  const { rows } = await pool.query(
    `UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance`,
    [amount, userId]
  );
  if (!rows[0]) throw new Error('Insufficient balance');
  return parseFloat(rows[0].balance);
}

export async function addBalance(userId, amount) {
  const { rows } = await pool.query(
    `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
    [amount, userId]
  );
  return parseFloat(rows[0]?.balance ?? 0);
}

export async function getBalance(userId) {
  const { rows } = await pool.query(`SELECT balance FROM users WHERE id = $1`, [userId]);
  return parseFloat(rows[0]?.balance ?? 0);
}

// Track game statistics (fire-and-forget)
export function recordStats(userId, gameType, wagered, won) {
  const biggestWin = won > 0 ? won : 0;
  pool.query(
    `INSERT INTO game_stats (user_id, game_type, games_played, total_wagered, total_won, biggest_win)
     VALUES ($1, $2, 1, $3, $4, $5)
     ON CONFLICT (user_id, game_type) DO UPDATE SET
       games_played = game_stats.games_played + 1,
       total_wagered = game_stats.total_wagered + $3,
       total_won = game_stats.total_won + $4,
       biggest_win = GREATEST(game_stats.biggest_win, $5)`,
    [userId, gameType, wagered, won, biggestWin]
  ).catch(() => {});
}
