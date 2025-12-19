import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { apiRouter } from './routes/index';
import { errorHandler } from './middleware/error';
import analyticsRouter from './routes/analytics';
import { getPersistenceManager } from './services/bloomFilterPersistence';
import { getDeduplicationService } from './services/deduplicationService';
import { getSuspiciousPlayerService } from './services/suspiciousPlayerService';

declare const require: any;

const app = express();
app.use(cors({ origin: config.allowOrigin === '*' ? true : config.allowOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use(errorHandler);

export default app;

// Initialize Bloom Filters and load persisted state on startup
async function initializeBloomFilters() {
  try {
    const persistenceManager = getPersistenceManager();
    await persistenceManager.initialize();

    const deduplicationService = getDeduplicationService();
    const suspiciousPlayerService = getSuspiciousPlayerService();

    // Load persisted bloom filter data
    await persistenceManager.loadAll(deduplicationService, suspiciousPlayerService);
    console.log('✓ Bloom Filters initialized and state loaded');
  } catch (error) {
    console.error('Failed to initialize Bloom Filters:', error);
  }
}

// Setup periodic persistence (every 10 minutes)
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
  }, 600000); // 10 minutes
}

// Start server only when module executed directly and run initialization
if (require.main === module) {
  app.listen(config.port, async () => {
    console.log(`Ares backend listening on http://localhost:${config.port}`);

    // Initialize bloom filters
    await initializeBloomFilters();

    // Setup periodic persistence
    setupPeriodicPersistence();
  });
}
