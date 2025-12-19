"""
Ares AntiCheat - Real-Time ML Prediction Service
=================================================
FastAPI service for real-time cheat detection using trained ML models.

Endpoints:
- POST /predict - Predict if a player event is suspicious
- POST /predict/batch - Batch prediction for multiple events
- GET /model/info - Get current model information
- GET /health - Health check

Author: Ares Team
Version: 1.0
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import pickle
import json
import os
import numpy as np
import pandas as pd
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================

MODEL_PATH = os.getenv("MODEL_PATH", "./models")
DEFAULT_MODEL = "random_forest"

# Features expected by the model
FEATURE_COLUMNS = [
    'aim_snap_angle',
    'aim_snap_speed', 
    'tracking_smoothness',
    'is_flick_shot',
    'time_to_target_ms',
    'aim_linearity',
    'acceleration_variance',
    'aim_corrections_count',
    'recoil_recovery_score',
    'spray_pattern_score',
    'time_between_shots_ms',
    'first_shot_accuracy',
    'spray_transfer_speed',
    'session_accuracy',
    'session_headshot_ratio',
    'kills_per_minute',
    'deaths_per_minute',
    'session_kd_ratio',
    'movement_speed',
    'direction_changes_per_sec',
    'reaction_time_ms',
    'time_to_kill_ms',
]

# ============================================
# PYDANTIC MODELS
# ============================================

class PlayerEvent(BaseModel):
    """Single player event for prediction"""
    player_id: str
    event_type: str = "AIM"
    
    # Aim features
    aim_snap_angle: float = Field(default=0, ge=0, le=180)
    aim_snap_speed: float = Field(default=0, ge=0)
    tracking_smoothness: float = Field(default=0.5, ge=0, le=1)
    is_flick_shot: bool = False
    time_to_target_ms: float = Field(default=200, ge=0)
    aim_linearity: float = Field(default=0.5, ge=0, le=1)
    acceleration_variance: float = Field(default=0.3, ge=0, le=1)
    aim_corrections_count: int = Field(default=3, ge=0)
    
    # Shooting features
    recoil_recovery_score: float = Field(default=0.5, ge=0, le=1)
    spray_pattern_score: float = Field(default=0.5, ge=0, le=1)
    time_between_shots_ms: float = Field(default=100, ge=0)
    first_shot_accuracy: float = Field(default=0.5, ge=0, le=1)
    spray_transfer_speed: float = Field(default=0.5, ge=0, le=1)
    
    # Session stats
    session_accuracy: float = Field(default=0.3, ge=0, le=1)
    session_headshot_ratio: float = Field(default=0.2, ge=0, le=1)
    kills_per_minute: float = Field(default=1.0, ge=0)
    deaths_per_minute: float = Field(default=1.0, ge=0)
    session_kd_ratio: float = Field(default=1.0, ge=0)
    
    # Movement
    movement_speed: float = Field(default=220, ge=0)
    direction_changes_per_sec: float = Field(default=1.5, ge=0)
    
    # Kill features
    reaction_time_ms: float = Field(default=250, ge=0)
    time_to_kill_ms: float = Field(default=500, ge=0)


class PredictionResult(BaseModel):
    """Prediction result for a single event"""
    player_id: str
    is_cheater: bool
    confidence: float
    cheat_probability: float
    risk_level: str  # low, medium, high, critical
    cheat_type_prediction: Optional[str] = None
    timestamp: str
    features_analyzed: int


class BatchPredictionRequest(BaseModel):
    """Batch prediction request"""
    events: List[PlayerEvent]


class BatchPredictionResult(BaseModel):
    """Batch prediction response"""
    predictions: List[PredictionResult]
    total_events: int
    cheaters_detected: int
    processing_time_ms: float


class ModelInfo(BaseModel):
    """Model information"""
    model_name: str
    model_type: str
    features_count: int
    features: List[str]
    loaded_at: str
    model_path: str


# ============================================
# ML MODEL MANAGER
# ============================================

class MLModelManager:
    """Manages ML models for prediction"""
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.model_name = None
        self.model_path = None
        self.loaded_at = None
        
    def load_latest_model(self):
        """Load the most recent trained model"""
        logger.info("Loading ML model...")
        
        if not os.path.exists(MODEL_PATH):
            logger.warning(f"Model directory not found: {MODEL_PATH}")
            return False
        
        # Find latest model file
        model_files = [f for f in os.listdir(MODEL_PATH) if f.endswith('.pkl') and not f.startswith('scaler')]
        
        if not model_files:
            logger.warning("No model files found")
            return False
        
        # Sort by timestamp and get latest
        model_files.sort(reverse=True)
        model_file = model_files[0]
        
        # Load model
        model_path = os.path.join(MODEL_PATH, model_file)
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)
        
        # Find corresponding scaler
        timestamp = model_file.split('_')[-1].replace('.pkl', '')
        scaler_file = f"scaler_{timestamp}.pkl"
        scaler_path = os.path.join(MODEL_PATH, scaler_file)
        
        if os.path.exists(scaler_path):
            with open(scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
        
        self.model_name = model_file.replace('.pkl', '')
        self.model_path = model_path
        self.loaded_at = datetime.now().isoformat()
        
        logger.info(f"✅ Model loaded: {self.model_name}")
        return True
    
    def predict(self, event: PlayerEvent) -> PredictionResult:
        """Make prediction for a single event"""
        if self.model is None:
            raise HTTPException(status_code=503, detail="Model not loaded")
        
        # Convert event to features DataFrame
        features = self._extract_features(event)
        
        # Scale if scaler exists
        if self.scaler is not None:
            features_scaled = self.scaler.transform(features)
        else:
            features_scaled = features.values
        
        # Get prediction
        prediction = self.model.predict(features_scaled)[0]
        probabilities = self.model.predict_proba(features_scaled)[0]
        
        # Get cheat probability (probability of class 1)
        cheat_prob = probabilities[1] if len(probabilities) > 1 else probabilities[0]
        
        # Determine risk level
        risk_level = self._get_risk_level(cheat_prob)
        
        return PredictionResult(
            player_id=event.player_id,
            is_cheater=bool(prediction),
            confidence=float(max(probabilities)),
            cheat_probability=float(cheat_prob),
            risk_level=risk_level,
            timestamp=datetime.now().isoformat(),
            features_analyzed=len(FEATURE_COLUMNS)
        )
    
    def predict_batch(self, events: List[PlayerEvent]) -> List[PredictionResult]:
        """Make predictions for multiple events"""
        return [self.predict(event) for event in events]
    
    def _extract_features(self, event: PlayerEvent) -> pd.DataFrame:
        """Extract features from event"""
        data = {
            'aim_snap_angle': event.aim_snap_angle,
            'aim_snap_speed': event.aim_snap_speed,
            'tracking_smoothness': event.tracking_smoothness,
            'is_flick_shot': int(event.is_flick_shot),
            'time_to_target_ms': event.time_to_target_ms,
            'aim_linearity': event.aim_linearity,
            'acceleration_variance': event.acceleration_variance,
            'aim_corrections_count': event.aim_corrections_count,
            'recoil_recovery_score': event.recoil_recovery_score,
            'spray_pattern_score': event.spray_pattern_score,
            'time_between_shots_ms': event.time_between_shots_ms,
            'first_shot_accuracy': event.first_shot_accuracy,
            'spray_transfer_speed': event.spray_transfer_speed,
            'session_accuracy': event.session_accuracy,
            'session_headshot_ratio': event.session_headshot_ratio,
            'kills_per_minute': event.kills_per_minute,
            'deaths_per_minute': event.deaths_per_minute,
            'session_kd_ratio': event.session_kd_ratio,
            'movement_speed': event.movement_speed,
            'direction_changes_per_sec': event.direction_changes_per_sec,
            'reaction_time_ms': event.reaction_time_ms,
            'time_to_kill_ms': event.time_to_kill_ms,
        }
        
        return pd.DataFrame([data])
    
    def _get_risk_level(self, probability: float) -> str:
        """Convert probability to risk level"""
        if probability >= 0.9:
            return "critical"
        elif probability >= 0.7:
            return "high"
        elif probability >= 0.5:
            return "medium"
        else:
            return "low"
    
    def get_info(self) -> ModelInfo:
        """Get model information"""
        return ModelInfo(
            model_name=self.model_name or "Not loaded",
            model_type=type(self.model).__name__ if self.model else "None",
            features_count=len(FEATURE_COLUMNS),
            features=FEATURE_COLUMNS,
            loaded_at=self.loaded_at or "Never",
            model_path=self.model_path or "None"
        )


# ============================================
# FASTAPI APPLICATION
# ============================================

app = FastAPI(
    title="Ares AntiCheat ML Service",
    description="Real-time cheat detection using Machine Learning",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model manager
model_manager = MLModelManager()


@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    model_manager.load_latest_model()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model_manager.model is not None,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/model/info", response_model=ModelInfo)
async def get_model_info():
    """Get information about the loaded model"""
    return model_manager.get_info()


@app.post("/model/reload")
async def reload_model():
    """Reload the ML model"""
    success = model_manager.load_latest_model()
    return {
        "success": success,
        "message": "Model reloaded" if success else "Failed to reload model"
    }


@app.post("/predict", response_model=PredictionResult)
async def predict(event: PlayerEvent):
    """Predict if a player event is suspicious"""
    return model_manager.predict(event)


@app.post("/predict/batch", response_model=BatchPredictionResult)
async def predict_batch(request: BatchPredictionRequest):
    """Batch prediction for multiple events"""
    start_time = datetime.now()
    
    predictions = model_manager.predict_batch(request.events)
    
    processing_time = (datetime.now() - start_time).total_seconds() * 1000
    cheaters_count = sum(1 for p in predictions if p.is_cheater)
    
    return BatchPredictionResult(
        predictions=predictions,
        total_events=len(predictions),
        cheaters_detected=cheaters_count,
        processing_time_ms=round(processing_time, 2)
    )


@app.post("/analyze/player/{player_id}")
async def analyze_player(player_id: str, events: List[PlayerEvent]):
    """Analyze multiple events from a single player"""
    if not events:
        raise HTTPException(status_code=400, detail="No events provided")
    
    predictions = model_manager.predict_batch(events)
    
    # Aggregate analysis
    cheat_probs = [p.cheat_probability for p in predictions]
    avg_prob = sum(cheat_probs) / len(cheat_probs)
    max_prob = max(cheat_probs)
    suspicious_count = sum(1 for p in predictions if p.is_cheater)
    
    return {
        "player_id": player_id,
        "events_analyzed": len(events),
        "suspicious_events": suspicious_count,
        "average_cheat_probability": round(avg_prob, 4),
        "max_cheat_probability": round(max_prob, 4),
        "overall_risk_level": model_manager._get_risk_level(avg_prob),
        "recommendation": "BAN" if avg_prob > 0.8 else "FLAG" if avg_prob > 0.5 else "MONITOR" if avg_prob > 0.3 else "CLEAR",
        "predictions": predictions
    }


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    import uvicorn
    
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║     🛡️  ARES ANTICHEAT - ML PREDICTION SERVICE  🛡️       ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "prediction_service:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
