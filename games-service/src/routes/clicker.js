import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, addBalance } from '../middleware/auth.js';

const router = Router();

// Upgrade definitions
const UPGRADES = [
  { id: 'click_1', nameUa: 'Кращий клік',      name: 'Better Click',   cost: 100,   clickBonus: 1,  autoBonus: 0,  maxLevel: 10 },
  { id: 'click_2', nameUa: 'Потужний клік',     name: 'Power Click',    cost: 1500,  clickBonus: 5,  autoBonus: 0,  maxLevel: 5  },
  { id: 'click_3', nameUa: 'Мега-клік',         name: 'Mega Click',     cost: 15000, clickBonus: 25, autoBonus: 0,  maxLevel: 3  },
  { id: 'auto_1',  nameUa: 'Авто-клікер',       name: 'Auto Clicker',   cost: 500,   clickBonus: 0,  autoBonus: 1,  maxLevel: 10 },
  { id: 'auto_2',  nameUa: 'Авто-ферма',        name: 'Auto Farm',      cost: 8000,  clickBonus: 0,  autoBonus: 5,  maxLevel: 5  },
  { id: 'auto_3',  nameUa: 'Нейромережа',       name: 'Neural Net',     cost: 50000, clickBonus: 0,  autoBonus: 20, maxLevel: 3  },
];

const CONVERT_RATE = 1000; // 1000 clicker coins = 1 K-coin

async function getOrCreateState(userId) {
  const { rows } = await pool.query(
    `INSERT INTO clicker_state (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId]
  );
  return rows[0];
}

function applyAutoCoins(state) {
  if (state.auto_power <= 0) return state;
  const nowMs = Date.now();
  const lastMs = new Date(state.last_auto_at).getTime();
  const secondsElapsed = Math.min((nowMs - lastMs) / 1000, 3600); // cap at 1 hour
  const earned = Math.floor(state.auto_power * secondsElapsed);
  return { ...state, coins: state.coins + earned };
}

// GET /api/v1/clicker
router.get('/', requireAuth, async (req, res) => {
  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    if (state.coins !== raw.coins) {
      await pool.query(
        `UPDATE clicker_state SET coins = $1, last_auto_at = NOW() WHERE user_id = $2`,
        [state.coins, req.user.id]
      );
    }
    res.json({
      ok: true,
      coins: state.coins,
      clickPower: state.click_power,
      autoPower: state.auto_power,
      upgrades: state.upgrades,
      convertRate: CONVERT_RATE,
      upgradeList: UPGRADES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/clicker/click — click (up to 100 at once)
router.post('/click', requireAuth, async (req, res) => {
  const clicks = Math.min(100, Math.max(1, parseInt(req.body.clicks) || 1));
  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    const earned = state.click_power * clicks;
    const newCoins = state.coins + earned;
    await pool.query(
      `UPDATE clicker_state SET coins = $1, last_auto_at = NOW() WHERE user_id = $2`,
      [newCoins, req.user.id]
    );
    res.json({ ok: true, coins: newCoins, earned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/clicker/upgrade — buy upgrade
router.post('/upgrade', requireAuth, async (req, res) => {
  const { upgradeId } = req.body;
  const upgradeDef = UPGRADES.find(u => u.id === upgradeId);
  if (!upgradeDef) return res.status(400).json({ ok: false, error: 'Unknown upgrade' });

  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    const levels = state.upgrades ?? {};
    const currentLevel = levels[upgradeId] ?? 0;

    if (currentLevel >= upgradeDef.maxLevel) {
      return res.status(400).json({ ok: false, error: 'Upgrade maxed out' });
    }

    const cost = upgradeDef.cost * (currentLevel + 1);
    if (state.coins < cost) {
      return res.status(400).json({ ok: false, error: 'Not enough coins' });
    }

    const newLevels = { ...levels, [upgradeId]: currentLevel + 1 };
    const newCoins = state.coins - cost;
    const newClickPower = state.click_power + upgradeDef.clickBonus;
    const newAutoPower = state.auto_power + upgradeDef.autoBonus;

    await pool.query(
      `UPDATE clicker_state SET coins = $1, click_power = $2, auto_power = $3, upgrades = $4, last_auto_at = NOW()
       WHERE user_id = $5`,
      [newCoins, newClickPower, newAutoPower, JSON.stringify(newLevels), req.user.id]
    );

    res.json({ ok: true, coins: newCoins, clickPower: newClickPower, autoPower: newAutoPower, upgrades: newLevels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/clicker/convert — convert clicker coins to K-coins
router.post('/convert', requireAuth, async (req, res) => {
  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    if (state.coins < CONVERT_RATE) {
      return res.status(400).json({ ok: false, error: `Need at least ${CONVERT_RATE} coins to convert` });
    }
    const batches = Math.floor(state.coins / CONVERT_RATE);
    const coinsUsed = batches * CONVERT_RATE;
    const kCoinsEarned = batches; // 1000 coins = 1 K

    await pool.query(
      `UPDATE clicker_state SET coins = coins - $1, last_auto_at = NOW() WHERE user_id = $2`,
      [coinsUsed, req.user.id]
    );
    await addBalance(req.user.id, kCoinsEarned);

    const remaining = state.coins - coinsUsed;
    res.json({ ok: true, coinsUsed, kCoinsEarned, coinsLeft: remaining });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
