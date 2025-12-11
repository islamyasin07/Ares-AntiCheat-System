# 📑 Ares Anti-Cheat System: Batch Analytics Report

Spark Batch Analytics Job (Offline Analysis).

**Goal:** To build a batch analytics job using Apache Spark (Scala) to analyze the historical data accumulated in the MongoDB database by the Spark Structured Streaming application (Ares Anti-Cheat Streaming App).

The primary purpose of this task is to transform the collected raw events and detection records into valuable statistics and reports for decision-making and performance monitoring.

## Execution Environment & Code Summary

|       Element           |  Details |
|       :---              |  :---    |
|       **Language**      |  Scala |
|       **Core Library**  |  Apache Spark 3.5.0 |
|       **Data Source**   |  MongoDB (Port 27018, DB: ares_anticheat) |
|       **Code File**     |  `src/main/scala/AnalyticsJob.scala` |
|   **Execution Command** |  `sbt "runMain AnalyticsJob"` |
|      **Write Mode**     |  Overwrite (ensures reports are refreshed on every run) |

##  Data Source Mapping

The job reads data from the following MongoDB collections, which are populated by your Streaming App:

* **`events_raw`**: Contains all raw player movement events (Movement, DeltaX/Y, Speed).
* **`detections`**: Contains events that were classified as suspicious (`playerId`, `ruleTriggered`, `timestamp`, etc.).

##  Calculated Statistics (Analysis Results)

Four key metrics were calculated and output as CSV files in the `analytics_output/` directory:

### 1. Top 10 Players with Most Suspicious Events
* **Filename:** `suspicious_by_player.csv`
* **Operation:** Groups data by `playerId` in the `detections` collection, calculates the `count` of events, and ranks the top 10 players descending.
* **Value:** Identifies the players most likely to be cheating, who may require further investigation or punishment.

### 2. Cheat Type Distribution
* **Filename:** `cheat_type_distribution.csv`
* **Operation:** Groups the `detections` data by the triggered rule (`ruleTriggered`) and calculates the frequency of each cheat type.
* **Value:** Highlights the most prevalent types of cheats being used, which can guide efforts to improve detection rules or patch game vulnerabilities.

### 3. Average Speed per Player
* **Filename:** `speed_avg.csv`
* **Operation:** Groups the `events_raw` data by `playerId` and calculates the average of the `movement.speed` field.
* **Value:** Provides a baseline measure of player performance, useful for detecting outliers that might indicate speed hacks.

### 4. Hourly Event Distribution
* **Filename:** `hourly_event_distribution.csv`
* **Operation:** Converts the Unix `timestamp` to an hour-of-day and counts the total events in each hour.
* **Value:** Identifies peak hours of game activity, which can assist in server maintenance scheduling or resource allocation.

## 5. Interpreting the CSV Outputs

Each output folder in `analytics_output/` contains a `part-00000-....csv` file, which holds the actual data.

|           Output Folder            |           Key Columns           | Example Interpretation |

| **`suspicious_by_player`** | `playerId`, `suspicious_events_count` | Player "Alpha" generated 500 suspicious events. |

| **`cheat_type_distribution`** | `ruleTriggered`, `occurrence` | The "Aimbot-Speed" rule was triggered 12,000 times. |

| **`speed_avg`** | `playerId`, `average_speed` | Player "Beta" has an average speed of 35.5 units/second. | 

| **`hourly_event_distribution`** | `hour`, `events_volume` | At hour 20 (8 PM), 150,000 events were recorded. |


