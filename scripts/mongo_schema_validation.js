// Apply JSON schema validation for collections
// Usage: docker exec ares-anticheat mongosh --quiet /scripts/mongo_schema_validation.js

const dbName = 'ares_anticheat';
const db = connect('mongodb://localhost:27017/' + dbName);

// Ensure collections exist
db.createCollection('events_features');
db.createCollection('detections');

// Validator for events_features
db.runCommand({
  collMod: 'events_features',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['playerId', 'timestamp', 'movement', 'eventType'],
      properties: {
        playerId: { bsonType: 'string' },
        timestamp: { bsonType: 'long' },
        eventType: { bsonType: 'string' },
        movement: {
          bsonType: 'object',
          required: ['deltaX', 'deltaY', 'speed', 'acceleration', 'jerk', 'smoothness'],
          properties: {
            deltaX: { bsonType: 'double' },
            deltaY: { bsonType: 'double' },
            speed: { bsonType: 'double' },
            acceleration: { bsonType: 'double' },
            jerk: { bsonType: 'double' },
            smoothness: { bsonType: 'double' }
          }
        }
      }
    }
  },
  validationLevel: 'moderate'
});

// Validator for detections
db.runCommand({
  collMod: 'detections',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['playerId', 'timestamp', 'eventType', 'ruleTriggered', 'cheatScore'],
      properties: {
        playerId: { bsonType: 'string' },
        timestamp: { bsonType: 'long' },
        eventType: { bsonType: 'string' },
        ruleTriggered: { bsonType: 'string' },
        cheatScore: { bsonType: 'double' }
      }
    }
  },
  validationLevel: 'moderate'
});

printjson({ validatorsApplied: true });
