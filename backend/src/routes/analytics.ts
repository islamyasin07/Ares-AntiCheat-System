import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@fast-csv/parse'; 

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

router.get('/top-cheaters', (req: Request, res: Response) => {
    readAnalyticsCsv('suspicious_by_player', res);
});

router.get('/cheat-distribution', (req: Request, res: Response) => {
    readAnalyticsCsv('cheat_type_distribution', res);
});

router.get('/hourly-events', (req: Request, res: Response) => {
    readAnalyticsCsv('hourly_event_distribution', res);
});

router.get('/avg-speed', (req: Request, res: Response) => {
    readAnalyticsCsv('speed_avg', res);
});

export default router;