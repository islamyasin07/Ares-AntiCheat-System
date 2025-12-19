import { Router, Request, Response } from 'express';
import { getDb } from '../db/mongo';

export const mlRouter = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Interfaces
interface MLPrediction {
  player_id: string;
  is_cheater: boolean;
  confidence: number;
  cheat_probability: number;
  risk_level: string;
  cheat_type_prediction?: string;
  timestamp: string;
  features_analyzed: number;
}

interface PlayerAnalysis {
  player_id: string;
  events_analyzed: number;
  suspicious_events: number;
  average_cheat_probability: number;
  max_cheat_probability: number;
  overall_risk_level: string;
  recommendation: string;
  predictions: MLPrediction[];
}

// Helper function to call ML service
async function callMLService(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`ML Service error: ${response.status}`);
  }
  
  return response.json();
}

// GET /api/ml/health - Check ML service health
mlRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await callMLService('/health');
    res.json({
      status: 'connected',
      ml_service: health,
    });
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      error: 'ML service unavailable',
      message: (error as Error).message,
    });
  }
});

// GET /api/ml/model/info - Get ML model info
mlRouter.get('/model/info', async (req: Request, res: Response) => {
  try {
    const info = await callMLService('/model/info');
    res.json(info);
  } catch (error) {
    res.status(503).json({ error: 'ML service unavailable' });
  }
});

// POST /api/ml/predict - Single event prediction
mlRouter.post('/predict', async (req: Request, res: Response) => {
  try {
    const prediction = await callMLService('/predict', 'POST', req.body);
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ml/predict/batch - Batch predictions
mlRouter.post('/predict/batch', async (req: Request, res: Response) => {
  try {
    const predictions = await callMLService('/predict/batch', 'POST', req.body);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ml/analyze/player/:playerId - Analyze a player using ML
mlRouter.get('/analyze/player/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const db = await getDb();

    // Fetch player events from MongoDB (use backend config to match Spark output)
    const events = await db.collection(require('../config').config.collections.events)
      .find({ playerId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    if (events.length === 0) {
      return res.status(404).json({ error: 'No events found for player' });
    }
    
    // Transform events to ML format
    const mlEvents = events.map((event: any) => ({
      player_id: event.playerId,
      aim_snap_angle: event.avgAimSnapAngle || event.avg_aim_snap_angle || 30,
      aim_snap_speed: (event.avgAimSnapAngle || 30) * 2,
      tracking_smoothness: 0.5,
      is_flick_shot: false,
      time_to_target_ms: 200,
      aim_linearity: 0.5,
      acceleration_variance: 0.3,
      aim_corrections_count: 4,
      recoil_recovery_score: 0.5,
      spray_pattern_score: 0.5,
      time_between_shots_ms: 100,
      first_shot_accuracy: event.accuracy || 0.3,
      spray_transfer_speed: 0.5,
      session_accuracy: event.accuracy || 0.3,
      session_headshot_ratio: event.headshotRatio || event.headshot_ratio || 0.2,
      kills_per_minute: 1.0,
      deaths_per_minute: 0.8,
      session_kd_ratio: event.killDeathRatio || event.kd_ratio || 1.0,
      movement_speed: 220,
      direction_changes_per_sec: 1.5,
      reaction_time_ms: event.reactionTimeMs || event.reaction_time_ms || 250,
      time_to_kill_ms: 500,
    }));
    
    // Call ML service for batch prediction
    const batchResult = await callMLService('/predict/batch', 'POST', { events: mlEvents });
    
    // Calculate aggregate stats
    const predictions = batchResult.predictions as MLPrediction[];
    const cheatProbs = predictions.map(p => p.cheat_probability);
    const avgProb = cheatProbs.reduce((a, b) => a + b, 0) / cheatProbs.length;
    const maxProb = Math.max(...cheatProbs);
    const suspiciousCount = predictions.filter(p => p.is_cheater).length;
    
    // Determine risk level
    let riskLevel = 'low';
    if (avgProb >= 0.9) riskLevel = 'critical';
    else if (avgProb >= 0.7) riskLevel = 'high';
    else if (avgProb >= 0.5) riskLevel = 'medium';
    
    // Determine recommendation
    let recommendation = 'CLEAR';
    if (avgProb > 0.8) recommendation = 'BAN';
    else if (avgProb > 0.5) recommendation = 'FLAG';
    else if (avgProb > 0.3) recommendation = 'MONITOR';
    
    const analysis: PlayerAnalysis = {
      player_id: playerId,
      events_analyzed: events.length,
      suspicious_events: suspiciousCount,
      average_cheat_probability: Math.round(avgProb * 10000) / 10000,
      max_cheat_probability: Math.round(maxProb * 10000) / 10000,
      overall_risk_level: riskLevel,
      recommendation,
      predictions,
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('ML analysis error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ml/scan/all - Scan all recent detections with ML
mlRouter.get('/scan/all', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const limit = parseInt(req.query.limit as string) || 100;
    
    // Get recent detections (read suspicious collection produced by Spark)
    const detections = await db.collection(require('../config').config.collections.suspicious)
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // Group by player
    const playerEvents: { [key: string]: any[] } = {};
    detections.forEach((d: any) => {
      const pid = d.playerId || d.player_id;
      if (!playerEvents[pid]) playerEvents[pid] = [];
      playerEvents[pid].push(d);
    });
    
    // Analyze each player
    const results: any[] = [];
    
    for (const [playerId, events] of Object.entries(playerEvents)) {
      // Create ML event format
      const mlEvent = {
        player_id: playerId,
        aim_snap_angle: events[0]?.avgAimSnapAngle || 30,
        session_headshot_ratio: events[0]?.headshotRatio || 0.2,
        reaction_time_ms: events[0]?.reactionTimeMs || 250,
        acceleration_variance: 0.3,
        aim_corrections_count: 4,
        deaths_per_minute: 0.8,
        session_kd_ratio: events[0]?.killDeathRatio || 1.0,
        direction_changes_per_sec: 1.5,
      };
      
      try {
        const prediction = await callMLService('/predict', 'POST', mlEvent);
        results.push({
          player_id: playerId,
          events_count: events.length,
          ml_prediction: prediction,
        });
      } catch (err) {
        // Skip if ML service fails for this player
      }
    }
    
    // Sort by cheat probability
    results.sort((a, b) => b.ml_prediction.cheat_probability - a.ml_prediction.cheat_probability);
    
    // Summary
    const summary = {
      total_players_scanned: results.length,
      cheaters_detected: results.filter(r => r.ml_prediction.is_cheater).length,
      high_risk: results.filter(r => r.ml_prediction.risk_level === 'high' || r.ml_prediction.risk_level === 'critical').length,
      medium_risk: results.filter(r => r.ml_prediction.risk_level === 'medium').length,
      low_risk: results.filter(r => r.ml_prediction.risk_level === 'low').length,
    };
    
    res.json({
      summary,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ml/analyze/realtime - Analyze real-time event
mlRouter.post('/analyze/realtime', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    
    // Transform to ML format if needed
    const mlEvent = {
      player_id: event.playerId || event.player_id,
      aim_snap_angle: event.avgAimSnapAngle || event.aim_snap_angle || 30,
      aim_snap_speed: (event.avgAimSnapAngle || 30) * 2,
      tracking_smoothness: event.tracking_smoothness || 0.5,
      is_flick_shot: event.is_flick_shot || false,
      time_to_target_ms: event.time_to_target_ms || 200,
      aim_linearity: event.aim_linearity || 0.5,
      acceleration_variance: event.acceleration_variance || 0.3,
      aim_corrections_count: event.aim_corrections_count || 4,
      recoil_recovery_score: event.recoil_recovery_score || 0.5,
      spray_pattern_score: event.spray_pattern_score || 0.5,
      time_between_shots_ms: event.time_between_shots_ms || 100,
      first_shot_accuracy: event.first_shot_accuracy || event.accuracy || 0.3,
      spray_transfer_speed: event.spray_transfer_speed || 0.5,
      session_accuracy: event.accuracy || event.session_accuracy || 0.3,
      session_headshot_ratio: event.headshotRatio || event.session_headshot_ratio || 0.2,
      kills_per_minute: event.kills_per_minute || 1.0,
      deaths_per_minute: event.deaths_per_minute || 0.8,
      session_kd_ratio: event.killDeathRatio || event.session_kd_ratio || 1.0,
      movement_speed: event.movement_speed || 220,
      direction_changes_per_sec: event.direction_changes_per_sec || 1.5,
      reaction_time_ms: event.reactionTimeMs || event.reaction_time_ms || 250,
      time_to_kill_ms: event.time_to_kill_ms || 500,
    };
    
    const prediction = await callMLService('/predict', 'POST', mlEvent);
    
    res.json({
      event_id: event._id || event.event_id,
      player_id: mlEvent.player_id,
      prediction,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ========================================
// ML Detections Endpoints (from kafka_ml_consumer -> ml_detections)
// ========================================

// GET /api/ml/detections - Paginated ML detections
mlRouter.get('/detections', async (req: Request, res: Response, next) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(200, parseInt((req.query.limit as string) || '50', 10));
    const playerId = (req.query.playerId as string) || undefined;
    const riskLevel = (req.query.riskLevel as string) || undefined;
    const minProb = req.query.minProb ? parseFloat(req.query.minProb as string) : undefined;

    const db = await getDb();
    const coll = db.collection('ml_detections');

    const filter: Record<string, any> = {};
    if (playerId) filter.player_id = playerId;
    if (riskLevel) filter.risk_level = riskLevel;
    if (!isNaN(minProb as number) && typeof minProb === 'number') filter.cheat_probability = { $gte: minProb };

    const cursor = coll.find(filter).sort({ detected_at: -1 }).skip((page - 1) * limit).limit(limit);
    const items = await cursor.toArray();
    const total = await coll.countDocuments(filter);

    res.json({ page, limit, total, items });
  } catch (err) {
    next(err);
  }
});

// GET /api/ml/detections/live - Latest ML detections (no cache)
mlRouter.get('/detections/live', async (_req: Request, res: Response, next) => {
  try {
    const db = await getDb();
    const coll = db.collection('ml_detections');

    const items = await coll.find({}).sort({ detected_at: -1 }).limit(50).toArray();

    // Ensure fresh data
    res.set('Cache-Control', 'no-store');
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/ml/detections/count - Quick stats for ML detections
mlRouter.get('/detections/count', async (_req: Request, res: Response, next) => {
  try {
    const db = await getDb();
    const coll = db.collection('ml_detections');

    const total = await coll.countDocuments({});
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recent = await coll.countDocuments({ detected_at: { $gte: fiveMinAgo } });
    const highRisk = await coll.countDocuments({ risk_level: { $in: ['high', 'critical'] } });

    res.json({ total, recent, highRisk });
  } catch (err) {
    next(err);
  }
});

// GET /api/ml/detections/player/:playerId - ML detections for a player
mlRouter.get('/detections/player/:playerId', async (req: Request, res: Response, next) => {
  try {
    const { playerId } = req.params;
    const db = await getDb();
    const coll = db.collection('ml_detections');

    const items = await coll.find({ player_id: playerId }).sort({ detected_at: -1 }).limit(200).toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/ml/seed - Insert sample ML detections (dev helper)
mlRouter.post('/seed', async (_req: Request, res: Response, next) => {
  try {
    const db = await getDb();
    const coll = db.collection('ml_detections');

    const now = Date.now();
    const samplePlayers = ['P_TEST_01', 'P_TEST_02', 'P_TEST_03', 'P_TEST_04', 'P_TEST_05'];
    const docs = [] as any[];
    for (let i = 0; i < 12; i++) {
      const p = samplePlayers[Math.floor(Math.random() * samplePlayers.length)];
      const prob = Math.round(Math.random() * 100) / 100;
      let rl = 'low';
      if (prob >= 0.9) rl = 'critical';
      else if (prob >= 0.7) rl = 'high';
      else if (prob >= 0.5) rl = 'medium';

      docs.push({
        player_id: p,
        detected_at: now - Math.floor(Math.random() * 300000),
        cheat_probability: prob,
        risk_level: rl,
        confidence: Math.round((prob + Math.random() * (1 - prob)) * 100) / 100,
        ruleTriggered: 'ML-Seed',
        source: 'ml_model',
        details: { note: 'seeded detection for UI testing' }
      });
    }

    const r = await coll.insertMany(docs);
    res.json({ success: true, inserted: r.insertedCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/ml/seed - Dev helper: insert sample ML detections for UI testing (non-production)
mlRouter.post('/seed', async (_req: Request, res: Response, next) => {
  try {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') return res.status(403).json({ error: 'Forbidden in production' });

    const db = await getDb();
    const coll = db.collection('ml_detections');

    const now = Date.now();
    const samplePlayers = ['P_UI_01','P_UI_02','P_UI_03','P_UI_04','P_UI_05'];
    const docs = [];
    for (let i=0;i<20;i++){
      const p = samplePlayers[Math.floor(Math.random()*samplePlayers.length)];
      const prob = Math.round(Math.random()*100)/100;
      const rl = prob>=0.9? 'critical' : prob>=0.7? 'high' : prob>=0.5? 'medium' : 'low';
      docs.push({
        player_id: p,
        detected_at: now - Math.floor(Math.random()*1000*60*10),
        cheat_probability: prob,
        risk_level: rl,
        confidence: Math.round((prob + Math.random()*(1-prob))*100)/100,
        ruleTriggered: 'ML-Seed-HTTP',
        source: 'ml_model',
        details: { note: 'seeded via /api/ml/seed' }
      });
    }

    const r = await coll.insertMany(docs);
    res.json({ inserted: r.insertedCount, total: await coll.countDocuments({}) });
  } catch (err) {
    next(err);
  }
});
