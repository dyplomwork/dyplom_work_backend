/**
 * Data Transfer Object helpers for auth-service.
 * Single source of truth — imported by auth.js and admin.js.
 */

/** Public user DTO — returned to the client after login/register */
export function userDto(row) {
  return {
    id:         row.id,
    nickname:   row.nickname,
    role:       row.role,
    balance:    parseFloat(row.balance),
    avatar_url: row.avatar_url ?? null,
  };
}

/** Extended user DTO — used in admin panel (includes discord, status, createdAt) */
export function adminUserDto(row) {
  return {
    id:         row.id,
    nickname:   row.nickname,
    discord:    row.discord ?? null,
    role:       row.role,
    balance:    parseFloat(row.balance),
    avatar_url: row.avatar_url ?? null,
    status:     row.status ?? 'active',
    banReason:  row.ban_reason ?? null,
    createdAt:  row.created_at,
  };
}
