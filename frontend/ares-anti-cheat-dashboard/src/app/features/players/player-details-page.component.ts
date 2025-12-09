import { Component } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { AresRadarChartComponent } from '../../core/components/charts/ares-radar-chart.component';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-player-details',
  standalone: true,
  imports: [
    NgIf,
    AsyncPipe,
    GlowCardComponent,
    AresRadarChartComponent
  ],
  templateUrl: './player-details-page.component.html',
  styleUrls: ['./player-details-page.component.css']
})
export class PlayerDetailsPageComponent {

  playerId = '';

  player$ = this.route.paramMap.pipe(
    switchMap(params => {
      this.playerId = params.get('id') ?? '';
      return this.statsService.getPlayerDetails(this.playerId);
    })
  );

  constructor(
    private route: ActivatedRoute,
    private statsService: StatsService
  ) {}
}
