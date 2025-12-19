import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/error';
import analyticsRouter from './routes/analytics';
import { getPersistenceManager } from './services/bloomFilterPersistence';
import { getDeduplicationService } from './services/deduplicationService';
import { getSuspiciousPlayerService } from './services/suspiciousPlayerService';

declare const require: any;

const app = express();

/* =========================================================
   🔥 KILL ALL HTTP CACHING – GLOBAL
========================================================= */
app.disable('etag');

/* =========================================================
   🔥 Force no-cache on detections (LIVE DATA)
========================================================= */
app.use('/api/detections', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

/* =========================================================
   Middleware
========================================================= */
app.use(cors({ origin: config.allowOrigin === '*' ? true : config.allowOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

/* =========================================================
   Routes
========================================================= */
app.get('/health', (_req, res) => res.json({ ok: true }));

// === Realtime API: Disable caching so clients always receive freshest data ===
app.use('/api', (req, res, next) => {
  try {
    // Strip conditional request headers to prevent 304 Not Modified responses
    delete (req.headers as any)['if-none-match'];
    delete (req.headers as any)['if-modified-since'];

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  } catch (e) {
    // ignore header errors
  }
  next();
});

app.use('/api', apiRouter);
app.use('/api/v1/analytics', analyticsRouter);

/* =========================================================
   Error Handler
========================================================= */
app.use(errorHandler);

export default app;

/* =========================================================
   Bloom Filters Initialization
========================================================= */
async function initializeBloomFilters() {
  try {
    const persistenceManager = getPersistenceManager();
    await persistenceManager.initialize();

    const deduplicationService = getDeduplicationService();
    const suspiciousPlayerService = getSuspiciousPlayerService();

    await persistenceManager.loadAll(deduplicationService, suspiciousPlayerService);
    console.log('✓ Bloom Filters initialized and state loaded');
  } catch (error) {
    console.error('Failed to initialize Bloom Filters:', error);
  }
}

/* =========================================================
   Periodic Persistence
========================================================= */
function setupPeriodicPersistence() {
  const persistenceManager = getPersistenceManager();
  const deduplicationService = getDeduplicationService();
  const suspiciousPlayerService = getSuspiciousPlayerService();

  setInterval(async () => {
    try {
      await persistenceManager.saveAll(deduplicationService, suspiciousPlayerService);
      console.log('✓ Bloom Filters persisted to disk');
    } catch (error) {
      console.error('Failed to persist Bloom Filters:', error);
    }
  }, 600000);
}

/* =========================================================
   Start Server
========================================================= */
if (require.main === module) {
  app.listen(config.port, async () => {
    console.log(`Ares backend listening on http://localhost:${config.port}`);
    await initializeBloomFilters();
    setupPeriodicPersistence();
  });
}
