package org.ares.streaming

import org.apache.spark.sql.{SparkSession, Dataset, Row}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import com.typesafe.config.ConfigFactory

import com.mongodb.client.MongoClients
import org.bson.Document
import scala.collection.JavaConverters._
import com.mongodb.client.model.ReplaceOptions

object SparkStreamingApp {

  def main(args: Array[String]): Unit = {

    val spark = SparkSession.builder()
      .appName("Ares AntiCheat - Spark Streaming (Unified Producer Compatible)")
      .master("local[*]")
      .getOrCreate()

    spark.sparkContext.setLogLevel("ERROR")
    spark.conf.set("spark.sql.shuffle.partitions", "4")
    spark.conf.set("spark.streaming.backpressure.enabled", "true")
    spark.conf.set("spark.sql.streaming.stateStore.maintenanceInterval", "30s")

    println("🔥 Spark Streaming App Started (Unified Schema)...")

    // Allow tuning via environment for production
    val maxOffsetsPerTriggerEnv = sys.env.getOrElse("MAX_OFFSETS_PER_TRIGGER", "1000")

    // ------------------------------------------------------------
    // Load detection rules config 
    // ------------------------------------------------------------
    val conf = ConfigFactory.parseFile(new java.io.File("c:/Ares-AntiCheat-System/config/detection_rules.conf")).resolve()

    // Existing rules (legacy) - keep for compatibility if needed
    val speedMin = conf.getDouble("rules.aimbot-speed.minSpeed")
    val flickMin = conf.getDouble("rules.aimbot-flick.minSpeed")
    val requireFlick = conf.getBoolean("rules.aimbot-flick.requireFlick")
    val roboticMaxDelta = conf.getDouble("rules.robotic-aim.maxDelta")
    val roboticMinSpeed = conf.getDouble("rules.robotic-aim.minSpeed")
    val noRecoilMaxDeltaY = conf.getDouble("rules.no-recoil.maxDeltaY")
    val noRecoilMinSpeed = conf.getDouble("rules.no-recoil.minSpeed")
    val aimLinearityHigh = if (conf.hasPath("rules.ml.aimLinearityHigh")) conf.getDouble("rules.ml.aimLinearityHigh") else 0.85
    val trackingSmoothnessLow = if (conf.hasPath("rules.ml.trackingSmoothnessLow")) conf.getDouble("rules.ml.trackingSmoothnessLow") else 0.35
    val snapSpeedHigh = if (conf.hasPath("rules.ml.snapSpeedHigh")) conf.getDouble("rules.ml.snapSpeedHigh") else 400.0

    val recoilHigh = if (conf.hasPath("rules.ml.recoilHigh")) conf.getDouble("rules.ml.recoilHigh") else 0.95
    val sprayHigh = if (conf.hasPath("rules.ml.sprayHigh")) conf.getDouble("rules.ml.sprayHigh") else 0.90

    val movementSpeedHigh = if (conf.hasPath("rules.ml.movementSpeedHigh")) conf.getDouble("rules.ml.movementSpeedHigh") else 320.0
    val directionChangesHigh = if (conf.hasPath("rules.ml.directionChangesHigh")) conf.getDouble("rules.ml.directionChangesHigh") else 5.0

    // ------------------------------------------------------------
    // Kafka Streaming Source
    // ------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "player-events")
      .option("startingOffsets", "earliest")
      .option("maxOffsetsPerTrigger", maxOffsetsPerTriggerEnv)
      .option("failOnDataLoss", "false")
      .option("minPartitions", "1")
      .option("fetchOffset.numRetries", "30")
      .option("kafka.request.timeout.ms", "120000")
      .option("kafka.metadata.max.age.ms", "30000")
      .load()

    val rawJson = kafkaDF.selectExpr("CAST(value AS STRING) as json")

    // ------------------------------------------------------------
    // Unified Schema 
    // ------------------------------------------------------------
    val schema = new StructType()
      .add("event_id", StringType)
      .add("schema_version", StringType)

      // identity (both styles)
      .add("player_id", StringType)
      .add("playerId", StringType)

      // event type (both styles)
      .add("event_type", StringType)
      .add("eventType", StringType)

      // time
      .add("timestamp", StringType)      // ISO
      .add("unix_timestamp", LongType)   // ms

      // legacy movement fields (spark old)
      .add("deltaX", DoubleType)
      .add("deltaY", DoubleType)
      .add("speed", DoubleType)
      .add("isFlick", BooleanType)

      // unified movement fields
      .add("movement_speed", DoubleType)
      .add("direction_changes_per_sec", DoubleType)
      .add("speed_anomaly_detected", BooleanType)

      // aim / ML features
      .add("aim_snap_angle", DoubleType)
      .add("aim_snap_speed", DoubleType)
      .add("tracking_smoothness", DoubleType)
      .add("aim_linearity", DoubleType)
      .add("acceleration_variance", DoubleType)
      .add("aim_corrections_count", IntegerType)
      .add("is_flick_shot", BooleanType)

      // recoil / shooting features
      .add("recoil_recovery_score", DoubleType)
      .add("spray_pattern_score", DoubleType)
      .add("time_between_shots_ms", DoubleType)

      // labels (useful for analytics/training, but Spark doesn't "trust" them)
      .add("is_cheater", BooleanType)
      .add("cheat_type", StringType)
      .add("risk_hint", StringType)

    // Parse JSON and keep original raw field for events_raw
    val parsedWithJson = rawJson
      .select(from_json(col("json"), schema).as("data"), col("json"))
      .select(col("data.*"), col("json"))

    // ------------------------------------------------------------
    // Normalize fields to ONE naming style
    // ------------------------------------------------------------
    val normalized = parsedWithJson
      .withColumn("player_id_norm", coalesce(col("player_id"), col("playerId")))
      .withColumn("event_type_norm", coalesce(col("event_type"), col("eventType")))
      // Normalize unix timestamp: use provided `unix_timestamp` or parse ISO `timestamp` to ms
      .withColumn("unix_ts_norm",
        coalesce(
          col("unix_timestamp"),
          (unix_timestamp(col("timestamp")).cast(LongType) * lit(1000)).cast(LongType)
        )
      )
      .withColumn("movement_speed_norm", coalesce(col("movement_speed"), col("speed")))
      .withColumn("is_flick_norm", coalesce(col("is_flick_shot"), col("isFlick"), lit(false)))
      .withColumn("aim_linearity_norm", coalesce(col("aim_linearity"), lit(0.55)))
      .withColumn("tracking_smoothness_norm", coalesce(col("tracking_smoothness"), lit(0.55)))
      .withColumn("aim_snap_speed_norm", coalesce(col("aim_snap_speed"), lit(0.0)))
      .withColumn("recoil_recovery_norm", coalesce(col("recoil_recovery_score"), lit(0.55)))
      .withColumn("spray_pattern_norm", coalesce(col("spray_pattern_score"), lit(0.55)))
      .withColumn("direction_changes_norm", coalesce(col("direction_changes_per_sec"), lit(2.0)))
      .withColumn("speed_anomaly_norm", coalesce(col("speed_anomaly_detected"), lit(false)))

    // Base DF used for detections & features
    val baseDF = normalized.select(
      col("event_id"),
      col("player_id_norm").alias("player_id"),
      col("event_type_norm").alias("event_type"),
      col("unix_ts_norm").alias("unix_timestamp"),
      col("timestamp").alias("timestamp_iso"),

      // legacy movement
      col("deltaX"), col("deltaY"), col("speed"),
      col("isFlick"),

      // unified features
      col("movement_speed_norm").alias("movement_speed"),
      col("direction_changes_norm").alias("direction_changes_per_sec"),
      col("speed_anomaly_norm").alias("speed_anomaly_detected"),

      // aim features
      col("aim_snap_angle"),
      col("aim_snap_speed_norm").alias("aim_snap_speed"),
      col("tracking_smoothness_norm").alias("tracking_smoothness"),
      col("aim_linearity_norm").alias("aim_linearity"),
      col("acceleration_variance"),
      col("aim_corrections_count"),
      col("is_flick_norm").alias("is_flick_shot"),

      // recoil & spray
      col("recoil_recovery_norm").alias("recoil_recovery_score"),
      col("spray_pattern_norm").alias("spray_pattern_score"),
      col("time_between_shots_ms"),

      // labels
      col("risk_hint"),
      col("cheat_type"),
      col("is_cheater"),

      // raw
      col("json").alias("raw_json")
    ).filter(col("player_id").isNotNull && col("unix_timestamp").isNotNull)

    // ------------------------------------------------------------
    // Spark Rule-based Detection (ML-Aware)
    // ------------------------------------------------------------

    // Legacy rules (keep, but they will often be weak with new generator)
    val legacyAimbotDF = baseDF.filter(
      (col("speed") > lit(speedMin)) ||
        ((col("speed") > lit(flickMin)) && (if (requireFlick) col("isFlick") === true else lit(true)))
    )

    val legacyNoRecoilDF = baseDF.filter(
      abs(col("deltaY")) < lit(noRecoilMaxDeltaY) && col("speed") > lit(noRecoilMinSpeed)
    )

    val legacyRoboticDF = baseDF.filter(
      abs(col("deltaX")) < lit(roboticMaxDelta) &&
        abs(col("deltaY")) < lit(roboticMaxDelta) &&
        col("speed") > lit(roboticMinSpeed)
    )

    // NEW rules using ML-ready features
    val aimbotPatternDF = baseDF.filter(
      col("aim_linearity") > lit(aimLinearityHigh) &&
        col("tracking_smoothness") < lit(trackingSmoothnessLow) &&
        col("aim_snap_speed") > lit(snapSpeedHigh)
    )

    val noRecoilPatternDF = baseDF.filter(
      col("recoil_recovery_score") > lit(recoilHigh) &&
        col("spray_pattern_score") > lit(sprayHigh)
    )

    val speedHackPatternDF = baseDF.filter(
      col("movement_speed") > lit(movementSpeedHigh) ||
        col("direction_changes_per_sec") > lit(directionChangesHigh) ||
        col("speed_anomaly_detected") === true
    )

    val suspiciousDF =
      legacyAimbotDF.withColumn("ruleTriggered", lit("Legacy-Aimbot"))
        .union(legacyNoRecoilDF.withColumn("ruleTriggered", lit("Legacy-NoRecoil")))
        .union(legacyRoboticDF.withColumn("ruleTriggered", lit("Legacy-RoboticAim")))
        .union(aimbotPatternDF.withColumn("ruleTriggered", lit("Aimbot-Pattern")))
        .union(noRecoilPatternDF.withColumn("ruleTriggered", lit("NoRecoil-Pattern")))
        .union(speedHackPatternDF.withColumn("ruleTriggered", lit("SpeedHack-Pattern")))
        .withColumn("source", lit("spark"))
        .withColumn("detected_at", col("unix_timestamp"))
        .withColumn("evidence",
          struct(
            col("event_type"),
            col("aim_linearity"),
            col("tracking_smoothness"),
            col("aim_snap_speed"),
            col("recoil_recovery_score"),
            col("spray_pattern_score"),
            col("movement_speed"),
            col("direction_changes_per_sec"),
            col("speed_anomaly_detected"),
            col("risk_hint")
          )
        )

    // Score mapping (simple and stable)
    val detectionsStructured = suspiciousDF
      .withColumn("cheatScore",
        when(col("ruleTriggered") === "Aimbot-Pattern", lit(0.85))
          .when(col("ruleTriggered") === "NoRecoil-Pattern", lit(0.80))
          .when(col("ruleTriggered") === "SpeedHack-Pattern", lit(0.78))
          .when(col("ruleTriggered") === "Legacy-Aimbot", lit(0.60))
          .when(col("ruleTriggered") === "Legacy-NoRecoil", lit(0.58))
          .when(col("ruleTriggered") === "Legacy-RoboticAim", lit(0.55))
          .otherwise(lit(0.50))
      )
      .select(
        col("player_id"),
        col("detected_at"),
        col("ruleTriggered"),
        col("cheatScore"),
        col("source"),
        col("evidence")
      )
      .withColumn("playerId", col("player_id"))
      .withColumn("timestamp", col("detected_at"))

    // ------------------------------------------------------------
    // events_raw: store raw event JSON 
    // ------------------------------------------------------------
    val eventsRawStructured = baseDF.select(
      col("event_id"),
      col("player_id"),
      col("unix_timestamp"),
      col("event_type"),
      col("raw_json").alias("rawEvent")
    )
    .withColumn("playerId", col("player_id"))
    .withColumn("timestamp", col("unix_timestamp"))

  
    val checkpointBase = sys.env.getOrElse("SPARK_CHECKPOINT_DIR", "checkpoint")
    val baseUri = sys.env.getOrElse("MONGO_URI", "mongodb://localhost:27018")
    def writeToMongo(df: Dataset[Row], collectionName: String, batchId: Long): Unit = {
      val printable = s"$baseUri/ares_anticheat.$collectionName"
      println(s"Writing to MongoDB -> $printable (batch: $batchId) | rows: ${df.count()}")
      if (collectionName == "events_raw" || collectionName == "events_features" || collectionName == "detections") {
        writeToMongoAppend(df, collectionName, batchId)
        try {
          val client = MongoClients.create(baseUri)
          try {
            val coll = client.getDatabase("ares_anticheat").getCollection(collectionName)
            val total = coll.countDocuments()
            println(s"[verify-driver] $collectionName totalDocuments=$total")
            try {
              val doc = coll.find().sort(new org.bson.Document("timestamp", -1)).first()
              if (doc != null) println(s"[verify-driver] $collectionName latest=${doc.toJson}")
            } catch { case _: Throwable => () }
          } finally client.close()
        } catch { case _: Throwable => () }

        return
      }

      try {
        val dfWithId = if (collectionName == "detections") {
          df
        } else if (df.columns.contains("_id")) {
          df
        } else if (df.columns.contains("event_id")) {
          df.withColumn("_id", col("event_id"))
        } else {
          val pidCol = coalesce(col("player_id"), col("playerId"))
          val idCol = if (df.columns.contains("detected_at")) {
            concat(pidCol, lit("-"), col("detected_at").cast(StringType))
          } else if (df.columns.contains("timestamp")) {
            concat(pidCol, lit("-"), col("timestamp").cast(StringType))
          } else if (df.columns.contains("unix_timestamp")) {
            concat(pidCol, lit("-"), col("unix_timestamp").cast(StringType))
          } else {
            concat(pidCol, lit("-"), lit(batchId.toString))
          }
          df.withColumn("_id", idCol)
        }

        // Try using the MongoDB Spark Connector first (distributed, fast)
        dfWithId.write
          .format("mongodb")
          .option("uri", baseUri)
          .option("database", "ares_anticheat")
          .option("collection", collectionName)
          .mode("append")
          .save()

        println(s"✔️ Saved batch $batchId -> $collectionName (connector)")
        try {
          val client = MongoClients.create(baseUri)
          try {
            val coll = client.getDatabase("ares_anticheat").getCollection(collectionName)
            val total = coll.countDocuments()
            println(s"[verify-driver] $collectionName totalDocuments=$total")
          } finally client.close()
        } catch {
          case e: Exception => println(s"[verify-driver] count failed: ${e.getMessage}")
        }
      } catch {
        case e: Exception =>
          println(s"MongoDB connector write failed for $collectionName / batch $batchId: " + e.getMessage)
          println("Falling back to per-partition append writer to avoid stopping the stream.")
          writeToMongoAppend(df, collectionName, batchId)
      }
    }

    def writeHeartbeat(batchId: Long): Unit = {
      import spark.implicits._
      val heartbeatDF = Seq((batchId, System.currentTimeMillis())).toDF("batchId", "processedAt")
      try {
        heartbeatDF.write
          .format("mongodb")
          .option("uri", baseUri)
          .option("database", "ares_anticheat")
          .option("collection", "spark_heartbeat")
          .mode("append")
          .save()
        println(s"✔️ Heartbeat saved for batch $batchId")
      } catch {
        case e: Exception => println(s"Heartbeat write failed: " + e.getMessage)
      }
    }

    def writeToMongoWithUpsert(df: Dataset[Row], collectionName: String, batchId: Long): Unit = {
      val fieldNames = df.schema.fieldNames
      df.foreachPartition { (iter: scala.collection.Iterator[Row]) =>
        val client = MongoClients.create(baseUri)
        try {
          val coll = client.getDatabase("ares_anticheat").getCollection(collectionName)
          val replaceOpt = new ReplaceOptions().upsert(true)
          iter.foreach { row =>
            def toBsonValue(v: Any): AnyRef = {
              if (v == null) null
              else v match {
                case r: org.apache.spark.sql.Row =>
                  try {
                    val schema = r.getClass.getMethod("schema").invoke(r)
                    val fieldNamesNested = schema.getClass.getMethod("fieldNames").invoke(schema).asInstanceOf[Array[String]]
                    val nestedDoc = new Document()
                    var j = 0
                    while (j < fieldNamesNested.length) {
                      val key = fieldNamesNested(j)
                      nestedDoc.append(key, toBsonValue(r.get(j)))
                      j += 1
                    }
                    nestedDoc
                  } catch {
                    case _: Throwable =>
                      // Fallback
                      val lst = new java.util.ArrayList[AnyRef]()
                      var j = 0
                      while (j < r.length) { lst.add(toBsonValue(r.get(j))); j += 1 }
                      lst
                  }
                case seq: scala.collection.Seq[_] =>
                  val jl = new java.util.ArrayList[AnyRef]()
                  seq.foreach(x => jl.add(toBsonValue(x)))
                  jl
                case arr: Array[_] =>
                  val jl = new java.util.ArrayList[AnyRef]()
                  arr.foreach(x => jl.add(toBsonValue(x)))
                  jl
                case m: scala.collection.Map[_, _] =>
                  val d = new Document()
                  m.foreach { case (k, v) => d.append(String.valueOf(k), toBsonValue(v)) }
                  d
                case other => other.asInstanceOf[AnyRef]
              }
            }

            val doc = new Document()
            var i = 0
            while (i < fieldNames.length) {
              val k = fieldNames(i)
              val v = row.get(i)
              val conv = toBsonValue(v)
              if (conv != null) doc.append(k, conv)
              i += 1
            }

            if (doc.containsKey("_id")) {
              val idVal = doc.get("_id")
              coll.replaceOne(new Document("_id", idVal), doc, replaceOpt)
            } else {
              coll.insertOne(doc)
            }
          }
        } catch {
          case e: Exception =>
            println(s"Executor partition write error for $collectionName / batch $batchId: " + e.getMessage)
        } finally {
          client.close()
        }
      }
      println(s"✔️ Fallback upsert completed for batch $batchId -> $collectionName")
    }

    def writeToMongoAppend(df: Dataset[Row], collectionName: String, batchId: Long): Unit = {
      val fieldNames = df.schema.fieldNames
      df.foreachPartition { (iter: scala.collection.Iterator[Row]) =>
        val client = MongoClients.create(baseUri)
        try {
          val coll = client.getDatabase("ares_anticheat").getCollection(collectionName)
          val batch = new java.util.ArrayList[Document]()
          var count = 0
          while (iter.hasNext) {
            val row = iter.next()
            val doc = new Document()
            var i = 0
            while (i < fieldNames.length) {
              val k = fieldNames(i)
              val v = row.get(i)
              def toBsonValueLocal(vv: Any): AnyRef = {
                if (vv == null) null
                else vv match {
                  case r: org.apache.spark.sql.Row =>
                    try {
                      val schema = r.getClass.getMethod("schema").invoke(r)
                      val fieldNamesNested = schema.getClass.getMethod("fieldNames").invoke(schema).asInstanceOf[Array[String]]
                      val nestedDoc = new Document()
                      var j = 0
                      while (j < fieldNamesNested.length) {
                        nestedDoc.append(fieldNamesNested(j), toBsonValueLocal(r.get(j)))
                        j += 1
                      }
                      nestedDoc
                    } catch {
                      case _: Throwable =>
                        val jl = new java.util.ArrayList[AnyRef]()
                        var j = 0
                        while (j < r.length) { jl.add(toBsonValueLocal(r.get(j))); j += 1 }
                        jl
                    }
                  case seq: scala.collection.Seq[_] =>
                    val jl = new java.util.ArrayList[AnyRef]()
                    seq.foreach(x => jl.add(toBsonValueLocal(x)))
                    jl
                  case arr: Array[_] =>
                    val jl = new java.util.ArrayList[AnyRef]()
                    arr.foreach(x => jl.add(toBsonValueLocal(x)))
                    jl
                  case m: scala.collection.Map[_, _] =>
                    val d = new Document()
                    m.foreach { case (kk, vv) => d.append(String.valueOf(kk), toBsonValueLocal(vv)) }
                    d
                  case other => other.asInstanceOf[AnyRef]
                }
              }

              val converted = toBsonValueLocal(v)
              if (converted != null) doc.append(k, converted)
              i += 1
            }
            batch.add(doc)
            count += 1
            if (batch.size() >= 500) {
              coll.insertMany(batch)
              batch.clear()
            }
          }
          if (batch.size() > 0) {
            coll.insertMany(batch)
            batch.clear()
          }
        } catch {
          case e: Exception => println(s"Executor partition append error for $collectionName / batch $batchId: " + e.getMessage)
        } finally {
          client.close()
        }
      }
      println(s"✔️ Append completed for batch $batchId -> $collectionName")
    }

    // -----------------------------
    // Write detections
    // -----------------------------
    val suspiciousQuery = detectionsStructured.writeStream
      .trigger(org.apache.spark.sql.streaming.Trigger.ProcessingTime("5 seconds"))
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
        println(s"[detections] Processing batch $batchId - rows: ${batchDF.count()}")
        writeToMongo(batchDF, "detections", batchId)
        try {
          writeToMongoAppend(batchDF, "suspicious", batchId)
          try {
            val client = MongoClients.create(baseUri)
            try {
              val coll = client.getDatabase("ares_anticheat").getCollection("suspicious")
              val total = coll.countDocuments()
              println(s"[verify-driver] suspicious totalDocuments=$total")
            } finally client.close()
          } catch { case _: Throwable => () }
        } catch { case e: Exception => println(s"mirror to suspicious failed: ${e.getMessage}") }
      }
      .option("checkpointLocation", s"$checkpointBase/suspicious")
      .start()

    // -----------------------------
    // Write events_raw
    // -----------------------------
 
    val allEventsQuery = eventsRawStructured
      .writeStream
      .trigger(org.apache.spark.sql.streaming.Trigger.ProcessingTime("5 seconds"))
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
        writeToMongo(batchDF, "events_raw", batchId)
      }
      .option("checkpointLocation", s"$checkpointBase/events")
      .start()

    // -----------------------------
    // Write events_features 
    // -----------------------------
    import org.apache.spark.sql.expressions.Window

    val featuresQuery = baseDF.writeStream
      .trigger(org.apache.spark.sql.streaming.Trigger.ProcessingTime("5 seconds"))
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>

        val w = Window.partitionBy(col("player_id")).orderBy(col("unix_timestamp"))

        val withLagBatch = batchDF
          .withColumn("prevMovementSpeed", lag(col("movement_speed"), 1).over(w))
          .withColumn("acceleration", (col("movement_speed") - col("prevMovementSpeed")).cast("double"))
          .withColumn("prevAcceleration", lag(col("acceleration"), 1).over(w))
          .withColumn("jerk", (col("acceleration") - col("prevAcceleration")).cast("double"))
          .withColumn("smoothness",
            when(col("jerk").isNull, lit(1.0))
              .otherwise(expr("1.0 / (abs(jerk) + 1.0)"))
          )

        val featuresStructured = withLagBatch.select(
          col("player_id"),
          col("unix_timestamp"),
          col("event_type"),
          struct(
            col("movement_speed"),
            col("acceleration"),
            col("jerk"),
            col("smoothness"),
            col("direction_changes_per_sec"),
            col("speed_anomaly_detected")
          ).alias("movement"),
          struct(
            col("aim_snap_angle"),
            col("aim_snap_speed"),
            col("tracking_smoothness"),
            col("aim_linearity"),
            col("acceleration_variance"),
            col("aim_corrections_count"),
            col("is_flick_shot")
          ).alias("aim"),
          struct(
            col("recoil_recovery_score"),
            col("spray_pattern_score"),
            col("time_between_shots_ms")
          ).alias("shooting"),
          col("risk_hint")
        )

        writeToMongo(featuresStructured, "events_features", batchId)
      }
      .option("checkpointLocation", s"$checkpointBase/features")
      .start()

    val consoleQuery = detectionsStructured.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    spark.streams.awaitAnyTermination()
  }
}
