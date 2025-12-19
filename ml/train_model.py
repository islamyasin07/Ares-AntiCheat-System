"""
Ares AntiCheat - Machine Learning Module
========================================
Trains and evaluates ML models for cheat detection.

Models Implemented:
- Random Forest Classifier
- XGBoost Classifier  
- Isolation Forest (Anomaly Detection)
- Neural Network (MLP)

Author: Ares Team
Version: 1.0
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import pickle
import json
import os

# ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, IsolationForest, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    precision_score, recall_score, f1_score, roc_auc_score,
    precision_recall_curve, roc_curve
)
from sklearn.pipeline import Pipeline
import warnings
warnings.filterwarnings('ignore')

# Optional: XGBoost (if installed)
try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("⚠️  XGBoost not installed. Install with: pip install xgboost")

# MongoDB connection
from pymongo import MongoClient

# ============================================
# CONFIGURATION
# ============================================

MONGO_URI = "mongodb://localhost:27018"
DB_NAME = "ares_anticheat"
COLLECTION_NAME = "ml_training_data"  # ML training data collection

MODEL_SAVE_PATH = "./models"
RANDOM_SEED = 42

# Features to use for training
FEATURE_COLUMNS = [
    # Aim features
    'aim_snap_angle',
    'aim_snap_speed', 
    'tracking_smoothness',
    'is_flick_shot',
    'time_to_target_ms',
    'aim_linearity',
    'acceleration_variance',
    'aim_corrections_count',
    
    # Shooting features
    'recoil_recovery_score',
    'spray_pattern_score',
    'time_between_shots_ms',
    'first_shot_accuracy',
    'spray_transfer_speed',
    
    # Aggregated stats
    'session_accuracy',
    'session_headshot_ratio',
    'kills_per_minute',
    'deaths_per_minute',
    'session_kd_ratio',
    
    # Movement features
    'movement_speed',
    'direction_changes_per_sec',
    
    # Kill features
    'reaction_time_ms',
    'time_to_kill_ms',
]

# Target column
TARGET_COLUMN = 'is_cheater'
CHEAT_TYPE_COLUMN = 'cheat_type'


# ============================================
# DATA LOADING & PREPROCESSING
# ============================================

class DataLoader:
    """Load and preprocess data from MongoDB"""
    
    def __init__(self, mongo_uri: str = MONGO_URI, db_name: str = DB_NAME):
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        
    def load_from_mongodb(self, collection: str = COLLECTION_NAME, limit: int = None) -> pd.DataFrame:
        """Load data from MongoDB collection"""
        print(f"📥 Loading data from MongoDB: {collection}")
        
        query = {}
        cursor = self.db[collection].find(query)
        
        if limit:
            cursor = cursor.limit(limit)
            
        data = list(cursor)
        df = pd.DataFrame(data)
        
        print(f"   Loaded {len(df):,} records")
        return df
    
    def load_from_csv(self, filepath: str) -> pd.DataFrame:
        """Load data from CSV file"""
        print(f"📥 Loading data from CSV: {filepath}")
        df = pd.read_csv(filepath)
        print(f"   Loaded {len(df):,} records")
        return df
    
    def preprocess(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, pd.Series]:
        """Preprocess data for ML training"""
        print("\n🔧 Preprocessing data...")
        
        # Filter for events that have the features we need
        available_features = [f for f in FEATURE_COLUMNS if f in df.columns]
        missing_features = [f for f in FEATURE_COLUMNS if f not in df.columns]
        
        if missing_features:
            print(f"   ⚠️  Missing features: {missing_features}")
        
        print(f"   Using {len(available_features)} features")
        
        # Drop rows with missing target
        df = df.dropna(subset=[TARGET_COLUMN])
        
        # Extract features
        X = df[available_features].copy()
        
        # Handle missing values
        X = X.fillna(X.median())
        
        # Convert boolean to int
        for col in X.columns:
            if X[col].dtype == bool:
                X[col] = X[col].astype(int)
        
        # Extract targets
        y_binary = df[TARGET_COLUMN].astype(int)
        y_cheat_type = df[CHEAT_TYPE_COLUMN] if CHEAT_TYPE_COLUMN in df.columns else None
        
        print(f"   Final dataset: {len(X):,} samples, {len(available_features)} features")
        print(f"   Class distribution: {y_binary.value_counts().to_dict()}")
        
        return X, y_binary, y_cheat_type


# ============================================
# MODEL TRAINING
# ============================================

class CheatDetectorML:
    """Machine Learning model for cheat detection"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.models = {}
        self.results = {}
        self.best_model = None
        self.best_model_name = None
        
    def train_all_models(self, X: pd.DataFrame, y: pd.Series) -> Dict:
        """Train multiple models and compare performance"""
        print("\n" + "="*60)
        print("🤖 TRAINING ML MODELS")
        print("="*60)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
        )
        
        print(f"\n📊 Data Split:")
        print(f"   Training: {len(X_train):,} samples")
        print(f"   Testing: {len(X_test):,} samples")
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Define models to train
        models_to_train = {
            'Random Forest': RandomForestClassifier(
                n_estimators=100,
                max_depth=15,
                min_samples_split=5,
                random_state=RANDOM_SEED,
                n_jobs=-1
            ),
            'Gradient Boosting': GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=RANDOM_SEED
            ),
            'Neural Network': MLPClassifier(
                hidden_layer_sizes=(64, 32, 16),
                activation='relu',
                max_iter=500,
                random_state=RANDOM_SEED
            ),
        }
        
        # Add XGBoost if available
        if XGBOOST_AVAILABLE:
            models_to_train['XGBoost'] = XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=RANDOM_SEED,
                use_label_encoder=False,
                eval_metric='logloss'
            )
        
        # Train and evaluate each model
        for name, model in models_to_train.items():
            print(f"\n{'─'*40}")
            print(f"🔄 Training: {name}")
            
            # Train
            start_time = datetime.now()
            
            if name == 'Neural Network':
                model.fit(X_train_scaled, y_train)
                y_pred = model.predict(X_test_scaled)
                y_prob = model.predict_proba(X_test_scaled)[:, 1]
            else:
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                y_prob = model.predict_proba(X_test)[:, 1]
            
            train_time = (datetime.now() - start_time).total_seconds()
            
            # Evaluate
            metrics = self._evaluate_model(y_test, y_pred, y_prob)
            metrics['train_time_sec'] = round(train_time, 2)
            
            # Store results
            self.models[name] = model
            self.results[name] = metrics
            
            # Print results
            print(f"   ✅ Accuracy:  {metrics['accuracy']:.4f}")
            print(f"   ✅ Precision: {metrics['precision']:.4f}")
            print(f"   ✅ Recall:    {metrics['recall']:.4f}")
            print(f"   ✅ F1 Score:  {metrics['f1']:.4f}")
            print(f"   ✅ ROC-AUC:   {metrics['roc_auc']:.4f}")
            print(f"   ⏱️  Time:     {train_time:.2f}s")
        
        # Find best model
        self._select_best_model()
        
        # Store test data for later analysis
        self.X_test = X_test
        self.y_test = y_test
        
        return self.results
    
    def _evaluate_model(self, y_true, y_pred, y_prob) -> Dict:
        """Calculate evaluation metrics"""
        return {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred),
            'recall': recall_score(y_true, y_pred),
            'f1': f1_score(y_true, y_pred),
            'roc_auc': roc_auc_score(y_true, y_prob),
            'confusion_matrix': confusion_matrix(y_true, y_pred).tolist()
        }
    
    def _select_best_model(self):
        """Select the best performing model based on F1 score"""
        best_f1 = 0
        for name, metrics in self.results.items():
            if metrics['f1'] > best_f1:
                best_f1 = metrics['f1']
                self.best_model_name = name
                self.best_model = self.models[name]
        
        print(f"\n{'='*60}")
        print(f"🏆 BEST MODEL: {self.best_model_name}")
        print(f"   F1 Score: {best_f1:.4f}")
        print(f"{'='*60}")
    
    def train_anomaly_detector(self, X: pd.DataFrame) -> IsolationForest:
        """Train Isolation Forest for anomaly detection (unsupervised)"""
        print("\n🔍 Training Anomaly Detector (Isolation Forest)...")
        
        X_scaled = self.scaler.fit_transform(X)
        
        iso_forest = IsolationForest(
            n_estimators=100,
            contamination=0.15,  # Expected proportion of anomalies
            random_state=RANDOM_SEED,
            n_jobs=-1
        )
        
        iso_forest.fit(X_scaled)
        self.models['Isolation Forest'] = iso_forest
        
        # Get anomaly scores
        scores = iso_forest.decision_function(X_scaled)
        predictions = iso_forest.predict(X_scaled)
        
        anomalies = (predictions == -1).sum()
        print(f"   Detected {anomalies:,} anomalies ({anomalies/len(X)*100:.1f}%)")
        
        return iso_forest
    
    def get_feature_importance(self, model_name: str = None) -> pd.DataFrame:
        """Get feature importance from tree-based models"""
        if model_name is None:
            model_name = self.best_model_name
            
        model = self.models.get(model_name)
        
        if hasattr(model, 'feature_importances_'):
            importance = pd.DataFrame({
                'feature': FEATURE_COLUMNS[:len(model.feature_importances_)],
                'importance': model.feature_importances_
            }).sort_values('importance', ascending=False)
            
            print(f"\n📊 Feature Importance ({model_name}):")
            print(importance.head(10).to_string(index=False))
            
            return importance
        else:
            print(f"   ⚠️  {model_name} doesn't support feature importance")
            return None
    
    def save_model(self, model_name: str = None, path: str = MODEL_SAVE_PATH):
        """Save trained model to disk"""
        if model_name is None:
            model_name = self.best_model_name
            
        os.makedirs(path, exist_ok=True)
        
        model = self.models[model_name]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save model
        model_path = os.path.join(path, f"{model_name.lower().replace(' ', '_')}_{timestamp}.pkl")
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        
        # Save scaler
        scaler_path = os.path.join(path, f"scaler_{timestamp}.pkl")
        with open(scaler_path, 'wb') as f:
            pickle.dump(self.scaler, f)
        
        # Save metadata
        metadata = {
            'model_name': model_name,
            'timestamp': timestamp,
            'features': FEATURE_COLUMNS,
            'metrics': self.results[model_name]
        }
        metadata_path = os.path.join(path, f"metadata_{timestamp}.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n💾 Model saved:")
        print(f"   Model: {model_path}")
        print(f"   Scaler: {scaler_path}")
        print(f"   Metadata: {metadata_path}")
        
        return model_path
    
    def load_model(self, model_path: str, scaler_path: str):
        """Load a saved model from disk"""
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        with open(scaler_path, 'rb') as f:
            self.scaler = pickle.load(f)
        
        self.best_model = model
        print(f"✅ Model loaded from {model_path}")
        
        return model
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Make predictions using the best model"""
        if self.best_model is None:
            raise ValueError("No model trained yet!")
        
        # Use scaler for neural network
        if self.best_model_name == 'Neural Network':
            X_scaled = self.scaler.transform(X)
            return self.best_model.predict(X_scaled)
        
        return self.best_model.predict(X)
    
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Get prediction probabilities"""
        if self.best_model is None:
            raise ValueError("No model trained yet!")
        
        if self.best_model_name == 'Neural Network':
            X_scaled = self.scaler.transform(X)
            return self.best_model.predict_proba(X_scaled)
        
        return self.best_model.predict_proba(X)
    
    def print_summary(self):
        """Print summary of all trained models"""
        print("\n" + "="*70)
        print("📊 MODEL COMPARISON SUMMARY")
        print("="*70)
        
        summary_df = pd.DataFrame(self.results).T
        summary_df = summary_df[['accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'train_time_sec']]
        summary_df = summary_df.round(4)
        
        print(summary_df.to_string())
        print(f"\n🏆 Best Model: {self.best_model_name} (F1: {self.results[self.best_model_name]['f1']:.4f})")


# ============================================
# CHEAT TYPE CLASSIFIER (Multi-class)
# ============================================

class CheatTypeClassifier:
    """Classify the specific type of cheat used"""
    
    def __init__(self):
        self.model = None
        self.label_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        
    def train(self, X: pd.DataFrame, y_cheat_type: pd.Series):
        """Train multi-class classifier for cheat types"""
        print("\n🎯 Training Cheat Type Classifier...")
        
        # Filter only cheater samples
        cheater_mask = y_cheat_type != 'none'
        X_cheaters = X[cheater_mask]
        y_types = y_cheat_type[cheater_mask]
        
        if len(X_cheaters) < 10:
            print("   ⚠️  Not enough cheater samples for training")
            return None
        
        # Encode labels
        y_encoded = self.label_encoder.fit_transform(y_types)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_cheaters, y_encoded, test_size=0.2, random_state=RANDOM_SEED
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=RANDOM_SEED,
            n_jobs=-1
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"   ✅ Cheat Type Classification Accuracy: {accuracy:.4f}")
        print(f"\n   Classification Report:")
        print(classification_report(
            y_test, y_pred,
            target_names=self.label_encoder.classes_
        ))
        
        return self.model
    
    def predict_cheat_type(self, X: pd.DataFrame) -> List[str]:
        """Predict the type of cheat"""
        if self.model is None:
            raise ValueError("Model not trained!")
        
        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)
        return self.label_encoder.inverse_transform(predictions)


# ============================================
# MAIN TRAINING SCRIPT
# ============================================

def main():
    """Main training pipeline"""
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║     🛡️  ARES ANTICHEAT - ML TRAINING PIPELINE  🛡️        ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    # 1. Load Data
    loader = DataLoader()
    
    # Try to load from MongoDB first
    try:
        df = loader.load_from_mongodb(collection='ml_training_data', limit=50000)
    except Exception as e:
        print(f"   ⚠️  MongoDB error: {e}")
        print("   📝 Please run ml_data_generator.py first to generate training data")
        return
    
    # 2. Preprocess
    X, y_binary, y_cheat_type = loader.preprocess(df)
    
    if len(X) < 100:
        print("\n❌ Not enough data for training. Need at least 100 samples.")
        print("   Run: python ml_data_generator.py")
        return
    
    # 3. Train Models
    detector = CheatDetectorML()
    results = detector.train_all_models(X, y_binary)
    
    # 4. Feature Importance
    detector.get_feature_importance()
    
    # 5. Train Cheat Type Classifier (if cheat types available)
    if y_cheat_type is not None:
        type_classifier = CheatTypeClassifier()
        type_classifier.train(X, y_cheat_type)
    
    # 6. Summary
    detector.print_summary()
    
    # 7. Save Best Model
    detector.save_model()
    
    print("\n✅ Training complete!")


if __name__ == "__main__":
    main()
