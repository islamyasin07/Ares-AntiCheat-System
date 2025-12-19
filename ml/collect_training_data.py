"""
Ares AntiCheat - Direct ML Training Data Collector
==================================================
Collects data directly to MongoDB for ML training (bypassing Kafka/Spark).
Use this to quickly generate labeled training data.

Author: Ares Team
Version: 1.0
"""

import time
import json
import random
import math
import uuid
from datetime import datetime, timedelta
from pymongo import MongoClient
from typing import Dict, List
from dataclasses import dataclass
from enum import Enum

# ============================================
# CONFIGURATION
# ============================================

MONGO_URI = 'mongodb://localhost:27018'
DB_NAME = 'ares_anticheat'
COLLECTION_NAME = 'ml_training_data'

TOTAL_SAMPLES = 10000  # Total training samples to generate
CHEATER_PERCENTAGE = 0.15

# ============================================
# ENUMS
# ============================================

class CheatType(Enum):
    NONE = "none"
    AIMBOT = "aimbot"
    NO_RECOIL = "no_recoil"
    SPEED_HACK = "speed_hack"
    WALL_HACK = "wall_hack"
    TRIGGER_BOT = "trigger_bot"
    SOFT_AIM = "soft_aim"

class PlayerSkillLevel(Enum):
    NOOB = "noob"
    CASUAL = "casual"
    AVERAGE = "average"
    SKILLED = "skilled"
    PRO = "pro"

# ============================================
# BEHAVIOR PROFILES
# ============================================

@dataclass
class BehaviorProfile:
    base_accuracy: float
    accuracy_variance: float
    headshot_ratio: float
    headshot_variance: float
    avg_reaction_time_ms: float
    reaction_time_variance: float
    snap_angle_mean: float
    snap_angle_std: float
    tracking_smoothness: float
    flick_frequency: float
    recoil_control: float
    spray_pattern_consistency: float
    avg_movement_speed: float
    movement_variance: float
    kills_per_minute: float

# Legitimate profiles
LEGIT_PROFILES = {
    PlayerSkillLevel.NOOB: BehaviorProfile(0.15, 0.08, 0.08, 0.05, 450, 100, 15, 10, 0.3, 0.05, 0.2, 0.2, 180, 40, 0.3),
    PlayerSkillLevel.CASUAL: BehaviorProfile(0.25, 0.07, 0.15, 0.06, 350, 80, 25, 12, 0.45, 0.1, 0.35, 0.35, 200, 35, 0.6),
    PlayerSkillLevel.AVERAGE: BehaviorProfile(0.35, 0.06, 0.22, 0.06, 280, 60, 35, 15, 0.55, 0.15, 0.5, 0.5, 220, 30, 1.0),
    PlayerSkillLevel.SKILLED: BehaviorProfile(0.45, 0.05, 0.32, 0.07, 220, 40, 45, 18, 0.7, 0.25, 0.7, 0.65, 240, 25, 1.5),
    PlayerSkillLevel.PRO: BehaviorProfile(0.55, 0.04, 0.42, 0.08, 180, 30, 55, 20, 0.85, 0.35, 0.85, 0.8, 260, 20, 2.2),
}

# Cheater profiles
CHEATER_PROFILES = {
    CheatType.AIMBOT: BehaviorProfile(0.85, 0.03, 0.78, 0.05, 80, 15, 85, 8, 0.15, 0.7, 0.6, 0.5, 230, 30, 3.5),
    CheatType.SOFT_AIM: BehaviorProfile(0.62, 0.05, 0.48, 0.08, 150, 35, 55, 15, 0.5, 0.35, 0.7, 0.6, 235, 28, 2.0),
    CheatType.NO_RECOIL: BehaviorProfile(0.55, 0.04, 0.30, 0.06, 230, 50, 40, 18, 0.6, 0.2, 0.98, 0.95, 225, 30, 1.8),
    CheatType.SPEED_HACK: BehaviorProfile(0.38, 0.06, 0.25, 0.07, 260, 55, 38, 16, 0.55, 0.18, 0.55, 0.5, 450, 80, 1.6),
    CheatType.WALL_HACK: BehaviorProfile(0.42, 0.05, 0.28, 0.06, 120, 25, 30, 12, 0.65, 0.12, 0.6, 0.55, 235, 30, 2.0),
    CheatType.TRIGGER_BOT: BehaviorProfile(0.70, 0.04, 0.35, 0.06, 50, 10, 35, 15, 0.6, 0.2, 0.55, 0.5, 225, 30, 1.9),
}

# ============================================
# DATA GENERATOR
# ============================================

class MLTrainingDataGenerator:
    def __init__(self):
        self.client = MongoClient(MONGO_URI)
        self.db = self.client[DB_NAME]
        self.collection = self.db[COLLECTION_NAME]
        
    def _add_noise(self, value: float, variance: float) -> float:
        return max(0, value + random.gauss(0, variance))
    
    def _clamp(self, value: float, min_val: float, max_val: float) -> float:
        return max(min_val, min(max_val, value))
    
    def generate_sample(self, is_cheater: bool, cheat_type: CheatType = CheatType.NONE, 
                       skill_level: PlayerSkillLevel = None) -> Dict:
        """Generate a single training sample with all features"""
        
        if is_cheater:
            profile = CHEATER_PROFILES[cheat_type]
        else:
            if skill_level is None:
                skill_level = random.choice(list(PlayerSkillLevel))
            profile = LEGIT_PROFILES[skill_level]
        
        p = profile
        
        # Generate all features
        sample = {
            # Identifiers
            "sample_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            
            # ============ ML LABELS ============
            "is_cheater": is_cheater,
            "cheat_type": cheat_type.value,
            "skill_level": skill_level.value if skill_level else "cheater",
            
            # ============ AIM FEATURES ============
            "aim_snap_angle": round(self._clamp(random.gauss(p.snap_angle_mean, p.snap_angle_std), 0, 180), 2),
            "aim_snap_speed": round(self._add_noise(p.snap_angle_mean * 2, 20), 2),
            "tracking_smoothness": round(self._clamp(self._add_noise(p.tracking_smoothness, 0.1), 0, 1), 3),
            "is_flick_shot": random.random() < p.flick_frequency,
            "time_to_target_ms": round(max(10, self._add_noise(p.avg_reaction_time_ms * 0.5, 30)), 1),
            "aim_linearity": round(self._clamp(0.9 if is_cheater and cheat_type == CheatType.AIMBOT else random.uniform(0.3, 0.7), 0, 1), 3),
            "acceleration_variance": round(0.1 if is_cheater else random.uniform(0.3, 0.6), 3),
            "aim_corrections_count": random.randint(0, 2) if is_cheater else random.randint(2, 8),
            
            # ============ SHOOTING FEATURES ============
            "session_accuracy": round(self._clamp(self._add_noise(p.base_accuracy, p.accuracy_variance), 0, 1), 3),
            "session_headshot_ratio": round(self._clamp(self._add_noise(p.headshot_ratio, p.headshot_variance), 0, 1), 3),
            "recoil_recovery_score": round(self._clamp(self._add_noise(p.recoil_control, 0.05), 0, 1), 3),
            "spray_pattern_score": round(self._clamp(self._add_noise(p.spray_pattern_consistency, 0.08), 0, 1), 3),
            "time_between_shots_ms": round(random.uniform(55, 70) if is_cheater else random.uniform(60, 150), 1),
            "first_shot_accuracy": round(self._clamp(self._add_noise(p.base_accuracy + 0.15, 0.05), 0, 1), 3),
            "spray_transfer_speed": round(random.uniform(0.7, 0.95) if is_cheater else random.uniform(0.3, 0.8), 3),
            
            # ============ REACTION & KILL FEATURES ============
            "reaction_time_ms": round(max(30, self._add_noise(p.avg_reaction_time_ms, p.reaction_time_variance)), 1),
            "time_to_kill_ms": round(random.uniform(100, 500) if is_cheater else random.uniform(200, 2000), 1),
            "kills_per_minute": round(self._add_noise(p.kills_per_minute, 0.3), 2),
            "deaths_per_minute": round(random.uniform(0.2, 0.5) if is_cheater else random.uniform(0.5, 1.5), 2),
            "session_kd_ratio": round(random.uniform(2, 10) if is_cheater else random.uniform(0.5, 2.5), 2),
            
            # ============ MOVEMENT FEATURES ============
            "movement_speed": round(self._add_noise(p.avg_movement_speed, p.movement_variance), 2),
            "direction_changes_per_sec": round(random.uniform(2, 6) if is_cheater else random.uniform(0.5, 3), 2),
            
            # ============ ADDITIONAL FEATURES ============
            "shots_fired": random.randint(50, 500),
            "hits": 0,  # Calculated below
            "headshots": 0,  # Calculated below
            "through_smoke_kills": random.randint(1, 5) if is_cheater and cheat_type == CheatType.WALL_HACK else random.randint(0, 1),
            "prefiring_frequency": round(random.uniform(0.3, 0.6) if is_cheater and cheat_type == CheatType.WALL_HACK else random.uniform(0.05, 0.2), 3),
        }
        
        # Calculate derived features
        sample["hits"] = int(sample["shots_fired"] * sample["session_accuracy"])
        sample["headshots"] = int(sample["hits"] * sample["session_headshot_ratio"])
        
        return sample
    
    def generate_dataset(self, num_samples: int = TOTAL_SAMPLES):
        """Generate complete training dataset"""
        print(f"""
    ╔═══════════════════════════════════════════════════════════╗
    ║   🛡️  ARES - ML TRAINING DATA COLLECTOR  🛡️              ║
    ╚═══════════════════════════════════════════════════════════╝
        """)
        
        # Clear existing training data
        self.collection.delete_many({})
        print(f"🗑️  Cleared existing training data")
        
        num_cheaters = int(num_samples * CHEATER_PERCENTAGE)
        num_legit = num_samples - num_cheaters
        
        print(f"\n📊 Generating {num_samples:,} training samples:")
        print(f"   - Legitimate: {num_legit:,} ({100-CHEATER_PERCENTAGE*100:.0f}%)")
        print(f"   - Cheaters: {num_cheaters:,} ({CHEATER_PERCENTAGE*100:.0f}%)")
        
        samples = []
        cheat_types = [CheatType.AIMBOT, CheatType.SOFT_AIM, CheatType.NO_RECOIL, 
                      CheatType.SPEED_HACK, CheatType.WALL_HACK, CheatType.TRIGGER_BOT]
        
        # Generate legitimate samples
        print(f"\n🎮 Generating legitimate player samples...")
        for i in range(num_legit):
            skill = random.choice(list(PlayerSkillLevel))
            sample = self.generate_sample(is_cheater=False, skill_level=skill)
            samples.append(sample)
            
            if (i + 1) % 1000 == 0:
                print(f"   Generated {i+1:,}/{num_legit:,} legitimate samples")
        
        # Generate cheater samples
        print(f"\n🚨 Generating cheater samples...")
        cheat_distribution = {}
        for i in range(num_cheaters):
            cheat_type = random.choice(cheat_types)
            sample = self.generate_sample(is_cheater=True, cheat_type=cheat_type)
            samples.append(sample)
            
            cheat_distribution[cheat_type.value] = cheat_distribution.get(cheat_type.value, 0) + 1
            
            if (i + 1) % 200 == 0:
                print(f"   Generated {i+1:,}/{num_cheaters:,} cheater samples")
        
        # Shuffle samples
        random.shuffle(samples)
        
        # Insert to MongoDB
        print(f"\n💾 Inserting to MongoDB...")
        self.collection.insert_many(samples)
        
        print(f"\n✅ Dataset generation complete!")
        print(f"   - Total samples: {len(samples):,}")
        print(f"   - Collection: {DB_NAME}.{COLLECTION_NAME}")
        print(f"   - Cheat distribution: {cheat_distribution}")
        
        # Verify
        count = self.collection.count_documents({})
        cheater_count = self.collection.count_documents({"is_cheater": True})
        print(f"\n📈 Verification:")
        print(f"   - Documents in collection: {count:,}")
        print(f"   - Cheater documents: {cheater_count:,}")
        
        return samples


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    generator = MLTrainingDataGenerator()
    generator.generate_dataset(num_samples=10000)
