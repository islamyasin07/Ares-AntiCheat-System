"""
ARES AntiCheat - Unified AI Producer (Spark + ML)
=================================================
Single Kafka producer that generates:
- Spark-friendly events (legacy-compatible fields)
- ML-ready features (rich behavioral signals)
- Consistent schema across event types
- Realistic legit + cheater patterns
- Cheat-type analytics support

Design goals:
1) ONE SOURCE OF TRUTH for "player-events" Kafka topic
2) Spark jobs can consume eventType/playerId + few base fields
3) ML consumer can consume player_id + ML feature set
4) Every event ALWAYS contains the ML feature keys (via setdefault defaults)
   to avoid model "empty feature" problem and prob=0.0 forever.

Author: Ares Team
Version: 3.5 (Unified + ML-First)
"""

import time
import json
import random
import math
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from kafka import KafkaProducer
from datetime import timezone

# ============================================================
# CONFIG
# ============================================================

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_TOPIC = "player-events"

TOTAL_PLAYERS = 120
CHEATER_PERCENTAGE = 0.22     # demo-ready: enough detections
EVENTS_PER_SECOND = 60        # global target rate
BATCH_MIN = 4
BATCH_MAX = 12

# time correlation alignment
# prefer unix_timestamp in ms for Spark + ML join windows
USE_UNIX_MS = True

# if you want more ML detections quickly:
# increase CHEATER_PERCENTAGE or raise cheater aggressiveness below.

SCHEMA_VERSION = "ares.unified.v3.5"


# ============================================================
# ENUMS
# ============================================================

class EventType(Enum):
    AIM = "AIM"
    SHOOT = "SHOOT"
    KILL = "KILL"
    MOVE = "MOVE"
    DAMAGE = "DAMAGE"


class CheatType(Enum):
    NONE = "none"
    AIMBOT = "aimbot"
    SOFT_AIM = "soft_aim"
    NO_RECOIL = "no_recoil"
    SPEED_HACK = "speed_hack"
    WALL_HACK = "wall_hack"
    TRIGGER_BOT = "trigger_bot"


class SkillLevel(Enum):
    NOOB = "noob"
    CASUAL = "casual"
    AVERAGE = "average"
    SKILLED = "skilled"
    PRO = "pro"


# ============================================================
# BEHAVIOR PROFILE
# ============================================================

@dataclass
class BehaviorProfile:
    # core combat
    base_accuracy: float
    accuracy_var: float
    headshot_ratio: float
    headshot_var: float

    # reaction & time
    reaction_ms: float
    reaction_var: float

    # aim mechanics
    snap_angle_mean: float
    snap_angle_std: float
    tracking_smoothness: float
    flick_freq: float
    aim_linearity_min: float
    aim_linearity_max: float
    accel_var_min: float
    accel_var_max: float
    aim_corrections_min: int
    aim_corrections_max: int

    # recoil & spray
    recoil_control: float
    recoil_var: float
    spray_consistency: float
    spray_var: float
    time_between_shots_min: float
    time_between_shots_max: float

    # movement
    move_speed: float
    move_var: float
    strafe_freq: float
    dir_change_min: float
    dir_change_max: float

    # macro performance
    kpm: float
    dpm: float
    engagement_distance: float


def clamp(x: float, a: float, b: float) -> float:
    return max(a, min(b, x))


def noise_gauss(val: float, std: float) -> float:
    return val + random.gauss(0, std)


# Legit profiles by skill (tuned)
LEGIT_PROFILES = {
    SkillLevel.NOOB: BehaviorProfile(
        base_accuracy=0.15, accuracy_var=0.08,
        headshot_ratio=0.08, headshot_var=0.05,
        reaction_ms=450, reaction_var=110,
        snap_angle_mean=15, snap_angle_std=10,
        tracking_smoothness=0.30, flick_freq=0.05,
        aim_linearity_min=0.20, aim_linearity_max=0.55,
        accel_var_min=0.35, accel_var_max=0.65,
        aim_corrections_min=4, aim_corrections_max=10,
        recoil_control=0.22, recoil_var=0.08,
        spray_consistency=0.25, spray_var=0.10,
        time_between_shots_min=95, time_between_shots_max=160,
        move_speed=180, move_var=45,
        strafe_freq=0.12, dir_change_min=0.6, dir_change_max=2.0,
        kpm=0.35, dpm=1.20, engagement_distance=15
    ),
    SkillLevel.CASUAL: BehaviorProfile(
        base_accuracy=0.25, accuracy_var=0.07,
        headshot_ratio=0.15, headshot_var=0.06,
        reaction_ms=350, reaction_var=85,
        snap_angle_mean=25, snap_angle_std=12,
        tracking_smoothness=0.45, flick_freq=0.10,
        aim_linearity_min=0.25, aim_linearity_max=0.62,
        accel_var_min=0.30, accel_var_max=0.60,
        aim_corrections_min=3, aim_corrections_max=9,
        recoil_control=0.36, recoil_var=0.07,
        spray_consistency=0.36, spray_var=0.10,
        time_between_shots_min=90, time_between_shots_max=150,
        move_speed=200, move_var=40,
        strafe_freq=0.22, dir_change_min=0.8, dir_change_max=2.4,
        kpm=0.65, dpm=0.95, engagement_distance=20
    ),
    SkillLevel.AVERAGE: BehaviorProfile(
        base_accuracy=0.35, accuracy_var=0.06,
        headshot_ratio=0.22, headshot_var=0.06,
        reaction_ms=280, reaction_var=65,
        snap_angle_mean=35, snap_angle_std=15,
        tracking_smoothness=0.55, flick_freq=0.15,
        aim_linearity_min=0.30, aim_linearity_max=0.70,
        accel_var_min=0.28, accel_var_max=0.55,
        aim_corrections_min=3, aim_corrections_max=8,
        recoil_control=0.52, recoil_var=0.06,
        spray_consistency=0.52, spray_var=0.09,
        time_between_shots_min=85, time_between_shots_max=140,
        move_speed=220, move_var=32,
        strafe_freq=0.35, dir_change_min=0.9, dir_change_max=2.8,
        kpm=1.00, dpm=0.80, engagement_distance=25
    ),
    SkillLevel.SKILLED: BehaviorProfile(
        base_accuracy=0.45, accuracy_var=0.05,
        headshot_ratio=0.32, headshot_var=0.07,
        reaction_ms=220, reaction_var=45,
        snap_angle_mean=45, snap_angle_std=18,
        tracking_smoothness=0.70, flick_freq=0.25,
        aim_linearity_min=0.38, aim_linearity_max=0.78,
        accel_var_min=0.25, accel_var_max=0.50,
        aim_corrections_min=2, aim_corrections_max=7,
        recoil_control=0.72, recoil_var=0.05,
        spray_consistency=0.68, spray_var=0.08,
        time_between_shots_min=80, time_between_shots_max=130,
        move_speed=240, move_var=28,
        strafe_freq=0.50, dir_change_min=1.0, dir_change_max=3.2,
        kpm=1.55, dpm=0.62, engagement_distance=30
    ),
    SkillLevel.PRO: BehaviorProfile(
        base_accuracy=0.55, accuracy_var=0.04,
        headshot_ratio=0.42, headshot_var=0.08,
        reaction_ms=180, reaction_var=35,
        snap_angle_mean=55, snap_angle_std=20,
        tracking_smoothness=0.85, flick_freq=0.35,
        aim_linearity_min=0.45, aim_linearity_max=0.85,
        accel_var_min=0.22, accel_var_max=0.45,
        aim_corrections_min=2, aim_corrections_max=6,
        recoil_control=0.86, recoil_var=0.04,
        spray_consistency=0.80, spray_var=0.07,
        time_between_shots_min=78, time_between_shots_max=125,
        move_speed=260, move_var=22,
        strafe_freq=0.65, dir_change_min=1.2, dir_change_max=3.6,
        kpm=2.25, dpm=0.50, engagement_distance=35
    )
}

# Cheater profiles by cheat-type (tuned + distinct signatures)
CHEATER_PROFILES = {
    CheatType.AIMBOT: BehaviorProfile(
        base_accuracy=0.88, accuracy_var=0.03,
        headshot_ratio=0.80, headshot_var=0.05,
        reaction_ms=80, reaction_var=15,
        snap_angle_mean=90, snap_angle_std=8,
        tracking_smoothness=0.18, flick_freq=0.70,
        aim_linearity_min=0.86, aim_linearity_max=0.98,
        accel_var_min=0.06, accel_var_max=0.16,
        aim_corrections_min=0, aim_corrections_max=2,
        recoil_control=0.66, recoil_var=0.06,
        spray_consistency=0.55, spray_var=0.10,
        time_between_shots_min=55, time_between_shots_max=70,
        move_speed=235, move_var=35,
        strafe_freq=0.30, dir_change_min=1.0, dir_change_max=4.0,
        kpm=3.6, dpm=0.30, engagement_distance=45
    ),
    CheatType.SOFT_AIM: BehaviorProfile(
        base_accuracy=0.65, accuracy_var=0.05,
        headshot_ratio=0.50, headshot_var=0.08,
        reaction_ms=150, reaction_var=35,
        snap_angle_mean=55, snap_angle_std=15,
        tracking_smoothness=0.50, flick_freq=0.35,
        aim_linearity_min=0.70, aim_linearity_max=0.92,
        accel_var_min=0.12, accel_var_max=0.25,
        aim_corrections_min=1, aim_corrections_max=3,
        recoil_control=0.70, recoil_var=0.05,
        spray_consistency=0.60, spray_var=0.09,
        time_between_shots_min=55, time_between_shots_max=75,
        move_speed=235, move_var=30,
        strafe_freq=0.40, dir_change_min=1.1, dir_change_max=4.6,
        kpm=2.2, dpm=0.50, engagement_distance=35
    ),
    CheatType.NO_RECOIL: BehaviorProfile(
        base_accuracy=0.58, accuracy_var=0.04,
        headshot_ratio=0.30, headshot_var=0.06,
        reaction_ms=230, reaction_var=55,
        snap_angle_mean=40, snap_angle_std=18,
        tracking_smoothness=0.62, flick_freq=0.20,
        aim_linearity_min=0.45, aim_linearity_max=0.80,
        accel_var_min=0.18, accel_var_max=0.35,
        aim_corrections_min=2, aim_corrections_max=4,
        recoil_control=0.98, recoil_var=0.02,
        spray_consistency=0.95, spray_var=0.03,
        time_between_shots_min=55, time_between_shots_max=75,
        move_speed=225, move_var=30,
        strafe_freq=0.35, dir_change_min=0.9, dir_change_max=3.8,
        kpm=1.9, dpm=0.55, engagement_distance=28
    ),
    CheatType.SPEED_HACK: BehaviorProfile(
        base_accuracy=0.40, accuracy_var=0.06,
        headshot_ratio=0.25, headshot_var=0.07,
        reaction_ms=260, reaction_var=55,
        snap_angle_mean=38, snap_angle_std=16,
        tracking_smoothness=0.55, flick_freq=0.18,
        aim_linearity_min=0.30, aim_linearity_max=0.70,
        accel_var_min=0.25, accel_var_max=0.55,
        aim_corrections_min=3, aim_corrections_max=7,
        recoil_control=0.55, recoil_var=0.07,
        spray_consistency=0.50, spray_var=0.10,
        time_between_shots_min=85, time_between_shots_max=140,
        move_speed=470, move_var=90,
        strafe_freq=0.80, dir_change_min=2.0, dir_change_max=6.0,
        kpm=1.7, dpm=0.40, engagement_distance=22
    ),
    CheatType.WALL_HACK: BehaviorProfile(
        base_accuracy=0.44, accuracy_var=0.05,
        headshot_ratio=0.28, headshot_var=0.06,
        reaction_ms=120, reaction_var=25,
        snap_angle_mean=30, snap_angle_std=12,
        tracking_smoothness=0.68, flick_freq=0.12,
        aim_linearity_min=0.35, aim_linearity_max=0.78,
        accel_var_min=0.22, accel_var_max=0.45,
        aim_corrections_min=2, aim_corrections_max=5,
        recoil_control=0.62, recoil_var=0.06,
        spray_consistency=0.55, spray_var=0.09,
        time_between_shots_min=80, time_between_shots_max=135,
        move_speed=235, move_var=30,
        strafe_freq=0.45, dir_change_min=1.0, dir_change_max=4.0,
        kpm=2.1, dpm=0.45, engagement_distance=32
    ),
    CheatType.TRIGGER_BOT: BehaviorProfile(
        base_accuracy=0.72, accuracy_var=0.04,
        headshot_ratio=0.35, headshot_var=0.06,
        reaction_ms=50, reaction_var=10,
        snap_angle_mean=35, snap_angle_std=15,
        tracking_smoothness=0.60, flick_freq=0.20,
        aim_linearity_min=0.50, aim_linearity_max=0.88,
        accel_var_min=0.10, accel_var_max=0.20,
        aim_corrections_min=0, aim_corrections_max=2,
        recoil_control=0.55, recoil_var=0.07,
        spray_consistency=0.50, spray_var=0.10,
        time_between_shots_min=55, time_between_shots_max=75,
        move_speed=225, move_var=30,
        strafe_freq=0.35, dir_change_min=0.9, dir_change_max=3.8,
        kpm=2.0, dpm=0.50, engagement_distance=28
    )
}

# ============================================================
# PLAYER STATE
# ============================================================

@dataclass
class SessionStats:
    shots: int = 0
    hits: int = 0
    headshots: int = 0
    kills: int = 0
    deaths: int = 0


class Player:
    def __init__(self, player_id: str, is_cheater: bool, cheat_type: CheatType):
        self.player_id = player_id
        self.is_cheater = is_cheater
        self.cheat_type = cheat_type

        if is_cheater:
            self.skill = SkillLevel.AVERAGE  # not used for cheater, keep stable label
            self.profile = CHEATER_PROFILES[cheat_type]
        else:
            self.skill = random.choice(list(SkillLevel))
            self.profile = LEGIT_PROFILES[self.skill]

        self.session_start_unix_ms = int(time.time() * 1000)
        self.stats = SessionStats()

        # movement state
        self.pos_x = random.uniform(0, 1000)
        self.pos_y = random.uniform(0, 1000)
        self.pos_z = 0.0
        self.last_aim_angle = random.uniform(0, 180)

        # “soft” behavioral drift (keeps things from being too uniform)
        self.drift = random.uniform(-0.03, 0.03)

    def _session_minutes(self, now_ms: int) -> float:
        return max(0.1, (now_ms - self.session_start_unix_ms) / 60000.0)

    def _accuracy_sample(self) -> float:
        p = self.profile
        return clamp(noise_gauss(p.base_accuracy + self.drift, p.accuracy_var), 0.02, 0.98)

    def _headshot_sample(self) -> float:
        p = self.profile
        return clamp(noise_gauss(p.headshot_ratio, p.headshot_var), 0.01, 0.95)

    def _reaction_sample(self) -> float:
        p = self.profile
        return clamp(noise_gauss(p.reaction_ms, p.reaction_var), 30, 900)

    def _snap_angle_sample(self) -> float:
        p = self.profile
        ang = abs(random.gauss(p.snap_angle_mean, p.snap_angle_std))
        return clamp(ang, 0, 180)

    def _tracking_smoothness(self) -> float:
        p = self.profile
        return clamp(noise_gauss(p.tracking_smoothness, 0.08), 0.0, 1.0)

    def _aim_linearity(self) -> float:
        p = self.profile
        # aimbot tends to be very linear
        return clamp(random.uniform(p.aim_linearity_min, p.aim_linearity_max), 0.0, 1.0)

    def _accel_variance(self) -> float:
        p = self.profile
        return clamp(random.uniform(p.accel_var_min, p.accel_var_max), 0.0, 1.0)

    def _aim_corrections(self) -> int:
        p = self.profile
        return random.randint(p.aim_corrections_min, p.aim_corrections_max)

    def _recoil_recovery(self) -> float:
        p = self.profile
        return clamp(noise_gauss(p.recoil_control, p.recoil_var), 0.0, 1.0)

    def _spray_score(self) -> float:
        p = self.profile
        return clamp(noise_gauss(p.spray_consistency, p.spray_var), 0.0, 1.0)

    def _tbs_ms(self) -> float:
        p = self.profile
        return random.uniform(p.time_between_shots_min, p.time_between_shots_max)

    def _move_speed(self) -> float:
        p = self.profile
        return max(0, noise_gauss(p.move_speed, p.move_var))

    def _dir_changes(self) -> float:
        p = self.profile
        return random.uniform(p.dir_change_min, p.dir_change_max)

    def _is_flick(self) -> bool:
        p = self.profile
        return random.random() < p.flick_freq

    def _weapon_type(self) -> str:
        # keep stable distribution
        return random.choice(["rifle", "smg", "sniper", "pistol", "shotgun"])

    # ------------------------------------------------------------
    # Event building
    # ------------------------------------------------------------

    def build_event(self) -> Dict:
        now_ms = int(time.time() * 1000)
        event_type = random.choices(
            population=[EventType.AIM, EventType.SHOOT, EventType.KILL, EventType.MOVE, EventType.DAMAGE],
            weights=[0.40, 0.25, 0.10, 0.20, 0.05],
        )[0]

        # base skeleton (unified IDs)
        event = {
            "schema_version": SCHEMA_VERSION,
            "event_id": str(uuid.uuid4()),

            # time
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "unix_timestamp": now_ms,

            # unified identity (ML)
            "player_id": self.player_id,

            # legacy identity (Spark-friendly)
            "playerId": self.player_id,
            "eventType": event_type.value,      # Spark old style
            "event_type": event_type.value,     # ML style

            # labels/context (useful for training + analytics)
            "is_cheater": self.is_cheater,
            "cheat_type": self.cheat_type.value,
            "skill_level": self.skill.value if not self.is_cheater else "cheater",

            # session summary
            "session_duration_mins": round(self._session_minutes(now_ms), 2),
            "session_shots_fired": self.stats.shots,
            "session_hits": self.stats.hits,
            "session_headshots": self.stats.headshots,
            "session_kills": self.stats.kills,
            "session_deaths": self.stats.deaths,
            "session_kd_ratio": round(self.stats.kills / max(1, self.stats.deaths), 3),

            # minimal spark-like fields that older pipelines may expect
            "deltaX": round(random.uniform(-3, 3), 3),
            "deltaY": round(random.uniform(-3, 3), 3),
            "speed": round(random.uniform(5, 60) + (random.uniform(40, 90) if self.is_cheater else 0), 2),
            "isFlick": self._is_flick(),
        }

        # event-specific enrichment
        if event_type == EventType.AIM:
            event.update(self._aim_features())
        elif event_type == EventType.SHOOT:
            event.update(self._shoot_features())
        elif event_type == EventType.KILL:
            event.update(self._kill_features())
        elif event_type == EventType.MOVE:
            event.update(self._move_features())
        elif event_type == EventType.DAMAGE:
            event.update(self._damage_features())

        # aggregated ML features must always exist
        event.update(self._aggregated_features(now_ms))

        # Ensure ML-required keys always exist (avoid model empty features)
        self._ensure_ml_keys(event)

        return event

    # ------------------------------------------------------------
    # Feature groups
    # ------------------------------------------------------------

    def _aim_features(self) -> Dict:
        snap = self._snap_angle_sample()
        react = self._reaction_sample()
        smooth = self._tracking_smoothness()
        is_flick = self._is_flick()

        # compute snap delta from last angle for realism
        new_angle = random.uniform(0, 180)
        snap_delta = abs(new_angle - self.last_aim_angle)
        self.last_aim_angle = new_angle

        # aimbot tends to have high snap_delta frequently
        if self.is_cheater and self.cheat_type in (CheatType.AIMBOT, CheatType.TRIGGER_BOT):
            snap_delta = clamp(snap_delta + random.uniform(20, 70), 0, 180)

        time_to_target = max(10, react * 0.55 + random.uniform(-25, 25))

        return {
            "aim_snap_angle": round(clamp(snap_delta, 0, 180), 2),
            "aim_snap_speed": round(clamp(snap_delta / max(0.01, time_to_target / 1000), 0, 5000), 2),
            "tracking_smoothness": round(smooth, 3),
            "is_flick_shot": bool(is_flick),
            "flick_distance": round(snap_delta if is_flick else 0.0, 2),
            "time_to_target_ms": round(time_to_target, 1),
            "aim_linearity": round(self._aim_linearity(), 3),
            "acceleration_variance": round(self._accel_variance(), 3),
            "crosshair_on_target_time_ms": round(random.uniform(60, 450) if not self.is_cheater else random.uniform(10, 120), 1),
            "aim_corrections_count": int(self._aim_corrections()),
        }

    def _shoot_features(self) -> Dict:
        acc = self._accuracy_sample()
        hs = self._headshot_sample()

        self.stats.shots += 1
        is_hit = random.random() < acc
        is_headshot = False

        if is_hit:
            self.stats.hits += 1
            is_headshot = random.random() < hs
            if is_headshot:
                self.stats.headshots += 1

        recoil = self._recoil_recovery()
        spray = self._spray_score()
        tbs = self._tbs_ms()

        # no-recoil cheat signature
        if self.is_cheater and self.cheat_type == CheatType.NO_RECOIL:
            recoil = clamp(recoil + random.uniform(0.02, 0.08), 0.0, 1.0)
            spray = clamp(spray + random.uniform(0.02, 0.08), 0.0, 1.0)

        return {
            "is_hit": bool(is_hit),
            "is_headshot": bool(is_headshot),
            "damage_dealt": int(random.randint(20, 100) if is_hit else 0),
            "weapon_type": self._weapon_type(),
            "distance_to_target": round(clamp(noise_gauss(self.profile.engagement_distance, 10), 1, 200), 1),

            "recoil_recovery_score": round(recoil, 3),
            "spray_pattern_score": round(spray, 3),
            "bullets_in_spray": int(random.randint(1, 30)),
            "time_between_shots_ms": round(tbs, 1),
            "first_shot_accuracy": round(clamp(acc + 0.12, 0.0, 1.0), 3),
            "spray_transfer_speed": round(random.uniform(0.35, 0.80) if not self.is_cheater else random.uniform(0.70, 0.95), 3),
        }

    def _kill_features(self) -> Dict:
        self.stats.kills += 1
        react = self._reaction_sample()

        # time-to-kill cheaters tend to be lower
        t2k = random.uniform(250, 1800)
        if self.is_cheater:
            # aimbot/triggerbot even lower
            if self.cheat_type in (CheatType.AIMBOT, CheatType.TRIGGER_BOT):
                t2k = random.uniform(90, 250)
            else:
                t2k = random.uniform(120, 520)

        through_obstacle = False
        if self.is_cheater and self.cheat_type == CheatType.WALL_HACK:
            through_obstacle = random.random() < 0.30
        else:
            through_obstacle = random.random() < 0.05

        return {
            "kill_distance": round(clamp(noise_gauss(self.profile.engagement_distance, 15), 1, 250), 1),
            "reaction_time_ms": round(react, 1),
            "time_to_kill_ms": round(t2k, 1),
            "shots_to_kill": int(random.randint(1, 10)),
            "is_headshot_kill": bool(random.random() < self.profile.headshot_ratio),
            "through_smoke": bool(through_obstacle and random.random() < 0.5),
            "through_wall": bool(through_obstacle and random.random() < 0.35),
            "enemy_was_flashed": bool(random.random() < 0.10),
            "enemy_was_moving": bool(random.random() < 0.70),
            "kill_streak": int(random.randint(1, 5) if self.is_cheater else random.randint(1, 3)),
        }

    def _move_features(self) -> Dict:
        spd = self._move_speed()

        # update position
        ang = random.uniform(0, 2 * math.pi)
        distance = spd * 0.10
        self.pos_x += math.cos(ang) * distance
        self.pos_y += math.sin(ang) * distance

        # speed hack signature
        max_normal_speed = 280
        speed_anomaly = spd > max_normal_speed

        # strafing behavior
        strafing = random.random() < self.profile.strafe_freq
        dir_changes = self._dir_changes()

        return {
            "movement_speed": round(spd, 2),
            "position_x": round(self.pos_x, 2),
            "position_y": round(self.pos_y, 2),
            "position_z": round(self.pos_z, 2),
            "movement_direction": round(math.degrees(ang), 1),
            "is_strafing": bool(strafing),
            "is_crouching": bool(random.random() < 0.20),
            "is_jumping": bool(random.random() < 0.10),
            "speed_anomaly_detected": bool(speed_anomaly),
            "acceleration": round(random.uniform(-50, 50), 2),
            "direction_changes_per_sec": round(dir_changes, 2),
        }

    def _damage_features(self) -> Dict:
        # deaths occur from damage sometimes
        died = random.random() < (0.08 if self.is_cheater else 0.18)
        if died:
            self.stats.deaths += 1

        return {
            "damage_received": int(random.randint(10, 100)),
            "damage_source": random.choice(["rifle", "smg", "sniper", "pistol", "grenade"]),
            "hit_location": random.choice(["head", "chest", "arm", "leg"]),
            "attacker_distance": round(random.uniform(5, 60), 1),
            "was_killed": bool(died),
            "time_since_last_damage_ms": int(random.randint(800, 30000)),
        }

    def _aggregated_features(self, now_ms: int) -> Dict:
        mins = self._session_minutes(now_ms)

        session_acc = self.stats.hits / max(1, self.stats.shots)
        session_hs = self.stats.headshots / max(1, self.stats.hits)

        kpm = self.stats.kills / mins
        dpm = self.stats.deaths / mins

        return {
            "session_accuracy": round(session_acc, 3),
            "session_headshot_ratio": round(session_hs, 3),
            "kills_per_minute": round(kpm, 2),
            "deaths_per_minute": round(dpm, 2),
        }

    # ------------------------------------------------------------
    # ML Key Guard (MOST IMPORTANT)
    # ------------------------------------------------------------

    def _ensure_ml_keys(self, event: Dict) -> None:
        # These keys are expected by ML service / feature extractors.
        # Guarantee they exist for all event types.
        defaults = {
            # aim
            "aim_snap_angle": 0.0,
            "aim_snap_speed": 0.0,
            "tracking_smoothness": 0.55,
            "is_flick_shot": False,
            "time_to_target_ms": 300.0,
            "aim_linearity": 0.55,
            "acceleration_variance": 0.45,
            "aim_corrections_count": 5,

            # recoil / spray / shooting
            "recoil_recovery_score": 0.55,
            "spray_pattern_score": 0.55,
            "time_between_shots_ms": 120.0,
            "first_shot_accuracy": 0.35,
            "spray_transfer_speed": 0.55,

            # session
            "session_accuracy": 0.30,
            "session_headshot_ratio": 0.15,
            "kills_per_minute": 0.50,
            "deaths_per_minute": 1.00,
            "session_kd_ratio": round(self.stats.kills / max(1, self.stats.deaths), 3),

            # movement / reaction / ttk
            "movement_speed": 220.0,
            "direction_changes_per_sec": 2.0,
            "reaction_time_ms": 300.0,
            "time_to_kill_ms": 850.0,
        }

        for k, v in defaults.items():
            if k not in event or event[k] is None:
                event[k] = v

        # Derived: cheat "confidence style" hints (optional)
        # Keep them for analytics even if ML ignores them.
        event.setdefault("risk_hint", self._risk_hint(event))

        # unify optional keys to reduce UI mapping bugs
        event.setdefault("details", None)     # legacy UI sometimes expects 'details'
        event.setdefault("event_data", None)

    def _risk_hint(self, event: Dict) -> str:
        # This is NOT the final ML prediction; it's just a hint for Spark/analytics.
        # ML consumer will produce true cheat_probability + risk_level.
        score = 0.0

        score += clamp(event.get("aim_linearity", 0.5), 0, 1) * 0.6
        score += (1 - clamp(event.get("tracking_smoothness", 0.6), 0, 1)) * 0.6
        score += clamp(event.get("recoil_recovery_score", 0.5), 0, 1) * 0.3
        score += clamp(event.get("spray_pattern_score", 0.5), 0, 1) * 0.3

        if event.get("speed_anomaly_detected") is True:
            score += 0.7

        # Normalize-ish
        if score >= 1.6:
            return "high"
        if score >= 1.1:
            return "medium"
        return "low"


# ============================================================
# PRODUCER (Kafka)
# ============================================================

class UnifiedAIProducer:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8")
        )

        self.players: List[Player] = []
        self._init_players()

        self.sent = 0
        self.start_ts = time.time()

    def _init_players(self):
        cheaters = int(TOTAL_PLAYERS * CHEATER_PERCENTAGE)
        legit = TOTAL_PLAYERS - cheaters

        # legit
        for i in range(legit):
            pid = f"P{i:04d}"
            self.players.append(Player(pid, False, CheatType.NONE))

        # cheaters mixed types
        cheat_types = [
            CheatType.AIMBOT, CheatType.SOFT_AIM, CheatType.NO_RECOIL,
            CheatType.SPEED_HACK, CheatType.WALL_HACK, CheatType.TRIGGER_BOT
        ]

        for i in range(cheaters):
            pid = f"P{legit+i:04d}"
            ct = random.choice(cheat_types)
            self.players.append(Player(pid, True, ct))

        random.shuffle(self.players)

        # print distribution
        dist = {}
        for p in self.players:
            if p.is_cheater:
                dist[p.cheat_type.value] = dist.get(p.cheat_type.value, 0) + 1

        print("✅ UnifiedAIProducer initialized")
        print(f"   - TOTAL_PLAYERS: {TOTAL_PLAYERS}")
        print(f"   - CHEATER_PERCENTAGE: {CHEATER_PERCENTAGE:.2f}")
        print(f"   - Cheater types distribution: {dist}")
        print(f"   - Kafka: {KAFKA_BOOTSTRAP_SERVERS} / topic={KAFKA_TOPIC}")

    def _emit(self, event: Dict):
        self.producer.send(KAFKA_TOPIC, value=event)
        self.sent += 1

        # flush occasionally
        if self.sent % 200 == 0:
            self.producer.flush()
            elapsed = max(0.1, time.time() - self.start_ts)
            rate = self.sent / elapsed
            print(f"📤 Sent: {self.sent:,} | Rate: {rate:.1f}/sec")

    def run(self):
        print("\n🚀 Running Unified AI Producer...\n")
        try:
            while True:
                batch = random.randint(BATCH_MIN, BATCH_MAX)

                for _ in range(batch):
                    p = random.choice(self.players)
                    e = p.build_event()
                    self._emit(e)

                # rate control
                time.sleep(batch / max(1, EVENTS_PER_SECOND))

        except KeyboardInterrupt:
            print("\n⏹️ Stopping producer...")
            self.producer.flush()
            self.producer.close()
            print(f"✅ Closed. Total events sent: {self.sent:,}")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print(f"""
╔═══════════════════════════════════════════════════════════╗
║        🛡️  ARES UNIFIED AI PRODUCER (Spark + ML) 🛡️       ║
╠═══════════════════════════════════════════════════════════╣
║  Topic: {KAFKA_TOPIC:<45}║
║  Players: {TOTAL_PLAYERS:<43}║
║  Cheaters: {int(TOTAL_PLAYERS * CHEATER_PERCENTAGE):<42}║
║  Rate: ~{EVENTS_PER_SECOND:<40}/sec║
║  Schema: {SCHEMA_VERSION:<44}║
╚═══════════════════════════════════════════════════════════╝
""")
    UnifiedAIProducer().run()
