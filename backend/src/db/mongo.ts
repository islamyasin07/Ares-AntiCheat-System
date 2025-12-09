import { MongoClient, Db } from 'mongodb';
import { config } from '../config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db && client) return db;
  client = new MongoClient(config.mongoUri, {
    // modern driver uses stable API by default
  });
  await client.connect();
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
