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
      cheatType: item.cheatType || item.ruleTriggered || 'Unknown',
      cheatScore: item.cheatScore,
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
      cheatType: item.cheatType || item.ruleTriggered || 'Unknown',
      cheatScore: item.cheatScore,
      isFlick: item.isFlick
    }));

    res.json(transformed);
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
      cheatType: item.cheatType || item.ruleTriggered || 'Unknown',
      cheatScore: item.cheatScore,
      isFlick: item.isFlick
    }));

    res.json(transformed);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/detections - Report a new detection with Bloom Filter deduplication
 * Automatically flags suspicious players and prevents duplicate reports
 */
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

    // Check for duplicate using Bloom Filter
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

    // Flag the player as suspicious based on threat type
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

    // Mark as high-risk if high confidence
    if (detection.cheatScore >= 80) {
      suspiciousPlayerService.markAsHighRisk(detection.playerId);
    }

    // Save to database
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

/**
 * GET /api/detections/player/:playerId - Get threat profile for a player
 */
detectionsRouter.get('/player/:playerId', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);

    const threatProfile = suspiciousPlayerService.getThreatProfile(playerId);

    res.json(threatProfile);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/detections/threats/stats - Get bloom filter statistics
 */
detectionsRouter.get('/threats/stats', (_req, res) => {
  const stats = suspiciousPlayerService.getStats();
  res.json(stats);
});

