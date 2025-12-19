import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, switchMap, catchError, of, tap, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemLog {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface AnalyticsData {
  ingestion: number;
  detectionRate: number;
  latency: number;
  sparkLoad: number;
  throughputHistory: number[];
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  totalEvents: number;
  totalSuspicious: number;
}

export interface AdminAction {
  id: string;
  action: string;
  timestamp: number;
  details: any;
  performedBy: string;
}

export interface PlayerStatus {
  playerId: string;
  status: 'CLEAN' | 'FLAGGED' | 'BANNED';
  flagged: boolean;
  banned: boolean;
  reason?: string;
  timestamp?: number;
}

export interface SystemInfo {
  database: {
    name: string;
    sizeOnDisk: number;
    collections: number;
  };
  counts: {
    totalEvents: number;
    totalDetections: number;
    flaggedPlayers: number;
    bannedPlayers: number;
    actionHistory: number;
  };
  server: {
    uptime: number;
    memoryUsage: any;
    nodeVersion: string;
  };
}

@Injectable({ providedIn: 'root' })
export class StatsService {

  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  // Dashboard stats stream
  private _stats = new BehaviorSubject<any>(null);
  stats$ = this._stats.asObservable();

  // Live feed
  private _live = new BehaviorSubject<any[]>([]);
  liveFeed$ = this._live.asObservable();

  // Suspicious events
  private _suspicious = new BehaviorSubject<any[]>([]);
  suspiciousEvents$ = this._suspicious.asObservable();

  // Analytics
  private _analytics = new BehaviorSubject<AnalyticsData>({
    ingestion: 0, detectionRate: 0, latency: 0, sparkLoad: 0,
    throughputHistory: [], cpuUsage: 0, memoryUsage: 0, diskUsage: 0,
    totalEvents: 0, totalSuspicious: 0
  });
  analytics$ = this._analytics.asObservable();

  // System logs
  private _logs = new BehaviorSubject<SystemLog[]>([]);
  logs$ = this._logs.asObservable();

  constructor(private http: HttpClient) {
    // Initial load
    this.refreshStats();
    this.refreshLiveFeed();
    this.refreshAnalytics();
    this.refreshLogs();

    // Poll for updates every 2 seconds
    interval(2000).pipe(
      switchMap(() => this.http.get<any>(`${this.apiUrl}/stats/overview`).pipe(
        catchError(() => of(null))
      ))
    ).subscribe(data => {
      if (data) this._stats.next(data);
    });

    // Poll live feed every 1 second
    interval(1000).pipe(
      switchMap(() => this.http.get<any[]>(`${this.apiUrl}/detections/live`).pipe(
        catchError(() => of([]))
      ))
    ).subscribe(data => {
      if (data && data.length) {
        this._live.next(data);
        this._suspicious.next(data);
      }
    });

    // Poll analytics every 2 seconds
    interval(2000).pipe(
      switchMap(() => this.http.get<AnalyticsData>(`${this.apiUrl}/stats/analytics`).pipe(
        catchError(() => of(null))
      ))
    ).subscribe(data => {
      if (data) this._analytics.next(data);
    });

    // Poll logs every 3 seconds
    interval(3000).pipe(
      switchMap(() => this.http.get<SystemLog[]>(`${this.apiUrl}/stats/logs`).pipe(
        catchError(() => of([]))
      ))
    ).subscribe(data => {
      if (data && data.length) this._logs.next(data);
    });
  }

  private refreshStats() {
    this.http.get<any>(`${this.apiUrl}/stats/overview`).pipe(
      catchError(() => of(this.getMockStats()))
    ).subscribe(data => this._stats.next(data));
  }

  private refreshLiveFeed() {
    this.http.get<any[]>(`${this.apiUrl}/detections/live`).pipe(
      catchError(() => of([]))
    ).subscribe(data => {
      this._live.next(data);
      this._suspicious.next(data);
    });
  }

  private refreshAnalytics() {
    this.http.get<AnalyticsData>(`${this.apiUrl}/stats/analytics`).pipe(
      catchError(() => of({
        ingestion: 0, detectionRate: 0, latency: 0, sparkLoad: 0,
        throughputHistory: [], cpuUsage: 0, memoryUsage: 0, diskUsage: 0,
        totalEvents: 0, totalSuspicious: 0
      }))
    ).subscribe(data => this._analytics.next(data));
  }

  private refreshLogs() {
    this.http.get<SystemLog[]>(`${this.apiUrl}/stats/logs`).pipe(
      catchError(() => of([]))
    ).subscribe(data => this._logs.next(data));
  }

  // Player details
  getPlayerDetails(playerId: string) {
    return this.http.get<any>(`${this.apiUrl}/players/${playerId}`).pipe(
      catchError(() => of({
        playerId,
        riskScore: 0,
        totalEvents: 0,
        suspiciousEvents: 0,
        behaviorLabels: ['Aim', 'Recoil', 'Movement', 'Prediction'],
        behaviorValues: [0, 0, 0, 0],
        recentDetections: []
      }))
    );
  }

  // Get all players
  getPlayers() {
    return this.http.get<any[]>(`${this.apiUrl}/players`).pipe(
      catchError(() => of([]))
    );
  }

  // Get player summary
  getPlayerSummary(playerId: string) {
    return this.http.get<any>(`${this.apiUrl}/players/${playerId}/summary`).pipe(
      catchError(() => of({ playerId, detections: 0, lastDetection: null }))
    );
  }

  // Get detections with filters
  getDetections(params: { playerId?: string; page?: number; limit?: number; cheatType?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.playerId) queryParams.set('playerId', params.playerId);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.cheatType) queryParams.set('cheatType', params.cheatType);
    
    return this.http.get<any>(`${this.apiUrl}/detections?${queryParams.toString()}`).pipe(
      catchError(() => of({ items: [], total: 0, page: 1, limit: 50 }))
    );
  }

  // Fallback mock stats if API unavailable
  private getMockStats() {
    return {
      totalEvents: 0,
      totalSuspicious: 0,
      cheatersToday: 0,
      livePlayers: 0,
      perMinuteSuspicious: [],
      cheatDistribution: [],
      hourlyHeatmap: Array(24).fill(0)
    };
  }

  // ========================================
  // ADMIN API METHODS
  // ========================================

  // Data Management
  clearDetections(): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/clear-detections`, {}).pipe(
      catchError(err => of({ success: false, message: err.message }))
    );
  }

  clearEvents(): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/clear-events`, {}).pipe(
      catchError(err => of({ success: false, message: err.message }))
    );
  }

  clearAllData(): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/clear-all`, {}).pipe(
      catchError(err => of({ success: false, message: err.message }))
    );
  }

  // Player Management
  flagPlayer(playerId: string, reason?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/players/${playerId}/flag`, { reason }).pipe(
      catchError(err => of({ success: false, message: err.error?.message || err.message }))
    );
  }

  unflagPlayer(playerId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/players/${playerId}/unflag`, {}).pipe(
      catchError(err => of({ success: false, message: err.error?.message || err.message }))
    );
  }

  banPlayer(playerId: string, reason?: string, duration?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/players/${playerId}/ban`, { reason, duration }).pipe(
      catchError(err => of({ success: false, message: err.error?.message || err.message }))
    );
  }

  unbanPlayer(playerId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/players/${playerId}/unban`, {}).pipe(
      catchError(err => of({ success: false, message: err.error?.message || err.message }))
    );
  }

  getPlayerStatus(playerId: string): Observable<PlayerStatus> {
    return this.http.get<PlayerStatus>(`${this.apiUrl}/admin/players/${playerId}/status`).pipe(
      catchError(() => of({ playerId, status: 'CLEAN' as const, flagged: false, banned: false }))
    );
  }

  getFlaggedPlayers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/players/flagged`).pipe(
      catchError(() => of([]))
    );
  }

  // Action History
  getActionHistory(limit = 50): Observable<AdminAction[]> {
    return this.http.get<AdminAction[]>(`${this.apiUrl}/admin/history?limit=${limit}`).pipe(
      catchError(() => of([]))
    );
  }

  clearActionHistory(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/history`).pipe(
      catchError(err => of({ success: false, message: err.message }))
    );
  }

  // System Info
  getSystemInfo(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${this.apiUrl}/admin/system`).pipe(
      catchError(() => of({
        database: { name: 'N/A', sizeOnDisk: 0, collections: 0 },
        counts: { totalEvents: 0, totalDetections: 0, flaggedPlayers: 0, bannedPlayers: 0, actionHistory: 0 },
        server: { uptime: 0, memoryUsage: {}, nodeVersion: 'N/A' }
      }))
    );
  }

  // ============================================
  // ML (Machine Learning) Methods
  // ============================================

  // Check ML service health
  getMLHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/ml/health`).pipe(
      catchError(err => of({ status: 'disconnected', error: err.message }))
    );
  }

  // Get ML model info
  getMLModelInfo(): Observable<any> {
    return this.http.get(`${this.apiUrl}/ml/model/info`).pipe(
      catchError(err => of({ error: err.message }))
    );
  }

  // Analyze a single player with ML
  analyzePlayerWithML(playerId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/ml/analyze/player/${playerId}`).pipe(
      catchError(err => of({ error: err.message }))
    );
  }

  // Scan all recent detections with ML
  scanAllWithML(limit = 100): Observable<any> {
    return this.http.get(`${this.apiUrl}/ml/scan/all?limit=${limit}`).pipe(
      catchError(err => of({ error: err.message }))
    );
  }

  // Real-time ML prediction for an event
  predictWithML(event: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/ml/analyze/realtime`, event).pipe(
      catchError(err => of({ error: err.message }))
    );
  }
}
