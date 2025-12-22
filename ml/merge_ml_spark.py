from pymongo import MongoClient

# ============================
# CONFIG
# ============================

MONGO_URI = "mongodb://localhost:27018"
DB_NAME = "ares_anticheat"

ML_COLLECTION = "ml_detections"
SPARK_COLLECTION = "detections"
MERGED_COLLECTION = "merged_detections"

WINDOW_MS = 5 * 1000  # 5 seconds window

# ============================
# CONNECT
# ============================

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

ML = db[ML_COLLECTION]
SPARK = db[SPARK_COLLECTION]
MERGED = db[MERGED_COLLECTION]

print("🔗 Merging ML + Spark detections (timestamp-based)...")

merged_count = 0

# ============================
# MERGE LOGIC
# ============================

for ml in ML.find():
    player_id = ml.get("player_id")

    # detected_at can be int (ms) or ISO string
    t = ml.get("detected_at") or ml.get("timestamp")

    if t is None:
        continue

    # Normalize timestamp to milliseconds
    if isinstance(t, str):
        # ISO string → skip (optional: parse if needed)
        continue

    if not isinstance(t, int):
        continue

    start = t - WINDOW_MS
    end = t + WINDOW_MS

    spark_hits = list(SPARK.find({
        "player_id": player_id,
        "unix_timestamp": {"$gte": start, "$lte": end}
    }))

    risk_score = ml.get("cheat_probability", 0)
    risk_score += 0.3 * len(spark_hits)

    merged_doc = {
        "player_id": player_id,
        "timestamp": t,
        "ml_detection_id": ml.get("_id"),
        "spark_matches": spark_hits,
        "ml": {
            "cheat_probability": ml.get("cheat_probability"),
            "risk_level": ml.get("risk_level"),
            "cheat_type": ml.get("cheat_type"),
            "confidence": ml.get("confidence"),
        },
        "spark_flags_count": len(spark_hits),
        "final_risk_score": round(risk_score, 3),
        "final_risk": (
            "critical"
            if ml.get("risk_level") in ["high", "critical"] and spark_hits
            else ml.get("risk_level")
        )
    }

    MERGED.insert_one(merged_doc)
    merged_count += 1

print(f"✅ Merge complete. Inserted {merged_count} merged records.")
