import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, addBalance, deductBalance } from '../middleware/auth.js';
import { ITEM_DEFS } from '../itemDefs.js';

const router = Router();

function listingDto(row) {
  const def = ITEM_DEFS[row.item_def_id] ?? {};
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerNick: row.seller_nick,
    itemId: row.item_id,
    itemDefId: row.item_def_id,
    name: def.name ?? row.item_def_id,
    nameUa: def.nameUa ?? row.item_def_id,
    rarity: def.rarity ?? 'common',
    icon: def.icon ?? '📦',
    color: def.color ?? '#9ca3af',
    baseValue: def.value ?? 0,
    price: parseFloat(row.price),
    status: row.status,
    buyerId: row.buyer_id ?? null,
    buyerNick: row.buyer_nick ?? null,
    createdAt: row.created_at,
    soldAt: row.sold_at ?? null,
  };
}

// GET /api/v1/auction — list active listings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM auction_listings WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ ok: true, listings: rows.map(listingDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/auction — list an item
router.post('/', requireAuth, async (req, res) => {
  const { itemId, price } = req.body;
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid price' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify item belongs to user and is not already listed
    const { rows: itemRows } = await client.query(
      `SELECT i.* FROM items i
       LEFT JOIN auction_listings al ON al.item_id = i.id AND al.status = 'ACTIVE'
       WHERE i.id = $1 AND i.user_id = $2 AND al.id IS NULL`,
      [itemId, req.user.id]
    );
    if (!itemRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Item not found or already listed' });
    }
    const item = itemRows[0];
    const { rows } = await client.query(
      `INSERT INTO auction_listings (seller_id, seller_nick, item_id, item_def_id, price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, req.user.nickname, itemId, item.item_def_id, p]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true, listing: listingDto(rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/v1/auction/:id — delist
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE auction_listings SET status = 'CANCELLED'
       WHERE id = $1 AND seller_id = $2 AND status = 'ACTIVE' RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Listing not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/auction/:id/buy
router.post('/:id/buy', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: listRows } = await client.query(
      `SELECT * FROM auction_listings WHERE id = $1 AND status = 'ACTIVE'`,
      [req.params.id]
    );
    const listing = listRows[0];
    if (!listing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Listing not found or sold' });
    }
    if (listing.seller_id === req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Cannot buy your own listing' });
    }

    const price = parseFloat(listing.price);
    // Deduct from buyer
    const { rows: balRows } = await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance`,
      [price, req.user.id]
    );
    if (!balRows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Insufficient balance' });
    }

    // Pay seller (95% — 5% marketplace fee)
    const sellerPayout = parseFloat((price * 0.95).toFixed(2));
    await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [sellerPayout, listing.seller_id]
    );

    // Transfer item to buyer
    await client.query(
      `UPDATE items SET user_id = $1 WHERE id = $2`,
      [req.user.id, listing.item_id]
    );

    // Close listing
    await client.query(
      `UPDATE auction_listings SET status = 'SOLD', buyer_id = $1, buyer_nick = $2, sold_at = NOW()
       WHERE id = $3`,
      [req.user.id, req.user.nickname, listing.id]
    );

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
