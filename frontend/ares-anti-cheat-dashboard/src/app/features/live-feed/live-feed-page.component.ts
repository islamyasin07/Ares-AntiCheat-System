import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval, switchMap } from 'rxjs';

import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { LiveFeedListComponent } from '../../core/components/live-feed-list/live-feed-list.component';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-live-feed-page',
  standalone: true,
  imports: [CommonModule, GlowCardComponent, LiveFeedListComponent],
  templateUrl: './live-feed-page.component.html',
  styleUrls: ['./live-feed-page.component.css']
})
export class LiveFeedPageComponent implements OnInit, OnDestroy {
  liveFeed$ = this.statsService.liveFeed$;
  
  // Stats
  totalEvents = 0;
  criticalCount = 0;
  highCount = 0;
  mediumCount = 0;
  
  private subs: Subscription[] = [];

  constructor(private statsService: StatsService) {}

  ngOnInit() {
    // Update counts when feed changes
    this.subs.push(
      this.liveFeed$.subscribe(events => {
        this.totalEvents = events.length;
        this.criticalCount = events.filter(e => this.isCritical(e.cheatType)).length;
        this.highCount = events.filter(e => this.isHigh(e.cheatType)).length;
        this.mediumCount = events.filter(e => this.isMedium(e.cheatType)).length;
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  private isCritical(type: string): boolean {
    if (!type) return false;
    const t = type.toLowerCase();
    return t.includes('aimbot') || t.includes('snap');
  }

  private isHigh(type: string): boolean {
    if (!type) return false;
    const t = type.toLowerCase();
    return t.includes('speed') || t.includes('wall') || t.includes('flick');
  }

  private isMedium(type: string): boolean {
    if (!type) return false;
    const t = type.toLowerCase();
    return t.includes('recoil') || t.includes('robotic') || t.includes('no-recoil');
  }
}
