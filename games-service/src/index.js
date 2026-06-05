import express from 'express';
import { initDb } from './db.js';
import diceRouter from './routes/dice.js';
import rouletteRouter from './routes/roulette.js';
import minesRouter from './routes/mines.js';
import casesRouter from './routes/cases.js';
import plinkoRouter from './routes/plinko.js';
import battlesRouter from './routes/battles.js';
import itemsRouter from './routes/items.js';
import auctionRouter from './routes/auction.js';
import clickerRouter from './routes/clicker.js';

const app = express();
app.use(express.json());

app.use('/api/v1/games/dice', diceRouter);
app.use('/api/v1/games/roulette', rouletteRouter);
app.use('/api/v1/games/mines', minesRouter);
app.use('/api/v1/games/cases', casesRouter);
app.use('/api/v1/games/plinko', plinkoRouter);
app.use('/api/v1/battles', battlesRouter);
app.use('/api/v1/items', itemsRouter);
app.use('/api/v1/auction', auctionRouter);
app.use('/api/v1/clicker', clickerRouter);

const PORT = process.env.PORT || 5002;

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
  app.listen(PORT, () => console.log(`Games Service running on port ${PORT}`));
}

start();
