name := "AresSparkStreaming"

version := "0.1"

scalaVersion := "2.12.18"

libraryDependencies ++= Seq(
  // Spark core dependencies
  "org.apache.spark" %% "spark-sql" % "3.5.0",
  "org.apache.spark" %% "spark-streaming" % "3.5.0",
  "org.apache.spark" %% "spark-sql-kafka-0-10" % "3.5.0",

  // MongoDB Java Driver (used directly in foreachBatch)
  "org.mongodb" % "mongodb-driver-sync" % "4.11.1",

  // Test framework
  "org.scalameta" %% "munit" % "0.7.29" % Test
)
