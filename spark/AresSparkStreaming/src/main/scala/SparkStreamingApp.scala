import org.apache.spark.sql.{SparkSession, Dataset, Row}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

import com.mongodb.client.MongoClients
import org.bson.Document
import scala.collection.JavaConverters._

object SparkStreamingApp {

  def main(args: Array[String]): Unit = {

    val spark = SparkSession.builder()
      .appName("Ares AntiCheat - Spark Streaming")
      .master("local[*]")
      .getOrCreate()

    spark.sparkContext.setLogLevel("ERROR")
    println("🔥 Spark Streaming App Started...")

    // -------------------------------------------------------------
    // 1) Kafka Stream
    // -------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "player-events")
      .option("startingOffsets", "latest")
      .load()

    val rawJson = kafkaDF.selectExpr("CAST(value AS STRING) as json")

    // -------------------------------------------------------------
    // 2) Schema
    // -------------------------------------------------------------
    val schema = new StructType()
      .add("eventType", StringType)
      .add("playerId", StringType)
      .add("timestamp", LongType)
      .add("deltaX", DoubleType)
      .add("deltaY", DoubleType)
      .add("speed", DoubleType)
      .add("isFlick", BooleanType)

    val parsedDF = rawJson
      .select(from_json(col("json"), schema).as("data"))
      .select("data.*")

    // -------------------------------------------------------------
    // 3) Detection Rules (Relaxed for testing)
    // -------------------------------------------------------------
    val aimbotDF = parsedDF.filter(
      col("speed") > 50 ||
      (col("isFlick") === true && col("speed") > 40)
    )

    val norecoilDF = parsedDF.filter(
      abs(col("deltaY")) < 0.2 && col("speed") > 30
    )

    val roboticDF = parsedDF.filter(
      abs(col("deltaX")) < 0.3 &&
      abs(col("deltaY")) < 0.3 &&
      col("speed") > 25
    )

    val suspiciousDF = aimbotDF
      .union(norecoilDF)
      .union(roboticDF)
      .withColumn("cheatType",
        when(col("speed") > 100, "Aimbot-Speed")
          .when(col("isFlick") && col("speed") > 85, "Aimbot-Flick")
          .when(abs(col("deltaY")) < 0.05 && col("speed") > 40, "No-Recoil")
          .when(abs(col("deltaX")) < 0.15 && abs(col("deltaY")) < 0.15 && col("speed") > 30, "Robotic-Aim")
          .otherwise("Unknown")
      )

    // -------------------------------------------------------------
    // 4) MongoDB Insert Function (Reusable)
    // -------------------------------------------------------------
    def writeToMongo(
        df: Dataset[Row],
        collectionName: String,
        batchId: Long
    ): Unit = {

      if (df.isEmpty) return

      val mongoUri = sys.env.getOrElse("MONGO_URI", "mongodb://localhost:27017")
      println(s"Connecting to MongoDB -> $mongoUri, DB -> ares_anticheat, coll -> $collectionName (batch: $batchId)")
      val client = MongoClients.create(mongoUri)
      try {
        val coll = client.getDatabase("ares_anticheat").getCollection(collectionName)

          val docs = df.toJSON.collect().map(Document.parse).toList.asJava
        if (!docs.isEmpty) {
          coll.insertMany(docs)
            println(s"✔️ Inserted ${docs.size()} documents → $collectionName (batch: $batchId)")
        }
      } catch {
        case e: Exception =>
          println(s"❌ MongoDB Error in $collectionName / batch $batchId: " + e.getMessage)
      } finally {
        client.close()
      }
    }

    // -------------------------------------------------------------
    // 5) Suspicious Events → MongoDB.suspicious
    // -------------------------------------------------------------
    val suspiciousQuery = suspiciousDF.writeStream
  .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
    writeToMongo(batchDF, "suspicious", batchId)
  }
  .option("checkpointLocation", "checkpoint/suspicious")
  .start()

val allEventsQuery = parsedDF.writeStream
  .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
    writeToMongo(batchDF, "events", batchId)
  }
  .option("checkpointLocation", "checkpoint/events")
  .start()


    // -------------------------------------------------------------
    // 7) Console Output (nice for debugging)
    // -------------------------------------------------------------
    val consoleQuery = suspiciousDF.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    spark.streams.awaitAnyTermination()
  }
}
