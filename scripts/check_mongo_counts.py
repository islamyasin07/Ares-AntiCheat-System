from pymongo import MongoClient

c = MongoClient('mongodb://localhost:27018')
db = c['ares_anticheat']

print('detections:', db['detections'].count_documents({}))
print('ml_detections:', db['ml_detections'].count_documents({}))
print('events_raw:', db['events_raw'].count_documents({}))
