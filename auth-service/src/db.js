import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nickname VARCHAR(50) UNIQUE NOT NULL,
      discord VARCHAR(100),
      password_hash VARCHAR(255) NOT NULL DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      balance NUMERIC(20,2) NOT NULL DEFAULT 10000,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id VARCHAR(50) NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      granted_by UUID REFERENCES users(id),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS donations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id VARCHAR(40) NOT NULL,
      amount_usd NUMERIC(10,2) NOT NULL,
      coins_credited NUMERIC(20,2) NOT NULL,
      idempotency_key TEXT UNIQUE,
      payment_token_hash TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Idempotent schema migrations
  await pool.query(`ALTER TABLE users ALTER COLUMN discord DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_discord_key`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`).catch(() => {});

  // Seed default admin account ONLY when explicitly enabled via env.
  // Never ships an insecure default password — the password must be provided.
  if (process.env.SEED_DEFAULT_ADMIN === 'true') {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.warn('⚠ SEED_DEFAULT_ADMIN=true but ADMIN_PASSWORD is not set — skipping admin seed');
    } else {
      const { rows } = await pool.query(`SELECT id FROM users WHERE nickname = 'Admin'`);
      if (rows.length === 0) {
        const hash = await bcrypt.hash(adminPassword, 10);
        await pool.query(
          `INSERT INTO users (nickname, password_hash, role, balance)
           VALUES ('Admin', $1, 'admin', 0)
           ON CONFLICT DO NOTHING`,
          [hash]
        );
        console.log('✓ Default admin created: nickname=Admin (password from ADMIN_PASSWORD)');
      }
    }
  }
}

export default pool;
