import time
import json
import random
import string
import os
from datetime import datetime
from kafka import KafkaProducer

producer = KafkaProducer(bootstrap_servers='localhost:9092')

# Path to shared bloom input file (JSONL)
SHARED_BLOOM_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'shared', 'bloom_input.jsonl')


def write_to_bloom_input(item):
    try:
        os.makedirs(os.path.dirname(SHARED_BLOOM_PATH), exist_ok=True)
        with open(SHARED_BLOOM_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(item, default=str) + "\n")
    except Exception:
        # best-effort logging; keep generator running
        pass


# --------------------------------------
# Basic Player Profile (Normal & Cheater)
# --------------------------------------

class PlayerProfile:
    def __init__(self, player_id, is_cheater=False):
        self.player_id = player_id
        self.is_cheater = is_cheater

    def generate_aim_event(self):
        """Basic placeholder for aim movement event."""
        event = {
            "eventType": "AIM",
            "playerId": self.player_id,
            "timestamp": int(time.time() * 1000),
            "deltaX": random.uniform(-3, 3),
            "deltaY": random.uniform(-3, 3),
            "speed": random.uniform(5, 60),
            "isFlick": False
        }

        # Cheaters flick more often
        if self.is_cheater:
            event["isFlick"] = random.random() < 0.2  # 20% flick chance
            event["speed"] += random.uniform(30, 80)

        return event


# --------------------------------------
# Enhanced Player Profile (Realistic Data)
# --------------------------------------

class EnhancedPlayerProfile(PlayerProfile):
    def __init__(self, player_id, is_cheater=False):
        super().__init__(player_id, is_cheater)
        self.name = self.generate_name()
        self.rank = random.choice(["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion"])
        self.country = random.choice(["USA", "UK", "Germany", "India", "China", "Brazil", "Canada"])

        # Persist player metadata for centralized Bloom processing
        write_to_bloom_input({
            "type": "player",
            "playerId": self.player_id,
            "isCheater": bool(self.is_cheater),
            "name": self.name,
            "rank": self.rank,
            "country": self.country
        })

    def generate_name(self):
        return ''.join(random.choices(string.ascii_uppercase, k=3)) + ''.join(random.choices(string.digits, k=3))

    def generate_aim_event(self):
        event = super().generate_aim_event()
        event.update({
            "playerName": self.name,
            "rank": self.rank,
            "country": self.country
        })
        return event


# -----------------------------
# Event Generator Main Function
# -----------------------------

def generate_events(players):
    while True:
        for p in players:
            event = p.generate_aim_event()
            producer.send("player-events", json.dumps(event).encode("utf-8"))

        time.sleep(0.1)  # adjust rate


# -----------------------------
# Enhanced Event Generator Main Function
# -----------------------------

def generate_enhanced_events(players):
    while True:
        for p in players:
            event = p.generate_aim_event()
            producer.send("player-events", json.dumps(event).encode("utf-8"))
            # Persist event to shared bloom input for centralized Bloom processing
            write_to_bloom_input({"type": "event", "event": event})

        time.sleep(0.05)  # faster rate for more data


# -------------
# Program Start
# -------------

if __name__ == "__main__":
    players = [
        EnhancedPlayerProfile(f"P{i:03}", is_cheater=(i % 5 == 0)) for i in range(1, 101)
    ]

    print("Starting enhanced data generator with 100 players...")
    generate_enhanced_events(players)
