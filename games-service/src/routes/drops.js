import { Router } from 'express';
import { BIG_WIN_TIERS, getBigWinTier } from '../constants/index.js';

const router = Router();

// Circular buffer of last 50 drops (in-memory)
const recentDrops = [];
const MAX_DROPS = 50;

export function pushDrop(drop) {
  recentDrops.unshift({ ...drop, type: drop.type ?? 'drop' }); // newest first
  if (recentDrops.length > MAX_DROPS) recentDrops.pop();
}

/**
 * Push a Big / Mega / Super Win event into the live ticker.
 * Tier is chosen automatically based on the mult ratio.
 */
export function pushBigWin({ nick, game, amount, mult }) {
  const tierKey = getBigWinTier(mult);
  const tier    = BIG_WIN_TIERS[tierKey];
  pushDrop({
    type:   'bigwin',
    nick,
    icon:   tier.icon,
    name:   `${tier.label} ${game}`,
    nameUa: `${tier.label} ${game}`,
    rarity: tier.rarity,
    color:  tier.color,
    ts:     Date.now(),
    amount,
    mult:   Math.round(mult),
  });
}

// GET /api/v1/drops/recent
router.get('/recent', (req, res) => {
  res.json(recentDrops.slice(0, 24));
});

export default router;
