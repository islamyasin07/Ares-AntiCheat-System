import { BloomFilter } from '../utils/bloomFilter';

/**
 * Suspicious Player Tracking Service
 * Uses Bloom Filters for fast lookups of flagged players
 * and tracking various threat levels
 */
export class SuspiciousPlayerService {
    private flaggedPlayersBloomFilter: BloomFilter;
    private aimabotsBloomFilter: BloomFilter;
    private noRecoilPlayersBloomFilter: BloomFilter;
    private speedhackersBloomFilter: BloomFilter;
    private wallhackersBloomFilter: BloomFilter;
    private highRiskPlayersBloomFilter: BloomFilter;

    private lastResetTime: number = Date.now();
    private resetIntervalMs: number = 7200000; // 2 hours

    constructor() {
        // 20KB bloom filter for general flagged players
        this.flaggedPlayersBloomFilter = new BloomFilter(20000, 4);

        // 5KB filters for specific cheat types
        this.aimabotsBloomFilter = new BloomFilter(5000, 3);
        this.noRecoilPlayersBloomFilter = new BloomFilter(5000, 3);
        this.speedhackersBloomFilter = new BloomFilter(5000, 3);
        this.wallhackersBloomFilter = new BloomFilter(5000, 3);

        // High risk players requiring immediate attention
        this.highRiskPlayersBloomFilter = new BloomFilter(10000, 3);
    }

    /**
     * Flag a player as suspicious
     */
    flagPlayer(playerId: string): void {
        this.flaggedPlayersBloomFilter.add(playerId);
    }

    /**
     * Check if a player is flagged as suspicious
     * Returns true if player is likely flagged, false if definitely not
     */
    isPlayerFlagged(playerId: string): boolean {
        return this.flaggedPlayersBloomFilter.contains(playerId);
    }

    /**
     * Flag a player for aimbot detection
     */
    flagAimbotSuspect(playerId: string): void {
        this.aimabotsBloomFilter.add(playerId);
        this.flagPlayer(playerId);
    }

    /**
     * Check if player is suspected of aimbotting
     */
    isAimbotSuspect(playerId: string): boolean {
        return this.aimabotsBloomFilter.contains(playerId);
    }

    /**
     * Flag a player for no-recoil cheating
     */
    flagNoRecoilSuspect(playerId: string): void {
        this.noRecoilPlayersBloomFilter.add(playerId);
        this.flagPlayer(playerId);
    }

    /**
     * Check if player is suspected of no-recoil cheating
     */
    isNoRecoilSuspect(playerId: string): boolean {
        return this.noRecoilPlayersBloomFilter.contains(playerId);
    }

    /**
     * Flag a player for speedhacking
     */
    flagSpeedhacker(playerId: string): void {
        this.speedhackersBloomFilter.add(playerId);
        this.flagPlayer(playerId);
    }

    /**
     * Check if player is suspected of speedhacking
     */
    isSpeedhacker(playerId: string): boolean {
        return this.speedhackersBloomFilter.contains(playerId);
    }

    /**
     * Flag a player for wallhacking
     */
    flagWallhacker(playerId: string): void {
        this.wallhackersBloomFilter.add(playerId);
        this.flagPlayer(playerId);
    }

    /**
     * Check if player is suspected of wallhacking
     */
    isWallhacker(playerId: string): boolean {
        return this.wallhackersBloomFilter.contains(playerId);
    }

    /**
     * Mark a player as high-risk (requires immediate attention)
     */
    markAsHighRisk(playerId: string): void {
        this.highRiskPlayersBloomFilter.add(playerId);
        this.flagPlayer(playerId);
    }

    /**
     * Check if a player is high-risk
     */
    isHighRisk(playerId: string): boolean {
        return this.highRiskPlayersBloomFilter.contains(playerId);
    }

    /**
     * Batch flag multiple players
     */
    flagPlayersBatch(playerIds: string[]): void {
        playerIds.forEach(id => this.flagPlayer(id));
    }

    /**
     * Get threat profile for a player (probability of each threat type)
     */
    getThreatProfile(playerId: string) {
        return {
            playerId,
            isFlagged: this.isPlayerFlagged(playerId),
            threats: {
                aimbot: this.isAimbotSuspect(playerId),
                noRecoil: this.isNoRecoilSuspect(playerId),
                speedhack: this.isSpeedhacker(playerId),
                wallhack: this.isWallhacker(playerId),
                highRisk: this.isHighRisk(playerId)
            },
            threatCount: [
                this.isAimbotSuspect(playerId),
                this.isNoRecoilSuspect(playerId),
                this.isSpeedhacker(playerId),
                this.isWallhacker(playerId),
                this.isHighRisk(playerId)
            ].filter(Boolean).length
        };
    }

    /**
     * Get statistics about the threat tracking filters
     */
    getStats() {
        return {
            flaggedPlayers: this.flaggedPlayersBloomFilter.getStats(),
            aimbots: this.aimabotsBloomFilter.getStats(),
            noRecoilPlayers: this.noRecoilPlayersBloomFilter.getStats(),
            speedhackers: this.speedhackersBloomFilter.getStats(),
            wallhackers: this.wallhackersBloomFilter.getStats(),
            highRiskPlayers: this.highRiskPlayersBloomFilter.getStats(),
            uptime: Date.now() - this.lastResetTime,
            willResetIn: this.resetIntervalMs - (Date.now() - this.lastResetTime)
        };
    }

    /**
     * Check and reset filters if needed
     */
    checkAndReset(): void {
        const now = Date.now();
        if (now - this.lastResetTime > this.resetIntervalMs) {
            console.log('Resetting suspicious player tracking filters');
            this.reset();
        }
    }

    /**
     * Reset all filters
     */
    reset(): void {
        this.flaggedPlayersBloomFilter.clear();
        this.aimabotsBloomFilter.clear();
        this.noRecoilPlayersBloomFilter.clear();
        this.speedhackersBloomFilter.clear();
        this.wallhackersBloomFilter.clear();
        this.highRiskPlayersBloomFilter.clear();
        this.lastResetTime = Date.now();
    }

    /**
     * Export threat tracking state
     */
    export() {
        return {
            flaggedPlayers: this.flaggedPlayersBloomFilter.export(),
            aimbots: this.aimabotsBloomFilter.export(),
            noRecoilPlayers: this.noRecoilPlayersBloomFilter.export(),
            speedhackers: this.speedhackersBloomFilter.export(),
            wallhackers: this.wallhackersBloomFilter.export(),
            highRiskPlayers: this.highRiskPlayersBloomFilter.export(),
            timestamp: Date.now()
        };
    }

    /**
     * Import threat tracking state
     */
    import(data: ReturnType<SuspiciousPlayerService['export']>): void {
        try {
            this.flaggedPlayersBloomFilter.import(data.flaggedPlayers);
            this.aimabotsBloomFilter.import(data.aimbots);
            this.noRecoilPlayersBloomFilter.import(data.noRecoilPlayers);
            this.speedhackersBloomFilter.import(data.speedhackers);
            this.wallhackersBloomFilter.import(data.wallhackers);
            this.highRiskPlayersBloomFilter.import(data.highRiskPlayers);
            this.lastResetTime = data.timestamp;
        } catch (error) {
            console.error('Failed to import suspicious player state:', error);
        }
    }
}

// Singleton instance
let instance: SuspiciousPlayerService | null = null;

/**
 * Get or create singleton instance
 */
export function getSuspiciousPlayerService(): SuspiciousPlayerService {
    if (!instance) {
        instance = new SuspiciousPlayerService();
    }

    instance.checkAndReset();
    return instance;
}

export default SuspiciousPlayerService;
