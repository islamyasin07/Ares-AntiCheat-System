import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { AnalyticsService } from '../../shared/services/analytics.service';

@Component({
  selector: 'app-analytics-report',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe],
  templateUrl: './analytics-report.component.html',
  styleUrls: ['./analytics-report.component.css']
})
export class AnalyticsReportComponent implements OnInit {
  topCheaters: any[] = [];
  cheatDistribution: any[] = [];
  hourlyEvents: any[] = [];
  avgSpeed: any[] = [];
  loading = true;

  constructor(private analytics: AnalyticsService) {}

  ngOnInit(): void {
    this.loading = true;
    this.analytics.getTopCheaters().subscribe(data => this.topCheaters = data || []);
    this.analytics.getCheatDistribution().subscribe(data => this.cheatDistribution = data || []);
    this.analytics.getHourlyEvents().subscribe(data => this.hourlyEvents = data || []);
    this.analytics.getAvgSpeed().subscribe(data => this.avgSpeed = data || []);
    // small delay to allow all calls to complete in simple demo
    setTimeout(() => this.loading = false, 400);
  }
}
