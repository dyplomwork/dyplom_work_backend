/**
 * Shared game constants for games-service.
 * Import from here to keep a single source of truth.
 */

// ── House edges ────────────────────────────────────────────────────────────
/** Dice: fraction of each bet kept by the house (1 %) */
export const DICE_HOUSE_EDGE = 0.01;
/** Mines: fraction of theoretical payout returned to player (97 %) */
export const MINES_PAYOUT_FACTOR = 0.97;

// ── Big Win ────────────────────────────────────────────────────────────────
/**
 * Minimum payout/bet ratio for a win to be promoted to the live ticker
 * as a Big Win event. e.g. 20 means payout >= bet * 20.
 */
export const BIG_WIN_THRESHOLD = 20;

/** Tier definitions (mult thresholds, labels, icons, colors) */
export const BIG_WIN_TIERS = {
  super: { min: 100, label: 'SUPER WIN', icon: '🌟', color: '#ec4899', rarity: 'mythic' },
  mega:  { min: 50,  label: 'MEGA WIN',  icon: '💥', color: '#f59e0b', rarity: 'legendary' },
  big:   { min: 20,  label: 'BIG WIN',   icon: '🔥', color: '#a855f7', rarity: 'epic' },
};

/**
 * Returns the tier key ('super' | 'mega' | 'big') for a given multiplier.
 * @param {number} mult  payout / bet ratio
 */
export function getBigWinTier(mult) {
  if (mult >= BIG_WIN_TIERS.super.min) return 'super';
  if (mult >= BIG_WIN_TIERS.mega.min)  return 'mega';
  return 'big';
}
