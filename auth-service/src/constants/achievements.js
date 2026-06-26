
export const MYTHIC_IDS     = ['divine_relic', 'cosmos_gem'];
export const LEGENDARY_IDS  = ['ancient_relic', 'void_artifact', 'phoenix_feather'];

export const ALL_ACHIEVEMENTS = [
  { id: 'mythic_hunter',  icon: '✨', rarity: 'mythic',    name: 'Mythic Hunter',       nameUa: 'Мисливець за Mythic',  desc: 'Dropped a Mythic item',              descUa: 'Випав Mythic предмет' },
  { id: 'millionaire',    icon: '💰', rarity: 'legendary', name: 'Millionaire',         nameUa: 'Мільйонер',            desc: 'Won 1,000,000+ K in a single round', descUa: 'Виграли 1,000,000+ K за раунд' },
  { id: 'big_winner',     icon: '🏆', rarity: 'epic',      name: 'Big Winner',          nameUa: 'Великий виграш',       desc: 'Won 100,000+ K in a single round',   descUa: 'Виграли 100,000+ K за раунд' },
  { id: 'collector_pro',  icon: '🗃️', rarity: 'rare',      name: 'Master Collector',    nameUa: 'Майстер колекціонер',  desc: '50+ items collected',                descUa: '50+ предметів зібрано' },
  { id: 'collector',      icon: '📦', rarity: 'uncommon',  name: 'Collector',           nameUa: 'Колекціонер',          desc: '10+ items collected',                descUa: '10+ предметів зібрано' },
  { id: 'veteran',        icon: '⭐', rarity: 'rare',      name: 'Veteran Player',      nameUa: 'Ветеран',              desc: '100+ games played',                  descUa: '100+ ігор зіграно' },
  { id: 'click_master',   icon: '👆', rarity: 'uncommon',  name: 'Click Master',        nameUa: 'Майстер кліків',       desc: 'Click power ≥ 50',                   descUa: 'Потужність кліку ≥ 50' },
  { id: 'auto_master',    icon: '🤖', rarity: 'rare',      name: 'Automation Expert',   nameUa: 'Експерт автоматизації',desc: 'Auto power ≥ 30',                    descUa: 'Авто сила ≥ 30' },
  { id: 'rich',           icon: '💎', rarity: 'epic',      name: 'High Roller',         nameUa: 'Великий гравець',      desc: 'Balance ≥ 500,000 K',                descUa: 'Баланс ≥ 500,000 K' },
  { id: 'high_roller',    icon: '🎰', rarity: 'epic',      name: 'Casino Regular',      nameUa: 'Постійний клієнт',     desc: 'Wagered 1,000,000+ K total',         descUa: 'Поставлено 1,000,000+ K загалом' },
  { id: 'special',        icon: '🌟', rarity: 'mythic',    name: 'Special Award',       nameUa: 'Особлива нагорода',    desc: 'Special recognition',                descUa: 'Особлива відзнака' },
  { id: 'early_bird',     icon: '🐦', rarity: 'uncommon',  name: 'Early Adopter',       nameUa: 'Ранній користувач',    desc: 'One of the first players',           descUa: 'Один з перших гравців' },
  { id: 'loyal',          icon: '❤️', rarity: 'rare',      name: 'Loyal Player',        nameUa: 'Лояльний гравець',     desc: 'Long-time community member',         descUa: 'Давній учасник спільноти' },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ALL_ACHIEVEMENTS.map(a => [a.id, a]));

export function getAchievement(id) {
  return ACHIEVEMENT_MAP[id] ?? { id, icon: '🏅', rarity: 'common', name: id, nameUa: id, desc: '', descUa: '' };
}
