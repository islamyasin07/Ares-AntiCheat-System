// Thin compatibility wrapper to the refactored packaged app.
// Keeps the existing `SparkStreamingApp` main entrypoint for backwards compatibility.
object SparkStreamingApp {
  def main(args: Array[String]): Unit = {
    org.ares.streaming.SparkStreamingApp.main(args)
  }
}
