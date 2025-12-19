from pymongo import MongoClient
c=MongoClient('mongodb://localhost:27018')
db=c['ares_anticheat']
print('collections:', list(db.list_collection_names()))
print('ml_detections count:', db['ml_detections'].count_documents({}))