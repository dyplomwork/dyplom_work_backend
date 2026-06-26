import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, deductBalance, addBalance, recordStats } from '../middleware/auth.js';
import { pushBigWin } from './drops.js';
import { MINES_PAYOUT_FACTOR, BIG_WIN_THRESHOLD } from '../constants/index.js';

const router = Router();

const TOTAL_CELLS = 25;

function calcMultiplier(opened, mines) {
  if (opened === 0) return 1;
  let p = 1;
  for (let i = 0; i < opened; i++) {
    p *= (TOTAL_CELLS - mines - i) / (TOTAL_CELLS - i);
  }
  return parseFloat(((1 / p) * MINES_PAYOUT_FACTOR).toFixed(4));
}

function generateMinePositions(count) {
  const indices = Array.from({ length: TOTAL_CELLS }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map(i => ({ row: Math.floor(i / 5), col: i % 5 }));
}

function buildField(minePositions) {
  const field = Array.from({ length: 5 }, () => Array(5).fill(false));
  for (const { row, col } of minePositions) field[row][col] = true;
  return { field };
}

router.get('/game/multiplier', (req, res) => {
  const opened = parseInt(req.query.opened);
  const mines  = parseInt(req.query.mines);
  if (isNaN(opened) || isNaN(mines) || opened < 0 || mines < 1 || mines > 24 || opened > TOTAL_CELLS - mines) {
    return res.status(400).json({ ok: false, error: 'Invalid params' });
  }
  res.json(calcMultiplier(opened, mines));
});

router.get('/game', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM mines_sessions WHERE user_id = $1 AND status = 'ACTIVE'`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ ok: false, error: 'No active game' });
  const s = rows[0];
  res.json({ ok: true, bet: parseFloat(s.bet), minesCount: s.mines_count, opened: s.opened });
});

router.post('/game/start', requireAuth, async (req, res) => {
  const bet   = Number(req.body.bet);
  const mines = parseInt(req.body.mines);
  if (!Number.isFinite(bet) || bet <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid bet' });
  }
  if (isNaN(mines) || mines < 1 || mines > 24) {
    return res.status(400).json({ ok: false, error: 'mines must be between 1 and 24' });
  }
  try {
    await deductBalance(req.user.id, bet);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }

  await pool.query(`DELETE FROM mines_sessions WHERE user_id = $1`, [req.user.id]);

  const minePositions = generateMinePositions(mines);
  await pool.query(
    `INSERT INTO mines_sessions (user_id, bet, mines_count, mine_positions) VALUES ($1, $2, $3, $4)`,
    [req.user.id, bet, mines, JSON.stringify(minePositions)]
  );

  res.status(201).json({ ok: true });
});

router.post('/game/step', requireAuth, async (req, res) => {
  const row = parseInt(req.body.row);
  const col = parseInt(req.body.col);

  if (isNaN(row) || isNaN(col) || row < 0 || row > 4 || col < 0 || col > 4) {
    return res.status(400).json({ ok: false, error: 'row and col must be 0–4' });
  }

  const { rows } = await pool.query(
    `SELECT * FROM mines_sessions WHERE user_id = $1 AND status = 'ACTIVE'`,
    [req.user.id]
  );
  const session = rows[0];
  if (!session) return res.status(404).json({ ok: false, error: 'No active game' });

  const alreadyOpened = session.opened.some(p => p.row === row && p.col === col);
  if (alreadyOpened) {
    return res.status(400).json({ ok: false, error: 'Cell already revealed' });
  }

  const isMine = session.mine_positions.some(p => p.row === row && p.col === col);
  if (isMine) {
    recordStats(req.user.id, 'mines', parseFloat(session.bet), 0);
    await pool.query(`UPDATE mines_sessions SET status = 'FINISHED' WHERE id = $1`, [session.id]);
    return res.json({ finish: true, field: buildField(session.mine_positions) });
  }

  const opened = [...session.opened, { row, col }];
  await pool.query(
    `UPDATE mines_sessions SET opened = $1 WHERE id = $2`,
    [JSON.stringify(opened), session.id]
  );

  const nextMultiplier = calcMultiplier(opened.length + 1, session.mines_count);
  res.json({ finish: false, nextMultiplier });
});

router.post('/game/finish', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM mines_sessions WHERE user_id = $1 AND status = 'ACTIVE'`,
    [req.user.id]
  );
  const session = rows[0];
  if (!session) return res.status(404).json({ ok: false, error: 'No active game' });

  await pool.query(`UPDATE mines_sessions SET status = 'FINISHED' WHERE id = $1`, [session.id]);

  const openedCount = session.opened.length;
  const multiplier  = calcMultiplier(openedCount, session.mines_count);
  const bet         = parseFloat(session.bet);
  const win         = parseFloat((bet * multiplier).toFixed(2));

  if (win > 0) await addBalance(req.user.id, win);
  recordStats(req.user.id, 'mines', bet, win);

  if (bet > 0 && win >= bet * BIG_WIN_THRESHOLD) {
    pushBigWin({ nick: req.user.nickname, game: 'Mines', amount: win, mult: win / bet });
  }

  res.json({ win, field: buildField(session.mine_positions) });
});

export default router;
