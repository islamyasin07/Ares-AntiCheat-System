<div align="center">

# 🛡️ Ares AntiCheat System

### Real-Time Game Cheat Detection Platform

[![Scala](https://img.shields.io/badge/Scala-2.12-DC322F?style=for-the-badge&logo=scala&logoColor=white)](https://scala-lang.org/)
[![Apache Spark](https://img.shields.io/badge/Apache%20Spark-3.5.0-E25A1C?style=for-the-badge&logo=apachespark&logoColor=white)](https://spark.apache.org/)
[![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-7.5.0-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Angular](https://img.shields.io/badge/Angular-17-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

<p align="center">
  <strong>A high-performance streaming pipeline for detecting suspicious player behavior in real-time gaming environments</strong>
</p>

[Features](#-features) •
[Architecture](#-architecture) •
[Quick Start](#-quick-start) •
[Documentation](#-documentation) •
[Contributing](#-contributing)

</div>

---

## 📋 Overview

**Ares AntiCheat System** is a comprehensive real-time cheat detection platform designed to identify and flag suspicious player behaviors such as **Aimbot**, **No-Recoil**, **Speed Hacks**, and **Robotic Aim patterns**. Built with modern streaming technologies, it processes thousands of player events per second and provides instant detection with a beautiful cyberpunk-themed dashboard.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔴 **Real-Time Detection** | Process player events in real-time using Spark Structured Streaming |
| 📊 **Live Dashboard** | Beautiful Angular dashboard with live feed, analytics, and player management |
| 🎯 **Multi-Rule Engine** | Configurable detection rules for various cheat types |
| 👥 **Player Management** | Flag, ban, unflag, and track suspicious players |
| 📈 **Analytics** | Hourly heatmaps, trend analysis, and cheat distribution charts |
| 🔧 **Admin Controls** | Full admin panel for data management and system monitoring |
| 🐳 **Docker Ready** | One-command deployment with Docker Compose |

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Data Generator │────▶│  Apache Kafka   │────▶│  Spark Streaming│
│    (Python)     │     │   (Events)      │     │    (Scala)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │◀────│    Backend      │◀────│    MongoDB      │
│   (Angular)     │     │   (Node.js)     │     │  (Detections)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 📁 Project Structure

```
Ares-AntiCheat-System/
├── 📂 backend/                 # Node.js Express API server
│   └── src/routes/             # API endpoints (players, detections, admin)
├── 📂 frontend/                # Angular 17+ Dashboard
│   └── ares-anti-cheat-dashboard/
├── 📂 spark/                   # Spark Structured Streaming (Scala)
│   └── AresSparkStreaming/
├── 📂 kafka/                   # Docker Compose files
│   ├── docker-compose.yml      # Kafka + Zookeeper
│   └── mongo-compose.yml       # MongoDB
├── 📂 data-generator/          # Python event generator
├── 📂 config/                  # Detection rules configuration
└── 📂 docs/                    # Documentation
```

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required)
- [Node.js 18+](https://nodejs.org/) (for backend & frontend)
- [Java 11+](https://adoptium.net/) & [sbt](https://www.scala-sbt.org/) (for Spark)
- [Python 3.9+](https://www.python.org/) (for data generator)

### Step 1: Clone the Repository

```bash
git clone https://github.com/islamyasin07/Ares-AntiCheat-System.git
cd Ares-AntiCheat-System
git checkout dev
```

### Step 2: Start Infrastructure (Docker)

```bash
# Start Kafka & Zookeeper
cd kafka
docker-compose up -d

# Start MongoDB (separate compose)
docker-compose -f mongo-compose.yml up -d
```

**Services Started:**
| Service | Port | Description |
|---------|------|-------------|
| Zookeeper | 2181 | Kafka coordination |
| Kafka | 9092 | Message broker |
| MongoDB | 27018 | Database storage |

### Step 3: Start Backend API

```bash
cd backend
npm install
npm run build
npm start
```
✅ Backend runs on **http://localhost:3000**

### Step 4: Start Frontend Dashboard

```bash
cd frontend/ares-anti-cheat-dashboard
npm install
ng serve
```
✅ Dashboard runs on **http://localhost:4200**

### Step 5: Start Spark Streaming (Optional - for processing)

```bash
cd spark/AresSparkStreaming
sbt run
```

### Step 6: Generate Test Data (Optional)

```bash
cd data-generator
pip install kafka-python faker
python data_generator.py
```

---

## 📖 Documentation

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/players` | Get all players |
| `GET` | `/api/players/:id` | Get player details |
| `GET` | `/api/detections` | Get all detections |
| `GET` | `/api/stats/overview` | Dashboard statistics |
| `POST` | `/api/admin/players/:id/flag` | Flag a player |
| `POST` | `/api/admin/players/:id/ban` | Ban a player |
| `DELETE` | `/api/admin/clear-detections` | Clear detection data |

### Detection Rules

The system detects the following cheat types:

| Cheat Type | Description | Severity |
|------------|-------------|----------|
| `Aimbot` | Unnatural aim assistance | 🔴 Critical |
| `NoRecoil` | Recoil pattern elimination | 🔴 Critical |
| `SpeedHack` | Movement speed manipulation | 🟠 High |
| `RoboticAim` | Mechanical aim patterns | 🟠 High |
| `WallHack` | Vision through obstacles | 🟡 Medium |

### MongoDB Collections

| Collection | Description |
|------------|-------------|
| `events_raw` | Raw player events from Kafka |
| `detections` | Processed suspicious detections |
| `flagged_players` | Flagged/banned player records |
| `admin_actions` | Admin action audit log |

---

## 🛠️ Configuration

### Environment Variables (Backend)

Create a `.env` file in the `backend/` directory:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27018
DB_NAME=ares_anticheat
ALLOW_ORIGIN=*
```

### Spark Configuration

MongoDB connection in `SparkStreamingApp.scala`:
```scala
val mongoUri = "mongodb://localhost:27018"
val database = "ares_anticheat"
```

---

## 🐛 Troubleshooting

<details>
<summary><strong>Kafka connection refused</strong></summary>

Ensure Docker containers are running:
```bash
docker ps
```
Check Kafka logs:
```bash
docker logs kafka-kafka-1
```
</details>

<details>
<summary><strong>MongoDB connection failed</strong></summary>

Verify MongoDB container:
```bash
docker exec ares-anticheat mongosh --eval "db.stats()"
```
Ensure you're connecting to port `27018` (not `27017`).
</details>

<details>
<summary><strong>Spark out of memory</strong></summary>

The app uses per-partition writes to avoid driver OOMs. If issues persist, increase driver memory:
```bash
sbt -J-Xmx4g run
```
</details>

---

## 👥 Team

| Role | Member |
|------|--------|
| **Project Lead** | [@islamyasin07](https://github.com/islamyasin07) |

---

## 📄 License

This project is part of an academic/educational initiative.

---

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

</div>

