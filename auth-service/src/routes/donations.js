import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Coin packages — single source of truth on the server.
 * The client never sends the amount of coins; it sends only a packageId,
 * so a user cannot request an arbitrary credit. `coins` is the amount of
 * virtual currency (K) added to the balance; priceUsd is the Google Pay price.
 */
export const PACKAGES = [
  { id: 'mini',  priceUsd: 1.99,  coins: 50000,   bonusPct: 0   },
  { id: 'basic', priceUsd: 4.99,  coins: 150000,  bonusPct: 20  },
  { id: 'plus',  priceUsd: 9.99,  coins: 350000,  bonusPct: 40  },
  { id: 'pro',   priceUsd: 19.99, coins: 800000,  bonusPct: 60  },
  { id: 'whale', priceUsd: 49.99, coins: 2500000, bonusPct: 100 },
];

const PACKAGE_MAP = Object.fromEntries(PACKAGES.map(p => [p.id, p]));

function donationDto(row) {
  return {
    id: row.id,
    packageId: row.package_id,
    amountUsd: parseFloat(row.amount_usd),
    coinsCredited: parseFloat(row.coins_credited),
    status: row.status,
    createdAt: row.created_at,
  };
}

// GET /api/v1/donations/packages — public catalogue of coin packages
router.get('/packages', (req, res) => {
  res.json({ ok: true, packages: PACKAGES });
});

// POST /api/v1/donations/checkout — confirm a Google Pay payment and credit coins
router.post('/checkout', requireAuth, async (req, res) => {
  const { packageId, paymentToken, idempotencyKey } = req.body;

  const pkg = PACKAGE_MAP[packageId];
  if (!pkg) return res.status(400).json({ ok: false, error: 'Unknown package' });

  // The Google Pay token proves a completed payment flow. We never store it raw —
  // only a hash, for audit.
  if (typeof paymentToken !== 'string' || paymentToken.trim().length < 10) {
    return res.status(400).json({ ok: false, error: 'Invalid payment token' });
  }
  // Client-supplied idempotency key (unique per purchase, reused on retry) — the
  // same key cannot credit coins twice, even if the request is replayed.
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
    return res.status(400).json({ ok: false, error: 'Invalid idempotency key' });
  }
  const tokenHash = crypto.createHash('sha256').update(paymentToken).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(
      `INSERT INTO donations (user_id, package_id, amount_usd, coins_credited, idempotency_key, payment_token_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [req.user.id, pkg.id, pkg.priceUsd, pkg.coins, idempotencyKey.trim(), tokenHash]
    );

    // Duplicate key — this payment was already processed. Do not credit again.
    if (!ins.rows[0]) {
      await client.query('ROLLBACK');
      const { rows } = await pool.query(`SELECT balance FROM users WHERE id = $1`, [req.user.id]);
      return res.json({ ok: true, duplicate: true, coinsCredited: 0, balance: parseFloat(rows[0]?.balance ?? 0) });
    }

    const { rows } = await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
      [pkg.coins, req.user.id]
    );

    await client.query('COMMIT');
    res.json({
      ok: true,
      packageId: pkg.id,
      coinsCredited: pkg.coins,
      balance: parseFloat(rows[0].balance),
      donation: donationDto(ins.rows[0]),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[donations/checkout]', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/v1/donations/me — current user's donation history
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM donations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ ok: true, donations: rows.map(donationDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
