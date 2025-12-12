import { spawn } from 'child_process';
import path from 'path';
const KAFKA_INSPECTOR_PATH = path.join(__dirname, '../../../kafka', 'kafka_inspector.py');

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
 * List all available Kafka topics
 */
export async function listTopics(): Promise<KafkaTopicsResponse> {
    return new Promise((resolve, reject) => {
        // Prefer `python`, fall back to `python3` on some systems
        const exeCandidates = ['python', 'python3'];
        let tried = 0;

        const trySpawn = () => {
            const exe = exeCandidates[tried++] || exeCandidates[0];
            console.log("RUNNING PY:", KAFKA_INSPECTOR_PATH);
            const python = spawn(exe, [KAFKA_INSPECTOR_PATH, '--topics']);
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
                // If executable not found, try next candidate
                if ((err as any).code === 'ENOENT' && tried < exeCandidates.length) {
                    trySpawn();
                    return;
                }
                reject(err);
            });

            python.on('close', (code) => {
                clearTimeout(timer);
                if (timedOut) {
                    // try next python candidate if available
                    if (tried < exeCandidates.length) {
                        trySpawn();
                        return;
                    }
                    reject(new Error('Kafka inspector timed out'));
                    return;
                }

                if (code !== 0) {
                    // If the inspector logged a clear connection error, return empty list instead of failing
                    if (stderr && /NoBrokersAvailable|NoBrokersAvailableError|Failed to.*connect|Connection refused/i.test(stderr)) {
                        resolve({ topics: [] });
                        return;
                    }
                    reject(new Error(`Kafka inspector failed: ${stderr || 'exit code ' + code}`));
                    return;
                }

                const topics = parseTopics(stdout);
                resolve({ topics });
            });
        };

        trySpawn();
    });
}

/**
 * Describe a specific Kafka topic with partition details
 */
export async function describeTopic(topicName: string): Promise<TopicInfo> {
    return new Promise((resolve, reject) => {
        const exeCandidates = ['python', 'python3'];
        let tried = 0;

        const trySpawn = () => {
            const exe = exeCandidates[tried++] || exeCandidates[0];
            const python = spawn(exe, [KAFKA_INSPECTOR_PATH, '--describe', topicName]);
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
                if ((err as any).code === 'ENOENT' && tried < exeCandidates.length) {
                    trySpawn();
                    return;
                }
                reject(err);
            });

            python.on('close', (code) => {
                clearTimeout(timer);
                if (timedOut) {
                    if (tried < exeCandidates.length) {
                        trySpawn();
                        return;
                    }
                    reject(new Error('Kafka inspector timed out'));
                    return;
                }

                if (code !== 0) {
                    if (stderr && /NoBrokersAvailable|NoBrokersAvailableError|Failed to.*connect|Connection refused/i.test(stderr)) {
                        // return empty topic info when broker unavailable
                        resolve({ name: topicName, partitions: [] });
                        return;
                    }
                    reject(new Error(`Failed to describe topic: ${stderr || 'exit code ' + code}`));
                    return;
                }

                const topicInfo = parseTopicDescription(topicName, stdout);
                resolve(topicInfo);
            });
        };

        trySpawn();
    });
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
