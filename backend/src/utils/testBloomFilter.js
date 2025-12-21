const ProfessionalBloomFilter = require('../../../shared/bloomFilter');

// Initialize Professional Bloom filter with custom size and hash count
const bloom = new ProfessionalBloomFilter(20000, 10);

// Define consistent test data
const event1 = { type: 'event', id: 'event1', timestamp: 1234567890 };
const collection1 = { type: 'collection', name: 'players', count: 100 };

// Add generic data to the Bloom filter
bloom.add(event1);
bloom.add(collection1);

// Check generic data in the Bloom filter
console.log('Event1 in Bloom filter:', bloom.has(event1)); // Expected: true
console.log('Non-existent data in Bloom filter:', bloom.has({ type: 'event', id: 'event2' })); // Expected: false

// Get Bloom filter stats
console.log('Bloom filter stats:', bloom.getStats());

// Clear the Bloom filter
bloom.clear();
console.log('Bloom filter cleared. Stats:', bloom.getStats());