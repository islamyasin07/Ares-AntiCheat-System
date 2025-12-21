import { Router } from 'express';
import { statsRouter } from './stats';
import { detectionsRouter } from './detections';
import { eventsRouter } from './events';
import { playersRouter } from './players';
import { adminRouter } from './admin';
import { bloomRouter } from './bloom';

export const apiRouter = Router();

apiRouter.use('/stats', statsRouter);
apiRouter.use('/detections', detectionsRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/players', playersRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/bloom', bloomRouter);
