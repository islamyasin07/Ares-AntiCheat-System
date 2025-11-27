import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

object SparkStreamingApp {
  def main(args: Array[String]): Unit = {

    val spark = SparkSession.builder()
      .appName("Ares AntiCheat - Spark Streaming")
      .master("local[*]")
      .getOrCreate()

    spark.sparkContext.setLogLevel("ERROR")

    println("🔥 Spark Streaming App Started...")

    // -------------------------------------------------------------
    // MongoDB CONFIG
    // -------------------------------------------------------------
    spark.conf.set("spark.mongodb.output.uri",
      "mongodb://localhost:27017/ares_anticheat.suspicious"
    )

    // -------------------------------------------------------------
    // 1) Read Kafka Stream
    // -------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "player-events")
      .option("startingOffsets", "latest")
      .load()

    val rawJson = kafkaDF.selectExpr("CAST(value AS STRING) as json")

    // -------------------------------------------------------------
    // 2) Define Schema
    // -------------------------------------------------------------
    val schema = new StructType()
      .add("eventType", StringType)
      .add("playerId", StringType)
      .add("timestamp", LongType)
      .add("deltaX", DoubleType)
      .add("deltaY", DoubleType)
      .add("speed", DoubleType)
      .add("isFlick", BooleanType)

    // -------------------------------------------------------------
    // 3) Parse JSON
    // -------------------------------------------------------------
    val parsedDF = rawJson
      .select(from_json(col("json"), schema).as("data"))
      .select("data.*")

    // -------------------------------------------------------------
    // 4) Rule-Based Detection
    // -------------------------------------------------------------
    val aimbotDF = parsedDF.filter(
      (col("speed") > 100) ||
      (col("isFlick") === true && col("speed") > 85)
    )

    val norecoilDF = parsedDF.filter(
      (abs(col("deltaY")) < 0.05) && (col("speed") > 40)
    )

    val roboticDF = parsedDF.filter(
      (abs(col("deltaX")) < 0.15) &&
      (abs(col("deltaY")) < 0.15) &&
      (col("speed") > 30)
    )

    val suspiciousDF = aimbotDF
      .union(norecoilDF)
      .union(roboticDF)
      .withColumn("cheatType",
        when(col("speed") > 100, "Aimbot-Speed")
          .when(col("isFlick") === true && col("speed") > 85, "Aimbot-Flick")
          .when(abs(col("deltaY")) < 0.05 && col("speed") > 40, "No-Recoil")
          .when(abs(col("deltaX")) < 0.15 && abs(col("deltaY")) < 0.15 && col("speed") > 30, "Robotic-Aim")
          .otherwise("Unknown")
      )

    // -------------------------------------------------------------
    // 5) Write Normal Events to Console
    // -------------------------------------------------------------
    val query = parsedDF.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    // -------------------------------------------------------------
    // 6) Write Suspicious Events to Console
    // -------------------------------------------------------------
    val suspiciousQuery = suspiciousDF.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    // -------------------------------------------------------------
    // 7) Write Suspicious Events to MongoDB
    // -------------------------------------------------------------
    val mongoQuery = suspiciousDF.writeStream
      .format("mongodb")                     // MongoDB Sink
      .option("checkpointLocation", "checkpoint/mongo")
      .outputMode("append")
      .start()

    // -------------------------------------------------------------
    // 8) KEEP STREAMS ALIVE
    // -------------------------------------------------------------
    query.awaitTermination()
    suspiciousQuery.awaitTermination()
    mongoQuery.awaitTermination()
  }
}
