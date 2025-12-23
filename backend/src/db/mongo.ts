import { MongoClient, Db } from 'mongodb';
import { config } from '../config';
import { retryWithBackoff, RetryConfig } from '../utils/retryUtils';

let client: MongoClient | null = null;
let db: Db | null = null;

const MONGO_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};


export async function getDb(): Promise<Db> {
  if (db && client) return db;

  client = new MongoClient(config.mongoUri, {
  });

  await retryWithBackoff(
    () => client!.connect(),
    MONGO_RETRY_CONFIG,
    'MongoDB Connection'
  );

  db = client.db(config.dbName);
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
