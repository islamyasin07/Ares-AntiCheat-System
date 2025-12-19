import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MlService } from '../../shared/services/ml.service';
import { SparkService } from '../../shared/services/spark.service';

@Component({
  selector: 'app-ml-player-drill',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drill">
      <h2>Player: {{ playerId }}</h2>
      <div *ngIf="loading">Loading...</div>

      <div *ngIf="!loading">
        <div class="split">
          <section class="left">
            <h3>ML Detections</h3>
            <table class="compact">
              <thead><tr><th>Time</th><th>Risk</th><th>Prob</th></tr></thead>
              <tbody><tr *ngFor="let d of mlDetections"><td>{{ d.detected_at | date:'short' }}</td><td>{{ d.risk_level }}</td><td>{{ (d.cheat_probability||0) | percent:'1.0-2' }}</td></tr></tbody>
            </table>

            <h3>Spark / Rule Detections</h3>
            <table class="compact">
              <thead><tr><th>Time</th><th>Rule</th></tr></thead>
              <tbody><tr *ngFor="let s of rules"><td>{{ s.timestamp | date:'short' }}</td><td>{{ s.rule }}</td></tr></tbody>
            </table>
          </section>

          <section class="right">
            <h3>Correlation Timeline</h3>
            <div class="timeline">
              <div *ngFor="let c of correlation" class="timeline-item" [class.confirmed]="c.confirmed">
                <div class="timestack">
                  <div class="spark">{{ c.sparkTime ? (c.sparkTime | date:'short') : '—' }}</div>
                  <div class="ml">{{ c.mlTime ? (c.mlTime | date:'short') : '—' }}</div>
                </div>
                <div class="meta">Δ: {{ c.deltaMs !== null ? c.deltaMs + ' ms' : '—' }} · Confirmed: {{ c.confirmed }}</div>
                <div *ngIf="c.ruleObj" class="detail">Rule: {{ c.ruleObj.rule || 'n/a' }}</div>
                <div *ngIf="c.ml" class="detail">ML: {{ c.ml.player_id }} · {{ c.ml.risk_level }} · {{ (c.ml.cheat_probability||0) | percent:'1.0-2' }}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .split { display:flex; gap:12px }
    .left, .right { flex:1 }
    table.compact { width:100%; border-collapse:collapse }
    table.compact th, table.compact td { padding:6px; border-bottom:1px solid rgba(255,255,255,0.04) }
    .timeline { max-height:480px; overflow:auto; padding:8px; background: rgba(255,255,255,0.01); border-radius:6px }
    .timeline-item { padding:8px; border-bottom:1px dashed rgba(255,255,255,0.03); margin-bottom:6px }
    .timeline-item.confirmed { border-left:4px solid rgba(34,197,94,0.6); background: rgba(34,197,94,0.02) }
    .timestack { display:flex; gap:8px; font-size:12px; color:#9fb0d9 }
    .meta { color:#9fb0d9; font-size:12px; margin-top:6px }
    .detail { font-size:12px; color:#d6e6ff }
  `]
})
export class MlPlayerDrillComponent implements OnInit {
  playerId = '';
  mlDetections: any[] = [];
  rules: any[] = [];
  correlation: any[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private ml: MlService, private spark: SparkService) {}

  ngOnInit(): void {
    this.playerId = this.route.snapshot.params['id'];
    if (!this.playerId) {
      // fallback to hash
      const match = location.hash.match(/player\/(.+)/);
      if (match) this.playerId = decodeURIComponent(match[1]);
    }

    this.loadAll();
  }

  async loadAll() {
    this.loading = true;

    // Use the dedicated endpoint for player ML detections (may return more recent/complete data)
    this.ml.getDetectionsByPlayer(this.playerId).subscribe((ml) => {
      this.mlDetections = ml || [];
      this.computeCorrelation();
    }, (err) => {
      console.error('ml detections by player failed', err);
      // fallback to generic call
      this.ml.getDetections({ page: 1, limit: 200, playerId: this.playerId }).subscribe((r) => {
        this.mlDetections = r.items || [];
        this.computeCorrelation();
      }, (e) => console.error('fallback detections failed', e));
    });

    this.spark.getRuleDetections({ playerId: this.playerId, limit: 200 }).subscribe((r) => {
      this.rules = r.items || [];
      this.computeCorrelation();
    }, (err) => {
      console.error('spark rule detections failed', err);
    });

    this.loading = false;
  }

  computeCorrelation() {
    if (!this.rules || !this.mlDetections) return;
    this.correlation = [];

    // Sort both lists by timestamp ascending to create a timeline
    const rulesSorted = [...this.rules].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const mlSorted = [...this.mlDetections].sort((a, b) => (a.detected_at || 0) - (b.detected_at || 0));

    // For each rule detection, find nearest ML detection within 2 minutes
    for (const s of rulesSorted) {
      const sTime = s.timestamp || s.detected_at || 0;
      let nearest = null as any | null;
      let nearestDelta = Infinity;
      for (const m of mlSorted) {
        const mTime = m.detected_at || m.timestamp || 0;
        const delta = Math.abs(mTime - sTime);
        if (delta < nearestDelta) {
          nearestDelta = delta;
          nearest = m;
        }
      }

      // if within 2 minutes (120000ms) consider a match
      const confirmed = nearest && nearestDelta <= 120000 && this._riskAtLeast(nearest.risk_level, 'medium');
      this.correlation.push({
        sparkTime: sTime,
        rule: s.rule || s.detected_rule || 'rule',
        mlTime: nearest ? (nearest.detected_at || nearest.timestamp) : null,
        deltaMs: nearest ? nearestDelta : null,
        confirmed: !!confirmed,
        ml: nearest || null,
        ruleObj: s
      });
    }

    // Also include ML detections that didn't match any rule (for completeness)
    const matchedMl = new Set(this.correlation.filter(c => c.ml).map(c => (c.ml as any)._id));
    for (const m of mlSorted) {
      if (!matchedMl.has(m._id)) {
        this.correlation.push({ sparkTime: null, rule: null, mlTime: m.detected_at || m.timestamp, deltaMs: null, confirmed: false, ml: m, ruleObj: null });
      }
    }

    // Sort correlation timeline by the earliest timestamp available
    this.correlation.sort((a, b) => {
      const ta = a.sparkTime || a.mlTime || 0;
      const tb = b.sparkTime || b.mlTime || 0;
      return ta - tb;
    });
  }

  private _riskAtLeast(risk: string|undefined, min: 'low'|'medium'|'high'|'critical') {
    const order = { low:1, medium:2, high:3, critical:4 } as any;
    const r = (risk || 'low') as keyof typeof order;
    return order[r] >= order[min];
  }
}