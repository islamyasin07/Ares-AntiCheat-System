"""
Ares AntiCheat - Kafka to ML Pipeline
=====================================
Consumes events from Kafka, calls ML service for predictions, 
and writes results to MongoDB.

This replaces the Spark pipeline for ML-based detection.

Author: Ares Team
Version: 1.0
"""

import json
import time
import os
import requests
from datetime import datetime
from kafka import KafkaConsumer
from pymongo import MongoClient
from typing import Dict, List
import threading
from queue import Queue

# ============================================
# CONFIGURATION
# ============================================

KAFKA_BOOTSTRAP_SERVERS = 'localhost:9092'
KAFKA_TOPIC = 'player-events'
KAFKA_GROUP_ID = os.getenv('KAFKA_GROUP_ID', 'ares-ml-consumer-debug')

MONGO_URI = 'mongodb://localhost:27018'
DB_NAME = 'ares_anticheat'

ML_SERVICE_URL = 'http://localhost:8000'

BATCH_SIZE = 50  # Process events in batches
BATCH_TIMEOUT_SEC = 2  # Max wait time for batch

# ============================================
# ML KAFKA CONSUMER
# ============================================

class MLKafkaConsumer:
    def __init__(self):
        # Kafka Consumer
        self.consumer = KafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=KAFKA_GROUP_ID,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True
        )
        
        # MongoDB
        self.mongo_client = MongoClient(MONGO_URI)
        self.db = self.mongo_client[DB_NAME]
        self.events_collection = self.db['events_raw']
        self.detections_collection = self.db['ml_detections']
        
        # Stats
        self.events_processed = 0
        self.cheaters_detected = 0
        self.start_time = datetime.now()
        
    def check_ml_service(self) -> bool:
        """Check if ML service is running"""
        try:
            response = requests.get(f"{ML_SERVICE_URL}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def predict_event(self, event: Dict) -> Dict:
        """Send event to ML service for prediction"""
        try:
            # Map event fields to ML model expected fields
            ml_request = {
                "player_id": event.get("player_id", event.get("playerId", "unknown")),
                "aim_snap_angle": event.get("aim_snap_angle", event.get("speed", 30)),
                "aim_snap_speed": event.get("aim_snap_speed", event.get("speed", 0) * 2),
                "tracking_smoothness": event.get("tracking_smoothness", 0.5),
                "is_flick_shot": event.get("is_flick_shot", event.get("isFlick", False)),
                "time_to_target_ms": event.get("time_to_target_ms", 200),
                "aim_linearity": event.get("aim_linearity", 0.5),
                "acceleration_variance": event.get("acceleration_variance", 0.4),
                "aim_corrections_count": event.get("aim_corrections_count", 4),
                "recoil_recovery_score": event.get("recoil_recovery_score", 0.5),
                "spray_pattern_score": event.get("spray_pattern_score", 0.5),
                "time_between_shots_ms": event.get("time_between_shots_ms", 100),
                "first_shot_accuracy": event.get("first_shot_accuracy", 0.5),
                "spray_transfer_speed": event.get("spray_transfer_speed", 0.5),
                "session_accuracy": event.get("session_accuracy", 0.35),
                "session_headshot_ratio": event.get("session_headshot_ratio", 0.2),
                "kills_per_minute": event.get("kills_per_minute", 1.0),
                "deaths_per_minute": event.get("deaths_per_minute", 0.8),
                "session_kd_ratio": event.get("session_kd_ratio", 1.2),
                "movement_speed": event.get("movement_speed", 220),
                "direction_changes_per_sec": event.get("direction_changes_per_sec", 1.5),
                "reaction_time_ms": event.get("reaction_time_ms", 250),
                "time_to_kill_ms": event.get("time_to_kill_ms", 500),
            }
            
            response = requests.post(
                f"{ML_SERVICE_URL}/predict",
                json=ml_request,
                timeout=5
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
                
        except Exception as e:
            print(f"   ⚠️  ML prediction error: {e}")
            return None
    
    def process_event(self, event: Dict) -> Dict:
        """Process single event with ML prediction"""
        # Get ML prediction
        prediction = self.predict_event(event)
        
        # Combine event with prediction
        result = {
            **event,
            "processed_at": datetime.now().isoformat(),
            "ml_prediction": prediction
        }
        
        if prediction:
            result["is_cheater_ml"] = prediction.get("is_cheater", False)
            result["cheat_probability"] = prediction.get("cheat_probability", 0)
            result["risk_level"] = prediction.get("risk_level", "low")
            result["ml_confidence"] = prediction.get("confidence", 0)
        
        return result
    
    def save_to_mongo(self, events: List[Dict], detections: List[Dict]):
        """Save events and detections to MongoDB with defensive logging"""
        if events:
            try:
                print(f"   [Mongo] inserting {len(events)} events...")
                self.events_collection.insert_many(events)
                print("   [Mongo] events inserted")
            except Exception as e:
                print(f"   [Mongo ERR] events insert failed: {e}")
                # Fallback: try single inserts to find problematic document
                for ev in events:
                    try:
                        self.events_collection.insert_one(ev)
                    except Exception as ee:
                        print(f"   [Mongo ERR] failed insert one: {ee} | ev_id={ev.get('event_id') or ev.get('player_id')}")
        
        if detections:
            try:
                print(f"   [Mongo] inserting {len(detections)} detections...")
                self.detections_collection.insert_many(detections)
                print("   [Mongo] detections inserted")
            except Exception as e:
                print(f"   [Mongo ERR] detections insert failed: {e}")
                for d in detections:
                    try:
                        self.detections_collection.insert_one(d)
                    except Exception as ee:
                        print(f"   [Mongo ERR] failed insert detection: {ee} | player={d.get('player_id')}")
    
    def run(self):
        """Main consumer loop"""
        print(f"""
    ╔═══════════════════════════════════════════════════════════╗
    ║    🛡️  ARES ML KAFKA CONSUMER  🛡️                        ║
    ╚═══════════════════════════════════════════════════════════╝
        """)
        
        # Check ML service
        if not self.check_ml_service():
            print("❌ ML Service not running! Start it with:")
            print("   cd ml && python prediction_service.py")
            return
        
        print("✅ ML Service connected")
        print(f"📡 Kafka: {KAFKA_BOOTSTRAP_SERVERS} / {KAFKA_TOPIC}")
        print(f"💾 MongoDB: {MONGO_URI} / {DB_NAME}")
        print(f"\n🚀 Starting consumer...\n")
        
        batch_events = []
        batch_detections = []
        last_batch_time = time.time()
        
        try:
            for message in self.consumer:
                event = message.value
                
                # Process with ML
                result = self.process_event(event)
                self.events_processed += 1
                
                # Debug: print prediction summary
                try:
                    print(f"   [ML] {result.get('player_id', result.get('playerId', 'unknown'))} -> is_cheater_ml={result.get('is_cheater_ml')} prob={result.get('cheat_probability')} risk={result.get('risk_level')}")
                except Exception as e:
                    print(f"   [ML DEBUG ERR] {e}")

                # Always record ML prediction into ml_detections so the UI can show ML scores
                ml_doc = {
                    "player_id": result.get("player_id", result.get("playerId")),
                    "timestamp": result.get("timestamp"),
                    "detected_at": datetime.now().isoformat(),
                    "cheat_probability": result.get("cheat_probability", 0),
                    "risk_level": result.get("risk_level"),
                    "confidence": result.get("ml_confidence"),
                    "ruleTriggered": "ML-Detection" if result.get("is_cheater_ml", False) else "ML-Score",
                    "source": "ml_model",
                    "is_cheater_ml": bool(result.get("is_cheater_ml", False)),
                    "event_data": event
                }

                batch_detections.append(ml_doc)

                # If an actual cheater was detected, increment counters and highlight
                if result.get("is_cheater_ml", False):
                    self.cheaters_detected += 1
                    player = result.get("player_id", result.get("playerId", "unknown"))
                    prob = result.get("cheat_probability", 0)
                    risk = result.get("risk_level", "unknown")
                    print(f"   🚨 CHEATER DETECTED: {player} | Probability: {prob:.2f} | Risk: {risk}")
                
                # Batch insert
                current_time = time.time()
                if len(batch_events) >= BATCH_SIZE or (current_time - last_batch_time) >= BATCH_TIMEOUT_SEC:
                    self.save_to_mongo(batch_events, batch_detections)
                    
                    # Stats
                    elapsed = (datetime.now() - self.start_time).seconds or 1
                    rate = self.events_processed / elapsed
                    print(f"📊 Processed: {self.events_processed:,} | "
                          f"Cheaters: {self.cheaters_detected} | "
                          f"Rate: {rate:.1f}/sec")
                    
                    batch_events = []
                    batch_detections = []
                    last_batch_time = current_time
                    
        except KeyboardInterrupt:
            print(f"\n\n⏹️  Stopping consumer...")
            print(f"   Total processed: {self.events_processed:,}")
            print(f"   Total cheaters: {self.cheaters_detected}")
            
            # Save remaining batch
            if batch_events:
                self.save_to_mongo(batch_events, batch_detections)
            
            self.consumer.close()
            self.mongo_client.close()


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    consumer = MLKafkaConsumer()
    consumer.run()
