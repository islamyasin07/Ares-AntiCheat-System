import fs from 'fs/promises';
import path from 'path';
import { EventDeduplicationService } from './deduplicationService';
import { SuspiciousPlayerService } from './suspiciousPlayerService';

/**
 * Bloom Filter Persistence Manager
 * Handles saving and loading Bloom Filter state for recovery
 */
export class BloomFilterPersistenceManager {
    private dataDir: string;

    constructor(dataDir: string = './bloom-filter-data') {
        this.dataDir = dataDir;
    }

    /**
     * Initialize data directory
     */
    async initialize(): Promise<void> {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create bloom filter data directory:', error);
        }
    }

    /**
     * Save event deduplication filters to disk
     */
    async saveDeduplicationFilters(service: EventDeduplicationService): Promise<void> {
        try {
            const data = service.export();
            const filepath = path.join(this.dataDir, 'deduplication.json');
            await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
            console.log('Deduplication filters saved to', filepath);
        } catch (error) {
            console.error('Failed to save deduplication filters:', error);
        }
    }

    /**
     * Load event deduplication filters from disk
     */
    async loadDeduplicationFilters(service: EventDeduplicationService): Promise<void> {
        try {
            const filepath = path.join(this.dataDir, 'deduplication.json');
            const data = await fs.readFile(filepath, 'utf8');
            const parsed = JSON.parse(data);
            service.import(parsed);
            console.log('Deduplication filters loaded from', filepath);
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                console.error('Failed to load deduplication filters:', error);
            }
        }
    }

    /**
     * Save suspicious player filters to disk
     */
    async saveSuspiciousPlayerFilters(service: SuspiciousPlayerService): Promise<void> {
        try {
            const data = service.export();
            const filepath = path.join(this.dataDir, 'suspicious-players.json');
            await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
            console.log('Suspicious player filters saved to', filepath);
        } catch (error) {
            console.error('Failed to save suspicious player filters:', error);
        }
    }

    /**
     * Load suspicious player filters from disk
     */
    async loadSuspiciousPlayerFilters(service: SuspiciousPlayerService): Promise<void> {
        try {
            const filepath = path.join(this.dataDir, 'suspicious-players.json');
            const data = await fs.readFile(filepath, 'utf8');
            const parsed = JSON.parse(data);
            service.import(parsed);
            console.log('Suspicious player filters loaded from', filepath);
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                console.error('Failed to load suspicious player filters:', error);
            }
        }
    }

    /**
     * Save all bloom filters
     */
    async saveAll(
        deduplicationService: EventDeduplicationService,
        suspiciousPlayerService: SuspiciousPlayerService
    ): Promise<void> {
        await Promise.all([
            this.saveDeduplicationFilters(deduplicationService),
            this.saveSuspiciousPlayerFilters(suspiciousPlayerService)
        ]);
    }

    /**
     * Load all bloom filters
     */
    async loadAll(
        deduplicationService: EventDeduplicationService,
        suspiciousPlayerService: SuspiciousPlayerService
    ): Promise<void> {
        await Promise.all([
            this.loadDeduplicationFilters(deduplicationService),
            this.loadSuspiciousPlayerFilters(suspiciousPlayerService)
        ]);
    }

    /**
     * Get size of stored bloom filter data
     */
    async getStorageSize(): Promise<{ total: number; files: Record<string, number> }> {
        const files: Record<string, number> = {};
        let total = 0;

        try {
            const entries = await fs.readdir(this.dataDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.json')) {
                    const filepath = path.join(this.dataDir, entry.name);
                    const stat = await fs.stat(filepath);
                    files[entry.name] = stat.size;
                    total += stat.size;
                }
            }
        } catch (error) {
            console.error('Failed to calculate storage size:', error);
        }

        return { total, files };
    }

    /**
     * Clear all stored bloom filters
     */
    async clearStorage(): Promise<void> {
        try {
            const entries = await fs.readdir(this.dataDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.json')) {
                    const filepath = path.join(this.dataDir, entry.name);
                    await fs.unlink(filepath);
                }
            }

            console.log('Cleared all bloom filter storage');
        } catch (error) {
            console.error('Failed to clear storage:', error);
        }
    }
}

// Singleton instance
let persistenceManager: BloomFilterPersistenceManager | null = null;

/**
 * Get or create persistence manager instance
 */
export function getPersistenceManager(
    dataDir?: string
): BloomFilterPersistenceManager {
    if (!persistenceManager) {
        persistenceManager = new BloomFilterPersistenceManager(dataDir);
    }
    return persistenceManager;
}

export default BloomFilterPersistenceManager;
