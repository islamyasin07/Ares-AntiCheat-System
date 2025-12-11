# Kafka Monitoring – Topic Inspection Tool

## Overview
This tool provides lightweight Kafka monitoring without using Spark.  
It allows developers to inspect:
- Topics
- Partitions
- Earliest / Latest Offsets
- Lag

This is useful for debugging ingestion pipelines and ensuring Kafka is receiving data correctly.

---

## How to Use

### List all topics
To list all available Kafka topics, run:
```
python kafka_inspector.py --topics
```
Output example:
```
=== Available Topics ===
- player-events
```

### Describe a specific topic
To get partition details, earliest/latest offsets, and lag:
```
python kafka_inspector.py --describe player-events
```
Output example:
```
Topic: player-events
---------------------------
Partition 0:
  • Earliest Offset: 0
  • Latest Offset:   209988
  • Lag:             209988
```

---

## Understanding Offsets
- **Earliest Offset**   
- **Latest Offset**  
- **Lag = latest - earliest**

If earliest = `0` → Kafka still retains all old messages (no retention cleanup).

---

## Checking Kafka Topics from Inside Docker
Because Kafka is running inside Docker, the CLI commands are inside the container.

### 1) View running containers
```
docker ps
```

### 2) Enter the Kafka container
```
docker exec -it <kafka-container-name> bash
```

### 3) Describe a topic using Kafka CLI
```
kafka-topics --bootstrap-server localhost:9092 --describe --topic player-events
```

---

## Example Repository Structure
```
/project
  ├── kafka_inspector.py
  ├── docker-compose.yml
  ├── docs/
  │   └── kafka_monitoring.md
  └── README.md
```

---

## Suggested README Section
```
## Monitoring Tools
This project includes a Kafka monitoring script (`kafka_inspector.py`) used to:
- List Kafka topics
- Inspect partitions
- Read earliest/latest offsets
- Compute lag

This tool verifies data ingestion before Spark processing.
```

---

## Conclusion
The Kafka Inspector provides a simple and efficient way to monitor Kafka topic health in a Docker-based environment. It ensures proper ingestion before running any real-time analytics.
