// Dev script: create indexes and TTL for Mongo collections
// Usage: docker exec ares-anticheat mongosh --quiet /scripts/mongo_setup_indexes.js

const dbName = 'ares_anticheat';
const db = connect('mongodb://localhost:27017/' + dbName);

// Indexes
db.events_raw.createIndex({ playerId: 1, timestamp: 1 });
db.events_features.createIndex({ playerId: 1, timestamp: 1 });
db.detections.createIndex({ playerId: 1, timestamp: 1, ruleTriggered: 1 });

// TTL for dev: expire raw events after 24h
db.events_raw.createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 });

printjson({
  rawIdx: db.events_raw.getIndexes(),
  featIdx: db.events_features.getIndexes(),
  detIdx: db.detections.getIndexes(),
});
