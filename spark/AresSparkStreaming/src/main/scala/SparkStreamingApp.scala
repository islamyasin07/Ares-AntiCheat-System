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

    println("Spark Streaming Started...")

    // -------------------------------------------------------------
    // 1) Read from Kafka
    // -------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "player-events")
      .option("startingOffsets", "latest")
      .load()

    // Kafka value → String
    val rawJson = kafkaDF.selectExpr("CAST(value AS STRING) as json")

    // -------------------------------------------------------------
    // 2) Define JSON Schema
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

    // Print parsed output
    val query = parsedDF.writeStream
      .outputMode("append")
      .format("console")
      .option("truncate", "false")
      .start()

    query.awaitTermination()
  }
}
