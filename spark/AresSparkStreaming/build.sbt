name := "AresSparkStreaming"

version := "0.1"

scalaVersion := "2.12.18"

libraryDependencies ++= Seq(
  "org.apache.spark" %% "spark-sql" % "3.5.0",
  "org.apache.spark" %% "spark-streaming" % "3.5.0",
  "org.apache.spark" %% "spark-sql-kafka-0-10" % "3.5.0",
  "org.mongodb" % "mongodb-driver-sync" % "4.11.1",
  "com.typesafe" % "config" % "1.4.2"
)
