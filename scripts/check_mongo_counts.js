const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27018';
const DB_NAME = process.env.DB_NAME || 'ares_anticheat';

async function main() {
  const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
  try {
    await client.connect();
    console.log('Connected to', MONGO_URI, 'db:', DB_NAME);
    const db = client.db(DB_NAME);

    const cols = ['events_raw', 'events', 'detections', 'events_features'];
    for (const c of cols) {
      const col = db.collection(c);
      const count = await col.countDocuments();
      const last = await col.find().sort({ timestamp: -1 }).limit(1).toArray();
      const lastTs = last.length ? last[0].timestamp || last[0].detected_at || last[0].unix_timestamp : null;
      console.log(`- ${c}: count=${count} lastTimestamp=${lastTs}`);
    }

    // Show top 3 recent detections
    const dets = await db.collection('detections').find().sort({ timestamp: -1 }).limit(3).toArray();
    console.log('\nRecent detections (top 3):');
    dets.forEach(d => console.log(JSON.stringify(d)));

  } catch (err) {
    console.error('Error connecting to Mongo:', err.message);
    process.exitCode = 2;
  } finally {
    await client.close();
  }
}

main();
