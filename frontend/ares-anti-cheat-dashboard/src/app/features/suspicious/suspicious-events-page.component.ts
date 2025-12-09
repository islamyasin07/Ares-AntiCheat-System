import { Component } from '@angular/core';
import { NgForOf, AsyncPipe } from '@angular/common';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-suspicious-events',
  standalone: true,
  imports: [NgForOf, AsyncPipe],
  templateUrl: './suspicious-events-page.component.html',
  styleUrls: ['./suspicious-events-page.component.css']
})
export class SuspiciousEventsPageComponent {
  suspicious$ = this.statsService.suspiciousEvents$;
  constructor(private statsService: StatsService) {}
}
