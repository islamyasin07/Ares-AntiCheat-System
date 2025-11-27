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
    // 1) Read from Kafka
    // -------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "player-events")
      .option("startingOffsets", "earliest")
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
    // 3) Parse JSON → DataFrame
    // -------------------------------------------------------------
    val parsedDF = rawJson
      .select(from_json(col("json"), schema).as("data"))
      .select("data.*")

    // -------------------------------------------------------------
    // 4) Rule-Based Anomaly Detection
    // -------------------------------------------------------------

    // Aimbot: unnatural high speed or high-speed flick
    val aimbotDF = parsedDF.filter(
      (col("speed") > 100) ||
      (col("isFlick") === true && col("speed") > 85)
    )

    // No-Recoil: recoil almost zero
    val norecoilDF = parsedDF.filter(
      (abs(col("deltaY")) < 0.05) && (col("speed") > 40)
    )

    // Robotic Movement: too little variation
    val roboticDF = parsedDF.filter(
      (abs(col("deltaX")) < 0.15) &&
      (abs(col("deltaY")) < 0.15) &&
      (col("speed") > 30)
    )

    // Combine all suspicious events and label them
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
    // 5) Write Streams to Console
    // -------------------------------------------------------------
    val query = parsedDF.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    val suspiciousQuery = suspiciousDF.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", false)
      .start()

    // -------------------------------------------------------------
    // 6) Keep Streams Alive
    // -------------------------------------------------------------
    spark.streams.awaitAnyTermination()
  }
}
