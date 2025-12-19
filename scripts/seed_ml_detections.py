from pymongo import MongoClient
from datetime import datetime, timedelta
import random

c = MongoClient('mongodb://localhost:27018')
db = c['ares_anticheat']
coll = db['ml_detections']
now = datetime.now()

sample_players = ['P_TEST_01','P_TEST_02','P_TEST_03','P_TEST_04','P_TEST_05']
risk_levels = ['low','medium','high','critical']

inserted = []
for i in range(12):
    p = random.choice(sample_players)
    prob = round(random.random(), 2)
    rl = 'low'
    if prob >= 0.9:
        rl = 'critical'
    elif prob >= 0.7:
        rl = 'high'
    elif prob >= 0.5:
        rl = 'medium'

    doc = {
        'player_id': p,
        'detected_at': int((now - timedelta(seconds=random.randint(0,300))).timestamp() * 1000),
        'cheat_probability': prob,
        'risk_level': rl,
        'confidence': round(prob + random.random()*(1-prob), 2),
        'ruleTriggered': 'ML-Seed',
        'source': 'ml_model',
        'details': {'note':'seeded detection for UI testing'}
    }
    coll.insert_one(doc)
    inserted.append(doc)

print('Inserted:', len(inserted))
print('Total ml_detections:', coll.count_documents({}))