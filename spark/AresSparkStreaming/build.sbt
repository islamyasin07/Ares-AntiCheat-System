name := "AresSparkStreaming"

version := "0.1"

scalaVersion := "2.12.18"

Compile / run / mainClass := Some("org.ares.streaming.SparkStreamingApp")
// Fork the run process to avoid classpath and memory issues when running Spark locally
Compile / run / fork := true

// JVM options required to allow Spark to access internal JDK classes when running on Java 17
Compile / run / javaOptions ++= Seq(
  "--add-exports", "java.base/sun.nio.ch=ALL-UNNAMED",
  "--add-opens",   "java.base/java.nio=ALL-UNNAMED"
)

libraryDependencies ++= Seq(
  // Spark core dependencies
  "org.apache.spark" %% "spark-sql" % "3.5.0",
  "org.apache.spark" %% "spark-streaming" % "3.5.0",
  "org.mongodb.spark" %% "mongo-spark-connector" % "10.3.0",
  "org.apache.spark" %% "spark-sql-kafka-0-10" % "3.5.0",
  // MongoDB Java Driver (used directly in foreachBatch)
  "org.mongodb" % "mongodb-driver-sync" % "4.11.1",
  // Config library for externalized detection rules
  "com.typesafe" % "config" % "1.4.3",
  // Test framework
  "org.scalameta" %% "munit" % "0.7.29" % Test
)
