from pymongo import MongoClient

c = MongoClient('mongodb://localhost:27018')
db = c['ares_anticheat']

for name in db.list_collection_names():
    print(name, db[name].estimated_document_count())
