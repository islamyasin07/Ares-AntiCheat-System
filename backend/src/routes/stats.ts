import { Router } from 'express';
import { getDb } from '../db/mongo';

export const statsRouter = Router();

statsRouter.get('/overview', async (_req, res, next) => {
  try {
    const db = await getDb();
    const eventsRaw = await db.collection('events_raw').estimatedDocumentCount();
    const features = await db.collection('events_features').estimatedDocumentCount();
    const detections = await db.collection('detections').estimatedDocumentCount();
    res.json({ eventsRaw, features, detections });
  } catch (err) {
    next(err);
  }
});
