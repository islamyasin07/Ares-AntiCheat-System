import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgIf, NgFor, AsyncPipe, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';

import { AresLineChartComponent } from '../../core/components/charts/ares-line-chart.component';
import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { StatsService, SystemLog } from '../../shared/services/stats.service';

@Component({
  selector: 'app-system-analytics',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, DecimalPipe, GlowCardComponent, AresLineChartComponent],
  templateUrl: './system-analytics-page.component.html',
  styleUrls: ['./system-analytics-page.component.css']
})
export class SystemAnalyticsPageComponent implements OnInit, OnDestroy {
  analytics$ = this.statsService.analytics$;
  logs$ = this.statsService.logs$;
  
  // Throughput chart - updated from real data
  throughputLabels: string[] = [];
  throughputData: number[] = [];
  
  // Resource usage - from real analytics
  cpuUsage = 0;
  memoryUsage = 0;
  diskUsage = 0;
  
  // Detection rate
  detectionRate = 0;
  totalEvents = 0;
  totalSuspicious = 0;
  
  // Recent logs from API
  recentLogs: SystemLog[] = [];
  
  private subs: Subscription[] = [];

  constructor(private statsService: StatsService) {}

  ngOnInit() {
    // Initialize throughput labels
    this.throughputLabels = Array.from({length: 10}, (_, i) => `${9-i}m ago`);
    
    // Subscribe to real analytics data
    this.subs.push(
      this.analytics$.subscribe(data => {
        if (!data) return;
        
        // Update throughput chart with real data
        if (data.throughputHistory && data.throughputHistory.length) {
          this.throughputData = [...data.throughputHistory];
        }
        
        // Update resource usage
        this.cpuUsage = Math.round(data.cpuUsage || 0);
        this.memoryUsage = Math.round(data.memoryUsage || 0);
        this.diskUsage = Math.round(data.diskUsage || 0);
        
        // Update totals
        this.detectionRate = data.detectionRate || 0;
        this.totalEvents = data.totalEvents || 0;
        this.totalSuspicious = data.totalSuspicious || 0;
      })
    );
    
    // Subscribe to logs
    this.subs.push(
      this.logs$.subscribe(logs => {
        if (logs && logs.length) {
          this.recentLogs = logs;
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }
}
