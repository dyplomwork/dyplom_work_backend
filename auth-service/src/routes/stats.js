import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const MYTHIC_IDS = ['divine_relic', 'cosmos_gem'];
const LEGENDARY_IDS = ['ancient_relic', 'void_artifact', 'phoenix_feather'];

// GET /api/v1/stats/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [statsRes, balRes, clickerRes, itemsRes, mythicRes] = await Promise.all([
      pool.query(`SELECT * FROM game_stats WHERE user_id = $1`, [req.user.id]),
      pool.query(`SELECT balance FROM users WHERE id = $1`, [req.user.id]),
      pool.query(`SELECT click_power, auto_power, coins FROM clicker_state WHERE user_id = $1`, [req.user.id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT COUNT(*) as cnt FROM items WHERE user_id = $1`, [req.user.id]).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(`SELECT COUNT(*) as cnt FROM items WHERE user_id = $1 AND item_def_id = ANY($2::text[])`,
        [req.user.id, MYTHIC_IDS]).catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    const byGame: Record<string, any> = {};
    let totalGames = 0, totalWagered = 0, totalWon = 0, biggestWin = 0;
    for (const row of statsRes.rows) {
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

    const favoriteGame = statsRes.rows.length
      ? statsRes.rows.reduce((a, b) => parseInt(a.games_played) > parseInt(b.games_played) ? a : b).game_type
      : null;

    const totalItems = parseInt(itemsRes.rows[0]?.cnt ?? 0);
    const mythicCount = parseInt(mythicRes.rows[0]?.cnt ?? 0);
    const clicker = clickerRes.rows[0];
    const clickPower = Number(clicker?.click_power ?? 0);
    const autoPower = Number(clicker?.auto_power ?? 0);
    const balance = parseFloat(balRes.rows[0]?.balance ?? 0);

    // Compute achievements
    const achievements = [];

    if (mythicCount > 0) {
      achievements.push({
        id: 'mythic_hunter', icon: '✨', rarity: 'mythic',
        name: 'Mythic Hunter', nameUa: 'Мисливець за Mythic',
        desc: 'Dropped a Mythic item', descUa: 'Випав Mythic предмет',
      });
    }
    if (biggestWin >= 1000000) {
      achievements.push({
        id: 'millionaire', icon: '💰', rarity: 'legendary',
        name: 'Millionaire', nameUa: 'Мільйонер',
        desc: 'Won 1,000,000+ K in a single round', descUa: 'Виграли 1,000,000+ K за раунд',
      });
    } else if (biggestWin >= 100000) {
      achievements.push({
        id: 'big_winner', icon: '🏆', rarity: 'epic',
        name: 'Big Winner', nameUa: 'Великий виграш',
        desc: 'Won 100,000+ K in a single round', descUa: 'Виграли 100,000+ K за раунд',
      });
    }
    if (totalItems >= 50) {
      achievements.push({
        id: 'collector_pro', icon: '🗃️', rarity: 'rare',
        name: 'Master Collector', nameUa: 'Майстер колекціонер',
        desc: '50+ items collected', descUa: '50+ предметів зібрано',
      });
    } else if (totalItems >= 10) {
      achievements.push({
        id: 'collector', icon: '📦', rarity: 'uncommon',
        name: 'Collector', nameUa: 'Колекціонер',
        desc: '10+ items collected', descUa: '10+ предметів зібрано',
      });
    }
    if (totalGames >= 100) {
      achievements.push({
        id: 'veteran', icon: '⭐', rarity: 'rare',
        name: 'Veteran Player', nameUa: 'Ветеран',
        desc: '100+ games played', descUa: '100+ ігор зіграно',
      });
    }
    if (clickPower >= 50) {
      achievements.push({
        id: 'click_master', icon: '👆', rarity: 'uncommon',
        name: 'Click Master', nameUa: 'Майстер кліків',
        desc: 'Click power ≥ 50', descUa: 'Потужність кліку ≥ 50',
      });
    }
    if (autoPower >= 30) {
      achievements.push({
        id: 'auto_master', icon: '🤖', rarity: 'rare',
        name: 'Automation Expert', nameUa: 'Експерт автоматизації',
        desc: 'Auto power ≥ 30', descUa: 'Авто сила ≥ 30',
      });
    }
    if (balance >= 500000) {
      achievements.push({
        id: 'rich', icon: '💎', rarity: 'epic',
        name: 'High Roller', nameUa: 'Великий гравець',
        desc: 'Balance ≥ 500,000 K', descUa: 'Баланс ≥ 500,000 K',
      });
    }
    if (totalWagered >= 1000000) {
      achievements.push({
        id: 'high_roller', icon: '🎰', rarity: 'epic',
        name: 'Casino Regular', nameUa: 'Постійний клієнт',
        desc: 'Wagered 1,000,000+ K total', descUa: 'Поставлено 1,000,000+ K загалом',
      });
    }

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
