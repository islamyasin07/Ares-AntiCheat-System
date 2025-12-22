import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {

  static async overview(req: Request, res: Response) {
    const data = await AnalyticsService.overview();
    res.json(data);
  }

  static async live(req: Request, res: Response) {
    const limit = Number(req.query.limit || 50);
    const data = await AnalyticsService.live(limit);
    res.json(data);
  }

  static async player(req: Request, res: Response) {
    const { playerId } = req.params;
    const data = await AnalyticsService.player(playerId);
    res.json(data);
  }

  static async topCheaters(req: Request, res: Response) {
    const limit = Number(req.query.limit || 10);
    const data = await AnalyticsService.topCheaters(limit);
    res.json(data);
  }

  static async cheatDistribution(_req: Request, res: Response) {
    const data = await AnalyticsService.cheatDistribution();
    res.json(data);
  }

  static async hourlyEvents(req: Request, res: Response) {
    const hours = Number(req.query.hours || 24);
    const data = await AnalyticsService.hourlyEvents(hours);
    res.json(data);
  }

  static async avgSpeed(req: Request, res: Response) {
    const hours = Number(req.query.hours || 24);
    const data = await AnalyticsService.avgSpeed(hours);
    res.json(data);
  }
}

