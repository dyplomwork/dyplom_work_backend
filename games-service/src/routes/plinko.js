import { Router } from 'express';
import { requireAuth, deductBalance, addBalance, recordStats } from '../middleware/auth.js';
import { pushBigWin } from './drops.js';
import { BIG_WIN_THRESHOLD } from '../constants/index.js';

const router = Router();

const TABLES = {
  'LOW:8':    [3, 1.5, 1.1, 1.0, 0.7, 1.0, 1.1, 1.5, 3],
  'MEDIUM:8': [8, 2.0, 1.3, 0.7, 0.3, 0.7, 1.3, 2.0, 8],
  'HIGH:8':   [29, 4.0, 1.5, 0.5, 0.2, 0.5, 1.5, 4.0, 29],

  'LOW:12':    [5, 2.0, 1.6, 1.3, 1.1, 1.0, 0.8, 1.0, 1.1, 1.3, 1.6, 2.0, 5],
  'MEDIUM:12': [29, 8.0, 3.0, 1.6, 1.1, 0.8, 0.5, 0.8, 1.1, 1.6, 3.0, 8.0, 29],
  'HIGH:12':   [120, 26, 8.0, 2.0, 1.0, 0.6, 0.2, 0.6, 1.0, 2.0, 8.0, 26, 120],

  'LOW:16':    [10, 3, 2, 1.6, 1.3, 1.1, 1.0, 0.8, 0.7, 0.8, 1.0, 1.1, 1.3, 1.6, 2, 3, 10],
  'MEDIUM:16': [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  'HIGH:16':   [1000, 110, 41, 10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10, 41, 110, 1000],
};

function popcount(x) {
  x = x >>> 0;
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}

function getTable(rows, difficulty) {
  return TABLES[`${String(difficulty).toUpperCase()}:${rows}`] ?? null;
}

router.get('/game/multipliers', (req, res) => {
  const rows       = parseInt(req.query.rows);
  const difficulty = String(req.query.difficulty || '').toUpperCase();
  const table      = getTable(rows, difficulty);
  if (!table) return res.status(400).json({ ok: false, error: 'Invalid rows or difficulty' });
  res.json(table);
});

router.post('/game/play', requireAuth, async (req, res) => {
  const { bet, balls, rows, difficulty } = req.body;

  if (!bet || bet <= 0) return res.status(400).json({ ok: false, error: 'Invalid bet' });
  const n     = Math.max(1, Math.min(100, parseInt(balls) || 1));
  const table = getTable(rows, difficulty);
  if (!table) return res.status(400).json({ ok: false, error: 'Invalid rows or difficulty' });

  const totalBet = parseFloat((bet * n).toFixed(2));
  try {
    await deductBalance(req.user.id, totalBet);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }

  const traces = [];
  let totalWin = 0;

  for (let i = 0; i < n; i++) {
    let mask = 0;
    for (let r = 0; r < rows; r++) {
      if (Math.random() < 0.5) mask |= (1 << r);
    }
    const landing    = popcount(mask);
    const multiplier = table[landing] ?? 0;
    const win        = parseFloat((bet * multiplier).toFixed(2));
    traces.push({ win, mask });
    totalWin = parseFloat((totalWin + win).toFixed(2));
  }

  if (totalWin > 0) await addBalance(req.user.id, totalWin);
  recordStats(req.user.id, 'plinko', totalBet, totalWin);

  if (totalBet > 0 && totalWin >= totalBet * BIG_WIN_THRESHOLD) {
    pushBigWin({ nick: req.user.nickname, game: 'Plinko', amount: totalWin, mult: totalWin / totalBet });
  }

  res.json({ total: totalWin, traces });
});

export default router;
