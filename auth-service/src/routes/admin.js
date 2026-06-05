import { Router } from 'express';
import pool from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { ticketDto } from './tickets.js';

const router = Router();

// All predefined achievements (for manual granting)
const ALL_ACHIEVEMENTS = [
  { id: 'mythic_hunter',  icon: '✨', rarity: 'mythic',     name: 'Mythic Hunter',       nameUa: 'Мисливець за Mythic' },
  { id: 'millionaire',    icon: '💰', rarity: 'legendary',  name: 'Millionaire',         nameUa: 'Мільйонер' },
  { id: 'big_winner',     icon: '🏆', rarity: 'epic',       name: 'Big Winner',          nameUa: 'Великий виграш' },
  { id: 'collector_pro',  icon: '🗃️', rarity: 'rare',       name: 'Master Collector',    nameUa: 'Майстер колекціонер' },
  { id: 'collector',      icon: '📦', rarity: 'uncommon',   name: 'Collector',           nameUa: 'Колекціонер' },
  { id: 'veteran',        icon: '⭐', rarity: 'rare',       name: 'Veteran Player',      nameUa: 'Ветеран' },
  { id: 'click_master',   icon: '👆', rarity: 'uncommon',   name: 'Click Master',        nameUa: 'Майстер кліків' },
  { id: 'auto_master',    icon: '🤖', rarity: 'rare',       name: 'Automation Expert',   nameUa: 'Експерт автоматизації' },
  { id: 'rich',           icon: '💎', rarity: 'epic',       name: 'High Roller',         nameUa: 'Великий гравець' },
  { id: 'high_roller',    icon: '🎰', rarity: 'epic',       name: 'Casino Regular',      nameUa: 'Постійний клієнт' },
  { id: 'special',        icon: '🌟', rarity: 'mythic',     name: 'Special Award',       nameUa: 'Особлива нагорода' },
  { id: 'early_bird',     icon: '🐦', rarity: 'uncommon',   name: 'Early Adopter',       nameUa: 'Ранній користувач' },
  { id: 'loyal',          icon: '❤️', rarity: 'rare',       name: 'Loyal Player',        nameUa: 'Лояльний гравець' },
];

// All item definitions (mirrored from games-service for admin panel)
const ITEM_DEFS_LIST = [
  { id: 'bronze_shard',    name: 'Bronze Shard',    icon: '🪙', rarity: 'common' },
  { id: 'iron_nugget',     name: 'Iron Nugget',     icon: '⚙️', rarity: 'common' },
  { id: 'wood_chip',       name: 'Wood Chip',       icon: '🪵', rarity: 'common' },
  { id: 'silver_shard',    name: 'Silver Shard',    icon: '💿', rarity: 'uncommon' },
  { id: 'emerald_gem',     name: 'Emerald Gem',     icon: '💚', rarity: 'uncommon' },
  { id: 'lucky_coin',      name: 'Lucky Coin',      icon: '🍀', rarity: 'uncommon' },
  { id: 'sapphire',        name: 'Sapphire',        icon: '💎', rarity: 'rare' },
  { id: 'iron_sword',      name: 'Iron Sword',      icon: '⚔️', rarity: 'rare' },
  { id: 'golden_shield',   name: 'Golden Shield',   icon: '🛡️', rarity: 'rare' },
  { id: 'dragon_crystal',  name: 'Dragon Crystal',  icon: '🔮', rarity: 'epic' },
  { id: 'shadow_crown',    name: 'Shadow Crown',    icon: '👑', rarity: 'epic' },
  { id: 'void_essence',    name: 'Void Essence',    icon: '🌑', rarity: 'epic' },
  { id: 'ancient_relic',   name: 'Ancient Relic',   icon: '⚜️', rarity: 'legendary' },
  { id: 'void_artifact',   name: 'Void Artifact',   icon: '🌟', rarity: 'legendary' },
  { id: 'phoenix_feather', name: 'Phoenix Feather', icon: '🔥', rarity: 'legendary' },
  { id: 'divine_relic',    name: 'Divine Relic',    icon: '✨', rarity: 'mythic' },
  { id: 'cosmos_gem',      name: 'Cosmos Gem',      icon: '🌌', rarity: 'mythic' },
];

function userDto(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    discord: row.discord,
    role: row.role,
    balance: parseFloat(row.balance),
    createdAt: row.created_at,
  };
}

// ── Users ──────────────────────────────────────────────────────────────

// GET /api/v1/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*,
         (SELECT COUNT(*) FROM items WHERE user_id = u.id) as item_count,
         (SELECT COUNT(*) FROM user_achievements WHERE user_id = u.id) as ach_count
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json({
      ok: true,
      users: rows.map(r => ({
        ...userDto(r),
        itemCount: parseInt(r.item_count),
        achCount: parseInt(r.ach_count),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// GET /api/v1/admin/users/:id — user detail
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });

    const [statsRes, clickerRes, itemsRes, achRes] = await Promise.all([
      pool.query(`SELECT * FROM game_stats WHERE user_id = $1`, [req.params.id]),
      pool.query(`SELECT coins, click_power, auto_power FROM clicker_state WHERE user_id = $1`, [req.params.id]),
      pool.query(`SELECT item_def_id, COUNT(*) as cnt FROM items WHERE user_id = $1 GROUP BY item_def_id ORDER BY cnt DESC LIMIT 20`, [req.params.id]),
      pool.query(`SELECT achievement_id, granted_at FROM user_achievements WHERE user_id = $1 ORDER BY granted_at DESC`, [req.params.id]),
    ]);

    res.json({
      ok: true,
      user: userDto(rows[0]),
      clicker: clickerRes.rows[0] ? {
        coins: Number(clickerRes.rows[0].coins),
        clickPower: Number(clickerRes.rows[0].click_power),
        autoPower: Number(clickerRes.rows[0].auto_power),
      } : null,
      stats: statsRes.rows.map(r => ({
        gameType: r.game_type,
        gamesPlayed: parseInt(r.games_played),
        totalWagered: parseFloat(r.total_wagered),
        totalWon: parseFloat(r.total_won),
        biggestWin: parseFloat(r.biggest_win),
      })),
      inventory: itemsRes.rows.map(r => ({ itemDefId: r.item_def_id, count: parseInt(r.cnt) })),
      achievements: achRes.rows.map(r => r.achievement_id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/users/:id — edit user
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const { nickname, role, balance } = req.body;
  if (!nickname?.trim()) return res.status(400).json({ ok: false, error: 'nickname required' });
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ ok: false, error: 'invalid role' });
  if (!Number.isFinite(Number(balance)) || Number(balance) < 0) {
    return res.status(400).json({ ok: false, error: 'invalid balance' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET nickname = $1, role = $2, balance = $3 WHERE id = $4 RETURNING *`,
      [nickname.trim(), role, balance, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: userDto(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Nickname already taken' });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ ok: false, error: 'Cannot delete your own account' });
  }
  try {
    const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/give-balance
router.post('/users/:id/give-balance', requireAdmin, async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ ok: false, error: 'Invalid amount' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET balance = GREATEST(0, balance + $1) WHERE id = $2 RETURNING balance`,
      [amount, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, balance: parseFloat(rows[0].balance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/give-item
router.post('/users/:id/give-item', requireAdmin, async (req, res) => {
  const { itemDefId } = req.body;
  const valid = ITEM_DEFS_LIST.some(d => d.id === itemDefId);
  if (!valid) return res.status(400).json({ ok: false, error: 'Unknown item' });
  try {
    const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [req.params.id]);
    if (!userRows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    await pool.query(
      `INSERT INTO items (user_id, item_def_id, source) VALUES ($1, $2, 'admin')`,
      [req.params.id, itemDefId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/give-clicker-coins
router.post('/users/:id/give-clicker-coins', requireAdmin, async (req, res) => {
  const amount = parseInt(req.body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ ok: false, error: 'Invalid amount' });
  }
  try {
    const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [req.params.id]);
    if (!userRows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    const { rows } = await pool.query(
      `INSERT INTO clicker_state (user_id, coins) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET coins = GREATEST(0, clicker_state.coins + $2)
       RETURNING coins`,
      [req.params.id, amount]
    );
    res.json({ ok: true, coins: Number(rows[0].coins) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/give-achievement
router.post('/users/:id/give-achievement', requireAdmin, async (req, res) => {
  const { achievementId } = req.body;
  const valid = ALL_ACHIEVEMENTS.some(a => a.id === achievementId);
  if (!valid) return res.status(400).json({ ok: false, error: 'Unknown achievement' });
  try {
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_id, granted_by) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [req.params.id, achievementId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/users/:id/achievement/:achId
router.delete('/users/:id/achievement/:achId', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM user_achievements WHERE user_id = $1 AND achievement_id = $2`,
      [req.params.id, req.params.achId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── Tickets ────────────────────────────────────────────────────────────

// GET /api/v1/admin/tickets
router.get('/tickets', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.nickname, u.discord FROM tickets t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC LIMIT 200`
    );
    res.json({ ok: true, ticket: rows.map(ticketDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/tickets/:id
router.patch('/tickets/:id', requireAdmin, async (req, res) => {
  const { status, note } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status must be APPROVED or REJECTED' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE tickets SET status = $1, note = $2, resolved_at = NOW()
       WHERE id = $3 AND status = 'PENDING' RETURNING *`,
      [status, note ?? null, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'Ticket not found or already resolved' }); }
    const ticket = rows[0];
    if (status === 'APPROVED') {
      const delta = ticket.type === 'DEPOSIT' ? ticket.amount : -ticket.amount;
      await client.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [delta, ticket.user_id]);
    }
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

// ── Dashboard ──────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [usersRes, ticketsRes, statsRes, topBalanceRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE role='admin') as admins FROM users`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status='PENDING') as pending, COUNT(*) as total FROM tickets`),
      pool.query(`SELECT SUM(total_wagered) as wagered, SUM(total_won) as won, MAX(biggest_win) as biggest FROM game_stats`),
      pool.query(`SELECT nickname, balance FROM users ORDER BY balance DESC LIMIT 5`),
    ]);
    res.json({
      ok: true,
      dashboard: {
        totalUsers: parseInt(usersRes.rows[0].total),
        adminCount: parseInt(usersRes.rows[0].admins),
        pendingTickets: parseInt(ticketsRes.rows[0].pending),
        totalTickets: parseInt(ticketsRes.rows[0].total),
        totalWagered: parseFloat(statsRes.rows[0].wagered ?? 0),
        totalWon: parseFloat(statsRes.rows[0].won ?? 0),
        biggestWin: parseFloat(statsRes.rows[0].biggest ?? 0),
        topBalance: topBalanceRes.rows.map(r => ({ nickname: r.nickname, balance: parseFloat(r.balance) })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ── Metadata for admin panel ───────────────────────────────────────────

// GET /api/v1/admin/meta
router.get('/meta', requireAdmin, (req, res) => {
  res.json({ ok: true, achievements: ALL_ACHIEVEMENTS, items: ITEM_DEFS_LIST });
});

export default router;
