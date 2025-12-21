import { Router, Request, Response } from 'express';

export const bloomRouter = Router();

bloomRouter.get('/stats', (req: Request, res: Response) => {
  const bloom: any = req.app && req.app.locals && req.app.locals.bloom;
  if (!bloom) return res.status(500).json({ error: 'Bloom filter not loaded' });
  try {
    return res.json(bloom.getStats());
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read bloom stats' });
  }
});
