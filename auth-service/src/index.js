import express from 'express';
import { initDb } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import statsRouter from './routes/stats.js';
import ticketsRouter from './routes/tickets.js';
import donationsRouter from './routes/donations.js';
import pool from './db.js';

// Fail fast if the JWT signing secret is missing — never run with an undefined
// secret (jwt.sign would throw per-request and tokens could not be verified).
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use('/api/v1/accounts', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/tickets', ticketsRouter);
app.use('/api/v1/donations', donationsRouter);

// GET /api/me — alias
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    const u = rows[0];
    res.json({
      ok: true,
      user: { id: u.id, nickname: u.nickname, discord: u.discord, role: u.role, balance: parseFloat(u.balance) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5001;

async function start() {
  let retries = 10;
  while (retries > 0) {
    try {
      await initDb();
      console.log('Database initialized');
      break;
    } catch (err) {
      retries--;
      console.log(`DB not ready, retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
}

start();
