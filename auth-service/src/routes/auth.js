import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { userDto } from '../utils/dto.js';

const router = Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, nickname: user.nickname, role: user.role, tv: user.token_version ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/v1/accounts/auth/register
router.post('/auth/register', async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) {
    return res.status(400).json({ ok: false, error: 'nickname and password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (nickname, password_hash) VALUES ($1, $2) RETURNING *`,
      [nickname.trim(), hash]
    );
    const user = rows[0];
    res.status(201).json({ ok: true, token: makeToken(user), user: userDto(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Нікнейм вже зайнятий' });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/accounts/auth/login
router.post('/auth/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ ok: false, error: 'login and password are required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE nickname = $1`,
      [login.trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ ok: false, error: 'Account banned' });
    }
    res.json({ ok: true, token: makeToken(user), user: userDto(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/accounts/logout
router.post('/logout', requireAuth, (req, res) => {
  res.json({ ok: true });
});

// GET /api/v1/accounts/users/me
router.get('/users/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: userDto(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/v1/accounts/users/me/balance
router.get('/users/me/balance', requireAuth, async (req, res) => {
  try {
    // Also return role so client can react to admin role changes without re-login
    const { rows } = await pool.query(`SELECT balance, role, nickname FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, balance: parseFloat(rows[0].balance), role: rows[0].role, nickname: rows[0].nickname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/accounts/auth/google — Google OAuth sign-in / sign-up
router.post('/auth/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ ok: false, error: 'idToken required' });

  try {
    // Verify Google ID token via Google's tokeninfo endpoint (no extra library needed)
    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const payload = await gRes.json();

    if (!gRes.ok || payload.error) {
      return res.status(401).json({ ok: false, error: 'Invalid Google token' });
    }

    // Audience check is mandatory: without it, an ID token minted for ANY other
    // Google app would be accepted here. Refuse to run sign-in if unconfigured.
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[Google OAuth] GOOGLE_CLIENT_ID is not configured');
      return res.status(503).json({ ok: false, error: 'Google sign-in is not configured' });
    }
    if (payload.aud !== clientId) {
      return res.status(401).json({ ok: false, error: 'Token audience mismatch' });
    }

    const googleSub = payload.sub;
    const rawName  = payload.name || payload.email?.split('@')[0] || `user${googleSub.slice(-6)}`;

    // Find existing user by google_sub
    let { rows } = await pool.query(`SELECT * FROM users WHERE google_sub = $1`, [googleSub]);
    let user = rows[0];

    if (user && user.status === 'banned') {
      return res.status(403).json({ ok: false, error: 'Account banned' });
    }

    if (!user) {
      // New Google user — generate a unique nickname
      let base = rawName.replace(/[^\w\-\.а-яА-ЯёЁіїєІЇЄ]/gu, '').slice(0, 40) || `g${googleSub.slice(-8)}`;
      const { rows: taken } = await pool.query(`SELECT id FROM users WHERE nickname = $1`, [base]);
      if (taken.length > 0) base = `${base}_${googleSub.slice(-4)}`;

      const { rows: created } = await pool.query(
        `INSERT INTO users (nickname, password_hash, google_sub, avatar_url) VALUES ($1, '', $2, $3) RETURNING *`,
        [base, googleSub, payload.picture ?? null]
      );
      user = created[0];
    } else if (payload.picture && !user.avatar_url) {
      // Existing Google user — update avatar if they don't have one yet
      const { rows: updated } = await pool.query(
        `UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *`,
        [payload.picture, user.id]
      );
      user = updated[0];
    }

    res.json({ ok: true, token: makeToken(user), user: userDto(user) });
  } catch (err) {
    console.error('[Google OAuth]', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// PATCH /api/v1/accounts/users/me — change nickname and/or avatar_url
router.patch('/users/me', requireAuth, async (req, res) => {
  const { nickname, avatar_url } = req.body;

  const updates = [];
  const values = [];

  if (nickname !== undefined) {
    if (!nickname?.trim() || nickname.trim().length < 3 || nickname.trim().length > 50) {
      return res.status(400).json({ ok: false, error: 'Nickname must be 3-50 characters' });
    }
    updates.push(`nickname = $${values.length + 1}`);
    values.push(nickname.trim());
  }

  if (avatar_url !== undefined) {
    // null or empty string clears the avatar
    updates.push(`avatar_url = $${values.length + 1}`);
    values.push(avatar_url || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nothing to update' });
  }

  values.push(req.user.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: userDto(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Nickname already taken' });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
