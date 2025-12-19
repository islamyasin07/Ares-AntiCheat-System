# Ares AntiCheat - Machine Learning Module

## 🤖 Overview

This module contains the ML components for intelligent cheat detection:

- **ml_data_generator.py** - Generates rich labeled data for training
- **train_model.py** - Trains and evaluates multiple ML models
- **prediction_service.py** - FastAPI service for real-time predictions

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ml
pip install -r requirements.txt
```

### 2. Generate Training Data

First, make sure Kafka is running, then:

```bash
python ml_data_generator.py
```

Let it run for a few minutes to generate sufficient data.

### 3. Train Models

```bash
python train_model.py
```

This will:
- Load data from MongoDB
- Train multiple models (Random Forest, XGBoost, Neural Network)
- Compare performance and select the best model
- Save the model to `./models/`

### 4. Start Prediction Service

```bash
python prediction_service.py
```

API will be available at `http://localhost:8000`

## 📊 Models Implemented

| Model | Description | Best For |
|-------|-------------|----------|
| Random Forest | Ensemble of decision trees | General classification |
| XGBoost | Gradient boosting | High accuracy |
| Neural Network | Multi-layer perceptron | Complex patterns |
| Isolation Forest | Anomaly detection | Unsupervised detection |

## 🎯 Features Used

### Aim Features
- `aim_snap_angle` - Angle of aim snaps
- `aim_snap_speed` - Speed of aim movements
- `tracking_smoothness` - How smooth the aim tracking is
- `aim_linearity` - Linear vs curved aim paths
- `time_to_target_ms` - Time to acquire target

### Shooting Features
- `session_accuracy` - Overall accuracy
- `session_headshot_ratio` - Headshot percentage
- `recoil_recovery_score` - Recoil control ability
- `spray_pattern_score` - Consistency of spray

### Movement Features
- `movement_speed` - Player movement speed
- `reaction_time_ms` - Time to react to enemies

## 📡 API Endpoints

```
POST /predict              - Single event prediction
POST /predict/batch        - Batch predictions
POST /analyze/player/{id}  - Analyze player history
GET  /model/info           - Model information
GET  /health               - Health check
```

### Example Request

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "player_id": "player_123",
    "aim_snap_angle": 85.5,
    "session_headshot_ratio": 0.78,
    "reaction_time_ms": 50
  }'
```

### Example Response

```json
{
  "player_id": "player_123",
  "is_cheater": true,
  "confidence": 0.94,
  "cheat_probability": 0.94,
  "risk_level": "critical",
  "timestamp": "2024-12-14T12:00:00"
}
```

## 📈 Performance Metrics

After training, you'll see metrics like:

```
MODEL COMPARISON SUMMARY
=====================================================
                  accuracy  precision  recall    f1   roc_auc
Random Forest       0.9543    0.9312   0.9234  0.9273  0.9821
XGBoost             0.9621    0.9456   0.9389  0.9422  0.9867
Neural Network      0.9487    0.9198   0.9156  0.9177  0.9745

🏆 Best Model: XGBoost (F1: 0.9422)
```
