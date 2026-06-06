import { Router } from 'express';

const router = Router();

// Circular buffer of last 50 drops (in-memory)
const recentDrops = [];
const MAX_DROPS = 50;

export function pushDrop(drop) {
  recentDrops.unshift({ ...drop, type: drop.type ?? 'drop' }); // newest first
  if (recentDrops.length > MAX_DROPS) recentDrops.pop();
}

// Push a big/super win into the same ticker stream
export function pushBigWin({ nick, game, amount, mult }) {
  const tier = mult >= 100 ? 'super' : mult >= 50 ? 'mega' : 'big';
  const labels = { super: 'SUPER WIN', mega: 'MEGA WIN', big: 'BIG WIN' };
  const icons  = { super: '🌟', mega: '💥', big: '🔥' };
  const colors = { super: '#ec4899', mega: '#f59e0b', big: '#a855f7' };
  pushDrop({
    type: 'bigwin',
    nick,
    icon: icons[tier],
    name: `${labels[tier]} ${game}`,
    nameUa: `${labels[tier]} ${game}`,
    rarity: tier === 'super' ? 'mythic' : tier === 'mega' ? 'legendary' : 'epic',
    color: colors[tier],
    ts: Date.now(),
    amount,
    mult: Math.round(mult),
  });
}

// GET /api/v1/drops/recent
router.get('/recent', (req, res) => {
  res.json(recentDrops.slice(0, 24));
});

export default router;
