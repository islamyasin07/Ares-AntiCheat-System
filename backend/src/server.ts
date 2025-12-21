import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { apiRouter } from './routes/index';
import { errorHandler } from './middleware/error';
// Load Bloom filter loader (loads items produced by data-generator)
const { loadBloomFromFile, getBloom } = require('./utils/bloomLoader');

const app = express();
app.use(cors({ origin: config.allowOrigin === '*' ? true : config.allowOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);
app.use(errorHandler);

// Load Bloom data before starting server
loadBloomFromFile();
app.locals.bloom = getBloom();

app.listen(config.port, () => {
  console.log(`Ares backend listening on http://localhost:${config.port}`);
});
