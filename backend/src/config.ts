import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27018',
  dbName: process.env.DB_NAME || 'ares_anticheat',
  allowOrigin: process.env.ALLOW_ORIGIN || '*',
  // Collections written by Spark
  collections: {
    // Spark currently writes raw parsed events to `events_raw` and detections to `detections`.
    // Map backend collections to those so live endpoints show current data.
    events: 'events_raw',
    // Spark/Scripts write detections into the `detections` collection.
    // Older code referenced `suspicious`; default to `detections` so the
    // backend reads the same collection Spark writes to.
    suspicious: process.env.SUSPICIOUS_COLLECTION || 'detections',
  }
};
