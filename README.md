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

Contact / ownership
- Repo owner: `islamyasin07`
- Open issues or tasks in the Trello board or create GitHub issues for larger items (connector, CI, dockerization).

If you want, I can now:
- Add a `scripts/run-stack.ps1` that starts Docker, waits for services, and launches the generator.
- Add `mongo-spark-connector` to `build.sbt` and switch the sink to `format("mongo")`.
- Create a small integration test script to automatically validate end-to-end flow.

Pick one and I'll implement it next.

