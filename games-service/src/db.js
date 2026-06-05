import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mines_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE,
      bet NUMERIC(20,2) NOT NULL,
      mines_count INT NOT NULL,
      mine_positions JSONB NOT NULL,
      opened JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS battles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      amount NUMERIC(20,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      creator_id UUID NOT NULL,
      creator_nick VARCHAR(100) NOT NULL,
      creator_side VARCHAR(10),
      creator_ready BOOLEAN NOT NULL DEFAULT FALSE,
      joiner_id UUID,
      joiner_nick VARCHAR(100),
      joiner_side VARCHAR(10),
      joiner_ready BOOLEAN NOT NULL DEFAULT FALSE,
      countdown_started_at TIMESTAMPTZ,
      winner_id UUID,
      winner_side VARCHAR(10),
      result_side VARCHAR(10),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      item_def_id VARCHAR(50) NOT NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'case',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auction_listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL,
      seller_nick VARCHAR(100) NOT NULL,
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      item_def_id VARCHAR(50) NOT NULL,
      price NUMERIC(20,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      buyer_id UUID,
      buyer_nick VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sold_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS clicker_state (
      user_id UUID PRIMARY KEY,
      coins BIGINT NOT NULL DEFAULT 0,
      click_power INT NOT NULL DEFAULT 1,
      auto_power INT NOT NULL DEFAULT 0,
      upgrades JSONB NOT NULL DEFAULT '{}',
      last_auto_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_stats (
      user_id UUID NOT NULL,
      game_type VARCHAR(30) NOT NULL,
      games_played INT NOT NULL DEFAULT 0,
      total_wagered NUMERIC(20,2) NOT NULL DEFAULT 0,
      total_won NUMERIC(20,2) NOT NULL DEFAULT 0,
      biggest_win NUMERIC(20,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, game_type)
    );
  `);
}

export default pool;
