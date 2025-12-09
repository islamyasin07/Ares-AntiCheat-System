import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { apiRouter } from './routes/index';
import { errorHandler } from './middleware/error';

const app = express();
app.use(cors({ origin: config.allowOrigin === '*' ? true : config.allowOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Ares backend listening on http://localhost:${config.port}`);
});
