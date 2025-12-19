import { BloomFilter, CountingBloomFilter } from '../utils/bloomFilter';

/**
 * Event Deduplication Service
 * Uses Bloom Filters to detect and prevent duplicate event processing
 */
export class EventDeduplicationService {
    private eventBloomFilter: BloomFilter;
    private suspiciousEventBloomFilter: BloomFilter;
    private playerAnomalyFilter: CountingBloomFilter;
    private lastResetTime: number = Date.now();
    private resetIntervalMs: number = 3600000; // 1 hour

    constructor() {
        // 10KB bloom filter (80,000 bits) for regular events
        this.eventBloomFilter = new BloomFilter(10000, 3);

        // 5KB bloom filter for suspicious/detection events
        this.suspiciousEventBloomFilter = new BloomFilter(5000, 3);

        // Counting bloom filter for tracking anomalies per player
        this.playerAnomalyFilter = new CountingBloomFilter(10000, 3);
    }

    /**
     * Generate unique identifier for an event
     */
    private generateEventId(
        playerId: string,
        eventType: string,
        timestamp: number,
        deltaX?: number,
        deltaY?: number
    ): string {
        // Create a composite key to uniquely identify the event
        const key = `${playerId}:${eventType}:${timestamp}:${deltaX || 0}:${deltaY || 0}`;
        return key;
    }

    /**
     * Check if an event is a duplicate and add it to the filter
     * Returns true if event is NEW (not a duplicate)
     * Returns false if event is LIKELY a duplicate
     */
    isDuplicate(
        playerId: string,
        eventType: string,
        timestamp: number,
        deltaX?: number,
        deltaY?: number
    ): boolean {
        const eventId = this.generateEventId(playerId, eventType, timestamp, deltaX, deltaY);

        // Check if event already exists in bloom filter
        if (this.eventBloomFilter.contains(eventId)) {
            return true; // Likely a duplicate
        }

        // Add to bloom filter for future checks
        this.eventBloomFilter.add(eventId);
        return false; // New event
    }

    /**
     * Check if a detection/suspicious event is duplicate
     */
    isSuspiciousDuplicate(
        playerId: string,
        cheatType: string,
        timestamp: number
    ): boolean {
        const detectionId = `${playerId}:${cheatType}:${timestamp}`;

        if (this.suspiciousEventBloomFilter.contains(detectionId)) {
            return true;
        }

        this.suspiciousEventBloomFilter.add(detectionId);
        return false;
    }

    /**
     * Track player anomaly occurrence (with counting)
     */
    recordPlayerAnomaly(playerId: string, anomalyType: string): void {
        const anomalyKey = `${playerId}:${anomalyType}`;
        this.playerAnomalyFilter.add(anomalyKey);
    }

    /**
     * Check if a player has been flagged for an anomaly
     */
    hasPlayerAnomaly(playerId: string, anomalyType: string): boolean {
        const anomalyKey = `${playerId}:${anomalyType}`;
        return this.playerAnomalyFilter.contains(anomalyKey);
    }

    /**
     * Remove a player anomaly flag (useful for counting filter)
     */
    removePlayerAnomaly(playerId: string, anomalyType: string): boolean {
        const anomalyKey = `${playerId}:${anomalyType}`;
        return this.playerAnomalyFilter.remove(anomalyKey);
    }

    /**
     * Get statistics about the bloom filters
     */
    getStats() {
        return {
            eventFilter: this.eventBloomFilter.getStats(),
            suspiciousFilter: this.suspiciousEventBloomFilter.getStats(),
            uptime: Date.now() - this.lastResetTime,
            willResetIn: this.resetIntervalMs - (Date.now() - this.lastResetTime)
        };
    }

    /**
     * Reset filters if interval has passed
     * Prevents bloom filters from becoming completely full
     */
    checkAndReset(): void {
        const now = Date.now();
        if (now - this.lastResetTime > this.resetIntervalMs) {
            console.log('Resetting bloom filters due to interval expiration');
            this.reset();
        }
    }

    /**
     * Manually reset all filters
     */
    reset(): void {
        this.eventBloomFilter.clear();
        this.suspiciousEventBloomFilter.clear();
        this.playerAnomalyFilter.clear();
        this.lastResetTime = Date.now();
    }

    /**
     * Export current bloom filter state
     */
    export() {
        return {
            eventFilter: this.eventBloomFilter.export(),
            suspiciousFilter: this.suspiciousEventBloomFilter.export(),
            timestamp: Date.now()
        };
    }

    /**
     * Import bloom filter state
     */
    import(data: { eventFilter: string; suspiciousFilter: string; timestamp: number }): void {
        try {
            this.eventBloomFilter.import(data.eventFilter);
            this.suspiciousEventBloomFilter.import(data.suspiciousFilter);
            this.lastResetTime = data.timestamp;
        } catch (error) {
            console.error('Failed to import bloom filter state:', error);
        }
    }
}

// Singleton instance
let instance: EventDeduplicationService | null = null;

/**
 * Get or create singleton instance of Event Deduplication Service
 */
export function getDeduplicationService(): EventDeduplicationService {
    if (!instance) {
        instance = new EventDeduplicationService();
    }

    // Check and reset periodically
    instance.checkAndReset();

    return instance;
}

export default EventDeduplicationService;
