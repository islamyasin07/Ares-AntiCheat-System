package org.ares.streaming

import com.typesafe.config.ConfigFactory
import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import org.apache.spark.sql.{Dataset, Row}
import org.bson.Document
import com.mongodb.client.MongoClients
import scala.collection.JavaConverters._

object SparkStreamingApp {
  def main(args: Array[String]): Unit = {
    val config = ConfigFactory.load()

    val appName = config.getString("spark.appName")
    val sparkMaster = config.getString("spark.master")

    val kafkaServers = config.getString("kafka.bootstrap.servers")
    val kafkaTopic = config.getString("kafka.topic")
    val startingOffsets = config.getString("kafka.startingOffsets")

    val mongoUri = config.getString("mongo.uri")
    val mongoDB  = config.getString("mongo.db")

    val checkpointSuspicious = config.getString("checkpoint.suspicious")
    val checkpointEvents = config.getString("checkpoint.events")

    val spark = SparkSession.builder()
      .appName(appName)
      .master(sparkMaster)
      .getOrCreate()

    spark.sparkContext.setLogLevel("ERROR")
    println("🔥 Spark Streaming App Started...")

    // -------------------------------------------------------------
    // Kafka Stream
    // -------------------------------------------------------------
    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", kafkaServers)
      .option("subscribe", kafkaTopic)
      .option("startingOffsets", startingOffsets)
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

    val enhancedSchema = new StructType()
      .add("eventType", StringType)
      .add("playerId", StringType)
      .add("timestamp", LongType)
      .add("deltaX", DoubleType)
      .add("deltaY", DoubleType)
      .add("speed", DoubleType)
      .add("isFlick", BooleanType)
      .add("playerName", StringType)
      .add("rank", StringType)
      .add("country", StringType)

    val parsedDF = rawJson
      .select(from_json(col("json"), enhancedSchema).as("data"))
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
      .withColumn("cheatScore",
        when(col("cheatType") === "Aimbot-Speed", col("speed") / 150.0)
          .when(col("cheatType") === "Aimbot-Flick", 0.8)
          .when(col("cheatType") === "Robotic-Aim", 0.7)
          .otherwise(0.5)
      )

    // -------------------------------------------------------------
    // 1) Write suspicious → MongoDB (per-partition)
    // -------------------------------------------------------------
    val newCheckpointSuspicious = checkpointSuspicious + "_new"
    val newCheckpointEvents = checkpointEvents + "_new"

    val suspiciousQuery = suspiciousDF.writeStream
      .foreachBatch { (batchDF: org.apache.spark.sql.Dataset[org.apache.spark.sql.Row], batchId: Long) =>
        if (!batchDF.isEmpty) {

          batchDF.toJSON.rdd.foreachPartition { iter =>
            val jsonList = iter.toList

            if (jsonList.nonEmpty) {
              val client = MongoClients.create(mongoUri)

              try {
                val coll = client.getDatabase(mongoDB).getCollection("suspicious")
                val docs = jsonList.map(json => Document.parse(json)).asJava
                coll.insertMany(docs)
              } finally client.close()
            }
          }

          println(s"Inserted suspicious batch $batchId")
        }
      }
      .option("checkpointLocation", newCheckpointSuspicious)
      .start()

    // -------------------------------------------------------------
    // 2) Write ALL events → MongoDB (per-partition)
    // -------------------------------------------------------------
    val eventsQuery = parsedDF.writeStream
      .foreachBatch { (batchDF: org.apache.spark.sql.Dataset[org.apache.spark.sql.Row], batchId: Long) =>
        if (!batchDF.isEmpty) {

          batchDF.toJSON.rdd.foreachPartition { iter =>
            val jsonList = iter.toList

            if (jsonList.nonEmpty) {
              val client = MongoClients.create(mongoUri)

              try {
                val coll = client.getDatabase(mongoDB).getCollection("events")
                val docs = jsonList.map(json => Document.parse(json)).asJava
                coll.insertMany(docs)
              } finally client.close()
            }
          }

          println(s"Inserted events batch $batchId")
        }
      }
      .option("checkpointLocation", newCheckpointEvents)
      .start()

    // -------------------------------------------------------------
    // 3) PRINT TABLE IN TERMINAL (formatted output)
    // -------------------------------------------------------------
    def prettyPrintDF(df: Dataset[Row], maxRows: Int = 25): Unit = {
      try {
        val cols = df.columns
        val rows = df.take(maxRows)

        if (rows.isEmpty) {
          println("[PrettyPrint] (no rows)")
          return
        }

        // compute column widths
        val colWidths = cols.indices.map { i =>
          val headerLen = cols(i).length
          val maxValLen = rows.map { r =>
            val v = Option(r.get(i)).map(_.toString).getOrElse("null")
            v.length
          }.foldLeft(0)(Math.max)
          Math.max(headerLen, maxValLen)
        }

        // helper to pad
        def pad(s: String, w: Int) = if (s.length >= w) s else s + " " * (w - s.length)

        // header
        val header = cols.zip(colWidths).map { case (c, w) => pad(c, w) }.mkString(" | ")
        val sep = colWidths.map(w => "-" * w).mkString("-+-")

        println("\n[PrettyPrint] Suspicious Events (first " + rows.length + ")")
        println(header)
        println(sep)

        rows.foreach { r =>
          val line = cols.indices.map { i =>
            val v = Option(r.get(i)).map(_.toString).getOrElse("null")
            pad(v, colWidths(i))
          }.mkString(" | ")
          println(line)
        }

        if (rows.length == maxRows) println(s"... (showing first $maxRows rows)")
        println()
      } catch {
        case e: Throwable => println(s"[PrettyPrint] Error printing rows: ${e.getMessage}")
      }
    }

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
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>
        if (!batchDF.isEmpty) {
          prettyPrintDF(batchDF, 25)
        }
      }
      .option("checkpointLocation", "checkpoint/console")
      .start()

    spark.streams.awaitAnyTermination()
  }
}
