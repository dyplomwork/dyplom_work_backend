import { Router } from 'express';

const router = Router();

// Circular buffer of last 50 drops (in-memory)
const recentDrops = [];
const MAX_DROPS = 50;

export function pushDrop(drop) {
  recentDrops.unshift(drop); // newest first
  if (recentDrops.length > MAX_DROPS) recentDrops.pop();
}

// GET /api/v1/drops/recent
router.get('/recent', (req, res) => {
  res.json(recentDrops.slice(0, 20));
});

export default router;
