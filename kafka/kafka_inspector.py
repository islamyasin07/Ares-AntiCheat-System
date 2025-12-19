import argparse
from kafka import KafkaConsumer
from kafka import TopicPartition

BOOTSTRAP = "localhost:9092"


def list_topics():
    consumer = KafkaConsumer(bootstrap_servers=BOOTSTRAP)
    topics = consumer.topics()
    print("Available Topics:\n------------------")
    for t in topics:
        print(f"- {t}")


def describe_topic(topic_name):
    consumer = KafkaConsumer(bootstrap_servers=BOOTSTRAP)

    if topic_name not in consumer.topics():
        print(f" Topic '{topic_name}' not found!")
        return

    partitions = consumer.partitions_for_topic(topic_name)
    print(f"Topic: {topic_name}")
    print("---------------------------")

    for p in partitions:
        tp = TopicPartition(topic_name, p)

        consumer.assign([tp])

        earliest = consumer.beginning_offsets([tp])[tp]
        latest = consumer.end_offsets([tp])[tp]

        lag = latest - earliest

        print(f"Partition {p}:")
        print(f"  • Earliest Offset: {earliest}")
        print(f"  • Latest Offset:   {latest}")
        print(f"  • Lag:             {lag}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kafka Topic Inspector")

    parser.add_argument("--topics", action="store_true", help="List all topics")
    parser.add_argument("--describe", type=str, help="Describe a specific topic")

    args = parser.parse_args()

    if args.topics:
        list_topics()
    elif args.describe:
        describe_topic(args.describe)
    else:
        print("Usage:")
        print("  python kafka_inspector.py --topics")
        print("  python kafka_inspector.py --describe <topic-name>")
