# Ares AntiCheat System

Lightweight streaming pipeline for detecting suspicious player aim behavior (Aimbot, No-Recoil, Robotic Aim) using Kafka, Spark Structured Streaming and MongoDB.

This repository contains:
- `data-generator/` — a Python Kafka event generator that streams synthetic player aim events to the `player-events` topic.
- `kafka/` — docker-compose files to start local Kafka/Zookeeper and a MongoDB service.
- `spark/AresSparkStreaming/` — Spark Structured Streaming application (Scala + sbt) that reads `player-events`, applies rule-based detection, and stores suspicious events in MongoDB.
- `docs/` — project docs and the Trello import CSV (`trello_import.csv`).

Goals
- Provide a reproducible local dev stack for testing real-time detection rules.
- Stream events from a Python generator → Kafka → Spark → MongoDB (viewable in MongoDB Compass).

Quick overview
- Kafka topic: `player-events`
- MongoDB database: `ares_anticheat`
- MongoDB collections: `events` (all parsed events), `suspicious` (detected suspicious events)

Prerequisites
- Docker & Docker Compose (Docker Desktop on Windows)
- Java 11+ and sbt (for running the Spark app locally) or Dockerized Spark (optional)
- Python 3.9+ and `pip`
- (Optional) MongoDB Compass to inspect the DB visually

Local development quickstart (recommended)

1) Start Kafka + MongoDB

Open PowerShell and run from the `kafka` folder:

```powershell
cd C:\Ares-AntiCheat-System\kafka
docker-compose up -d
```

This will start:
- Zookeeper (2181)
- Kafka broker (9092)
- MongoDB (27017) — service name `ares-anticheat`

Confirm services are running:

```powershell
docker ps
```

2) Run the Python data generator

Install Python requirements (create virtualenv recommended):

```powershell
cd C:\Ares-AntiCheat-System\data-generator
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt  # if present
# If requirements.txt is not present, install kafka-python
pip install kafka-python
```

Run the generator (it will produce events to `player-events` topic):

```powershell
python .\data_generator.py
```

3) Run the Spark streaming app (local sbt)

Open a new PowerShell terminal and run:

```powershell
cd C:\Ares-AntiCheat-System\spark\AresSparkStreaming
sbt run
```

Notes:
- The Spark app is configured to connect to Kafka at `localhost:9092` and MongoDB at `mongodb://localhost:27017`.
- The app writes all parsed events to `ares_anticheat.events` and detected suspicious events to `ares_anticheat.suspicious` collections.

4) Verify results

- Check Spark console logs — the app prints messages like "Inserted suspicious batch X".
- Open MongoDB Compass and connect to `mongodb://localhost:27017`.
- Look for the `ares_anticheat` database and the `suspicious` / `events` collections.

Troubleshooting
- If Kafka clients cannot connect to `localhost:9092` when running in Docker on Windows, ensure Docker Desktop exposes the broker on the host. You may need to change `KAFKA_ADVERTISED_LISTENERS` or use host networking.
- If Spark cannot find the Kafka dependency, verify `build.sbt` includes `spark-sql-kafka-0-10` and run `sbt update`.
- If Mongo inserts fail with authentication or connectivity errors, verify Mongo container is healthy and accessible on `27017`.
- If the Spark job uses too much memory when inserting to Mongo, we replaced `.collect()` with per-partition writes in `foreachBatch` to avoid driver OOMs.

Running everything via Docker (alternative)
- Dockerizing Spark adds complexity; a quick option is to run Kafka and Mongo via Docker (as above), run the Python generator and run local sbt for Spark.
- If you want a fully containerized Spark job, we can add a `Dockerfile` for the Spark job and a `docker-compose` service. Open an issue or a task to add this.

Recommended next steps (for the team)
- Add the Mongo Spark Connector to `build.sbt` and switch to the connector sink for simplified writes.
- Add a `scripts/run-stack.ps1` to automate Docker start + wait for services + start the generator.
- Add a small integration test that produces 10 deterministic events and asserts at least one suspicious doc appears in Mongo.
- Add GitHub Actions to run unit tests and linting on PRs.

Files of interest
- `spark/AresSparkStreaming/src/main/scala/SparkStreamingApp.scala` — main streaming application
- `data-generator/data_generator.py` — event producer
- `kafka/docker-compose.yml` — Kafka & Zookeeper
- `kafka/mongo-compose.yml` — MongoDB compose (or `ares-anticheat/docker-compose.yml`)
- `docs/trello_import.csv` — Trello import of project tasks
- `docs/bloom_filter_implementation.md` — Bloom Filter documentation
- `docs/BLOOM_FILTER_QUICK_REFERENCE.md` — Bloom Filter quick start

## 🆕 Bloom Filter Implementation

The system now includes a comprehensive **Bloom Filter** system for:
- ✅ **Duplicate Detection** - Prevent reprocessing the same events
- ✅ **Threat Tracking** - Fast O(1) lookup for flagged players
- ✅ **Memory Efficiency** - Only ~87 KB overhead for millions of elements
- ✅ **Automatic Persistence** - Bloom filter state saved to disk every 10 minutes

### Quick Start
```bash
# Check for duplicate event
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"playerId":"p1","eventType":"mouseMove","timestamp":1702000000}'

# Report a detection (auto-flags player)
curl -X POST http://localhost:3000/api/detections \
  -H "Content-Type: application/json" \
  -d '{"playerId":"p1","cheatType":"Aimbot-Speed","cheatScore":85,"timestamp":1702000001}'

# Get player threat profile
curl http://localhost:3000/api/detections/player/p1

# View statistics
curl http://localhost:3000/api/admin/bloom-filters/stats
```

### New API Endpoints

**Event Deduplication:**
- `POST /api/events` - Ingest event with Bloom Filter dedup
- `GET /api/events/dedup/stats` - Deduplication statistics

**Detection Tracking:**
- `POST /api/detections` - Report detection with threat flagging
- `GET /api/detections/player/:playerId` - Threat profile
- `GET /api/detections/threats/stats` - Threat statistics

**Player Management:**
- `POST /api/players/:playerId/flag` - Manually flag player
- `GET /api/players/:playerId/threat-profile` - Detailed threat profile
- `GET /api/players/bloom/stats` - Filter statistics
- `POST /api/players/bloom/reset` - Reset filters

**Admin Control:**
- `GET /api/admin/bloom-filters/stats` - All statistics
- `POST /api/admin/bloom-filters/save` - Save to disk
- `POST /api/admin/bloom-filters/load` - Load from disk
- `POST /api/admin/bloom-filters/reset-all` - Reset everything

### Key Features
- **Zero False Negatives** - If an element is stored, it WILL be found
- **Fast Queries** - O(1) time complexity (~microseconds)
- **Auto-Save** - Persisted to `./bloom-filter-data/` every 10 minutes
- **Auto-Reset** - Filters reset automatically (1-2 hour intervals)
- **Low Memory** - ~87 KB total for all filters

### Architecture

```
Event Flow:
Client → POST /api/events
         ↓
    Bloom Filter dedup check
    ├─ Duplicate? → 409 Conflict
    └─ New? → Save to DB

Detection Flow:
Client → POST /api/detections
         ↓
    Bloom Filter dedup check
    ├─ Flag player based on threat type
    ├─ Mark high-risk if score ≥ 80
    └─ Save to DB

Player Query:
GET /api/players/:playerId
├─ DB stats
├─ Bloom Filter threat profile
└─ Combined response
```

For detailed documentation, see:
- [Bloom Filter Implementation](docs/bloom_filter_implementation.md)
- [Quick Reference](docs/BLOOM_FILTER_QUICK_REFERENCE.md)
- Add a `scripts/run-stack.ps1` that starts Docker, waits for services, and launches the generator.
- Add `mongo-spark-connector` to `build.sbt` and switch the sink to `format("mongo")`.
- Create a small integration test script to automatically validate end-to-end flow.

Pick one and I'll implement it next.

