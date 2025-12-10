import org.apache.spark.sql.{SparkSession, Dataset, Row}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import com.typesafe.config.ConfigFactory

import com.mongodb.client.MongoClients
import org.bson.Document
import scala.collection.JavaConverters._
object SparkStreamingApp {

  def main(args: Array[String]): Unit = {
    val spark = SparkSession.builder()
      .appName("Ares AntiCheat - Spark Streaming")
      .master("local[1]")
      .getOrCreate()

    spark.sparkContext.setLogLevel("ERROR")
    println("🔥 Spark Streaming App Started...")
    spark.conf.set("spark.sql.shuffle.partitions", "1")
    spark.conf.set("spark.streaming.backpressure.enabled", "true")
    spark.conf.set("spark.sql.streaming.stateStore.maintenanceInterval", "30s")

    // Load detection rules config
    val conf = ConfigFactory.parseFile(new java.io.File("c:/Ares-AntiCheat-System/config/detection_rules.conf")).resolve()
    val speedMin = conf.getDouble("rules.aimbot-speed.minSpeed")
    val flickMin = conf.getDouble("rules.aimbot-flick.minSpeed")
    val requireFlick = conf.getBoolean("rules.aimbot-flick.requireFlick")
    val roboticMaxDelta = conf.getDouble("rules.robotic-aim.maxDelta")
    val roboticMinSpeed = conf.getDouble("rules.robotic-aim.minSpeed")
    val noRecoilMaxDeltaY = conf.getDouble("rules.no-recoil.maxDeltaY")
    val noRecoilMinSpeed = conf.getDouble("rules.no-recoil.minSpeed")

    // Use explicit partition assignment to avoid partition resolution timeouts in local dev.
      val kafkaDF = spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", "localhost:9092")
        .option("subscribe", "player-events")
      .option("startingOffsets", "latest")
        .option("maxOffsetsPerTrigger", "1000")
      .option("failOnDataLoss", "false")
      .option("minPartitions", "1")
      .option("fetchOffset.numRetries", "30")
      .option("kafka.request.timeout.ms", "120000")
      .option("kafka.metadata.max.age.ms", "30000")
      .load()

    val rawJson = kafkaDF.selectExpr("CAST(value AS STRING) as json")

    val schema = new StructType()
      .add("eventType", StringType)
      .add("playerId", StringType)
      .add("timestamp", LongType)
      .add("deltaX", DoubleType)
      .add("deltaY", DoubleType)
      .add("speed", DoubleType)
      .add("isFlick", BooleanType)

    // Parse JSON and keep original raw field for events_raw
    val parsedWithJson = rawJson
      .select(from_json(col("json"), schema).as("data"), col("json"))
      .select(col("data.*"), col("json"))
    val parsedDF = parsedWithJson.select("eventType", "playerId", "timestamp", "deltaX", "deltaY", "speed", "isFlick")

    // Feature engineering will be computed inside foreachBatch (static DF) to avoid
    // unsupported row-based window functions on streaming DFs.

    val aimbotDF = parsedDF.filter(
      (col("speed") > speedMin) ||
      ((col("speed") > flickMin) && (if (requireFlick) col("isFlick") === true else lit(true)))
    )

    val norecoilDF = parsedDF.filter(
      abs(col("deltaY")) < noRecoilMaxDeltaY && col("speed") > noRecoilMinSpeed
    )

    val roboticDF = parsedDF.filter(
      abs(col("deltaX")) < roboticMaxDelta &&
      abs(col("deltaY")) < roboticMaxDelta &&
      col("speed") > roboticMinSpeed
    )

    val suspiciousDF = aimbotDF
      .union(norecoilDF)
      .union(roboticDF)
      .withColumn("cheatType",
        when(col("speed") > speedMin, "Aimbot-Speed")
          .when((col("speed") > flickMin) && (if (requireFlick) col("isFlick") === true else lit(true)), "Aimbot-Flick")
          .when(abs(col("deltaY")) < noRecoilMaxDeltaY && col("speed") > noRecoilMinSpeed, "No-Recoil")
          .when(abs(col("deltaX")) < roboticMaxDelta && abs(col("deltaY")) < roboticMaxDelta && col("speed") > roboticMinSpeed, "Robotic-Aim")
      )
      .filter(col("cheatType").isNotNull)

    val detectionsStructured = suspiciousDF.select(
      col("playerId"), col("timestamp"), col("isFlick"), col("eventType"),
      col("cheatType").alias("ruleTriggered"),
      (when(col("cheatType") === "Aimbot-Speed", col("speed")/150.0)
        .when(col("cheatType") === "Aimbot-Flick", lit(0.8))
        .when(col("cheatType") === "Robotic-Aim", lit(0.7))
        .otherwise(lit(0.5))).alias("cheatScore"))

    val eventsRawStructured = parsedWithJson.select(
      col("playerId"), col("timestamp"),
      struct(col("deltaX"), col("deltaY"), col("speed")).alias("movement"),
      col("isFlick"), col("eventType"), col("json").alias("rawEvent"))

    // events_features will be derived per-batch

    def writeToMongo(
      df: Dataset[Row],
      collectionName: String,
      batchId: Long
    ): Unit = {

      // Proceed without an explicit emptiness action to avoid planning issues
      // Collect JSON docs and skip insert if none

        // Use port 27018 to avoid local MongoDB service conflict on 27017
        val mongoUri = "mongodb://localhost:27018"
      println(s"Connecting to MongoDB -> $mongoUri, DB -> ares_anticheat, coll -> $collectionName (batch: $batchId)")
      val client = MongoClients.create(mongoUri)
      try {
        val coll = client.getDatabase("ares_anticheat").getCollection(collectionName)

        val docsList = df.toJSON.collect().map(Document.parse).toList
        if (docsList.nonEmpty) {
          coll.insertMany(docsList.asJava)
          println(s"✔️ Inserted ${docsList.size} documents → $collectionName (batch: $batchId)")
        } else {
          println(s"No documents to insert → $collectionName (batch: $batchId)")
        }
      } catch {
        case e: Exception =>
          println(s"MongoDB Error in $collectionName / batch $batchId: " + e.getMessage)
      } finally {
        client.close()
      }
    }

    val suspiciousQuery = detectionsStructured.writeStream
      .trigger(org.apache.spark.sql.streaming.Trigger.ProcessingTime("5 seconds"))
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
        writeToMongo(batchDF, "detections", batchId)
      }
      .option("checkpointLocation", "checkpoint/suspicious")
      .start()

    val allEventsQuery = eventsRawStructured.writeStream
      .trigger(org.apache.spark.sql.streaming.Trigger.ProcessingTime("5 seconds"))
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
        writeToMongo(batchDF, "events_raw", batchId)
      }
      .option("checkpointLocation", "checkpoint/events")
      .start()

    import org.apache.spark.sql.expressions.Window
    val featuresQuery = parsedDF.writeStream
      .trigger(org.apache.spark.sql.streaming.Trigger.ProcessingTime("5 seconds"))
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
        val w = Window.partitionBy(col("playerId")).orderBy(col("timestamp"))
        val withLagBatch = batchDF
          .withColumn("prevSpeed", lag(col("speed"), 1).over(w))
          .withColumn("acceleration", (col("speed") - col("prevSpeed")).cast("double"))
          .withColumn("prevAccel", lag(col("acceleration"), 1).over(w))
          .withColumn("jerk", (col("acceleration") - col("prevAccel")).cast("double"))
          .withColumn("smoothness", when(col("jerk").isNull, lit(1.0)).otherwise(expr("1.0 / (abs(jerk) + 1.0)")))

        val featuresStructured = withLagBatch.select(
          col("playerId"), col("timestamp"),
          struct(col("deltaX"), col("deltaY"), col("speed"), col("acceleration"), col("jerk"), col("smoothness")).alias("movement"),
          col("isFlick"), col("eventType"))

        writeToMongo(featuresStructured, "events_features", batchId)
      }
      .option("checkpointLocation", "checkpoint/features")
      .start()

    val consoleQuery = detectionsStructured.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    spark.streams.awaitAnyTermination()
  }
}
