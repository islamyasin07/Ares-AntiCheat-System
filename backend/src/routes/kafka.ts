import { Router, Request, Response, NextFunction } from 'express';
import { listTopics, describeTopic } from '../services/kafkaService';

export const kafkaRouter = Router();


kafkaRouter.get('/topics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listTopics();
    console.log('[kafka] GET /api/kafka/topics ->', JSON.stringify(result));
    res.json(result);
  } catch (error) {
    console.error('[kafka] GET /api/kafka/topics error:', error);
    next(error);
  }
});


kafkaRouter.get('/topics/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const result = await describeTopic(name);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
