import time
import json
import random
from datetime import datetime
from kafka import KafkaProducer
producer = KafkaProducer(bootstrap_servers='localhost:9092')

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


# -----------------------------
# Event Generator Main Function
# -----------------------------

def generate_events(players):
    while True:
        for p in players:
            event = p.generate_aim_event()
            producer.send("player-events", json.dumps(event).encode("utf-8"))
        
        time.sleep(0.1)  # adjust rate


# -------------
# Program Start
# -------------

if __name__ == "__main__":
    players = [
        PlayerProfile("P01", is_cheater=False),
        PlayerProfile("P02", is_cheater=True),
        PlayerProfile("P03", is_cheater=False),
    ]

    print("Starting data generator...\n")
    generate_events(players)
