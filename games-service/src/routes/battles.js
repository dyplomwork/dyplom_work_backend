import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, deductBalance, addBalance } from '../middleware/auth.js';

const router = Router();

const TERMINAL_STATUSES = new Set(['FINISHED', 'CANCELLED', 'ABANDONED']);

const sseClients = new Map();

function battleDto(row) {
  return {
    id: row.id,
    amount: parseFloat(row.amount),
    status: row.status,
    creatorId: row.creator_id,
    creatorNick: row.creator_nick,
    creatorSide: row.creator_side ?? null,
    creatorReady: row.creator_ready,
    joinerId: row.joiner_id ?? null,
    joinerNick: row.joiner_nick ?? null,
    joinerSide: row.joiner_side ?? null,
    joinerReady: row.joiner_ready,
    countdownStartedAt: row.countdown_started_at ?? null,
    winnerId: row.winner_id ?? null,
    winnerSide: row.winner_side ?? null,
    resultSide: row.result_side ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function emitBattle(battleId, battle) {
  const clients = sseClients.get(battleId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(battle)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

async function getBattle(id) {
  const { rows } = await pool.query(`SELECT * FROM battles WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function tryStartCountdown(battleId) {
  const row = await getBattle(battleId);
  if (!row || row.status !== 'FULL') return;
  if (!row.creator_ready || !row.joiner_ready) return;

  const { rows } = await pool.query(
    `UPDATE battles SET status = 'COUNTDOWN', countdown_started_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'FULL' RETURNING *`,
    [battleId]
  );
  if (!rows[0]) return;
  emitBattle(battleId, battleDto(rows[0]));

  setTimeout(async () => {
    const battle = await getBattle(battleId);
    if (!battle || battle.status !== 'COUNTDOWN') return;

    const resultSide = Math.random() < 0.5 ? 'heads' : 'tails';
    let winnerId;
    if (battle.creator_side) {
      winnerId = battle.creator_side === resultSide ? battle.creator_id : battle.joiner_id;
    } else {
      winnerId = Math.random() < 0.5 ? battle.creator_id : battle.joiner_id;
    }

    const { rows: finished } = await pool.query(
      `UPDATE battles
       SET status = 'FINISHED', result_side = $1, winner_id = $2, winner_side = $1, updated_at = NOW()
       WHERE id = $3 AND status = 'COUNTDOWN' RETURNING *`,
      [resultSide, winnerId, battleId]
    );
    if (!finished[0]) return;

    await addBalance(winnerId, parseFloat(battle.amount) * 2);
    emitBattle(battleId, battleDto(finished[0]));
  }, 3000);
}

router.get('/history', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await pool.query(
      `SELECT * FROM battles WHERE status = 'FINISHED'
       ORDER BY updated_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows.map(battleDto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM battles WHERE status NOT IN ('FINISHED','CANCELLED','ABANDONED')
     ORDER BY created_at DESC LIMIT 50`
  );
  res.json(rows.map(battleDto));
});

router.post('/', requireAuth, async (req, res) => {
  const amount = Number(req.body.amount);
  const side = req.body.side ?? null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid amount' });
  }
  if (side && !['heads', 'tails'].includes(side)) {
    return res.status(400).json({ ok: false, error: 'side must be heads or tails' });
  }
  try {
    await deductBalance(req.user.id, amount);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }
  const { rows } = await pool.query(
    `INSERT INTO battles (amount, creator_id, creator_nick, creator_side) VALUES ($1, $2, $3, $4) RETURNING *`,
    [amount, req.user.id, req.user.nickname, side]
  );
  res.status(201).json(battleDto(rows[0]));
});

router.get('/:id', requireAuth, async (req, res) => {
  const row = await getBattle(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Battle not found' });
  res.json(battleDto(row));
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const row = await getBattle(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Battle not found' });
  if (row.status !== 'OPEN') return res.status(400).json({ ok: false, error: 'Battle not open' });
  if (row.creator_id === req.user.id) {
    return res.status(400).json({ ok: false, error: 'Cannot join your own battle' });
  }

  const amount = parseFloat(row.amount);
  try {
    await deductBalance(req.user.id, amount);
  } catch {
    return res.status(400).json({ ok: false, error: 'Insufficient balance' });
  }

  let joinerSide = req.body?.side ?? null;
  if (!joinerSide && row.creator_side) {
    joinerSide = row.creator_side === 'heads' ? 'tails' : 'heads';
  }

  const { rows } = await pool.query(
    `UPDATE battles
     SET status = 'FULL', joiner_id = $1, joiner_nick = $2, joiner_side = $3, updated_at = NOW()
     WHERE id = $4 AND status = 'OPEN' RETURNING *`,
    [req.user.id, req.user.nickname, joinerSide, req.params.id]
  );

  if (!rows[0]) {
    await addBalance(req.user.id, amount);
    return res.status(409).json({ ok: false, error: 'Battle no longer available' });
  }

  const dto = battleDto(rows[0]);
  emitBattle(req.params.id, dto);
  res.json(dto);
});

router.post('/:id/ready', requireAuth, async (req, res) => {
  const row = await getBattle(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Battle not found' });
  if (!['FULL', 'COUNTDOWN'].includes(row.status)) {
    return res.status(400).json({ ok: false, error: 'Battle not in correct state' });
  }

  const isCreator = row.creator_id === req.user.id;
  const isJoiner = row.joiner_id === req.user.id;
  if (!isCreator && !isJoiner) return res.status(403).json({ ok: false, error: 'Not a participant' });

  const field = isCreator ? 'creator_ready' : 'joiner_ready';
  const { rows } = await pool.query(
    `UPDATE battles SET ${field} = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  emitBattle(req.params.id, battleDto(rows[0]));

  await tryStartCountdown(req.params.id);
  const updated = await getBattle(req.params.id);
  res.json(battleDto(updated));
});

router.post('/:id/leave', requireAuth, async (req, res) => {
  const row = await getBattle(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Battle not found' });

  if (TERMINAL_STATUSES.has(row.status) || row.status === 'COUNTDOWN') {
    return res.status(400).json({ ok: false, error: 'Cannot leave at this stage' });
  }

  const isCreator = row.creator_id === req.user.id;
  const isJoiner = row.joiner_id === req.user.id;
  if (!isCreator && !isJoiner) return res.status(403).json({ ok: false, error: 'Not a participant' });

  await addBalance(req.user.id, parseFloat(row.amount));

  if (isJoiner) {
    const { rows } = await pool.query(
      `UPDATE battles SET status = 'OPEN', joiner_id = NULL, joiner_nick = NULL,
       joiner_side = NULL, joiner_ready = FALSE, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    emitBattle(req.params.id, battleDto(rows[0]));
    return res.json(battleDto(rows[0]));
  }

  if (row.joiner_id) await addBalance(row.joiner_id, parseFloat(row.amount));
  const { rows } = await pool.query(
    `UPDATE battles SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  emitBattle(req.params.id, battleDto(rows[0]));
  res.json(battleDto(rows[0]));
});

router.delete('/:id', requireAuth, async (req, res) => {
  const row = await getBattle(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Battle not found' });
  if (row.creator_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Only creator can delete' });
  if (row.status !== 'OPEN') {
    return res.status(400).json({ ok: false, error: 'Can only delete open battles' });
  }

  await addBalance(req.user.id, parseFloat(row.amount));
  await pool.query(`UPDATE battles SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [req.params.id]);
  res.status(204).end();
});

router.get('/:id/events', (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!sseClients.has(id)) sseClients.set(id, new Set());
  sseClients.get(id).add(res);

  getBattle(id).then(row => {
    if (row) {
      try { res.write(`data: ${JSON.stringify(battleDto(row))}\n\n`); } catch {}
    }
  });

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 20000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.get(id)?.delete(res);
    if (sseClients.get(id)?.size === 0) sseClients.delete(id);
  });
});

export default router;
