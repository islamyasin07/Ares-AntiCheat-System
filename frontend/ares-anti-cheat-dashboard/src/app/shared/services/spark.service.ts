import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SparkDetection } from '../types/ml.types';

@Injectable({ providedIn: 'root' })
export class SparkService {
  constructor(private http: HttpClient) {}

  // Always request fresh data
  private _get<T>(url: string, params?: HttpParams) {
    return this.http.get<T>(url, { params, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  }

  getRuleDetections(options?: { playerId?: string; limit?: number }): Observable<any> {
    let params = new HttpParams();
    if (options?.playerId) params = params.set('playerId', options.playerId);
    if (options?.limit) params = params.set('limit', String(options.limit));
    return this._get<{ items: SparkDetection[] }>('/api/detections', params);
  }

  getLiveRuleDetections(): Observable<SparkDetection[]> {
    return this._get<SparkDetection[]>('/api/detections/live-db');
  }

  getOverview(): Observable<any> {
    return this._get('/api/stats/overview');
  }
}
