import { Router } from 'express';
import { getDb } from '../db/mongo';
import { z } from 'zod';

export const eventsRouter = Router();

const querySchema = z.object({
  playerId: z.string().min(1).optional(),
  type: z.enum(['raw', 'features']).default('raw'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

eventsRouter.get('/', async (req, res, next) => {
  try {
    const { playerId, type, page, limit } = querySchema.parse(req.query);
    const db = await getDb();
    const coll = type === 'raw' ? 'events_raw' : 'events_features';
    const filter: Record<string, unknown> = {};
    if (playerId) filter.playerId = playerId;

    const cursor = db
      .collection(coll)
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = await cursor.toArray();
    const total = await db.collection(coll).countDocuments(filter);
    res.json({ page, limit, total, items });
  } catch (err) {
    next(err);
  }
});
