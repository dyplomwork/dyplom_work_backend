export const ITEM_DEFS = {
  // Common
  bronze_shard:   { id: 'bronze_shard',   name: 'Bronze Shard',    nameUa: 'Бронзовий осколок', rarity: 'common',    icon: '🪙', value: 150,     color: '#9ca3af' },
  iron_nugget:    { id: 'iron_nugget',     name: 'Iron Nugget',     nameUa: 'Залізна крупинка',  rarity: 'common',    icon: '⚙️', value: 300,     color: '#9ca3af' },
  wood_chip:      { id: 'wood_chip',       name: 'Wood Chip',       nameUa: 'Тріска',            rarity: 'common',    icon: '🪵', value: 100,     color: '#9ca3af' },

  // Uncommon
  silver_shard:   { id: 'silver_shard',   name: 'Silver Shard',    nameUa: 'Срібний осколок',   rarity: 'uncommon',  icon: '💿', value: 1200,    color: '#34d399' },
  emerald_gem:    { id: 'emerald_gem',     name: 'Emerald Gem',     nameUa: 'Смарагд',           rarity: 'uncommon',  icon: '💚', value: 2500,    color: '#34d399' },
  lucky_coin:     { id: 'lucky_coin',      name: 'Lucky Coin',      nameUa: 'Щаслива монета',    rarity: 'uncommon',  icon: '🍀', value: 3000,    color: '#34d399' },

  // Rare
  sapphire:       { id: 'sapphire',        name: 'Sapphire',        nameUa: 'Сапфір',            rarity: 'rare',      icon: '💎', value: 8000,    color: '#3b82f6' },
  iron_sword:     { id: 'iron_sword',      name: 'Iron Sword',      nameUa: 'Залізний меч',      rarity: 'rare',      icon: '⚔️', value: 12000,   color: '#3b82f6' },
  golden_shield:  { id: 'golden_shield',   name: 'Golden Shield',   nameUa: 'Золотий щит',       rarity: 'rare',      icon: '🛡️', value: 15000,   color: '#3b82f6' },

  // Epic
  dragon_crystal: { id: 'dragon_crystal',  name: 'Dragon Crystal',  nameUa: 'Кристал дракона',   rarity: 'epic',      icon: '🔮', value: 45000,   color: '#a855f7' },
  shadow_crown:   { id: 'shadow_crown',    name: 'Shadow Crown',    nameUa: 'Тіньова корона',    rarity: 'epic',      icon: '👑', value: 70000,   color: '#a855f7' },
  void_essence:   { id: 'void_essence',    name: 'Void Essence',    nameUa: 'Есенція порожнечі', rarity: 'epic',      icon: '🌑', value: 90000,   color: '#a855f7' },

  // Legendary
  ancient_relic:  { id: 'ancient_relic',   name: 'Ancient Relic',   nameUa: 'Стародавня реліквія',rarity: 'legendary', icon: '⚜️', value: 250000,  color: '#f59e0b' },
  void_artifact:  { id: 'void_artifact',   name: 'Void Artifact',   nameUa: 'Артефакт порожнечі',rarity: 'legendary', icon: '🌟', value: 400000,  color: '#f59e0b' },
  phoenix_feather:{ id: 'phoenix_feather', name: 'Phoenix Feather', nameUa: 'Перо фенікса',      rarity: 'legendary', icon: '🔥', value: 600000,  color: '#f59e0b' },

  // Mythic (ultra-rare)
  divine_relic:   { id: 'divine_relic',    name: 'Divine Relic',    nameUa: 'Божественна реліквія',rarity:'mythic',    icon: '✨', value: 2000000, color: '#ec4899' },
  cosmos_gem:     { id: 'cosmos_gem',      name: 'Cosmos Gem',      nameUa: 'Камінь космосу',    rarity: 'mythic',    icon: '🌌', value: 5000000, color: '#ec4899' },
};

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export function getItemDef(id) {
  return ITEM_DEFS[id] ?? null;
}
