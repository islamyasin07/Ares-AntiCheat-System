import { getDb } from '../db/mongo';

export class AnalyticsService {

  static async overview() {
    const db = await getDb();

    const totalDetections = await db.collection('detections').countDocuments();
    const mlTotal = await db.collection('ml_detections').countDocuments();

    const highRisk = await db.collection('ml_detections')
      .countDocuments({ risk_level: { $in: ['high', 'critical'] } });

    const last5Min = Date.now() - 5 * 60 * 1000;
    const recent = await db.collection('ml_detections')
      .countDocuments({ detected_at: { $gte: last5Min } });

    return {
      detections_total: totalDetections,
      ml_detections_total: mlTotal,
      recent_5min: recent,
      high_risk_players: highRisk
    };
  }

  static async live(limit = 50) {
    const db = await getDb();

    const spark = await db.collection('detections')
      .find({})
      .sort({ detected_at: -1 })
      .limit(limit)
      .toArray();

    const ml = await db.collection('ml_detections')
      .find({})
      .sort({ detected_at: -1 })
      .limit(limit)
      .toArray();

    return { spark, ml };
  }

  static async player(playerId: string) {
    const db = await getDb();

    const spark = await db.collection('detections')
      .find({ player_id: playerId })
      .sort({ detected_at: -1 })
      .toArray();

    const ml = await db.collection('ml_detections')
      .find({ player_id: playerId })
      .sort({ detected_at: -1 })
      .toArray();

    return { player_id: playerId, spark, ml };
  }

  // Top cheaters by ML detections (player_id, count, avg_prob, high_risk_count)
  static async topCheaters(limit = 10) {
    const db = await getDb();
    const pipeline = [
      { $group: { _id: '$player_id', count: { $sum: 1 }, avg_prob: { $avg: '$cheat_probability' }, high_risk: { $sum: { $cond: [{ $in: ['$risk_level', ['high', 'critical']] }, 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ];
    const rows = await db.collection('ml_detections').aggregate(pipeline).toArray();
    return rows.map(r => ({ player_id: r._id, count: r.count, avg_prob: r.avg_prob || 0, high_risk: r.high_risk || 0 }));
  }

  // Distribution of risk levels
  static async cheatDistribution() {
    const db = await getDb();
    const pipeline = [
      { $group: { _id: { $ifNull: ['$risk_level', 'unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const rows = await db.collection('ml_detections').aggregate(pipeline).toArray();
    return rows.map(r => ({ risk_level: r._id, count: r.count }));
  }

  // Hourly event counts for the last N hours (default 24)
  static async hourlyEvents(hours = 24) {
    const db = await getDb();
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;

    const pipeline = [
      { $match: { detected_at: { $gte: start } } },
      { $addFields: { dt: { $toDate: '$detected_at' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$dt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ];

    const rows = await db.collection('ml_detections').aggregate(pipeline).toArray();

    // Fill any missing hours with zero counts
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r._id] = r.count; });

    const result: Array<{ hour: string, count: number }> = [];
    for (let i = hours - 1; i >= 0; i--) {
      const t = new Date(now - i * 60 * 60 * 1000);
      const key = t.toISOString().substring(0, 13) + ':00:00Z';
      result.push({ hour: key, count: map[key] || 0 });
    }

    return result;
  }

  // Average movement speed per hour over last N hours (default 24)
  static async avgSpeed(hours = 24) {
    const db = await getDb();
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;

    const pipeline = [
      { $match: { detected_at: { $gte: start }, movement_speed: { $exists: true } } },
      { $addFields: { dt: { $toDate: '$detected_at' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$dt' } }, avg_speed: { $avg: '$movement_speed' } } },
      { $sort: { _id: 1 } }
    ];

    const rows = await db.collection('detections').aggregate(pipeline).toArray();
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r._id] = Math.round((r.avg_speed || 0) * 100) / 100; });

    const result: Array<{ hour: string, avg_speed: number }> = [];
    for (let i = hours - 1; i >= 0; i--) {
      const t = new Date(now - i * 60 * 60 * 1000);
      const key = t.toISOString().substring(0, 13) + ':00:00Z';
      result.push({ hour: key, avg_speed: map[key] || 0 });
    }

    return result;
  }
}

