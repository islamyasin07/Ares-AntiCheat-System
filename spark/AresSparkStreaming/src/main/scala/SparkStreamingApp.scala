import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import org.bson.Document
import com.mongodb.client.MongoClients
import scala.collection.JavaConverters._

object SparkStreamingApp {
  def main(args: Array[String]): Unit = {

    val spark = SparkSession.builder()
      .appName("Ares AntiCheat - Spark Streaming")
      .master("local[*]")
      .getOrCreate()

    spark.sparkContext.setLogLevel("ERROR")
    println("🔥 Spark Streaming App Started...")

    val mongoUri = "mongodb://localhost:27017"
    val mongoDB  = "ares_anticheat"

    // -------------------------------------------------------------
    // Kafka Stream
    // -------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "player-events")
      .option("startingOffsets", "latest")
      .load()

    val rawJson = kafkaDF.selectExpr("CAST(value AS STRING) as json")

    // -------------------------------------------------------------
    // Schema
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
    // Detection
    // -------------------------------------------------------------
    val suspiciousDF = parsedDF
      .filter(
        (col("speed") > 100) ||
        (col("isFlick") === true && col("speed") > 85) ||
        (abs(col("deltaY")) < 0.05 && col("speed") > 40) ||
        ((abs(col("deltaX")) < 0.15) && (abs(col("deltaY")) < 0.15) && col("speed") > 30)
      )
      .withColumn("cheatType",
        when(col("speed") > 100, "Aimbot-Speed")
          .when(col("isFlick") === true && col("speed") > 85, "Aimbot-Flick")
          .when(abs(col("deltaY")) < 0.05 && col("speed") > 40, "No-Recoil")
          .when(abs(col("deltaX")) < 0.15 && abs(col("deltaY")) < 0.15 && col("speed") > 30, "Robotic-Aim")
          .otherwise("Unknown")
      )

    // -------------------------------------------------------------
    // 1) Write suspicious → MongoDB
    // -------------------------------------------------------------
    val suspiciousQuery = suspiciousDF.writeStream
      .foreachBatch { (batchDF: org.apache.spark.sql.Dataset[org.apache.spark.sql.Row], batchId: Long) =>
        if (!batchDF.isEmpty) {

          batchDF.toJSON.rdd.foreachPartition { iter =>
            val jsonList = iter.toList

            if (jsonList.nonEmpty) {
              val client = MongoClients.create("mongodb://localhost:27017")

              try {
                val coll = client.getDatabase("ares_anticheat").getCollection("suspicious")
                val docs = jsonList.map(json => Document.parse(json)).asJava
                coll.insertMany(docs)
              } finally client.close()
            }
          }

          println(s"Inserted suspicious batch $batchId")
        }
      }
      .option("checkpointLocation", "checkpoint/suspicious")
      .start()

    // -------------------------------------------------------------
    // 2) Write ALL events → MongoDB
    // -------------------------------------------------------------
    val eventsQuery = parsedDF.writeStream
      .foreachBatch { (batchDF: org.apache.spark.sql.Dataset[org.apache.spark.sql.Row], batchId: Long) =>
        if (!batchDF.isEmpty) {

          batchDF.toJSON.rdd.foreachPartition { iter =>
            val jsonList = iter.toList

            if (jsonList.nonEmpty) {
              val client = MongoClients.create("mongodb://localhost:27017")

              try {
                val coll = client.getDatabase("ares_anticheat").getCollection("events")
                val docs = jsonList.map(json => Document.parse(json)).asJava
                coll.insertMany(docs)
              } finally client.close()
            }
          }

          println(s"Inserted events batch $batchId")
        }
      }
      .option("checkpointLocation", "checkpoint/events")
      .start()

    // -------------------------------------------------------------
    // 3) PRINT TABLE IN TERMINAL (formatted output)
    // -------------------------------------------------------------
    val consoleQuery = suspiciousDF
      .select(
        col("eventType"),
        col("playerId"),
        col("timestamp"),
        col("deltaX"),
        col("deltaY"),
        col("speed"),
        col("isFlick"),
        col("cheatType")
      )
      .writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    spark.streams.awaitAnyTermination()
  }
}
