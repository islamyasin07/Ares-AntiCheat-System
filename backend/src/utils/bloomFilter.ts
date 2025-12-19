import * as crypto from 'crypto';

/**
 * Bloom Filter implementation for efficient duplicate detection
 * and probabilistic data structure lookups
 */
export class BloomFilter {
    private bitset: Uint8Array;
    private size: number;
    private hashCount: number;
    private elementCount: number = 0;

    /**
     * Initialize a Bloom Filter
     * @param size - Size of the bit array (in bytes)
     * @param hashCount - Number of hash functions to use
     */
    constructor(size: number = 10000, hashCount: number = 3) {
        this.size = size * 8; // Convert bytes to bits
        this.bitset = new Uint8Array(size);
        this.hashCount = Math.max(1, Math.min(hashCount, 10)); // Limit hash functions
    }

    /**
     * Generate multiple hash values for an element
     */
    private getHashes(element: string): number[] {
        const hashes: number[] = [];

        for (let i = 0; i < this.hashCount; i++) {
            const hash = crypto
                .createHash('sha256')
                .update(element + i.toString())
                .digest();

            // Convert first 4 bytes to unsigned integer and mod by size
            const value = hash.readUInt32BE(0) % this.size;
            hashes.push(Math.abs(value));
        }

        return hashes;
    }

    /**
     * Add an element to the Bloom Filter
     */
    add(element: string): void {
        const hashes = this.getHashes(element);

        for (const hash of hashes) {
            const byteIndex = Math.floor(hash / 8);
            const bitIndex = hash % 8;
            this.bitset[byteIndex] |= 1 << bitIndex;
        }

        this.elementCount++;
    }

    /**
     * Check if an element might be in the set
     * Returns false if definitely not in the set
     * Returns true if might be in the set (could be false positive)
     */
    contains(element: string): boolean {
        const hashes = this.getHashes(element);

        for (const hash of hashes) {
            const byteIndex = Math.floor(hash / 8);
            const bitIndex = hash % 8;

            if ((this.bitset[byteIndex] & (1 << bitIndex)) === 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Batch add multiple elements
     */
    addBatch(elements: string[]): void {
        elements.forEach(element => this.add(element));
    }

    /**
     * Get current size stats
     */
    getStats() {
        const bitsSet = this.getBitsSet();
        const falsePositiveRate = this.calculateFalsePositiveRate();

        return {
            totalBits: this.size,
            bitsSet,
            percentFull: ((bitsSet / this.size) * 100).toFixed(2) + '%',
            elementCount: this.elementCount,
            hashCount: this.hashCount,
            estimatedFalsePositiveRate: (falsePositiveRate * 100).toFixed(4) + '%'
        };
    }

    /**
     * Count how many bits are set in the bitset
     */
    private getBitsSet(): number {
        let count = 0;
        for (let i = 0; i < this.bitset.length; i++) {
            let byte = this.bitset[i];
            while (byte) {
                count += byte & 1;
                byte >>= 1;
            }
        }
        return count;
    }

    /**
     * Calculate estimated false positive rate
     */
    private calculateFalsePositiveRate(): number {
        const bitsSet = this.getBitsSet();
        const bitsNotSet = this.size - bitsSet;

        // P(false positive) ≈ (1 - e^(-k*n/m))^k
        // Where k = number of hash functions, n = number of elements, m = number of bits
        const exponent = (-this.hashCount * this.elementCount) / this.size;
        const base = Math.pow(1 - Math.exp(exponent), this.hashCount);

        return Math.min(base, 1.0); // Cap at 1.0
    }

    /**
     * Clear the bloom filter
     */
    clear(): void {
        this.bitset.fill(0);
        this.elementCount = 0;
    }

    /**
     * Export the bloom filter state as base64
     */
    export(): string {
        return Buffer.from(this.bitset).toString('base64');
    }

    /**
     * Import a bloom filter state from base64
     */
    import(data: string): void {
        const buffer = Buffer.from(data, 'base64');
        if (buffer.length !== this.bitset.length) {
            throw new Error('Invalid bloom filter data size');
        }
        this.bitset = new Uint8Array(buffer);
    }
}

/**
 * Counting Bloom Filter - allows removing elements
 */
export class CountingBloomFilter extends BloomFilter {
    private counters: Map<number, number> = new Map();

    /**
     * Add an element with optional count increment
     */
    add(element: string): void {
        super.add(element);

        const hashes = this.getHashesPublic(element);
        for (const hash of hashes) {
            const current = this.counters.get(hash) || 0;
            this.counters.set(hash, current + 1);
        }
    }

    /**
     * Remove an element (decrease count)
     */
    remove(element: string): boolean {
        const hashes = this.getHashesPublic(element);
        let removed = false;

        for (const hash of hashes) {
            const count = this.counters.get(hash) || 0;
            if (count > 0) {
                this.counters.set(hash, count - 1);
                removed = true;
            }
        }

        return removed;
    }

    /**
     * Get public access to hashes (for internal use)
     */
    private getHashesPublic(element: string): number[] {
        const hashes: number[] = [];
        const size = 10000 * 8;

        for (let i = 0; i < 3; i++) {
            const hash = crypto
                .createHash('sha256')
                .update(element + i.toString())
                .digest();

            const value = hash.readUInt32BE(0) % size;
            hashes.push(Math.abs(value));
        }

        return hashes;
    }

    /**
     * Clear the counting bloom filter
     */
    clear(): void {
        super.clear();
        this.counters.clear();
    }
}

export default BloomFilter;
