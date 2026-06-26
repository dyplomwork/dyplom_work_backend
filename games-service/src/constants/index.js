
export const DICE_HOUSE_EDGE = 0.01;
export const MINES_PAYOUT_FACTOR = 0.97;

export const BIG_WIN_THRESHOLD = 20;

export const BIG_WIN_TIERS = {
  super: { min: 100, label: 'SUPER WIN', icon: '🌟', color: '#ec4899', rarity: 'mythic' },
  mega:  { min: 50,  label: 'MEGA WIN',  icon: '💥', color: '#f59e0b', rarity: 'legendary' },
  big:   { min: 20,  label: 'BIG WIN',   icon: '🔥', color: '#a855f7', rarity: 'epic' },
};

export function getBigWinTier(mult) {
  if (mult >= BIG_WIN_TIERS.super.min) return 'super';
  if (mult >= BIG_WIN_TIERS.mega.min)  return 'mega';
  return 'big';
}
