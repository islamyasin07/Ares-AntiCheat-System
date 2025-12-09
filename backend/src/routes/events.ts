import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';
import { z } from 'zod';

export const eventsRouter = Router();

const querySchema = z.object({
  playerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// GET /api/events - All parsed events from Spark
eventsRouter.get('/', async (req, res, next) => {
  try {
    const { playerId, page, limit } = querySchema.parse(req.query);
    const db = await getDb();
    const coll = db.collection(config.collections.events);

    const filter: Record<string, unknown> = {};
    if (playerId) filter.playerId = playerId;

    const cursor = coll
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = await cursor.toArray();
    const total = await coll.countDocuments(filter);

    res.json({ page, limit, total, items });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/live - Recent events for live feed (last 50)
eventsRouter.get('/live', async (_req, res, next) => {
  try {
    const db = await getDb();
    const coll = db.collection(config.collections.events);

    const items = await coll
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    res.json(items);
  } catch (err) {
    next(err);
  }
});
