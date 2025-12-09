import { Component } from '@angular/core';
import { NgIf } from '@angular/common';

import { AresLineChartComponent } from '../../core/components/charts/ares-line-chart.component';
import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-system-analytics',
  standalone: true,
  imports: [NgIf, GlowCardComponent, AresLineChartComponent],
  templateUrl: './system-analytics-page.component.html',
  styleUrls: ['./system-analytics-page.component.css']
})
export class SystemAnalyticsPageComponent {
  analytics$ = this.statsService.analytics$;
  constructor(private statsService: StatsService) {}
}
