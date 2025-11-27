name := "AresSparkStreaming"

version := "0.1"

scalaVersion := "2.12.18"

libraryDependencies ++= Seq(
  "org.apache.spark" %% "spark-sql" % "3.5.0",
  "org.apache.spark" %% "spark-streaming" % "3.5.0",
  "org.apache.spark" %% "spark-sql-kafka-0-10" % "3.5.0",
  // Test framework
  "org.scalameta" %% "munit" % "0.7.29" % Test,
  "org.mongodb.spark" %% "mongo-spark-connector" % "3.0.1",
  "org.mongodb" % "mongodb-driver-sync" % "4.11.1"
)
