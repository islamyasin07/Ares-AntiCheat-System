import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27018',
  dbName: process.env.DB_NAME || 'ares_anticheat',
  allowOrigin: process.env.ALLOW_ORIGIN || '*',
};
