import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@fast-csv/parse';
import { getDb } from '../db/mongo';
import { config } from '../config';

const router = Router();

const ANALYTICS_DIR = path.join(
    __dirname, 
    '..', 
    '..',
    '..',
    'spark', 
    'AresSparkStreaming', 
    'analytics_output'
);

const readAnalyticsCsv = (folderName: string, res: Response) => {
    const folderPath = path.join(ANALYTICS_DIR, folderName);
    
    fs.readdir(folderPath, (err: NodeJS.ErrnoException | null, files: string[]) => {
        if (err) {
            console.error(`Error reading directory ${folderName}:`, err);
            return res.status(500).json({ error: 'Analytics data folder not found or inaccessible. Please check Spark job status.' });
        }
        
        const partFile = files.find(f => f.startsWith('part-') && f.endsWith('.csv'));

        if (!partFile) {
            return res.status(404).json({ error: `No CSV data found in ${folderName}. Did the Spark job run successfully?` });
        }

        // Disable caching on analytics responses so clients always receive fresh JSON
        try {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        } catch (e) {
        }

        const data: any[] = [];
        const filePath = path.join(folderPath, partFile);

        fs.createReadStream(filePath)
            .pipe(parse({ headers: true, ignoreEmpty: true }))
            .on('error', (error: unknown) => { 
                console.error("CSV Parsing Error:", error);
                res.status(500).json({ error: 'Error parsing analytics CSV file.' });
            })
            .on('data', (row: any) => data.push(row))
            .on('end', () => {
                res.json(data);
            });
    });
};

// Try to serve analytics from MongoDB; fall back to CSV files when DB is unavailable
router.get('/top-cheaters', async (_req: Request, res: Response) => {
    try {
        const db = await getDb();
        const coll = db.collection(config.collections.suspicious);
        const agg = await coll.aggregate([
            { $group: { _id: '$playerId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 100 }
        ]).toArray();

        if (!agg || agg.length === 0) return readAnalyticsCsv('suspicious_by_player', res);

        const out = agg.map(item => ({ playerId: item._id, suspicious_events_count: item.count }));
        res.json(out);
    } catch (err) {
        console.warn('Top cheaters from DB failed, falling back to CSV:', err);
        return readAnalyticsCsv('suspicious_by_player', res);
    }
});

router.get('/cheat-distribution', async (_req: Request, res: Response) => {
    try {
        const db = await getDb();
        const coll = db.collection(config.collections.suspicious);
        const agg = await coll.aggregate([
            { $group: { _id: { $ifNull: ['$ruleTriggered', '$cheatType'] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        if (!agg || agg.length === 0) return readAnalyticsCsv('cheat_type_distribution', res);

        const out = agg.map(item => ({ ruleTriggered: item._id, occurrence: item.count }));
        res.json(out);
    } catch (err) {
        console.warn('Cheat distribution from DB failed, falling back to CSV:', err);
        return readAnalyticsCsv('cheat_type_distribution', res);
    }
});

router.get('/hourly-events', async (_req: Request, res: Response) => {
    try {
        const db = await getDb();
        const coll = db.collection(config.collections.suspicious);
        const agg = await coll.aggregate([
            { $group: { _id: { $hour: { $toDate: '$timestamp' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        if (!agg || agg.length === 0) return readAnalyticsCsv('hourly_event_distribution', res);

        // Build 24-hour array
        const hours = Array.from({ length: 24 }, (_, h) => {
            const found = agg.find(a => a._id === h);
            return { hour: h, events_volume: found ? found.count : 0 };
        });
        res.json(hours);
    } catch (err) {
        console.warn('Hourly events from DB failed, falling back to CSV:', err);
        return readAnalyticsCsv('hourly_event_distribution', res);
    }
});

router.get('/avg-speed', async (_req: Request, res: Response) => {
    try {
        const db = await getDb();
        const coll = db.collection(config.collections.events);
        const agg = await coll.aggregate([
            { $match: { speed: { $exists: true, $ne: null } } },
            { $group: { _id: '$playerId', avgSpeed: { $avg: '$speed' } } },
            { $sort: { avgSpeed: -1 } },
            { $limit: 100 }
        ]).toArray();

        if (!agg || agg.length === 0) return readAnalyticsCsv('speed_avg', res);

        const out = agg.map(item => ({ playerId: item._id, average_speed: item.avgSpeed }));
        res.json(out);
    } catch (err) {
        console.warn('Avg speed from DB failed, falling back to CSV:', err);
        return readAnalyticsCsv('speed_avg', res);
    }
});

export default router;