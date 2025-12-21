import time
import json
import random
import string
from datetime import datetime
from kafka import KafkaProducer
from shared.bloomFilter import BloomFilter

producer = KafkaProducer(bootstrap_servers='localhost:9092')

# Initialize Bloom filter for cheater detection
bloom_filter = BloomFilter(size=1000, hash_count=5)

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

        # Add to Bloom filter if cheater
        if self.is_cheater:
            bloom_filter.add(self.player_id)

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
