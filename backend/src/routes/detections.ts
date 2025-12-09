import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';
import { z } from 'zod';

export const detectionsRouter = Router();

const querySchema = z.object({
  playerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cheatType: z.string().optional(),
});

// GET /api/detections - Suspicious events (detections) from Spark
detectionsRouter.get('/', async (req, res, next) => {
  try {
    const { playerId, page, limit, cheatType } = querySchema.parse(req.query);
    const db = await getDb();
    const coll = db.collection(config.collections.suspicious);

    const filter: Record<string, unknown> = {};
    if (playerId) filter.playerId = playerId;
    if (cheatType) filter.cheatType = cheatType;

    const cursor = coll
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const items = await cursor.toArray();
    const total = await coll.countDocuments(filter);

    // Transform to match frontend GameEvent interface
    const transformed = items.map(item => ({
      eventId: item._id?.toString(),
      eventType: item.eventType || 'mouseMove',
      playerId: item.playerId,
      speed: item.speed,
      deltaX: item.deltaX,
      deltaY: item.deltaY,
      timestamp: item.timestamp,
      cheatType: item.cheatType,
      isFlick: item.isFlick
    }));

    res.json({ page, limit, total, items: transformed });
  } catch (err) {
    next(err);
  }
});

// GET /api/detections/live - Recent suspicious events for live feed
detectionsRouter.get('/live', async (_req, res, next) => {
  try {
    const db = await getDb();
    const coll = db.collection(config.collections.suspicious);

    const items = await coll
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    const transformed = items.map(item => ({
      eventId: item._id?.toString(),
      eventType: item.eventType || 'mouseMove',
      playerId: item.playerId,
      speed: item.speed,
      deltaX: item.deltaX,
      deltaY: item.deltaY,
      timestamp: item.timestamp,
      cheatType: item.cheatType,
      isFlick: item.isFlick
    }));

    res.json(transformed);
  } catch (err) {
    next(err);
  }
});
