import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, addBalance } from '../middleware/auth.js';
import { ITEM_DEFS } from '../itemDefs.js';

const router = Router();

export const UPGRADES = [
  // ── Tier 1: Coin upgrades ──────────────────────────────────────────
  {
    id: 'click_c1', tier: 1, visual: null,
    name: 'Quick Fingers', nameUa: 'Швидкі пальці',
    desc: '+1 per click', descUa: '+1 за клік',
    coinCost: 80, itemReq: null,
    clickBonus: 1, autoBonus: 0, maxLevel: 5,
  },
  {
    id: 'auto_c1', tier: 1, visual: null,
    name: 'Clicker Bot', nameUa: 'Клікер-бот',
    desc: 'Basic auto +1/sec', descUa: 'Базовий авто +1/сек',
    coinCost: 400, itemReq: null,
    clickBonus: 0, autoBonus: 1, maxLevel: 5,
  },
  {
    id: 'click_c2', tier: 1, visual: null,
    name: 'Faster Hands', nameUa: 'Швидші руки',
    desc: '+2 per click', descUa: '+2 за клік',
    coinCost: 600, itemReq: null,
    clickBonus: 2, autoBonus: 0, maxLevel: 4,
  },
  // ── Tier 2: Uncommon items ─────────────────────────────────────────
  {
    id: 'lucky_touch', tier: 2, visual: 'lucky',
    name: 'Lucky Touch', nameUa: 'Щасливий дотик',
    desc: 'Requires 1× Lucky Coin', descUa: 'Потрібна 1× Щаслива монета',
    coinCost: 0, itemReq: { itemDefId: 'lucky_coin', count: 1 },
    clickBonus: 5, autoBonus: 0, maxLevel: 3,
  },
  {
    id: 'tap_bot', tier: 2, visual: 'robot',
    name: 'Tap Bot', nameUa: 'Тап-бот',
    desc: 'Requires 2× Silver Shard — robots hit the coin!', descUa: 'Потрібні 2× Срібний осколок — роботи б\'ють по монеті!',
    coinCost: 0, itemReq: { itemDefId: 'silver_shard', count: 2 },
    clickBonus: 0, autoBonus: 5, maxLevel: 3,
  },
  {
    id: 'emerald_boost', tier: 2, visual: 'emerald',
    name: 'Emerald Boost', nameUa: 'Смарагдовий буст',
    desc: 'Requires 1× Emerald Gem — green sparkles', descUa: 'Потрібен 1× Смарагд — зелені іскри',
    coinCost: 0, itemReq: { itemDefId: 'emerald_gem', count: 1 },
    clickBonus: 3, autoBonus: 2, maxLevel: 3,
  },
  {
    id: 'ice_nova', tier: 2, visual: 'ice',
    name: 'Ice Nova', nameUa: 'Крижана нова',
    desc: 'Requires 2× Bronze Shard — frost crystals orbit', descUa: 'Потрібні 2× Бронзовий осколок — кристали інею обертаються',
    coinCost: 0, itemReq: { itemDefId: 'bronze_shard', count: 2 },
    clickBonus: 2, autoBonus: 2, maxLevel: 4,
  },
  {
    id: 'iron_tempo', tier: 2, visual: 'spark',
    name: 'Iron Tempo', nameUa: 'Залізний ритм',
    desc: 'Requires 2× Iron Nugget — metallic sparks flash', descUa: 'Потрібні 2× Залізна крупинка — металеві іскри',
    coinCost: 0, itemReq: { itemDefId: 'iron_nugget', count: 2 },
    clickBonus: 4, autoBonus: 3, maxLevel: 3,
  },
  // ── Tier 3: Rare items ─────────────────────────────────────────────
  {
    id: 'sapphire_strike', tier: 3, visual: 'sapphire',
    name: 'Sapphire Strike', nameUa: 'Сапфіровий удар',
    desc: 'Requires 1× Sapphire — blue lightning', descUa: 'Потрібен 1× Сапфір — блискавка',
    coinCost: 0, itemReq: { itemDefId: 'sapphire', count: 1 },
    clickBonus: 20, autoBonus: 0, maxLevel: 2,
  },
  {
    id: 'dragon_engine', tier: 3, visual: 'dragon',
    name: 'Dragon Engine', nameUa: 'Двигун дракона',
    desc: 'Requires 1× Dragon Crystal — fire aura', descUa: 'Потрібен 1× Кристал дракона — вогняна аура',
    coinCost: 0, itemReq: { itemDefId: 'dragon_crystal', count: 1 },
    clickBonus: 0, autoBonus: 15, maxLevel: 2,
  },
  {
    id: 'sword_slash', tier: 3, visual: 'sword',
    name: 'Sword Slash', nameUa: 'Удар меча',
    desc: 'Requires 1× Iron Sword — sword orbits coin', descUa: 'Потрібен 1× Залізний меч — меч обертається навколо монети',
    coinCost: 0, itemReq: { itemDefId: 'iron_sword', count: 1 },
    clickBonus: 10, autoBonus: 8, maxLevel: 2,
  },
  {
    id: 'golden_guard', tier: 3, visual: 'shield',
    name: 'Golden Guard', nameUa: 'Золотий щит',
    desc: 'Requires 1× Golden Shield — shields orbit the coin', descUa: 'Потрібен 1× Золотий щит — щити обертаються навколо монети',
    coinCost: 0, itemReq: { itemDefId: 'golden_shield', count: 1 },
    clickBonus: 15, autoBonus: 8, maxLevel: 2,
  },
  // ── Tier 4: Epic items ─────────────────────────────────────────────
  {
    id: 'void_power', tier: 4, visual: 'void',
    name: 'Void Power', nameUa: 'Сила порожнечі',
    desc: 'Requires 1× Void Essence — void swirl', descUa: 'Потрібна 1× Есенція порожнечі — вихор',
    coinCost: 0, itemReq: { itemDefId: 'void_essence', count: 1 },
    clickBonus: 60, autoBonus: 0, maxLevel: 1,
  },
  {
    id: 'shadow_farm', tier: 4, visual: 'shadow',
    name: 'Shadow Farm', nameUa: 'Тіньова ферма',
    desc: 'Requires 1× Shadow Crown — dark aura', descUa: 'Потрібна 1× Тіньова корона — темна аура',
    coinCost: 0, itemReq: { itemDefId: 'shadow_crown', count: 1 },
    clickBonus: 0, autoBonus: 40, maxLevel: 1,
  },
  {
    id: 'crystal_storm', tier: 4, visual: 'crystal',
    name: 'Crystal Storm', nameUa: 'Кристальна буря',
    desc: 'Requires 1× Dragon Crystal — crystals orbit', descUa: 'Потрібен 1× Кристал дракона — кристали навколо',
    coinCost: 0, itemReq: { itemDefId: 'dragon_crystal', count: 1 },
    clickBonus: 30, autoBonus: 20, maxLevel: 1,
  },
  // ── Tier 5: Legendary items ────────────────────────────────────────
  {
    id: 'phoenix_aura', tier: 5, visual: 'phoenix',
    name: 'Phoenix Aura', nameUa: 'Аура фенікса',
    desc: 'Requires 1× Phoenix Feather — flame halo', descUa: 'Потрібне 1× Перо фенікса — полум\'яний ореол',
    coinCost: 0, itemReq: { itemDefId: 'phoenix_feather', count: 1 },
    clickBonus: 100, autoBonus: 25, maxLevel: 1,
  },
  {
    id: 'relic_power', tier: 5, visual: 'relic',
    name: 'Ancient Power', nameUa: 'Стародавня сила',
    desc: 'Requires 1× Ancient Relic — golden rays', descUa: 'Потрібна 1× Стародавня реліквія — золоті промені',
    coinCost: 0, itemReq: { itemDefId: 'ancient_relic', count: 1 },
    clickBonus: 80, autoBonus: 50, maxLevel: 1,
  },
  {
    id: 'void_storm', tier: 5, visual: 'storm',
    name: 'Void Storm', nameUa: 'Буря порожнечі',
    desc: 'Requires 1× Void Artifact — electric storm erupts', descUa: 'Потрібен 1× Артефакт порожнечі — електрична буря навколо монети',
    coinCost: 0, itemReq: { itemDefId: 'void_artifact', count: 1 },
    clickBonus: 60, autoBonus: 80, maxLevel: 1,
  },
  // ── Tier 6: Mythic items ───────────────────────────────────────────
  {
    id: 'cosmos_skin', tier: 6, visual: 'cosmos',
    name: 'Cosmic Coin', nameUa: 'Космічна монета',
    desc: 'Requires 1× Cosmos Gem — transforms coin to galaxy!', descUa: 'Потрібен 1× Камінь космосу — перетворює монету на галактику!',
    coinCost: 0, itemReq: { itemDefId: 'cosmos_gem', count: 1 },
    clickBonus: 250, autoBonus: 75, maxLevel: 1,
  },
  {
    id: 'divine_touch', tier: 6, visual: 'divine',
    name: 'Divine Touch', nameUa: 'Божественний дотик',
    desc: 'Requires 1× Divine Relic — divine particles', descUa: 'Потрібна 1× Божественна реліквія — божественні частинки',
    coinCost: 0, itemReq: { itemDefId: 'divine_relic', count: 1 },
    clickBonus: 300, autoBonus: 100, maxLevel: 1,
  },
];

const CONVERT_RATE = 1000;

async function getOrCreateState(userId) {
  const { rows } = await pool.query(
    `INSERT INTO clicker_state (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING *`,
    [userId]
  );
  return rows[0];
}

function applyAutoCoins(state) {
  const coins = Number(state.coins) || 0;
  if (Number(state.auto_power) <= 0) return { ...state, coins };
  const nowMs = Date.now();
  const lastMs = new Date(state.last_auto_at).getTime();
  const secondsElapsed = Math.min((nowMs - lastMs) / 1000, 3600);
  const earned = Math.floor(Number(state.auto_power) * secondsElapsed);
  return { ...state, coins: coins + earned };
}

async function getSpecificItems(userId, itemDefId, limit) {
  const { rows } = await pool.query(
    `SELECT i.id FROM items i
     LEFT JOIN auction_listings al ON al.item_id = i.id AND al.status = 'ACTIVE'
     WHERE i.user_id = $1 AND i.item_def_id = $2 AND al.id IS NULL LIMIT $3`,
    [userId, itemDefId, limit]
  );
  return rows.map(r => r.id);
}

// GET /api/v1/clicker
router.get('/', requireAuth, async (req, res) => {
  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    if (state.coins !== Number(raw.coins)) {
      await pool.query(`UPDATE clicker_state SET coins = $1, last_auto_at = NOW() WHERE user_id = $2`, [state.coins, req.user.id]);
    }
    res.json({
      ok: true,
      coins: Number(state.coins),
      clickPower: Number(state.click_power),
      autoPower: Number(state.auto_power),
      upgrades: state.upgrades,
      convertRate: CONVERT_RATE,
      upgradeList: UPGRADES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/clicker/click — batched
router.post('/click', requireAuth, async (req, res) => {
  const clicks = Math.min(200, Math.max(1, parseInt(req.body.clicks) || 1));
  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    const earned = Number(state.click_power) * clicks;
    const newCoins = Number(state.coins) + earned;
    await pool.query(`UPDATE clicker_state SET coins = $1, last_auto_at = NOW() WHERE user_id = $2`, [newCoins, req.user.id]);
    res.json({ ok: true, coins: Number(newCoins), earned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /api/v1/clicker/upgrade
router.post('/upgrade', requireAuth, async (req, res) => {
  const { upgradeId } = req.body;
  const upgradeDef = UPGRADES.find(u => u.id === upgradeId);
  if (!upgradeDef) return res.status(400).json({ ok: false, error: 'Unknown upgrade' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    const levels = state.upgrades ?? {};
    const currentLevel = Number(levels[upgradeId] ?? 0);

    if (currentLevel >= upgradeDef.maxLevel) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Upgrade maxed out' });
    }

    let newCoins = Number(state.coins);

    if (upgradeDef.itemReq) {
      const { itemDefId, count } = upgradeDef.itemReq;
      const itemIds = await getSpecificItems(req.user.id, itemDefId, count);
      if (itemIds.length < count) {
        await client.query('ROLLBACK');
        const def = ITEM_DEFS[itemDefId];
        return res.status(400).json({ ok: false, error: `Need ${count}× ${def?.name ?? itemDefId}` });
      }
      await client.query(`DELETE FROM items WHERE id = ANY($1) AND user_id = $2`, [itemIds.slice(0, count), req.user.id]);
    } else {
      const cost = upgradeDef.coinCost * (currentLevel + 1);
      if (newCoins < cost) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Not enough coins' });
      }
      newCoins -= cost;
    }

    const newLevels = { ...levels, [upgradeId]: currentLevel + 1 };
    const newClickPower = Number(state.click_power) + upgradeDef.clickBonus;
    const newAutoPower = Number(state.auto_power) + upgradeDef.autoBonus;

    await client.query(
      `UPDATE clicker_state SET coins = $1, click_power = $2, auto_power = $3, upgrades = $4, last_auto_at = NOW() WHERE user_id = $5`,
      [newCoins, newClickPower, newAutoPower, JSON.stringify(newLevels), req.user.id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, coins: Number(newCoins), clickPower: Number(newClickPower), autoPower: Number(newAutoPower), upgrades: newLevels });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/clicker/convert
router.post('/convert', requireAuth, async (req, res) => {
  try {
    const raw = await getOrCreateState(req.user.id);
    const state = applyAutoCoins(raw);
    const coins = Number(state.coins);
    if (coins < CONVERT_RATE) return res.status(400).json({ ok: false, error: `Need at least ${CONVERT_RATE} coins` });
    const batches = Math.floor(coins / CONVERT_RATE);
    const coinsUsed = batches * CONVERT_RATE;
    await pool.query(`UPDATE clicker_state SET coins = coins - $1, last_auto_at = NOW() WHERE user_id = $2`, [coinsUsed, req.user.id]);
    await addBalance(req.user.id, batches);
    res.json({ ok: true, coinsUsed, kCoinsEarned: batches, coinsLeft: coins - coinsUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
