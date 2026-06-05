import { Router } from 'express';
import { requireAuth, deductBalance, addBalance, recordStats } from '../middleware/auth.js';

const router = Router();

const HOUSE_EDGE = 0.01;

function calcDicePayout(rollOver) {
  const winChance = (100 - rollOver) / 100;
  const multiplier = (1 - HOUSE_EDGE) / winChance;
  return { winChancePercentage: winChance * 100, payout: parseFloat(multiplier.toFixed(4)) };
}

// GET /api/v1/games/dice/game/payout?rollOver=X
router.get('/game/payout', (req, res) => {
  const rollOver = parseFloat(req.query.rollOver);
  if (!Number.isFinite(rollOver) || rollOver < 1 || rollOver > 98) {
    return res.status(400).json({ ok: false, error: 'rollOver must be between 1 and 98' });
  }
  res.json(calcDicePayout(rollOver));
});

// POST /api/v1/games/dice/game/play
router.post('/game/play', requireAuth, async (req, res) => {
  const bet = Number(req.body.bet);
  const rollOver = Number(req.body.rollOver);

  if (!Number.isFinite(bet) || bet <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid bet' });
  }
  if (!Number.isFinite(rollOver) || rollOver < 1 || rollOver > 98) {
    return res.status(400).json({ ok: false, error: 'rollOver must be between 1 and 98' });
  }

  try {
    await deductBalance(req.user.id, bet);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }

  const roll = parseFloat((Math.random() * 99.99).toFixed(2));
  const isWin = roll > rollOver;
  const { payout: multiplier } = calcDicePayout(rollOver);
  const payout = isWin ? parseFloat((bet * multiplier).toFixed(2)) : 0;

  if (isWin) await addBalance(req.user.id, payout);
  recordStats(req.user.id, 'dice', bet, payout);

  res.json({ roll, isWin, payout });
});

export default router;
