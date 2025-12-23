import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';

export const analyticsRouter = Router();

analyticsRouter.get('/overview', AnalyticsController.overview);
analyticsRouter.get('/live', AnalyticsController.live);
analyticsRouter.get('/player/:playerId', AnalyticsController.player);
analyticsRouter.get('/top-cheaters', AnalyticsController.topCheaters);
analyticsRouter.get('/cheat-distribution', AnalyticsController.cheatDistribution);
analyticsRouter.get('/hourly-events', AnalyticsController.hourlyEvents);
analyticsRouter.get('/avg-speed', AnalyticsController.avgSpeed);
