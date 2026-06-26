import { Router } from 'express';
import { requireAuth, deductBalance, addBalance, recordStats } from '../middleware/auth.js';
import { pushBigWin } from './drops.js';
import { BIG_WIN_THRESHOLD } from '../constants/index.js';

const router = Router();

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const COLUMN_1    = new Set([1,4,7,10,13,16,19,22,25,28,31,34]);
const COLUMN_2    = new Set([2,5,8,11,14,17,20,23,26,29,32,35]);
const COLUMN_3    = new Set([3,6,9,12,15,18,21,24,27,30,33,36]);

const VALID_KEYS = new Set([
  'red','black','even','odd','low','high',
  'range:1','range:2','range:3',
  'row:1','row:2','row:3',
  ...Array.from({ length: 37 }, (_, i) => `n:${i}`),
]);

function resolveBet(key, number) {
  if (number === 0) return key === 'n:0' ? 36 : 0;
  if (key.startsWith('n:')) {
    const n = parseInt(key.slice(2));
    return (Number.isInteger(n) && n >= 0 && n <= 36 && number === n) ? 36 : 0;
  }
  switch (key) {
    case 'red':     return RED_NUMBERS.has(number) ? 2 : 0;
    case 'black':   return !RED_NUMBERS.has(number) ? 2 : 0;
    case 'even':    return number % 2 === 0 ? 2 : 0;
    case 'odd':     return number % 2 !== 0 ? 2 : 0;
    case 'low':     return number >= 1  && number <= 18 ? 2 : 0;
    case 'high':    return number >= 19 && number <= 36 ? 2 : 0;
    case 'range:1': return number >= 1  && number <= 12 ? 3 : 0;
    case 'range:2': return number >= 13 && number <= 24 ? 3 : 0;
    case 'range:3': return number >= 25 && number <= 36 ? 3 : 0;
    case 'row:1':   return COLUMN_1.has(number) ? 3 : 0;
    case 'row:2':   return COLUMN_2.has(number) ? 3 : 0;
    case 'row:3':   return COLUMN_3.has(number) ? 3 : 0;
    default:        return 0;
  }
}

router.post('/game/play', requireAuth, async (req, res) => {
  const { bets } = req.body;
  if (!Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ ok: false, error: 'bets must be a non-empty array' });
  }
  if (bets.length > 100) {
    return res.status(400).json({ ok: false, error: 'Too many bets' });
  }

  for (const b of bets) {
    const amt = Number(b.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, error: 'Each bet amount must be a positive number' });
    }
    if (!VALID_KEYS.has(b.key)) {
      return res.status(400).json({ ok: false, error: `Invalid bet key: ${b.key}` });
    }
  }

  const totalBet = bets.reduce((s, b) => s + Number(b.amount), 0);
  if (!Number.isFinite(totalBet) || totalBet <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid total bet' });
  }

  try {
    await deductBalance(req.user.id, totalBet);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }

  const number = Math.floor(Math.random() * 37);
  let totalReturn = 0;
  for (const { key, amount } of bets) {
    totalReturn += Number(amount) * resolveBet(key, number);
  }

  if (totalReturn > 0) await addBalance(req.user.id, totalReturn);
  recordStats(req.user.id, 'roulette', totalBet, totalReturn);

  if (totalBet > 0 && totalReturn >= totalBet * BIG_WIN_THRESHOLD) {
    pushBigWin({ nick: req.user.nickname, game: 'Roulette', amount: totalReturn, mult: totalReturn / totalBet });
  }

  const netAmount = parseFloat((totalReturn - totalBet).toFixed(2));
  res.json({ number, amount: netAmount });
});

export default router;
