import { Router } from 'express';
import { getDb } from '../db/mongo';
import { config } from '../config';

export const statsRouter = Router();

// GET /api/stats/overview - Dashboard overview stats
statsRouter.get('/overview', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);
    const suspiciousCol = db.collection(config.collections.suspicious);

    // Get counts
    const [totalEvents, totalSuspicious] = await Promise.all([
      eventsCol.estimatedDocumentCount(),
      suspiciousCol.estimatedDocumentCount()
    ]);

    // Cheaters today (unique playerIds in suspicious in last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const cheatersToday = await suspiciousCol.distinct('playerId', {
      timestamp: { $gte: oneDayAgo }
    });

    // Live players (unique playerIds in events in last 5 min)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const livePlayers = await eventsCol.distinct('playerId', {
      timestamp: { $gte: fiveMinAgo }
    });

    // Per-minute suspicious (last 15 minutes)
    const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
    const perMinuteAgg = await suspiciousCol.aggregate([
      { $match: { timestamp: { $gte: fifteenMinAgo } } },
      {
        $group: {
          _id: {
            $subtract: [
              { $toLong: '$timestamp' },
              { $mod: [{ $toLong: '$timestamp' }, 60000] }
            ]
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 15 }
    ]).toArray();

    const perMinuteSuspicious = perMinuteAgg.map((item, idx) => ({
      minute: `${idx}`,
      count: item.count
    }));

    // Cheat distribution
    const cheatDistAgg = await suspiciousCol.aggregate([
      { $group: { _id: '$cheatType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    const cheatDistribution = cheatDistAgg.map(item => ({
      cheatType: item._id || 'Unknown',
      count: item.count
    }));

    // Hourly heatmap (last 24 hours, count per hour)
    const hourlyAgg = await suspiciousCol.aggregate([
      { $match: { timestamp: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: { $hour: { $toDate: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    // Fill 24 hours
    const hourlyHeatmap = Array.from({ length: 24 }, (_, h) => {
      const found = hourlyAgg.find(x => x._id === h);
      return found ? found.count : 0;
    });

    res.json({
      totalEvents,
      totalSuspicious,
      cheatersToday: cheatersToday.length,
      livePlayers: livePlayers.length,
      perMinuteSuspicious,
      cheatDistribution,
      hourlyHeatmap
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/analytics - System analytics (ingestion, latency, load)
statsRouter.get('/analytics', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsCol = db.collection(config.collections.events);

    // Calculate ingestion rate (events in last minute)
    const oneMinAgo = Date.now() - 60 * 1000;
    const recentEvents = await eventsCol.countDocuments({
      timestamp: { $gte: oneMinAgo }
    });

    // Simulated metrics (in production, pull from Kafka/Spark metrics)
    res.json({
      ingestion: recentEvents,                           // events per minute
      latency: Math.random() * 50 + 10,                  // simulated latency ms
      sparkLoad: Math.min(100, recentEvents / 10 + 20)   // simulated spark load %
    });
  } catch (err) {
    next(err);
  }
});
