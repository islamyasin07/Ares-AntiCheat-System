import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  private base() {
    return `${this.apiUrl}/v1/analytics`;
  }

  getTopCheaters() {
    const url = `${this.base()}/top-cheaters?t=${Date.now()}`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  getCheatDistribution() {
    const url = `${this.base()}/cheat-distribution?t=${Date.now()}`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  getHourlyEvents() {
    const url = `${this.base()}/hourly-events?t=${Date.now()}`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  getAvgSpeed() {
    const url = `${this.base()}/avg-speed?t=${Date.now()}`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }
}
