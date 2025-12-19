import org.apache.spark.sql.{SparkSession, SaveMode}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

object AnalyticsJob {

  def main(args: Array[String]): Unit = {

    // 1. Spark Session
    val spark = SparkSession.builder()
      .appName("Ares Batch Analytics")
      .master("local[*]") 
      .config("spark.mongodb.read.connection.uri", "mongodb://localhost:27018") 
      .config("spark.mongodb.read.database", "ares_anticheat")
      .getOrCreate()

    spark.sparkContext.setLogLevel("WARN")
    import spark.implicits._

    println("🚀 Starting Batch Analytics on Ares Data...")
    // 2. Load Data from MongoDB

    val eventsDF = spark.read
      .format("mongodb")
      .option("collection", "events_raw")
      .load()

    val suspiciousDF = spark.read
      .format("mongodb")
      .option("collection", "detections")
      .load()

    println("📊 Calculating Statistics...")

    // Top 10 players with most suspicious events
    val topSuspiciousPlayers = suspiciousDF
      .groupBy("playerId") 
      .count()
      .withColumnRenamed("count", "suspicious_events_count")
      .orderBy(col("suspicious_events_count").desc)
      .limit(10)

    //  Cheat type distribution
    val cheatTypeDist = suspiciousDF
      .groupBy("ruleTriggered") 
      .count()
      .withColumnRenamed("count", "occurrence")
      .orderBy(col("occurrence").desc)

    //  Average speed per player
    val avgSpeedPerPlayer = eventsDF
      .groupBy("playerId")
      .agg(avg(col("movement.speed")).as("average_speed")) 
      .orderBy(col("average_speed").desc)

    //  Hourly event distribution
    val hourlyDist = eventsDF
      .select(col("timestamp"))
      .withColumn("event_time", from_unixtime(col("timestamp"))) 
      .withColumn("hour", hour(col("event_time")))
      .groupBy("hour")
      .count()
      .withColumnRenamed("count", "events_volume")
      .orderBy("hour")

    //  Output (CSV)

    val outputDir = "analytics_output"
    

    def saveToCsv(df: org.apache.spark.sql.Dataset[_], fileName: String): Unit = {
      df.coalesce(1) // Merges into 1 file for easier reading
        .write
        .mode(SaveMode.Overwrite)
        .option("header", "true")
        .csv(s"$outputDir/$fileName")
      println(s"✅ Saved: $fileName")
    }

    saveToCsv(topSuspiciousPlayers, "suspicious_by_player")
    saveToCsv(cheatTypeDist, "cheat_type_distribution")
    saveToCsv(avgSpeedPerPlayer, "speed_avg")
    saveToCsv(hourlyDist, "hourly_event_distribution")

    println("🎉 Batch Job Completed Successfully!")
    spark.stop()
  }
}