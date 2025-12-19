import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TopicsResponse {
  topics: string[];
}

export interface PartitionInfo {
  partition: number;
  earliestOffset: number;
  latestOffset: number;
  lag: number;
}

export interface TopicDetailResponse {
  name: string;
  partitions: PartitionInfo[];
}

@Injectable({
  providedIn: 'root'
})
export class KafkaService {
  private apiUrl = `${environment.apiUrl}/kafka`;

  constructor(private http: HttpClient) { }

  /**
   * Get list of all Kafka topics
   */
  listTopics(): Observable<TopicsResponse> {
    return this.http.get<TopicsResponse>(`${this.apiUrl}/topics`);
  }

  /**
   * Get details about a specific topic including partition information
   */
  describeTopic(topicName: string): Observable<TopicDetailResponse> {
    return this.http.get<TopicDetailResponse>(`${this.apiUrl}/topics/${topicName}`);
  }
}
