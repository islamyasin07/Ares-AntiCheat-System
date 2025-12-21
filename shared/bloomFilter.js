const { BloomFilter } = require('bloom-filters');

class ProfessionalBloomFilter {
    constructor(size = 10000, hashCount = 7) {
        this.bloomFilter = new BloomFilter(size, hashCount);
    }

    add(item) {
        const serializedItem = JSON.stringify(item);
        this.bloomFilter.add(serializedItem);
    }

    has(item) {
        const serializedItem = JSON.stringify(item);
        return this.bloomFilter.has(serializedItem);
    }

    // Add a simple key (string) to the bloom for lightweight membership checks
    addKey(key) {
        this.bloomFilter.add(String(key));
    }

    hasKey(key) {
        return this.bloomFilter.has(String(key));
    }

    clear() {
        this.bloomFilter = new BloomFilter(this.bloomFilter.size, this.bloomFilter.hashCount);
    }

    getStats() {
        return {
            size: this.bloomFilter.size,
            hashCount: this.bloomFilter.hashCount,
            estimatedErrorRate: this.bloomFilter.errorRate,
        };
    }
}

module.exports = ProfessionalBloomFilter;