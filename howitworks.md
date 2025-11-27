# 🛡️ Ares Anti-Cheat – Real-Time Big Data Analytics System

Ares is a **real-time behavioral anti-cheat system** built using a complete Big Data streaming pipeline:
- **Kafka** for real-time event ingestion  
- **Spark Structured Streaming (Scala)** for processing  
- **Python** generator for simulated gameplay telemetry  
- **MongoDB** for storing suspicious events  
- **Future:** Backend API + Frontend Dashboard  

This system analyzes players’ aiming behavior live and detects cheating patterns (aimbot, no-recoil, flicks, robotic movements).

---

# 📂 Project Structure

    
---

# 🚀 System Overview (Architecture)

**1) Python Data Generator**  
Creates realistic AIM movement events:
- `deltaX`, `deltaY`, `speed`, `isFlick`, `timestamp`, `playerId`  
Simulates **normal players** & **cheaters**.

**2) Kafka Cluster**  
Ingests data in real-time to topic:


**3) Spark Structured Streaming**  
Reads Kafka stream → parses JSON → applies anti-cheat rules.

**4) MongoDB**  
Stores suspicious events & player analytics.

**5) Backend (Future)**  
REST API: `/players`, `/anomalies`, `/analytics`.

**6) Dashboard (Future)**  
Real-time UI showing detection results.

---

# 🧠 What The System Detects

Using Spark real-time analytics:

### ✔ Aimbot Detection  
Speed > 100 + Flick behavior → suspicious

### ✔ No-Recoil  
`abs(deltaY) < 0.05` for long duration

### ✔ Robotic Aim  
Low variance in aim movement

### ✔ Reaction Time  
Too fast → inhuman

### ✔ Abnormal Accuracy  
>70% accuracy over short window

---

# 🧪 Data Example

Every 100ms, a player sends an AIM event:

```json
{
  "eventType": "AIM",
  "playerId": "P02",
  "timestamp": 1763745211083,
  "deltaX": 0.8764,
  "deltaY": -2.7447,
  "speed": 108.89,
  "isFlick": true
}
```
# How to run ? 

### Start Kafka Cluster : 
## cd kafka docker-compose up -d


