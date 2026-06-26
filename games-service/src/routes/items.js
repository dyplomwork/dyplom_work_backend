import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, addBalance } from '../middleware/auth.js';
import { ITEM_DEFS, getItemDef } from '../itemDefs.js';

const router = Router();

function itemDto(row) {
  const def = ITEM_DEFS[row.item_def_id] ?? {};
  return {
    id: row.id,
    itemDefId: row.item_def_id,
    name: def.name ?? row.item_def_id,
    nameUa: def.nameUa ?? row.item_def_id,
    rarity: def.rarity ?? 'common',
    icon: def.icon ?? '📦',
    color: def.color ?? '#9ca3af',
    value: def.value ?? 0,
    source: row.source,
    listedAt: row.listed_at ?? null,
    createdAt: row.created_at,
  };
}

router.get('/defs', (req, res) => {
  res.json(Object.values(ITEM_DEFS));
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, al.id as listing_id
       FROM items i
       LEFT JOIN auction_listings al ON al.item_id = i.id AND al.status = 'ACTIVE'
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json({
      ok: true,
      items: rows.map(r => ({ ...itemDto(r), listingId: r.listing_id ?? null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

router.post('/:itemId/sell-vendor', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.* FROM items i
       LEFT JOIN auction_listings al ON al.item_id = i.id AND al.status = 'ACTIVE'
       WHERE i.id = $1 AND i.user_id = $2`,
      [req.params.itemId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Item not found or not yours' });

    const item = rows[0];
    const def = getItemDef(item.item_def_id);
    const baseValue = def?.value ?? 0;
    const sellPrice = Math.floor(baseValue * 0.5);

    if (sellPrice <= 0) return res.status(400).json({ ok: false, error: 'Item has no sell value' });

    await pool.query(`DELETE FROM items WHERE id = $1`, [item.id]);
    const newBalance = await addBalance(req.user.id, sellPrice);

    res.json({ ok: true, gained: sellPrice, balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
