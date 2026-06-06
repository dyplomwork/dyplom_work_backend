import { Router } from 'express';
import pool from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { ALL_ACHIEVEMENTS, MYTHIC_IDS, getAchievement } from '../constants/achievements.js';
import { adminUserDto } from '../utils/dto.js';

const router = Router();

// Item definitions list for admin panel (id + display fields only)
// Full definitions with value/color live in games-service/itemDefs.js
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
        ...adminUserDto(r),
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

    const [statsRes, clickerRes, itemsRes, achRes, mythicRes] = await Promise.all([
      pool.query(`SELECT * FROM game_stats WHERE user_id = $1`, [req.params.id]),
      pool.query(`SELECT coins, click_power, auto_power FROM clicker_state WHERE user_id = $1`, [req.params.id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT item_def_id, COUNT(*) as cnt FROM items WHERE user_id = $1 GROUP BY item_def_id ORDER BY cnt DESC LIMIT 20`, [req.params.id]),
      pool.query(`SELECT achievement_id, granted_at FROM user_achievements WHERE user_id = $1 ORDER BY granted_at DESC`, [req.params.id]),
      pool.query(`SELECT COUNT(*) as cnt FROM items WHERE user_id = $1 AND item_def_id = ANY($2::text[])`, [req.params.id, MYTHIC_IDS]).catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    // Compute auto achievements from stats
    const manualAchIds = new Set(achRes.rows.map(r => r.achievement_id));
    let totalGames = 0, totalWagered = 0, biggestWin = 0, totalWon = 0;
    for (const r of statsRes.rows) {
      totalGames += parseInt(r.games_played);
      totalWagered += parseFloat(r.total_wagered);
      totalWon += parseFloat(r.total_won);
      biggestWin = Math.max(biggestWin, parseFloat(r.biggest_win));
    }
    const totalItems = itemsRes.rows.reduce((s, r) => s + parseInt(r.cnt), 0);
    const mythicCount = parseInt(mythicRes.rows[0]?.cnt ?? 0);
    const clicker = clickerRes.rows[0];
    const clickPower = Number(clicker?.click_power ?? 0);
    const autoPower = Number(clicker?.auto_power ?? 0);
    const balance = parseFloat(rows[0].balance ?? 0);

    const computedAchIds = new Set();
    if (mythicCount > 0) computedAchIds.add('mythic_hunter');
    if (biggestWin >= 1000000) computedAchIds.add('millionaire');
    else if (biggestWin >= 100000) computedAchIds.add('big_winner');
    if (totalItems >= 50) computedAchIds.add('collector_pro');
    else if (totalItems >= 10) computedAchIds.add('collector');
    if (totalGames >= 100) computedAchIds.add('veteran');
    if (clickPower >= 50) computedAchIds.add('click_master');
    if (autoPower >= 30) computedAchIds.add('auto_master');
    if (balance >= 500000) computedAchIds.add('rich');
    if (totalWagered >= 1000000) computedAchIds.add('high_roller');

    const allAchIds = new Set([...manualAchIds, ...computedAchIds]);
    const achievements = [...allAchIds].map(id => ({
      ...getAchievement(id),
      manual: manualAchIds.has(id),
    }));

    res.json({
      ok: true,
      user: adminUserDto(rows[0]),
      clicker: clicker ? {
        coins: Number(clicker.coins),
        clickPower: Number(clicker.click_power),
        autoPower: Number(clicker.auto_power),
      } : null,
      stats: statsRes.rows.map(r => ({
        gameType: r.game_type,
        gamesPlayed: parseInt(r.games_played),
        totalWagered: parseFloat(r.total_wagered),
        totalWon: parseFloat(r.total_won),
        biggestWin: parseFloat(r.biggest_win),
      })),
      inventory: itemsRes.rows.map(r => ({ itemDefId: r.item_def_id, count: parseInt(r.cnt) })),
      achievements,
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
    res.json({ ok: true, user: adminUserDto(rows[0]) });
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

// ── Dashboard ──────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [usersRes, itemsRes, statsRes, topBalanceRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE role='admin') as admins FROM users`),
      pool.query(`SELECT COUNT(*) as total FROM items`),
      pool.query(`SELECT SUM(total_wagered) as wagered, SUM(total_won) as won, MAX(biggest_win) as biggest FROM game_stats`),
      pool.query(`SELECT nickname, balance FROM users ORDER BY balance DESC LIMIT 5`),
    ]);
    res.json({
      ok: true,
      dashboard: {
        totalUsers: parseInt(usersRes.rows[0].total),
        adminCount: parseInt(usersRes.rows[0].admins),
        totalItems: parseInt(itemsRes.rows[0].total),
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
