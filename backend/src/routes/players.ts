import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';
import { z } from 'zod';
import { getSuspiciousPlayerService } from '../services/suspiciousPlayerService';

export const playersRouter = Router();
const suspiciousPlayerService = getSuspiciousPlayerService();

// GET /api/players - List all players with stats
playersRouter.get('/', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const suspiciousCol = db.collection(config.collections.suspicious);

    // Get unique players from events
    const playerIds = await eventsCol.distinct('playerId');

    // For each player, calculate stats (limit to 100 players for dashboard)
    const players = await Promise.all(
      playerIds.slice(0, 100).map(async (playerId) => {
        const [totalEvents, suspiciousEvents] = await Promise.all([
          eventsCol.countDocuments({ playerId }),
          suspiciousCol.countDocuments({ playerId })
        ]);

        // Check if player is flagged using Bloom Filter
        const isFlagged = suspiciousPlayerService.isPlayerFlagged(playerId);
        const threatProfile = suspiciousPlayerService.getThreatProfile(playerId);

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
          riskScore,
          isFlagged,
          threatCount: threatProfile.threatCount,
          threats: threatProfile.threats
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

    recentSuspicious.forEach((event: any) => {
      const cheatType = event.cheatType || event.ruleTriggered;
      if (cheatType) {
        cheatTypeCounts[cheatType] = (cheatTypeCounts[cheatType] || 0) + 1;
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

    // Get threat profile using Bloom Filter
    const threatProfile = suspiciousPlayerService.getThreatProfile(playerId);

    res.json({
      playerId,
      riskScore,
      totalEvents,
      suspiciousEvents,
      isFlagged: threatProfile.isFlagged,
      threatCount: threatProfile.threatCount,
      threats: threatProfile.threats,
      behaviorLabels,
      behaviorValues,
      recentDetections: recentSuspicious.map(item => ({
        eventId: item._id?.toString(),
        cheatType: item.cheatType || item.ruleTriggered || 'Unknown',
        cheatScore: item.cheatScore,
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

/**
 * GET /api/players/bloom/stats - Get Bloom Filter statistics for player tracking
 */
playersRouter.get('/bloom/stats', (_req, res) => {
  const stats = suspiciousPlayerService.getStats();
  res.json(stats);
});

/**
 * POST /api/players/bloom/reset - Reset Bloom Filters
 * Only use if needed for maintenance
 */
playersRouter.post('/bloom/reset', (req, res) => {
  try {
    suspiciousPlayerService.reset();
    res.json({
      message: 'Bloom filters reset successfully',
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset bloom filters' });
  }
});

/**
 * POST /api/players/:playerId/flag - Manually flag a player
 */
playersRouter.post('/:playerId/flag', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const { threatType } = z.object({ threatType: z.string().optional() }).parse(req.body);

    if (threatType) {
      if (threatType === 'aimbot') {
        suspiciousPlayerService.flagAimbotSuspect(playerId);
      } else if (threatType === 'noRecoil') {
        suspiciousPlayerService.flagNoRecoilSuspect(playerId);
      } else if (threatType === 'speedhack') {
        suspiciousPlayerService.flagSpeedhacker(playerId);
      } else if (threatType === 'wallhack') {
        suspiciousPlayerService.flagWallhacker(playerId);
      } else if (threatType === 'highRisk') {
        suspiciousPlayerService.markAsHighRisk(playerId);
      } else {
        suspiciousPlayerService.flagPlayer(playerId);
      }
    } else {
      suspiciousPlayerService.flagPlayer(playerId);
    }

    const threatProfile = suspiciousPlayerService.getThreatProfile(playerId);
    res.json(threatProfile);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/players/:playerId/threat-profile - Get detailed threat profile
 */
playersRouter.get('/:playerId/threat-profile', (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const threatProfile = suspiciousPlayerService.getThreatProfile(playerId);
    res.json(threatProfile);
  } catch (err) {
    next(err);
  }
});
