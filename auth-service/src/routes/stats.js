import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { MYTHIC_IDS, getAchievement } from '../constants/achievements.js';

const router = Router();

// GET /api/v1/stats/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [statsRes, balRes, clickerRes, itemsRes, mythicRes, manualAchRes] = await Promise.all([
      pool.query(`SELECT * FROM game_stats WHERE user_id = $1`, [req.user.id]),
      pool.query(`SELECT balance FROM users WHERE id = $1`, [req.user.id]),
      pool.query(`SELECT click_power, auto_power, coins FROM clicker_state WHERE user_id = $1`, [req.user.id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT COUNT(*) as cnt FROM items WHERE user_id = $1`, [req.user.id]).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(
        `SELECT COUNT(*) as cnt FROM items WHERE user_id = $1 AND item_def_id = ANY($2::text[])`,
        [req.user.id, MYTHIC_IDS]
      ).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(`SELECT achievement_id FROM user_achievements WHERE user_id = $1`, [req.user.id]).catch(() => ({ rows: [] })),
    ]);

    const byGame = {};
    let totalGames = 0, totalWagered = 0, totalWon = 0, biggestWin = 0;
    for (const row of statsRes.rows) {
      byGame[row.game_type] = {
        gamesPlayed:  parseInt(row.games_played),
        totalWagered: parseFloat(row.total_wagered),
        totalWon:     parseFloat(row.total_won),
        biggestWin:   parseFloat(row.biggest_win),
      };
      totalGames   += parseInt(row.games_played);
      totalWagered += parseFloat(row.total_wagered);
      totalWon     += parseFloat(row.total_won);
      biggestWin    = Math.max(biggestWin, parseFloat(row.biggest_win));
    }

    const favoriteGame = statsRes.rows.length
      ? statsRes.rows.reduce((a, b) => parseInt(a.games_played) > parseInt(b.games_played) ? a : b).game_type
      : null;

    const totalItems  = parseInt(itemsRes.rows[0]?.cnt  ?? 0);
    const mythicCount = parseInt(mythicRes.rows[0]?.cnt ?? 0);
    const clicker     = clickerRes.rows[0];
    const clickPower  = Number(clicker?.click_power ?? 0);
    const autoPower   = Number(clicker?.auto_power  ?? 0);
    const balance     = parseFloat(balRes.rows[0]?.balance ?? 0);

    // Manually granted achievements (by admin)
    const manualAchIds = new Set(manualAchRes.rows.map(r => r.achievement_id));

    // Compute auto-earned achievement IDs based on current player stats
    const autoAchIds = new Set();
    if (mythicCount > 0)           autoAchIds.add('mythic_hunter');
    if (biggestWin >= 1_000_000)   autoAchIds.add('millionaire');
    else if (biggestWin >= 100_000) autoAchIds.add('big_winner');
    if (totalItems >= 50)          autoAchIds.add('collector_pro');
    else if (totalItems >= 10)     autoAchIds.add('collector');
    if (totalGames >= 100)         autoAchIds.add('veteran');
    if (clickPower >= 50)          autoAchIds.add('click_master');
    if (autoPower >= 30)           autoAchIds.add('auto_master');
    if (balance >= 500_000)        autoAchIds.add('rich');
    if (totalWagered >= 1_000_000) autoAchIds.add('high_roller');

    // Merge manual + auto; use getAchievement() as single source of truth for labels/icons
    const allAchIds = new Set([...manualAchIds, ...autoAchIds]);
    const achievements = [...allAchIds].map(id => ({
      ...getAchievement(id),
      manual: manualAchIds.has(id),
    }));

    res.json({
      ok: true,
      stats: {
        totalGames, totalWagered, totalWon,
        netProfit: parseFloat((totalWon - totalWagered).toFixed(2)),
        biggestWin, favoriteGame,
        totalItems, byGame,
      },
      achievements,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
