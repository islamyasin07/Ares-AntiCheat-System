from pymongo import MongoClient
import json

c = MongoClient('mongodb://localhost:27018')
db = c['ares_anticheat']
coll = db['ml_detections']

count = coll.count_documents({})
print('ml_detections_count:', count)

cursor = coll.find({}).sort([('detected_at', -1)])
print('\nLast 20 ml_detections:')
for i, doc in enumerate(cursor.limit(20)):
    summary = {
        'idx': i+1,
        'player_id': doc.get('player_id') or doc.get('playerId') or doc.get('player'),
        'detected_at': doc.get('detected_at') or doc.get('timestamp'),
        'cheat_probability': doc.get('cheat_probability') or doc.get('cheat_prob') or doc.get('cheatProbability'),
        'risk_level': doc.get('risk_level'),
        'confidence': doc.get('confidence') or doc.get('ml_confidence'),
        'ruleTriggered': doc.get('ruleTriggered'),
        'source': doc.get('source')
    }
    print(json.dumps(summary, default=str))
    # show small event_data sample
    event = doc.get('event_data') or doc.get('event')
    if event:
        keys = list(event.keys())[:8]
        sample = {k: event.get(k) for k in keys}
        print('  event_data_sample:', json.dumps(sample, default=str))
    else:
        print('  event_data: <none>')

c.close()
