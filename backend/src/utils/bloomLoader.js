const fs = require('fs');
const path = require('path');
const ProfessionalBloomFilter = require('../../../shared/bloomFilter');

const BLOOM_INPUT_PATH = path.join(__dirname, '..', '..', '..', 'shared', 'bloom_input.jsonl');

// Create a single, shared Bloom instance for the backend
const bloom = new ProfessionalBloomFilter();

function loadBloomFromFile() {
  if (!fs.existsSync(BLOOM_INPUT_PATH)) return;

  const stream = fs.createReadStream(BLOOM_INPUT_PATH, { encoding: 'utf8' });
  let leftover = '';
  stream.on('data', chunk => {
    const data = leftover + chunk;
    const lines = data.split('\n');
    leftover = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        // normalize items: if wrapped as {type, event} or {type, player...}
        if (obj.type === 'event' && obj.event) {
          bloom.add(obj.event);
          // also add lightweight key for player membership checks
          if (obj.event.playerId) bloom.addKey(`player:${obj.event.playerId}`);
          if (obj.event.id) bloom.addKey(`event:${obj.event.id}`);
        } else if (obj.type === 'player') {
          bloom.add(obj);
          if (obj.playerId) bloom.addKey(`player:${obj.playerId}`);
        } else {
          bloom.add(obj);
        }
      } catch (e) {
        // ignore malformed lines
      }
    }
  });

  stream.on('end', () => {
    if (leftover) {
      try {
        const obj = JSON.parse(leftover);
        if (obj) {
          if (obj.type === 'event' && obj.event) {
            bloom.add(obj.event);
            if (obj.event.playerId) bloom.addKey(`player:${obj.event.playerId}`);
            if (obj.event.id) bloom.addKey(`event:${obj.event.id}`);
          } else if (obj.type === 'player') {
            bloom.add(obj);
            if (obj.playerId) bloom.addKey(`player:${obj.playerId}`);
          } else {
            bloom.add(obj);
          }
        }
      } catch (e) {}
    }
  });
}

function getBloom() {
  return bloom;
}

module.exports = { loadBloomFromFile, getBloom };
