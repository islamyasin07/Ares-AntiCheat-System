import { Router } from 'express';
import { getDb } from '../db/mongo';
import { z } from 'zod';

export const playersRouter = Router();

playersRouter.get('/:playerId/summary', async (req, res, next) => {
  try {
    const params = z.object({ playerId: z.string().min(1) }).parse(req.params);
    const db = await getDb();
    const [detections, lastDetection] = await Promise.all([
      db.collection('detections').countDocuments({ playerId: params.playerId }),
      db.collection('detections').find({ playerId: params.playerId }).sort({ timestamp: -1 }).limit(1).toArray(),
    ]);
    res.json({
      playerId: params.playerId,
      detections,
      lastDetection: lastDetection[0] || null,
    });
  } catch (err) {
    next(err);
  }
});
