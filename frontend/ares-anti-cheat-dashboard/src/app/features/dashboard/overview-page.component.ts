import { Component } from '@angular/core';
import { NgIf, NgForOf, AsyncPipe, DecimalPipe } from '@angular/common';

import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { LiveFeedListComponent } from '../../core/components/live-feed-list/live-feed-list.component';
import { AresLineChartComponent } from '../../core/components/charts/ares-line-chart.component';
import { AresPieChartComponent } from '../../core/components/charts/ares-pie-chart.component';
import { AresHeatmapComponent } from '../../core/components/charts/ares-heatmap.component';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [
    NgIf, NgForOf, AsyncPipe, DecimalPipe,
    GlowCardComponent, StatCardComponent,
    LiveFeedListComponent,
    AresLineChartComponent, AresPieChartComponent, AresHeatmapComponent
  ],
  templateUrl: './overview-page.component.html',
  styleUrls: ['./overview-page.component.css']
})
export class OverviewPageComponent {

  stats$ = this.statsService.stats$;
  liveFeed$ = this.statsService.liveFeed$;

  labels_perMinute: string[] = [];
  data_perMinute: number[] = [];
  cheat_labels: string[] = [];
  cheat_counts: number[] = [];
  hourly_heatmap: number[] = [];

  constructor(private statsService: StatsService) {
    this.stats$.subscribe(s => {
      if (!s) return;

      this.labels_perMinute =
        s.perMinuteSuspicious?.map((x: { minute: string; count: number }) => x.minute) ?? [];

      this.data_perMinute =
        s.perMinuteSuspicious?.map((x: { minute: string; count: number }) => x.count) ?? [];

      this.cheat_labels =
        s.cheatDistribution?.map((c: { cheatType: string; count: number }) => c.cheatType) ?? [];

      this.cheat_counts =
        s.cheatDistribution?.map((c: { cheatType: string; count: number }) => c.count) ?? [];

      // Assign hourly heatmap data (array of 24 numbers)
      this.hourly_heatmap = s.hourlyHeatmap ?? Array(24).fill(0);
    });
  }
}
