import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, AsyncPipe, CommonModule } from '@angular/common';
import { AnalyticsService } from '../../shared/services/analytics.service';
import { AresPieChartComponent } from '../../core/components/charts/ares-pie-chart.component';
import { AresLineChartComponent } from '../../core/components/charts/ares-line-chart.component';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';

@Component({
  selector: 'app-analytics-report',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, AsyncPipe, AresPieChartComponent, AresLineChartComponent, StatCardComponent],
  templateUrl: './analytics-report.component.html',
  styleUrls: ['./analytics-report.component.css']
})
export class AnalyticsReportComponent implements OnInit {
  topCheaters: any[] = [];
  cheatDistribution: any[] = [];
  hourlyEvents: any[] = [];
  avgSpeed: any[] = [];
  loading = true;

  // chart-friendly shapes
  distLabels: string[] = [];
  distData: number[] = [];
  hourlyLabels: string[] = [];
  hourlyData: number[] = [];
  speedLabels: string[] = [];
  speedData: number[] = [];

  constructor(private analytics: AnalyticsService) {}

  ngOnInit(): void {
    this.loading = true;
    this.analytics.getTopCheaters().subscribe(data => this.topCheaters = data || []);
    this.analytics.getCheatDistribution().subscribe(data => {
      this.cheatDistribution = data || [];
      this.distLabels = this.cheatDistribution.map(d => d.risk_level);
      this.distData = this.cheatDistribution.map(d => d.count);
    });

    this.analytics.getHourlyEvents().subscribe(data => {
      this.hourlyEvents = data || [];
      this.hourlyLabels = this.hourlyEvents.map(h => h.hour);
      this.hourlyData = this.hourlyEvents.map(h => h.count);
    });

    this.analytics.getAvgSpeed().subscribe(data => {
      this.avgSpeed = data || [];
      this.speedLabels = this.avgSpeed.map(s => s.hour);
      this.speedData = this.avgSpeed.map(s => s.avg_speed || s.average_speed || 0);
    });

    // small delay to allow all calls to complete in simple demo
    setTimeout(() => this.loading = false, 400);
  }

  refresh() {
    this.loading = true;
    this.ngOnInit();
  }
}
