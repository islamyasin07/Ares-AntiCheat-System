import { Component, OnInit } from '@angular/core';
import { NgIf, NgForOf, AsyncPipe, CommonModule } from '@angular/common';
import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { KafkaService } from '../../shared/services/kafka.service';

interface Topic {
    name: string;
}

interface PartitionInfo {
    partition: number;
    earliestOffset: number;
    latestOffset: number;
    lag: number;
}

interface TopicDetail {
    name: string;
    partitions: PartitionInfo[];
}

@Component({
    selector: 'app-kafka-monitoring',
    standalone: true,
    imports: [NgIf, NgForOf, AsyncPipe, CommonModule, GlowCardComponent, StatCardComponent],
    templateUrl: './kafka-monitoring.component.html',
    styleUrls: ['./kafka-monitoring.component.css']
})
export class KafkaMonitoringComponent implements OnInit {
    topics: Topic[] = [];
    selectedTopic: TopicDetail | null = null;
    loading = false;
    error: string | null = null;

    totalTopics = 0;
    totalPartitions = 0;
    totalLag = 0;

    constructor(private kafkaService: KafkaService) { }

    ngOnInit(): void {
        this.loadTopics();
    }

    loadTopics(): void {
        this.loading = true;
        this.error = null;

        this.kafkaService.listTopics().subscribe({
            next: (response) => {
                this.topics = response.topics.map(name => ({ name }));
                this.totalTopics = this.topics.length;
                this.loading = false;
            },
            error: (err) => {
                this.error = 'Failed to load topics';
                this.loading = false;
                console.error('Error loading topics:', err);
            }
        });
    }

    selectTopic(topicName: string): void {
        this.loading = true;
        this.error = null;

        this.kafkaService.describeTopic(topicName).subscribe({
            next: (response) => {
                this.selectedTopic = response;
                this.totalPartitions = response.partitions.length;
                this.totalLag = response.partitions.reduce((sum, p) => sum + p.lag, 0);
                this.loading = false;
            },
            error: (err) => {
                this.error = `Failed to load topic details for ${topicName}`;
                this.loading = false;
                console.error('Error loading topic details:', err);
            }
        });
    }

    getLagStatus(lag: number): string {
        if (lag === 0) return 'healthy';
        if (lag < 100) return 'warning';
        return 'critical';
    }

    refreshTopicDetails(): void {
        if (this.selectedTopic) {
            this.selectTopic(this.selectedTopic.name);
        }
    }
}
