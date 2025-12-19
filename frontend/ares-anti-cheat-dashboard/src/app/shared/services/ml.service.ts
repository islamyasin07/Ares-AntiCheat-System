import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { MlDetection, MlCounts, ModelInfo } from '../types/ml.types';

@Injectable({ providedIn: 'root' })
export class MlService {
  constructor(private http: HttpClient) {}

  // Always request fresh data
  private _get<T>(url: string, params?: HttpParams) {
    return this.http.get<T>(url, { params, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  }

  getDetections(options?: { page?: number; limit?: number; playerId?: string; riskLevel?: string; minProb?: number }): Observable<any> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (options?.playerId) params = params.set('playerId', options.playerId);
    if (options?.riskLevel) params = params.set('riskLevel', options.riskLevel);
    if (options?.minProb !== undefined) params = params.set('minProb', String(options.minProb));
    return this._get<any>('/api/ml/detections', params);
  }

  getLiveDetections(): Observable<MlDetection[]> {
    return this._get<MlDetection[]>('/api/ml/detections/live');
  }

  getCounts(): Observable<MlCounts> {
    return this._get<MlCounts>('/api/ml/detections/count');
  }

  getModelInfo(): Observable<ModelInfo> {
    return this._get<ModelInfo>('/api/ml/model/info');
  }

  // Health check for ML service
  health(): Observable<any> {
    return this._get('/api/ml/health');
  }

  analyzePlayer(playerId: string): Observable<any> {
    return this.http.get(`/api/ml/analyze/player/${encodeURIComponent(playerId)}`);
  }

  triggerScanAll(): Observable<any> {
    return this.http.get('/api/ml/scan/all');
  }

  // Dev helper: seed sample detections
  seedSamples(): Observable<any> {
    return this.http.post('/api/ml/seed', {});
  }

  // Get detections for a specific player (explicit endpoint)
  getDetectionsByPlayer(playerId: string): Observable<MlDetection[]> {
    // Use the dedicated endpoint if available
    return this._get<MlDetection[]>(`/api/ml/detections/player/${encodeURIComponent(playerId)}`);
  }
}