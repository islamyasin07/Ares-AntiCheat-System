import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';
import { z } from 'zod';

export const playersRouter = Router();

// GET /api/players - List all players with stats
playersRouter.get('/', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const suspiciousCol = db.collection(config.collections.suspicious);

    // Get unique players from events
    const playerIds = await eventsCol.distinct('playerId');

    // For each player, calculate stats
    const players = await Promise.all(
      playerIds.slice(0, 50).map(async (playerId) => {
        const [totalEvents, suspiciousEvents] = await Promise.all([
          eventsCol.countDocuments({ playerId }),
          suspiciousCol.countDocuments({ playerId })
        ]);

        // Risk score: percentage of suspicious events (capped at 100)
        const riskScore = totalEvents > 0
          ? Math.min(100, Math.round((suspiciousEvents / totalEvents) * 100 * 2))
          : 0;

        return {
          id: playerId,
          nickname: playerId, // Use playerId as nickname (could be enriched)
          country: ['US', 'EU', 'MENA', 'ASIA'][Math.abs(playerId.charCodeAt(1)) % 4],
          rank: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][riskScore % 5],
          totalEvents,
          suspiciousEvents,
          riskScore
        };
      })
    );

    // Sort by risk score descending
    players.sort((a, b) => b.riskScore - a.riskScore);

    res.json(players);
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:playerId - Player details with behavior analysis
playersRouter.get('/:playerId', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const suspiciousCol = db.collection(config.collections.suspicious);

    const [totalEvents, suspiciousEvents, recentSuspicious] = await Promise.all([
      eventsCol.countDocuments({ playerId }),
      suspiciousCol.countDocuments({ playerId }),
      suspiciousCol.find({ playerId }).sort({ timestamp: -1 }).limit(20).toArray()
    ]);

    // Calculate behavior metrics from recent suspicious events
    const cheatTypeCounts: Record<string, number> = {};
    let totalSpeed = 0;
    let flickCount = 0;

    recentSuspicious.forEach(event => {
      if (event.cheatType) {
        cheatTypeCounts[event.cheatType] = (cheatTypeCounts[event.cheatType] || 0) + 1;
      }
      totalSpeed += event.speed || 0;
      if (event.isFlick) flickCount++;
    });

    // Behavior labels and values for radar chart
    const behaviorLabels = ['Aim', 'Recoil', 'Movement', 'Prediction'];
    const behaviorValues = [
      Math.min(100, (cheatTypeCounts['Aimbot-Speed'] || 0) * 20 + (cheatTypeCounts['Aimbot-Flick'] || 0) * 15),
      Math.min(100, (cheatTypeCounts['No-Recoil'] || 0) * 25),
      Math.min(100, (cheatTypeCounts['Robotic-Aim'] || 0) * 30),
      Math.min(100, flickCount * 10 + Math.round(totalSpeed / 10))
    ];

    const riskScore = totalEvents > 0
      ? Math.min(100, Math.round((suspiciousEvents / totalEvents) * 100 * 2))
      : 0;

    res.json({
      playerId,
      riskScore,
      totalEvents,
      suspiciousEvents,
      behaviorLabels,
      behaviorValues,
      recentDetections: recentSuspicious.map(item => ({
        eventId: item._id?.toString(),
        cheatType: item.cheatType,
        speed: item.speed,
        timestamp: item.timestamp
      }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/players/:playerId/summary - Simple summary (legacy)
playersRouter.get('/:playerId/summary', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const db = await getDb();
    const suspiciousCol = db.collection(config.collections.suspicious);

    const [detections, lastDetection] = await Promise.all([
      suspiciousCol.countDocuments({ playerId }),
      suspiciousCol.find({ playerId }).sort({ timestamp: -1 }).limit(1).toArray()
    ]);

    res.json({
      playerId,
      detections,
      lastDetection: lastDetection[0] || null
    });
  } catch (err) {
    next(err);
  }
});
