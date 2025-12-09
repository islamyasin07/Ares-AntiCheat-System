import { Router } from 'express';
import { getDb } from '../db/mongo';
import { z } from 'zod';

export const detectionsRouter = Router();

const querySchema = z.object({
  playerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  rule: z.string().optional(),
});

detectionsRouter.get('/', async (req, res, next) => {
  try {
    const { playerId, page, limit, rule } = querySchema.parse(req.query);
    const db = await getDb();
    const filter: Record<string, unknown> = {};
    if (playerId) filter.playerId = playerId;
    if (rule) filter.ruleTriggered = rule;

    const cursor = db
      .collection('detections')
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = await cursor.toArray();
    const total = await db.collection('detections').countDocuments(filter);
    res.json({ page, limit, total, items });
  } catch (err) {
    next(err);
  }
});
