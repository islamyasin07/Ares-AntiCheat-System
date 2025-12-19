import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MlService } from '../../shared/services/ml.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-ml-live-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="live-feed">
      <h3>Live ML Detections</h3>
      <table class="det-table">
        <thead><tr><th>Time</th><th>Player</th><th>Risk</th><th>Prob</th></tr></thead>
        <tbody>
          <tr *ngFor="let d of items; trackBy: trackById" [class.new]="d.__new">
            <td>{{ d.detected_at | date:'short' }}</td>
            <td><a (click)="drill(d.player_id)">{{ d.player_id }}</a></td>
            <td [class]="d.risk_level">{{ d.risk_level }}</td>
            <td>{{ (d.cheat_probability || 0) | percent:'1.0-2' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `.live-feed { padding:8px }`,
    `.det-table { width:100%; border-collapse:collapse }`,
    `.det-table th,.det-table td { padding:8px; border-bottom:1px solid rgba(255,255,255,0.04) }`,
    `.critical { color:#ef4444; font-weight:700 }`,
    `.high { color:#f97316 }`,
    `.medium { color:#f59e0b }`,
    `.low { color:#60a5fa }`,
    `.new { animation: fadeIn 1.2s ease; border-left: 4px solid rgba(99,102,241,0.9) }`,
    `@keyframes fadeIn { from { background: rgba(99,102,241,0.06) } to { background: transparent } }`
  ]
})
export class MlLiveFeedComponent implements OnInit, OnDestroy {
  items: any[] = [];
  sub = new Subscription();

  constructor(private ml: MlService) {}

  ngOnInit(): void {
    this.load();
    this.sub.add(interval(4000).subscribe(() => this.load()));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // Merge updates instead of replacing to avoid list blinking
  load() {
    this.ml.getLiveDetections().subscribe((r) => {
      const incoming = (r || []) as any[];
      const nowIds = new Set(incoming.map(i => i._id));

      // Update existing entries and add new ones at top
      const byId: Record<string, any> = {};
      for (const it of this.items) byId[it._id] = it;

      // Mark new items and merge
      for (const det of incoming) {
        if (!det._id) continue;
        const existing = byId[det._id];
        if (existing) {
          // update fields in place to avoid flicker
          Object.assign(existing, det);
        } else {
          det.__new = true; // transient flag for highlight
          this.items.unshift(det);
          // remove flag after brief highlight
          setTimeout(() => { det.__new = false; }, 1800);
        }
      }

      // Remove any stale items that are no longer in incoming (keep latest 100 max)
      this.items = this.items.filter(i => nowIds.has(i._id)).slice(0, 100);

    }, (err) => {
      console.error('[ML] live load error', err);
      // don't clear items on error to avoid blinking UI
    });
  }

  drill(playerId: string) {
    // Use hash navigation so we don't invent routes; clicking opens a player page
    location.hash = `#/ml/player/${encodeURIComponent(playerId)}`;
  }

  trackById(index: number, item: any) { return item._id; }
}