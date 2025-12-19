import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';
import { z } from 'zod';
import { getDeduplicationService } from '../services/deduplicationService';
import { getSuspiciousPlayerService } from '../services/suspiciousPlayerService';
import { getPersistenceManager } from '../services/bloomFilterPersistence';

export const adminRouter = Router();
const deduplicationService = getDeduplicationService();
const suspiciousPlayerService = getSuspiciousPlayerService();
const persistenceManager = getPersistenceManager();

// Collection for admin action history
const HISTORY_COLLECTION = 'admin_actions';
const FLAGGED_COLLECTION = 'flagged_players';

// ========================================
// DATA MANAGEMENT
// ========================================

// POST /api/admin/clear-detections - Clear all detection data
adminRouter.post('/clear-detections', async (_req, res, next) => {
  try {
    const db = await getDb();
    const suspiciousCol = db.collection(config.collections.suspicious);
    const historyCol = db.collection(HISTORY_COLLECTION);

    const countBefore = await suspiciousCol.estimatedDocumentCount();
    await suspiciousCol.deleteMany({});

    // Log action
    await historyCol.insertOne({
      action: 'CLEAR_DETECTIONS',
      timestamp: Date.now(),
      details: { deletedCount: countBefore },
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: `Cleared ${countBefore} detection records`,
      deletedCount: countBefore
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/clear-events - Clear all raw events
adminRouter.post('/clear-events', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const historyCol = db.collection(HISTORY_COLLECTION);

    const countBefore = await eventsCol.estimatedDocumentCount();
    await eventsCol.deleteMany({});

    // Log action
    await historyCol.insertOne({
      action: 'CLEAR_EVENTS',
      timestamp: Date.now(),
      details: { deletedCount: countBefore },
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: `Cleared ${countBefore} event records`,
      deletedCount: countBefore
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/clear-all - Clear ALL data (nuclear option)
adminRouter.post('/clear-all', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const suspiciousCol = db.collection(config.collections.suspicious);
    const historyCol = db.collection(HISTORY_COLLECTION);

    const [eventsCount, detectionsCount] = await Promise.all([
      eventsCol.estimatedDocumentCount(),
      suspiciousCol.estimatedDocumentCount()
    ]);

    await Promise.all([
      eventsCol.deleteMany({}),
      suspiciousCol.deleteMany({})
    ]);

    // Log action
    await historyCol.insertOne({
      action: 'CLEAR_ALL_DATA',
      timestamp: Date.now(),
      details: { eventsDeleted: eventsCount, detectionsDeleted: detectionsCount },
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: `Cleared all data`,
      eventsDeleted: eventsCount,
      detectionsDeleted: detectionsCount
    });
  } catch (err) {
    next(err);
  }
});

// ========================================
// PLAYER MANAGEMENT
// ========================================

// POST /api/admin/players/:playerId/flag - Flag a player
adminRouter.post('/players/:playerId/flag', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const { reason } = req.body || {};

    const db = await getDb();
    const flaggedCol = db.collection(FLAGGED_COLLECTION);
    const historyCol = db.collection(HISTORY_COLLECTION);

    // Check if already flagged
    const existing = await flaggedCol.findOne({ playerId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Player already flagged' });
    }

    await flaggedCol.insertOne({
      playerId,
      reason: reason || 'Suspicious activity',
      status: 'FLAGGED',
      flaggedAt: Date.now(),
      flaggedBy: 'admin'
    });

    // Log action
    await historyCol.insertOne({
      action: 'FLAG_PLAYER',
      timestamp: Date.now(),
      details: { playerId, reason: reason || 'Suspicious activity' },
      performedBy: 'admin'
    });

    res.json({ success: true, message: `Player ${playerId} has been flagged` });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/players/:playerId/unflag - Remove flag from player
adminRouter.post('/players/:playerId/unflag', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);

    const db = await getDb();
    const flaggedCol = db.collection(FLAGGED_COLLECTION);
    const historyCol = db.collection(HISTORY_COLLECTION);

    const result = await flaggedCol.deleteOne({ playerId, status: 'FLAGGED' });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Player not flagged' });
    }

    // Log action
    await historyCol.insertOne({
      action: 'UNFLAG_PLAYER',
      timestamp: Date.now(),
      details: { playerId },
      performedBy: 'admin'
    });

    res.json({ success: true, message: `Player ${playerId} flag removed` });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/players/:playerId/ban - Ban a player
adminRouter.post('/players/:playerId/ban', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const { reason, duration } = req.body || {};

    const db = await getDb();
    const flaggedCol = db.collection(FLAGGED_COLLECTION);
    const historyCol = db.collection(HISTORY_COLLECTION);

    // Upsert ban status
    await flaggedCol.updateOne(
      { playerId },
      {
        $set: {
          playerId,
          reason: reason || 'Cheating detected',
          status: 'BANNED',
          bannedAt: Date.now(),
          banDuration: duration || 'permanent',
          bannedBy: 'admin'
        }
      },
      { upsert: true }
    );

    // Log action
    await historyCol.insertOne({
      action: 'BAN_PLAYER',
      timestamp: Date.now(),
      details: { playerId, reason: reason || 'Cheating detected', duration: duration || 'permanent' },
      performedBy: 'admin'
    });

    res.json({ success: true, message: `Player ${playerId} has been banned` });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/players/:playerId/unban - Unban a player
adminRouter.post('/players/:playerId/unban', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);

    const db = await getDb();
    const flaggedCol = db.collection(FLAGGED_COLLECTION);
    const historyCol = db.collection(HISTORY_COLLECTION);

    const result = await flaggedCol.deleteOne({ playerId, status: 'BANNED' });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Player not banned' });
    }

    // Log action
    await historyCol.insertOne({
      action: 'UNBAN_PLAYER',
      timestamp: Date.now(),
      details: { playerId },
      performedBy: 'admin'
    });

    res.json({ success: true, message: `Player ${playerId} has been unbanned` });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/players/flagged - Get all flagged/banned players
adminRouter.get('/players/flagged', async (_req, res, next) => {
  try {
    const db = await getDb();
    const flaggedCol = db.collection(FLAGGED_COLLECTION);

    const flaggedPlayers = await flaggedCol.find({}).sort({ flaggedAt: -1 }).toArray();

    res.json(flaggedPlayers.map(p => ({
      playerId: p.playerId,
      status: p.status,
      reason: p.reason,
      timestamp: p.flaggedAt || p.bannedAt,
      by: p.flaggedBy || p.bannedBy
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/players/:playerId/status - Get player status
adminRouter.get('/players/:playerId/status', async (req, res, next) => {
  try {
    const { playerId } = z.object({ playerId: z.string().min(1) }).parse(req.params);

    const db = await getDb();
    const flaggedCol = db.collection(FLAGGED_COLLECTION);

    const record = await flaggedCol.findOne({ playerId });

    if (!record) {
      return res.json({ playerId, status: 'CLEAN', flagged: false, banned: false });
    }

    res.json({
      playerId,
      status: record.status,
      flagged: record.status === 'FLAGGED',
      banned: record.status === 'BANNED',
      reason: record.reason,
      timestamp: record.flaggedAt || record.bannedAt
    });
  } catch (err) {
    next(err);
  }
});

// ========================================
// ACTION HISTORY
// ========================================

// GET /api/admin/history - Get admin action history
adminRouter.get('/history', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const db = await getDb();
    const historyCol = db.collection(HISTORY_COLLECTION);

    const history = await historyCol
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.json(history.map(h => ({
      id: h._id?.toString(),
      action: h.action,
      timestamp: h.timestamp,
      details: h.details,
      performedBy: h.performedBy
    })));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/history - Clear action history
adminRouter.delete('/history', async (_req, res, next) => {
  try {
    const db = await getDb();
    const historyCol = db.collection(HISTORY_COLLECTION);

    const countBefore = await historyCol.estimatedDocumentCount();
    await historyCol.deleteMany({});

    // Don't log this action (would be recursive)
    res.json({
      success: true,
      message: `Cleared ${countBefore} history records`,
      deletedCount: countBefore
    });
  } catch (err) {
    next(err);
  }
});

// ========================================
// SYSTEM INFO
// ========================================

// GET /api/admin/system - Get system status
adminRouter.get('/system', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const suspiciousCol = db.collection(config.collections.suspicious);
    const flaggedCol = db.collection(FLAGGED_COLLECTION);
    const historyCol = db.collection(HISTORY_COLLECTION);

    const [totalEvents, totalDetections, flaggedCount, bannedCount, historyCount] = await Promise.all([
      eventsCol.estimatedDocumentCount(),
      suspiciousCol.estimatedDocumentCount(),
      flaggedCol.countDocuments({ status: 'FLAGGED' }),
      flaggedCol.countDocuments({ status: 'BANNED' }),
      historyCol.estimatedDocumentCount()
    ]);

    // Get database stats
    const stats = await db.stats();

    res.json({
      database: {
        name: db.databaseName,
        sizeOnDisk: stats.dataSize,
        collections: stats.collections
      },
      counts: {
        totalEvents,
        totalDetections,
        flaggedPlayers: flaggedCount,
        bannedPlayers: bannedCount,
        actionHistory: historyCount
      },
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
  } catch (err) {
    next(err);
  }
});
// ========================================
// BLOOM FILTER MANAGEMENT
// ========================================

/**
 * GET /api/admin/bloom-filters/stats - Get comprehensive Bloom Filter statistics
 */
adminRouter.get('/bloom-filters/stats', async (_req, res) => {
  try {
    const deduplicatStats = deduplicationService.getStats();
    const suspiciousStats = suspiciousPlayerService.getStats();
    const storageSize = await persistenceManager.getStorageSize();

    res.json({
      deduplication: deduplicatStats,
      suspiciousPlayers: suspiciousStats,
      storage: storageSize,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bloom filter stats' });
  }
});

/**
 * POST /api/admin/bloom-filters/reset-all - Reset all Bloom Filters
 */
adminRouter.post('/bloom-filters/reset-all', async (_req, res, next) => {
  try {
    deduplicationService.reset();
    suspiciousPlayerService.reset();

    const historyCol = (await getDb()).collection(HISTORY_COLLECTION);
    await historyCol.insertOne({
      action: 'BLOOM_FILTER_RESET',
      timestamp: Date.now(),
      details: { resetAll: true },
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: 'All Bloom Filters reset successfully',
      timestamp: Date.now()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/bloom-filters/reset-deduplication - Reset deduplication filter
 */
adminRouter.post('/bloom-filters/reset-deduplication', async (_req, res, next) => {
  try {
    deduplicationService.reset();

    const historyCol = (await getDb()).collection(HISTORY_COLLECTION);
    await historyCol.insertOne({
      action: 'BLOOM_FILTER_RESET',
      timestamp: Date.now(),
      details: { resetDeduplication: true },
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: 'Deduplication Bloom Filter reset successfully',
      timestamp: Date.now()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/bloom-filters/reset-suspicious - Reset suspicious player filter
 */
adminRouter.post('/bloom-filters/reset-suspicious', async (_req, res, next) => {
  try {
    suspiciousPlayerService.reset();

    const historyCol = (await getDb()).collection(HISTORY_COLLECTION);
    await historyCol.insertOne({
      action: 'BLOOM_FILTER_RESET',
      timestamp: Date.now(),
      details: { resetSuspiciousPlayers: true },
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: 'Suspicious Player Bloom Filter reset successfully',
      timestamp: Date.now()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/bloom-filters/save - Save Bloom Filters to disk
 */
adminRouter.post('/bloom-filters/save', async (_req, res, next) => {
  try {
    await persistenceManager.saveAll(deduplicationService, suspiciousPlayerService);

    const historyCol = (await getDb()).collection(HISTORY_COLLECTION);
    await historyCol.insertOne({
      action: 'BLOOM_FILTER_SAVE',
      timestamp: Date.now(),
      performedBy: 'admin'
    });

    const storageSize = await persistenceManager.getStorageSize();
    res.json({
      success: true,
      message: 'Bloom Filters saved to disk',
      storage: storageSize,
      timestamp: Date.now()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/bloom-filters/load - Load Bloom Filters from disk
 */
adminRouter.post('/bloom-filters/load', async (_req, res, next) => {
  try {
    await persistenceManager.loadAll(deduplicationService, suspiciousPlayerService);

    const historyCol = (await getDb()).collection(HISTORY_COLLECTION);
    await historyCol.insertOne({
      action: 'BLOOM_FILTER_LOAD',
      timestamp: Date.now(),
      performedBy: 'admin'
    });

    const deduplicatStats = deduplicationService.getStats();
    const suspiciousStats = suspiciousPlayerService.getStats();

    res.json({
      success: true,
      message: 'Bloom Filters loaded from disk',
      deduplication: deduplicatStats,
      suspiciousPlayers: suspiciousStats,
      timestamp: Date.now()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/bloom-filters/clear-storage - Clear all persisted Bloom Filter data
 */
adminRouter.post('/bloom-filters/clear-storage', async (_req, res, next) => {
  try {
    await persistenceManager.clearStorage();

    const historyCol = (await getDb()).collection(HISTORY_COLLECTION);
    await historyCol.insertOne({
      action: 'BLOOM_FILTER_CLEAR_STORAGE',
      timestamp: Date.now(),
      performedBy: 'admin'
    });

    res.json({
      success: true,
      message: 'Bloom Filter storage cleared',
      timestamp: Date.now()
    });
  } catch (err) {
    next(err);
  }
});