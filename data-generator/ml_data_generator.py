"""
Ares AntiCheat - ML-Ready Data Generator
=========================================
Generates rich behavioral data for Machine Learning model training.
Produces labeled events with realistic cheater/legitimate patterns.

Features Generated:
- Aim mechanics (snap angles, tracking smoothness, flick patterns)
- Shooting stats (headshot ratio, accuracy, spray control)
- Movement patterns (speed, acceleration, position changes)
- Reaction times and kill patterns
- Session behavior (playtime, consistency)

Author: Ares Team
Version: 2.0 (ML Edition)
"""

import time
import json
import random
import math
import uuid
from datetime import datetime, timedelta
from kafka import KafkaProducer
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum

# ============================================
# CONFIGURATION
# ============================================

KAFKA_BOOTSTRAP_SERVERS = 'localhost:9092'
KAFKA_TOPIC = 'player-events'
EVENTS_PER_SECOND = 50
TOTAL_PLAYERS = 100
CHEATER_PERCENTAGE = 0.15  # 15% cheaters for balanced training

# ============================================
# ENUMS & TYPES
# ============================================

class CheatType(Enum):
    NONE = "none"
    AIMBOT = "aimbot"
    NO_RECOIL = "no_recoil"
    SPEED_HACK = "speed_hack"
    WALL_HACK = "wall_hack"
    TRIGGER_BOT = "trigger_bot"
    SOFT_AIM = "soft_aim"  # Subtle aimbot

class PlayerSkillLevel(Enum):
    NOOB = "noob"
    CASUAL = "casual"
    AVERAGE = "average"
    SKILLED = "skilled"
    PRO = "pro"

# ============================================
# PLAYER BEHAVIOR PROFILES
# ============================================

@dataclass
class BehaviorProfile:
    """Defines realistic behavior ranges for different player types"""
    # Aim characteristics
    base_accuracy: float
    accuracy_variance: float
    headshot_ratio: float
    headshot_variance: float
    avg_reaction_time_ms: float
    reaction_time_variance: float
    
    # Aim snap/flick characteristics
    snap_angle_mean: float
    snap_angle_std: float
    tracking_smoothness: float  # 0-1, higher = smoother
    flick_frequency: float  # 0-1, how often they flick
    
    # Recoil control
    recoil_control: float  # 0-1, higher = better control
    spray_pattern_consistency: float
    
    # Movement
    avg_movement_speed: float
    movement_variance: float
    strafe_frequency: float
    
    # Session behavior
    kills_per_minute: float
    deaths_per_minute: float
    avg_engagement_distance: float


# Legitimate player profiles by skill level
LEGIT_PROFILES = {
    PlayerSkillLevel.NOOB: BehaviorProfile(
        base_accuracy=0.15, accuracy_variance=0.08,
        headshot_ratio=0.08, headshot_variance=0.05,
        avg_reaction_time_ms=450, reaction_time_variance=100,
        snap_angle_mean=15, snap_angle_std=10,
        tracking_smoothness=0.3, flick_frequency=0.05,
        recoil_control=0.2, spray_pattern_consistency=0.2,
        avg_movement_speed=180, movement_variance=40,
        strafe_frequency=0.1,
        kills_per_minute=0.3, deaths_per_minute=1.2,
        avg_engagement_distance=15
    ),
    PlayerSkillLevel.CASUAL: BehaviorProfile(
        base_accuracy=0.25, accuracy_variance=0.07,
        headshot_ratio=0.15, headshot_variance=0.06,
        avg_reaction_time_ms=350, reaction_time_variance=80,
        snap_angle_mean=25, snap_angle_std=12,
        tracking_smoothness=0.45, flick_frequency=0.1,
        recoil_control=0.35, spray_pattern_consistency=0.35,
        avg_movement_speed=200, movement_variance=35,
        strafe_frequency=0.2,
        kills_per_minute=0.6, deaths_per_minute=0.9,
        avg_engagement_distance=20
    ),
    PlayerSkillLevel.AVERAGE: BehaviorProfile(
        base_accuracy=0.35, accuracy_variance=0.06,
        headshot_ratio=0.22, headshot_variance=0.06,
        avg_reaction_time_ms=280, reaction_time_variance=60,
        snap_angle_mean=35, snap_angle_std=15,
        tracking_smoothness=0.55, flick_frequency=0.15,
        recoil_control=0.5, spray_pattern_consistency=0.5,
        avg_movement_speed=220, movement_variance=30,
        strafe_frequency=0.35,
        kills_per_minute=1.0, deaths_per_minute=0.8,
        avg_engagement_distance=25
    ),
    PlayerSkillLevel.SKILLED: BehaviorProfile(
        base_accuracy=0.45, accuracy_variance=0.05,
        headshot_ratio=0.32, headshot_variance=0.07,
        avg_reaction_time_ms=220, reaction_time_variance=40,
        snap_angle_mean=45, snap_angle_std=18,
        tracking_smoothness=0.7, flick_frequency=0.25,
        recoil_control=0.7, spray_pattern_consistency=0.65,
        avg_movement_speed=240, movement_variance=25,
        strafe_frequency=0.5,
        kills_per_minute=1.5, deaths_per_minute=0.6,
        avg_engagement_distance=30
    ),
    PlayerSkillLevel.PRO: BehaviorProfile(
        base_accuracy=0.55, accuracy_variance=0.04,
        headshot_ratio=0.42, headshot_variance=0.08,
        avg_reaction_time_ms=180, reaction_time_variance=30,
        snap_angle_mean=55, snap_angle_std=20,
        tracking_smoothness=0.85, flick_frequency=0.35,
        recoil_control=0.85, spray_pattern_consistency=0.8,
        avg_movement_speed=260, movement_variance=20,
        strafe_frequency=0.65,
        kills_per_minute=2.2, deaths_per_minute=0.5,
        avg_engagement_distance=35
    )
}

# Cheater profiles by cheat type
CHEATER_PROFILES = {
    CheatType.AIMBOT: BehaviorProfile(
        base_accuracy=0.85, accuracy_variance=0.03,  # Unnaturally high & consistent
        headshot_ratio=0.78, headshot_variance=0.05,  # Very high headshots
        avg_reaction_time_ms=80, reaction_time_variance=15,  # Inhuman reaction
        snap_angle_mean=85, snap_angle_std=8,  # Sharp snaps to targets
        tracking_smoothness=0.15, flick_frequency=0.7,  # Jerky, lots of flicks
        recoil_control=0.6, spray_pattern_consistency=0.5,
        avg_movement_speed=230, movement_variance=30,
        strafe_frequency=0.3,
        kills_per_minute=3.5, deaths_per_minute=0.3,
        avg_engagement_distance=45  # Kills from far away
    ),
    CheatType.SOFT_AIM: BehaviorProfile(
        base_accuracy=0.62, accuracy_variance=0.05,  # High but less obvious
        headshot_ratio=0.48, headshot_variance=0.08,
        avg_reaction_time_ms=150, reaction_time_variance=35,
        snap_angle_mean=55, snap_angle_std=15,  # More natural looking
        tracking_smoothness=0.5, flick_frequency=0.35,
        recoil_control=0.7, spray_pattern_consistency=0.6,
        avg_movement_speed=235, movement_variance=28,
        strafe_frequency=0.4,
        kills_per_minute=2.0, deaths_per_minute=0.5,
        avg_engagement_distance=35
    ),
    CheatType.NO_RECOIL: BehaviorProfile(
        base_accuracy=0.55, accuracy_variance=0.04,
        headshot_ratio=0.30, headshot_variance=0.06,
        avg_reaction_time_ms=230, reaction_time_variance=50,
        snap_angle_mean=40, snap_angle_std=18,
        tracking_smoothness=0.6, flick_frequency=0.2,
        recoil_control=0.98, spray_pattern_consistency=0.95,  # Perfect recoil control
        avg_movement_speed=225, movement_variance=30,
        strafe_frequency=0.35,
        kills_per_minute=1.8, deaths_per_minute=0.55,
        avg_engagement_distance=28
    ),
    CheatType.SPEED_HACK: BehaviorProfile(
        base_accuracy=0.38, accuracy_variance=0.06,
        headshot_ratio=0.25, headshot_variance=0.07,
        avg_reaction_time_ms=260, reaction_time_variance=55,
        snap_angle_mean=38, snap_angle_std=16,
        tracking_smoothness=0.55, flick_frequency=0.18,
        recoil_control=0.55, spray_pattern_consistency=0.5,
        avg_movement_speed=450, movement_variance=80,  # Way too fast
        strafe_frequency=0.8,  # Constant movement
        kills_per_minute=1.6, deaths_per_minute=0.4,
        avg_engagement_distance=22
    ),
    CheatType.WALL_HACK: BehaviorProfile(
        base_accuracy=0.42, accuracy_variance=0.05,
        headshot_ratio=0.28, headshot_variance=0.06,
        avg_reaction_time_ms=120, reaction_time_variance=25,  # Pre-aims = fast reaction
        snap_angle_mean=30, snap_angle_std=12,  # Already looking at target
        tracking_smoothness=0.65, flick_frequency=0.12,  # Less need to flick
        recoil_control=0.6, spray_pattern_consistency=0.55,
        avg_movement_speed=235, movement_variance=30,
        strafe_frequency=0.45,
        kills_per_minute=2.0, deaths_per_minute=0.45,
        avg_engagement_distance=32
    ),
    CheatType.TRIGGER_BOT: BehaviorProfile(
        base_accuracy=0.70, accuracy_variance=0.04,  # High accuracy when shooting
        headshot_ratio=0.35, headshot_variance=0.06,
        avg_reaction_time_ms=50, reaction_time_variance=10,  # Instant trigger
        snap_angle_mean=35, snap_angle_std=15,
        tracking_smoothness=0.6, flick_frequency=0.2,
        recoil_control=0.55, spray_pattern_consistency=0.5,
        avg_movement_speed=225, movement_variance=30,
        strafe_frequency=0.35,
        kills_per_minute=1.9, deaths_per_minute=0.5,
        avg_engagement_distance=28
    )
}

# ============================================
# PLAYER CLASS
# ============================================

class Player:
    def __init__(self, player_id: str, is_cheater: bool = False, cheat_type: CheatType = CheatType.NONE):
        self.player_id = player_id
        self.is_cheater = is_cheater
        self.cheat_type = cheat_type
        
        # Assign skill level for legit players
        if not is_cheater:
            self.skill_level = random.choice(list(PlayerSkillLevel))
            self.profile = LEGIT_PROFILES[self.skill_level]
        else:
            self.skill_level = None
            self.profile = CHEATER_PROFILES[cheat_type]
        
        # Session stats
        self.session_start = datetime.now()
        self.total_shots = 0
        self.total_hits = 0
        self.total_headshots = 0
        self.total_kills = 0
        self.total_deaths = 0
        self.position = {"x": random.uniform(0, 1000), "y": random.uniform(0, 1000), "z": 0}
        self.last_aim_angle = 0
        
    def _add_noise(self, value: float, variance: float) -> float:
        """Add realistic variance to a value"""
        return max(0, value + random.gauss(0, variance))
    
    def _clamp(self, value: float, min_val: float, max_val: float) -> float:
        """Clamp value between min and max"""
        return max(min_val, min(max_val, value))
    
    def generate_event(self) -> Dict:
        """Generate a comprehensive game event with ML features"""
        
        event_types = ["AIM", "SHOOT", "KILL", "MOVE", "DAMAGE"]
        weights = [0.4, 0.25, 0.1, 0.2, 0.05]
        event_type = random.choices(event_types, weights=weights)[0]
        
        # Base event structure
        event = {
            # Identifiers
            "event_id": str(uuid.uuid4()),
            "player_id": self.player_id,
            "timestamp": datetime.now().isoformat(),
            "unix_timestamp": int(time.time() * 1000),
            "event_type": event_type,
            
            # ML Labels (IMPORTANT for training)
            "is_cheater": self.is_cheater,
            "cheat_type": self.cheat_type.value,
            "skill_level": self.skill_level.value if self.skill_level else "cheater",
            
            # Session context
            "session_duration_mins": (datetime.now() - self.session_start).seconds / 60,
            "session_kills": self.total_kills,
            "session_deaths": self.total_deaths,
            "session_kd_ratio": self.total_kills / max(1, self.total_deaths),
        }
        
        # Add event-specific features
        if event_type == "AIM":
            event.update(self._generate_aim_features())
        elif event_type == "SHOOT":
            event.update(self._generate_shoot_features())
        elif event_type == "KILL":
            event.update(self._generate_kill_features())
        elif event_type == "MOVE":
            event.update(self._generate_move_features())
        elif event_type == "DAMAGE":
            event.update(self._generate_damage_features())
        
        # Add aggregated stats
        event.update(self._get_aggregated_stats())
        
        return event
    
    def _generate_aim_features(self) -> Dict:
        """Generate aim-related features"""
        p = self.profile
        
        # Calculate aim snap angle
        new_angle = random.gauss(p.snap_angle_mean, p.snap_angle_std)
        snap_delta = abs(new_angle - self.last_aim_angle)
        self.last_aim_angle = new_angle
        
        # Tracking smoothness (cheaters often have jerky aim)
        smoothness = self._add_noise(p.tracking_smoothness, 0.1)
        
        # Time to target (how fast crosshair reaches target)
        time_to_target = self._add_noise(p.avg_reaction_time_ms * 0.5, 30)
        
        # Is this a flick shot?
        is_flick = random.random() < p.flick_frequency
        
        # Aim path linearity (cheaters often have perfectly linear aim paths)
        # 1.0 = perfectly linear (suspicious), 0.0 = very curved (natural)
        if self.is_cheater and self.cheat_type == CheatType.AIMBOT:
            aim_linearity = random.uniform(0.85, 0.98)
        else:
            aim_linearity = random.uniform(0.3, 0.7)
        
        # Mouse movement acceleration pattern
        acceleration_variance = 0.1 if self.is_cheater else random.uniform(0.3, 0.6)
        
        return {
            "aim_snap_angle": round(self._clamp(snap_delta, 0, 180), 2),
            "aim_snap_speed": round(snap_delta / max(0.01, time_to_target / 1000), 2),
            "tracking_smoothness": round(self._clamp(smoothness, 0, 1), 3),
            "is_flick_shot": is_flick,
            "flick_distance": round(snap_delta if is_flick else 0, 2),
            "time_to_target_ms": round(max(10, time_to_target), 1),
            "aim_linearity": round(self._clamp(aim_linearity, 0, 1), 3),
            "acceleration_variance": round(acceleration_variance, 3),
            "crosshair_on_target_time_ms": round(random.uniform(50, 500) if not self.is_cheater else random.uniform(10, 100), 1),
            "aim_corrections_count": random.randint(2, 8) if not self.is_cheater else random.randint(0, 2),
        }
    
    def _generate_shoot_features(self) -> Dict:
        """Generate shooting-related features"""
        p = self.profile
        
        # Calculate hit/miss
        accuracy = self._add_noise(p.base_accuracy, p.accuracy_variance)
        is_hit = random.random() < accuracy
        
        # Headshot calculation
        is_headshot = False
        if is_hit:
            headshot_chance = self._add_noise(p.headshot_ratio, p.headshot_variance)
            is_headshot = random.random() < headshot_chance
            self.total_hits += 1
            if is_headshot:
                self.total_headshots += 1
        
        self.total_shots += 1
        
        # Recoil control metrics
        recoil_recovery = self._add_noise(p.recoil_control, 0.05)
        spray_consistency = self._add_noise(p.spray_pattern_consistency, 0.08)
        
        # Bullets in current spray (burst vs spray)
        bullets_in_spray = random.randint(1, 30)
        
        # Time between shots (fire rate consistency)
        time_between_shots = random.uniform(60, 150) if not self.is_cheater else random.uniform(55, 70)
        
        return {
            "is_hit": is_hit,
            "is_headshot": is_headshot,
            "damage_dealt": random.randint(20, 100) if is_hit else 0,
            "weapon_type": random.choice(["rifle", "smg", "sniper", "pistol", "shotgun"]),
            "distance_to_target": round(self._add_noise(p.avg_engagement_distance, 10), 1),
            "recoil_recovery_score": round(self._clamp(recoil_recovery, 0, 1), 3),
            "spray_pattern_score": round(self._clamp(spray_consistency, 0, 1), 3),
            "bullets_in_spray": bullets_in_spray,
            "time_between_shots_ms": round(time_between_shots, 1),
            "first_shot_accuracy": round(self._add_noise(p.base_accuracy + 0.15, 0.05), 3),
            "spray_transfer_speed": round(random.uniform(0.3, 0.8) if not self.is_cheater else random.uniform(0.7, 0.95), 3),
        }
    
    def _generate_kill_features(self) -> Dict:
        """Generate kill event features"""
        p = self.profile
        
        self.total_kills += 1
        
        # Reaction time to kill
        reaction_time = self._add_noise(p.avg_reaction_time_ms, p.reaction_time_variance)
        
        # Time to kill (from first shot to kill)
        time_to_kill = random.uniform(200, 2000) if not self.is_cheater else random.uniform(100, 500)
        
        # Kill through smoke/wall (wall hack indicator)
        through_obstacle = False
        if self.is_cheater and self.cheat_type == CheatType.WALL_HACK:
            through_obstacle = random.random() < 0.3
        else:
            through_obstacle = random.random() < 0.05
        
        return {
            "kill_distance": round(self._add_noise(p.avg_engagement_distance, 15), 1),
            "reaction_time_ms": round(max(30, reaction_time), 1),
            "time_to_kill_ms": round(time_to_kill, 1),
            "shots_to_kill": random.randint(1, 10),
            "is_headshot_kill": random.random() < p.headshot_ratio,
            "through_smoke": through_obstacle and random.random() < 0.5,
            "through_wall": through_obstacle and random.random() < 0.3,
            "enemy_was_flashed": random.random() < 0.1,
            "enemy_was_moving": random.random() < 0.7,
            "kill_streak": random.randint(1, 5) if self.is_cheater else random.randint(1, 3),
            "victim_skill_level": random.choice(["noob", "casual", "average", "skilled", "pro"]),
        }
    
    def _generate_move_features(self) -> Dict:
        """Generate movement-related features"""
        p = self.profile
        
        # Movement speed
        speed = self._add_noise(p.avg_movement_speed, p.movement_variance)
        
        # Update position
        angle = random.uniform(0, 2 * math.pi)
        distance = speed * 0.1  # distance moved in tick
        self.position["x"] += math.cos(angle) * distance
        self.position["y"] += math.sin(angle) * distance
        
        # Speed hack detection features
        max_normal_speed = 280  # Normal game max speed
        is_speed_anomaly = speed > max_normal_speed
        
        # Strafe patterns
        is_strafing = random.random() < p.strafe_frequency
        
        return {
            "movement_speed": round(speed, 2),
            "position_x": round(self.position["x"], 2),
            "position_y": round(self.position["y"], 2),
            "position_z": round(self.position["z"], 2),
            "movement_direction": round(math.degrees(angle), 1),
            "is_strafing": is_strafing,
            "is_crouching": random.random() < 0.2,
            "is_jumping": random.random() < 0.1,
            "speed_anomaly_detected": is_speed_anomaly,
            "acceleration": round(random.uniform(-50, 50), 2),
            "direction_changes_per_sec": round(random.uniform(0.5, 3) if not self.is_cheater else random.uniform(2, 6), 2),
        }
    
    def _generate_damage_features(self) -> Dict:
        """Generate damage received features"""
        self.total_deaths += random.choices([0, 1], weights=[0.8, 0.2])[0]
        
        return {
            "damage_received": random.randint(10, 100),
            "damage_source": random.choice(["rifle", "smg", "sniper", "pistol", "grenade"]),
            "hit_location": random.choice(["head", "chest", "arm", "leg"]),
            "attacker_distance": round(random.uniform(5, 50), 1),
            "was_killed": random.random() < 0.3,
            "time_since_last_damage_ms": random.randint(1000, 30000),
        }
    
    def _get_aggregated_stats(self) -> Dict:
        """Get aggregated session statistics"""
        return {
            # Aggregated accuracy stats
            "session_accuracy": round(self.total_hits / max(1, self.total_shots), 3),
            "session_headshot_ratio": round(self.total_headshots / max(1, self.total_hits), 3),
            "session_shots_fired": self.total_shots,
            "session_hits": self.total_hits,
            "session_headshots": self.total_headshots,
            
            # Performance metrics
            "kills_per_minute": round(self.total_kills / max(1, (datetime.now() - self.session_start).seconds / 60), 2),
            "deaths_per_minute": round(self.total_deaths / max(1, (datetime.now() - self.session_start).seconds / 60), 2),
        }


# ============================================
# DATA GENERATOR
# ============================================

class MLDataGenerator:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        self.players: List[Player] = []
        self._initialize_players()
        
    def _initialize_players(self):
        """Create player pool with mix of legit and cheaters"""
        num_cheaters = int(TOTAL_PLAYERS * CHEATER_PERCENTAGE)
        num_legit = TOTAL_PLAYERS - num_cheaters
        
        # Create legitimate players
        for i in range(num_legit):
            player_id = f"legit_{i:04d}"
            self.players.append(Player(player_id, is_cheater=False))
        
        # Create cheaters with different cheat types
        cheat_types = [
            CheatType.AIMBOT,
            CheatType.SOFT_AIM,
            CheatType.NO_RECOIL,
            CheatType.SPEED_HACK,
            CheatType.WALL_HACK,
            CheatType.TRIGGER_BOT,
        ]
        
        for i in range(num_cheaters):
            player_id = f"player_{i:04d}"  # Don't label as "cheater" in ID
            cheat_type = random.choice(cheat_types)
            self.players.append(Player(player_id, is_cheater=True, cheat_type=cheat_type))
        
        # Shuffle to mix players
        random.shuffle(self.players)
        
        print(f"✅ Initialized {len(self.players)} players:")
        print(f"   - Legitimate: {num_legit}")
        print(f"   - Cheaters: {num_cheaters} ({CHEATER_PERCENTAGE*100:.0f}%)")
        
        # Print cheat type distribution
        cheat_counts = {}
        for p in self.players:
            if p.is_cheater:
                ct = p.cheat_type.value
                cheat_counts[ct] = cheat_counts.get(ct, 0) + 1
        print(f"   - Cheat distribution: {cheat_counts}")
    
    def generate_events(self):
        """Main event generation loop"""
        print(f"\n🚀 Starting ML Data Generator")
        print(f"   - Kafka: {KAFKA_BOOTSTRAP_SERVERS}")
        print(f"   - Topic: {KAFKA_TOPIC}")
        print(f"   - Rate: ~{EVENTS_PER_SECOND} events/sec\n")
        
        event_count = 0
        start_time = time.time()
        
        try:
            while True:
                # Generate events from random players
                batch_size = random.randint(5, 15)
                
                for _ in range(batch_size):
                    player = random.choice(self.players)
                    event = player.generate_event()
                    
                    self.producer.send(KAFKA_TOPIC, value=event)
                    event_count += 1
                
                # Flush periodically
                if event_count % 100 == 0:
                    self.producer.flush()
                    elapsed = time.time() - start_time
                    rate = event_count / elapsed
                    print(f"📊 Events sent: {event_count:,} | Rate: {rate:.1f}/sec | "
                          f"Cheater events: ~{event_count * CHEATER_PERCENTAGE:.0f}")
                
                # Control event rate
                time.sleep(batch_size / EVENTS_PER_SECOND)
                
        except KeyboardInterrupt:
            print(f"\n\n⏹️  Stopping generator...")
            print(f"   Total events sent: {event_count:,}")
            self.producer.flush()
            self.producer.close()


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║     🛡️  ARES ANTICHEAT - ML DATA GENERATOR v2.0  🛡️      ║
    ║                                                           ║
    ║  Generating rich behavioral data for ML model training    ║
    ║  Features: Aim, Shooting, Movement, Kill patterns         ║
    ║  Labels: Cheater type, Skill level                        ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    generator = MLDataGenerator()
    generator.generate_events()
