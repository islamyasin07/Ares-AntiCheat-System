import { Router, Request, Response, NextFunction } from 'express';
import { listTopics, describeTopic } from '../services/kafkaService';

export const kafkaRouter = Router();

/**
 * GET /api/kafka/topics
 * List all available Kafka topics
 */
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

/**
 * GET /api/kafka/topics/:name
 * Describe a specific Kafka topic with partition details
 */
kafkaRouter.get('/topics/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    const result = await describeTopic(name);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
