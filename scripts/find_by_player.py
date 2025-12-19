from pymongo import MongoClient
import json
c=MongoClient('mongodb://localhost:27018')
db=c['ares_anticheat']
player='TEST_CHEATER_KAFKA'
doc=db['events_raw'].find_one({'player_id': player})
print('found' if doc else 'not found')
if doc:
    sample={k:doc.get(k) for k in ['player_id','event_type','timestamp','unix_timestamp','ml_prediction','is_cheater_ml','cheat_probability','risk_level']}
    print(json.dumps(sample, default=str, indent=2))