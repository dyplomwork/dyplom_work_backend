import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/stats/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows: statsRows } = await pool.query(
      `SELECT * FROM game_stats WHERE user_id = $1`,
      [req.user.id]
    );
    const { rows: itemRows } = await pool.query(
      `SELECT COUNT(*) as total_items FROM items WHERE user_id = $1`,
      [req.user.id]
    ).catch(() => [{ rows: [{ total_items: 0 }] }]);

    const byGame = {};
    let totalGames = 0, totalWagered = 0, totalWon = 0, biggestWin = 0;
    for (const row of statsRows) {
      byGame[row.game_type] = {
        gamesPlayed: parseInt(row.games_played),
        totalWagered: parseFloat(row.total_wagered),
        totalWon: parseFloat(row.total_won),
        biggestWin: parseFloat(row.biggest_win),
      };
      totalGames += parseInt(row.games_played);
      totalWagered += parseFloat(row.total_wagered);
      totalWon += parseFloat(row.total_won);
      biggestWin = Math.max(biggestWin, parseFloat(row.biggest_win));
    }

    const favoriteGame = statsRows.length
      ? statsRows.reduce((a, b) => parseInt(a.games_played) > parseInt(b.games_played) ? a : b).game_type
      : null;

    res.json({
      ok: true,
      stats: {
        totalGames,
        totalWagered: parseFloat(totalWagered.toFixed(2)),
        totalWon: parseFloat(totalWon.toFixed(2)),
        netProfit: parseFloat((totalWon - totalWagered).toFixed(2)),
        biggestWin: parseFloat(biggestWin.toFixed(2)),
        favoriteGame,
        totalItems: parseInt(itemRows[0]?.total_items ?? 0),
        byGame,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
