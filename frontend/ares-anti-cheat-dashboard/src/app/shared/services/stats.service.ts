import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, switchMap, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private _analytics = new BehaviorSubject<any>({ ingestion: 0, latency: 0, sparkLoad: 0 });
  analytics$ = this._analytics.asObservable();

  constructor(private http: HttpClient) {
    // Initial load
    this.refreshStats();
    this.refreshLiveFeed();
    this.refreshAnalytics();

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

    // Poll analytics every 1 second
    interval(1000).pipe(
      switchMap(() => this.http.get<any>(`${this.apiUrl}/stats/analytics`).pipe(
        catchError(() => of({ ingestion: 0, latency: 0, sparkLoad: 0 }))
      ))
    ).subscribe(data => {
      if (data) this._analytics.next(data);
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
    this.http.get<any>(`${this.apiUrl}/stats/analytics`).pipe(
      catchError(() => of({ ingestion: 0, latency: 0, sparkLoad: 0 }))
    ).subscribe(data => this._analytics.next(data));
  }

  // Player details
  getPlayerDetails(playerId: string) {
    return this.http.get<any>(`${this.apiUrl}/players/${playerId}`).pipe(
      catchError(() => of({
        playerId,
        riskScore: 0,
        behaviorLabels: ['Aim', 'Recoil', 'Movement', 'Prediction'],
        behaviorValues: [0, 0, 0, 0]
      }))
    );
  }

  // Get all players
  getPlayers() {
    return this.http.get<any[]>(`${this.apiUrl}/players`).pipe(
      catchError(() => of([]))
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
}
