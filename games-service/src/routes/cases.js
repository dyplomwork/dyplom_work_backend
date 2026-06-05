import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, deductBalance, addBalance, recordStats } from '../middleware/auth.js';
import { ITEM_DEFS } from '../itemDefs.js';

const router = Router();

const CASES = {
  starter: {
    id: 'starter', name: 'Starter Case', nameUa: 'Стартовий кейс',
    price: 10000,
    modelEmoji: '📦',
    items: [
      { itemDefId: 'wood_chip',      chance: 0.30 },
      { itemDefId: 'bronze_shard',   chance: 0.28 },
      { itemDefId: 'iron_nugget',    chance: 0.20 },
      { itemDefId: 'silver_shard',   chance: 0.12 },
      { itemDefId: 'emerald_gem',    chance: 0.07 },
      { itemDefId: 'lucky_coin',     chance: 0.025 },
      { itemDefId: 'sapphire',       chance: 0.005 },
    ],
  },
  premium: {
    id: 'premium', name: 'Premium Case', nameUa: 'Преміум кейс',
    price: 50000,
    modelEmoji: '💼',
    items: [
      { itemDefId: 'silver_shard',   chance: 0.25 },
      { itemDefId: 'emerald_gem',    chance: 0.22 },
      { itemDefId: 'lucky_coin',     chance: 0.18 },
      { itemDefId: 'sapphire',       chance: 0.14 },
      { itemDefId: 'iron_sword',     chance: 0.10 },
      { itemDefId: 'golden_shield',  chance: 0.06 },
      { itemDefId: 'dragon_crystal', chance: 0.03 },
      { itemDefId: 'shadow_crown',   chance: 0.018 },
      { itemDefId: 'ancient_relic',  chance: 0.01 },
      { itemDefId: 'void_artifact',  chance: 0.002 },
    ],
  },
  elite: {
    id: 'elite', name: 'Elite Case', nameUa: 'Елітний кейс',
    price: 100000,
    modelEmoji: '👜',
    items: [
      { itemDefId: 'sapphire',       chance: 0.20 },
      { itemDefId: 'iron_sword',     chance: 0.18 },
      { itemDefId: 'golden_shield',  chance: 0.15 },
      { itemDefId: 'dragon_crystal', chance: 0.14 },
      { itemDefId: 'shadow_crown',   chance: 0.12 },
      { itemDefId: 'void_essence',   chance: 0.10 },
      { itemDefId: 'ancient_relic',  chance: 0.055 },
      { itemDefId: 'void_artifact',  chance: 0.025 },
      { itemDefId: 'phoenix_feather',chance: 0.009 },
      { itemDefId: 'divine_relic',   chance: 0.0009 },
      { itemDefId: 'cosmos_gem',     chance: 0.0001 },
    ],
  },
};

function rollItem(items) {
  const r = Math.random();
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.chance;
    if (r <= cumulative) return item;
  }
  return items[items.length - 1];
}

function caseToDto(c) {
  return {
    id: c.id, name: c.name, nameUa: c.nameUa,
    price: c.price, modelEmoji: c.modelEmoji,
    items: c.items.map(i => {
      const def = ITEM_DEFS[i.itemDefId];
      return {
        itemDefId: i.itemDefId,
        name: def?.name ?? i.itemDefId,
        nameUa: def?.nameUa ?? i.itemDefId,
        rarity: def?.rarity ?? 'common',
        icon: def?.icon ?? '📦',
        color: def?.color ?? '#fff',
        value: def?.value ?? 0,
        chance: i.chance,
        prize: def?.value ?? 0,
      };
    }),
  };
}

// GET /api/v1/games/cases
router.get('/', (req, res) => {
  res.json(Object.values(CASES).map(caseToDto));
});

// GET /api/v1/games/cases/:id
router.get('/:id', (req, res) => {
  if (req.params.id === 'game') return res.status(404).json({ ok: false, error: 'Not found' });
  const c = CASES[req.params.id];
  if (!c) return res.status(404).json({ ok: false, error: 'Case not found' });
  res.json(caseToDto(c));
});

// POST /api/v1/games/cases/game/play
router.post('/game/play', requireAuth, async (req, res) => {
  const { type } = req.body;
  const c = CASES[type];
  if (!c) return res.status(400).json({ ok: false, error: 'Unknown case type' });

  try {
    await deductBalance(req.user.id, c.price);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }

  const rolled = rollItem(c.items);
  const def = ITEM_DEFS[rolled.itemDefId];
  const payout = def?.value ?? 0;

  // Save item to user inventory
  const { rows: itemRows } = await pool.query(
    `INSERT INTO items (user_id, item_def_id, source) VALUES ($1, $2, 'case') RETURNING id`,
    [req.user.id, rolled.itemDefId]
  );
  const itemId = itemRows[0]?.id;

  recordStats(req.user.id, 'cases', c.price, 0);

  res.json({
    item: def?.name ?? rolled.itemDefId,
    itemUa: def?.nameUa ?? rolled.itemDefId,
    itemDefId: rolled.itemDefId,
    itemId,
    payout,
    rarity: def?.rarity ?? 'common',
    icon: def?.icon ?? '📦',
    color: def?.color ?? '#fff',
  });
});

export default router;
