import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'ares_anticheat',
  allowOrigin: process.env.ALLOW_ORIGIN || '*',
  // Collections written by Spark
  collections: {
    events: 'events_raw',       // All raw events from Spark
    suspicious: 'detections',   // Suspicious/detection events from Spark
  }
};
