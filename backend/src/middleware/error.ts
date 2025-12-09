import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = 500;
  const message = err?.message || 'Internal Server Error';
  res.status(status).json({ error: message });
}
