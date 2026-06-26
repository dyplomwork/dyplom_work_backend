
export function userDto(row) {
  return {
    id:         row.id,
    nickname:   row.nickname,
    role:       row.role,
    balance:    parseFloat(row.balance),
    avatar_url: row.avatar_url ?? null,
  };
}

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
