import { spawn } from 'child_process';
import path from 'path';
import { retryWithBackoff, RetryConfig, sleep } from '../utils/retryUtils';

const KAFKA_INSPECTOR_PATH = path.join(__dirname, '../../../kafka', 'kafka_inspector.py');

/**
 * Kafka-specific retry configuration
 */
const KAFKA_RETRY_CONFIG: RetryConfig = {
    maxRetries: 4,
    initialDelayMs: 1000,
    maxDelayMs: 16000,
    backoffMultiplier: 2,
};

interface TopicInfo {
    name: string;
    partitions: PartitionInfo[];
}

interface PartitionInfo {
    partition: number;
    earliestOffset: number;
    latestOffset: number;
    lag: number;
}

interface KafkaTopicsResponse {
    topics: string[];
}

/**
 * Execute Python script with retry and automatic Python version fallback
 */
async function executePythonScript(
    args: string[],
    label: string = 'Kafka Inspector'
): Promise<string> {
    const exeCandidates = ['python', 'python3'];

    return retryWithBackoff(
        async () => {
            return new Promise<string>((resolve, reject) => {
                let lastError: Error | null = null;
                let tried = 0;

                const tryExecution = async () => {
                    if (tried >= exeCandidates.length) {
                        reject(
                            lastError || new Error('No Python executable found')
                        );
                        return;
                    }

                    const exe = exeCandidates[tried++];
                    const python = spawn(exe, args);
                    let stdout = '';
                    let stderr = '';
                    let timedOut = false;

                    const timer = setTimeout(() => {
                        timedOut = true;
                        python.kill();
                    }, 5000);

                    python.stdout.on('data', (data) => {
                        stdout += data.toString();
                    });

                    python.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });

                    python.on('error', (err) => {
                        clearTimeout(timer);
                        lastError = err;
                        if ((err as any).code === 'ENOENT') {
                            // Python not found, try next candidate
                            tryExecution();
                        } else {
                            reject(err);
                        }
                    });

                    python.on('close', (code) => {
                        clearTimeout(timer);

                        if (timedOut) {
                            lastError = new Error('Kafka inspector process timed out');
                            tryExecution(); // Try next Python version
                            return;
                        }

                        if (code !== 0) {
                            lastError = new Error(
                                `Kafka inspector failed: ${stderr || 'exit code ' + code}`
                            );

                            // Check if it's a connection error - these might be temporary
                            if (
                                stderr &&
                                /NoBrokersAvailable|NoBrokersAvailableError|Failed to.*connect|Connection refused/i.test(
                                    stderr
                                )
                            ) {
                                tryExecution(); // Retry on connection errors
                            } else {
                                reject(lastError);
                            }
                            return;
                        }

                        resolve(stdout);
                    });
                };

                tryExecution();
            });
        },
        KAFKA_RETRY_CONFIG,
        label
    );
}

/**
 * List all available Kafka topics
 * Uses retry logic with exponential backoff
 */
export async function listTopics(): Promise<KafkaTopicsResponse> {
    try {
        const stdout = await executePythonScript(
            [KAFKA_INSPECTOR_PATH, '--topics'],
            'Kafka List Topics'
        );
        const topics = parseTopics(stdout);
        return { topics };
    } catch (error) {
        console.error('Failed to list Kafka topics:', error);
        return { topics: [] };
    }
}

/**
 * Describe a specific Kafka topic with partition details
 * Uses retry logic with exponential backoff
 */
export async function describeTopic(topicName: string): Promise<TopicInfo> {
    try {
        const stdout = await executePythonScript(
            [KAFKA_INSPECTOR_PATH, '--describe', topicName],
            `Kafka Describe Topic: ${topicName}`
        );
        const topicInfo = parseTopicDescription(topicName, stdout);
        return topicInfo;
    } catch (error) {
        console.error(`Failed to describe Kafka topic '${topicName}':`, error);
        return { name: topicName, partitions: [] };
    }
}

/**
 * Parse topic list output from kafka_inspector
 */
function parseTopics(output: string): string[] {
    const lines = output.split('\n');
    const topics: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            topics.push(trimmed.substring(2));
        }
    }

    return topics;
}

/**
 * Parse topic description output from kafka_inspector
 */
function parseTopicDescription(topicName: string, output: string): TopicInfo {
    const lines = output.split('\n');
    const partitions: PartitionInfo[] = [];
    let currentPartition: Partial<PartitionInfo> | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Match "Partition N:" pattern
        const partitionMatch = trimmed.match(/^Partition (\d+):/);
        if (partitionMatch) {
            if (currentPartition) {
                partitions.push(currentPartition as PartitionInfo);
            }
            currentPartition = {
                partition: parseInt(partitionMatch[1], 10),
            };
            continue;
        }

        if (!currentPartition) continue;

        // Match "• Earliest Offset: N"
        const earliestMatch = trimmed.match(/Earliest Offset:\s*(\d+)/);
        if (earliestMatch) {
            currentPartition.earliestOffset = parseInt(earliestMatch[1], 10);
        }

        // Match "• Latest Offset: N"
        const latestMatch = trimmed.match(/Latest Offset:\s*(\d+)/);
        if (latestMatch) {
            currentPartition.latestOffset = parseInt(latestMatch[1], 10);
        }

        // Match "• Lag: N"
        const lagMatch = trimmed.match(/Lag:\s*(\d+)/);
        if (lagMatch) {
            currentPartition.lag = parseInt(lagMatch[1], 10);
        }
    }

    if (currentPartition) {
        partitions.push(currentPartition as PartitionInfo);
    }

    return {
        name: topicName,
        partitions,
    };
}
