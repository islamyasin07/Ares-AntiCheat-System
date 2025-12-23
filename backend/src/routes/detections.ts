import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';
import { z } from 'zod';
import { getDeduplicationService } from '../services/deduplicationService';
import { getSuspiciousPlayerService } from '../services/suspiciousPlayerService';

export const detectionsRouter = Router();

const deduplicationService = getDeduplicationService();
const suspiciousPlayerService = getSuspiciousPlayerService();

const querySchema = z.object({
  playerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cheatType: z.string().optional(),
});


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

    const transformed = items.map(item => ({
      eventId: item._id?.toString(),
      eventType: item.eventType || item.event_type || 'mouseMove',
      // normalize possible Spark field names (player_id / playerId)
      playerId: item.playerId || item.player_id || item.player_id_norm || item.player_id_norm || null,
      speed: item.speed || item.movement_speed || null,
      deltaX: item.deltaX || null,
      deltaY: item.deltaY || null,
      // normalize timestamp fields (timestamp / detected_at / unix_timestamp)
      timestamp: item.timestamp || item.detected_at || item.detectedAt || item.unix_timestamp || null,
      cheatType: item.cheatType || item.ruleTriggered || item.cheat_type || 'Unknown',
      cheatScore: item.cheatScore,
      isFlick: item.isFlick || item.is_flick_shot || false,
      source: item.cheatScore !== undefined ? 'ml' : (item.source || 'spark')
    }));

    res.json({ page, limit, total, items: transformed });
  } catch (err) {
    next(err);
  }
});


detectionsRouter.get('/live', async (_req, res, next) => {
  try {
    const db = await getDb();
    const coll = db.collection(config.collections.suspicious);

    const items = await coll
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    const transformed = items.map(item => ({
      eventId: item._id?.toString(),
      eventType: item.eventType || item.event_type || 'mouseMove',
      playerId: item.playerId || item.player_id || item.player_id_norm || null,
      speed: item.speed || item.movement_speed || null,
      deltaX: item.deltaX || null,
      deltaY: item.deltaY || null,
      timestamp: item.timestamp || item.detected_at || item.detectedAt || item.unix_timestamp || null,
      cheatType: item.cheatType || item.ruleTriggered || item.cheat_type || 'Unknown',
      cheatScore: item.cheatScore,
      isFlick: item.isFlick || item.is_flick_shot || false,
      source: item.cheatScore !== undefined ? 'ml' : (item.source || 'spark')
    }));

    res.json(transformed);
  } catch (err) {
    next(err);
  }
});


detectionsRouter.get('/live-db', async (_req, res, next) => {
  try {
    const db = await getDb();
    const coll = db.collection(config.collections.suspicious);

    const items = await coll
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    const transformed = items.map(item => ({
      eventId: item._id?.toString(),
      eventType: item.eventType || item.event_type || 'mouseMove',
      playerId: item.playerId || item.player_id || item.player_id_norm || null,
      speed: item.speed || item.movement_speed || null,
      deltaX: item.deltaX || null,
      deltaY: item.deltaY || null,
      timestamp: item.timestamp || item.detected_at || item.detectedAt || item.unix_timestamp || null,
      cheatType: item.cheatType || item.ruleTriggered || item.cheat_type || 'Unknown',
      cheatScore: item.cheatScore,
      isFlick: item.isFlick || item.is_flick_shot || false,
      source: item.cheatScore !== undefined ? 'ml' : (item.source || 'spark')
    }));

    res.set('Cache-Control', 'no-store');
    res.json(transformed);
  } catch (err) {
    next(err);
  }
});


const detectionSchema = z.object({
  playerId: z.string().min(1),
  cheatType: z.string(),
  cheatScore: z.number().min(0).max(100),
  timestamp: z.number(),
  eventType: z.string().optional(),
  speed: z.number().optional(),
  deltaX: z.number().optional(),
  deltaY: z.number().optional(),
  isFlick: z.boolean().optional(),
});

detectionsRouter.post('/', async (req, res, next) => {
  try {
    const detection = detectionSchema.parse(req.body);

    const isDuplicate = deduplicationService.isSuspiciousDuplicate(
      detection.playerId,
      detection.cheatType,
      detection.timestamp
    );

    if (isDuplicate) {
      return res.status(409).json({
        error: 'Duplicate detection already reported',
        isDuplicate: true
      });
    }

    if (detection.cheatType.includes('Aimbot')) {
      suspiciousPlayerService.flagAimbotSuspect(detection.playerId);
    } else if (detection.cheatType.includes('Recoil')) {
      suspiciousPlayerService.flagNoRecoilSuspect(detection.playerId);
    } else if (detection.cheatType.includes('Speed')) {
      suspiciousPlayerService.flagSpeedhacker(detection.playerId);
    } else if (detection.cheatType.includes('Wall')) {
      suspiciousPlayerService.flagWallhacker(detection.playerId);
    } else {
      suspiciousPlayerService.flagPlayer(detection.playerId);
    }

    if (detection.cheatScore >= 80) {
      suspiciousPlayerService.markAsHighRisk(detection.playerId);
    }

    const db = await getDb();
    const coll = db.collection(config.collections.suspicious);

    const result = await coll.insertOne({
      ...detection,
      createdAt: new Date()
    });

    res.status(201).json({
      _id: result.insertedId,
      ...detection,
      isDuplicate: false,
      flagged: true
    });
  } catch (err) {
    next(err);
  }
});


detectionsRouter.get('/player/:playerId', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const threatProfile = suspiciousPlayerService.getThreatProfile(playerId);
    res.json(threatProfile);
  } catch (err) {
    next(err);
  }
});
detectionsRouter.get('/threats/stats', (_req, res) => {
  const stats = suspiciousPlayerService.getStats();
  res.json(stats);
});
