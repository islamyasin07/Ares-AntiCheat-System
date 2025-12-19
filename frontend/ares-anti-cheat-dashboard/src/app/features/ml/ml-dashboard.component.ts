import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MlService } from '../../shared/services/ml.service';
import { SparkService } from '../../shared/services/spark.service';
import { MlDetection } from '../../shared/types/ml.types';
import { Subscription, interval } from 'rxjs';
import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { AresPieChartComponent } from '../../core/components/charts/ares-pie-chart.component';
import { AresLineChartComponent } from '../../core/components/charts/ares-line-chart.component';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MlOverviewComponent } from './ml-overview.component';
import { MlLiveFeedComponent } from './ml-live-feed.component';

@Component({
  selector: 'app-ml-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, GlowCardComponent, StatCardComponent, AresPieChartComponent, AresLineChartComponent, MlOverviewComponent, MlLiveFeedComponent],
  templateUrl: './ml-dashboard.component.html',
  styleUrls: ['./ml-dashboard.component.css'],
  providers: [DatePipe]
})
export class MlDashboardComponent implements OnInit, OnDestroy {
  liveDetections: MlDetection[] = [];
  counts: { total: number; recent: number; highRisk: number } = { total: 0, recent: 0, highRisk: 0 };
  modelInfo: any = null;

  // UI state
  loading = false;
  loadingCounts = false;
  filters = { playerId: '', riskLevel: '', minProb: 0 };
  emptyBanner = '';

  // Pagination
  page = 1;
  limit = 25;
  total = 0;

  // Chart data
  riskLabels: string[] = [];
  riskData: number[] = [];
  confidenceBins: number[] = [];
  private subs = new Subscription();

  constructor(private ml: MlService, private datePipe: DatePipe) {}

  ngOnInit(): void {
    this.showDebug = true; // show debug during initial warmup
    this.loadModelInfo();
    this.loadCounts();
    this.loadDetections();

    // Poll counts every 2s and live detections every 2s for snappy UI
    this.subs.add(interval(2000).subscribe(() => this.loadCounts()));
    this.subs.add(interval(2000).subscribe(() => this.loadDetections()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadModelInfo() {
    this.ml.getModelInfo().subscribe((info) => (this.modelInfo = info));
  }

  lastUpdate: number | null = null;
  showDebug = false;

  loadDetections(page = this.page) {
    this.loading = true;
    this.ml.getDetections({ page, limit: this.limit, playerId: this.filters.playerId || undefined, riskLevel: this.filters.riskLevel || undefined, minProb: this.filters.minProb || undefined }).subscribe((resp) => {
      this.loading = false;
      this.page = resp.page;
      this.limit = resp.limit;
      this.total = resp.total;
      this.liveDetections = resp.items || [];
      this.computeCharts();
      this.lastUpdate = Date.now();
      console.log('[ML] loadDetections', { page: this.page, count: this.liveDetections.length, total: this.total });

      // If we received detections, hide debug and any empty banner
      if (this.liveDetections.length > 0) {
        this.showDebug = false;
        this.emptyBanner = '';
      }
    }, (err) => {
      this.loading = false;
      console.error('[ML] loadDetections error', err);
      this.showDebug = true;
      this.emptyBanner = 'Error loading detections — check server logs';
    });
  }

  // Status banner (shows success or errors)
  statusBanner = '';

  loadCounts() {
    this.loadingCounts = true;
    this.ml.getCounts().subscribe((c) => {
      this.loadingCounts = false;
      this.counts = c;
      this.lastUpdate = Date.now();
      console.log('[ML] loadCounts', c);

      // If there is data on the server but no detections loaded on the page, try to fetch them
      if (c && c.total !== undefined && c.total > 0) {
        this.statusBanner = `Backend OK — ${c.total} ML detections`;
        // Auto-fetch detections if page is empty
        if (!this.liveDetections || this.liveDetections.length === 0) {
          this.showDebug = true; // show debug until data appears
          // immediate fetch
          this.loadDetections(1);
        } else {
          // hide debug when we have data
          this.showDebug = false;
        }

        // Clear success banner after 3s
        setTimeout(() => { this.statusBanner = ''; }, 3000);
      } else if (c && c.total === 0) {
        this.emptyBanner = 'No ML detections yet — click "Seed sample" or "Run Scan All"';
        this.showDebug = true;
      } else {
        this.emptyBanner = 'No ML detections yet — click "Seed sample" or "Run Scan All"';
      }
    }, (err) => {
      this.loadingCounts = false;
      console.error('[ML] loadCounts error', err);
      this.showDebug = true;
      this.emptyBanner = 'Error fetching counts — check backend logs';
      this.statusBanner = 'Backend error — see logs';
    });
  }

  // Force reload both counts and detections
  forceReload() {
    this.statusBanner = 'Refreshing...';
    this.showDebug = true;
    this.loadCounts();
    this.loadDetections(1);
    setTimeout(() => { this.statusBanner = ''; }, 4000);
  }

  applyFilters() {
    this.page = 1;
    this.loadDetections(1);
  }

  resetFilters() {
    this.filters = { playerId: '', riskLevel: '', minProb: 0 };
    this.applyFilters();
  }

  computeCharts() {
    // risk distribution
    const map: Record<string, number> = {};
    const bins = Array(10).fill(0);

    this.liveDetections.forEach(d => {
      const r = d.risk_level || 'unknown';
      map[r] = (map[r] || 0) + 1;

      const prob = Math.round((d.cheat_probability ?? 0) * 100);
      const bi = Math.min(9, Math.floor(prob / 10));
      bins[bi]++;
    });

    this.riskLabels = Object.keys(map);
    this.riskData = Object.values(map);

    this.confidenceBins = bins;
  }

  prevPage() {
    if (this.page > 1) this.loadDetections(this.page - 1);
  }

  nextPage() {
    if (this.page * this.limit < this.total) this.loadDetections(this.page + 1);
  }

  exportCSV() {
    const rows = this.liveDetections.map(d => ({ time: this.datePipe.transform(d.detected_at, 'yyyy-MM-dd HH:mm:ss'), player: d.player_id, risk: d.risk_level, prob: d.cheat_probability }));
    const csv = ['time,player,risk,prob', ...rows.map(r => `${r.time},${r.player},${r.risk},${r.prob}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ml_detections_page_${this.page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerScan() {
    this.ml.triggerScanAll().subscribe((resp) => {
      // small UX: reload counts after triggering a scan
      setTimeout(() => { this.loadCounts(); this.loadDetections(1); }, 1500);
    });
  }

  seedSample() {
    this.ml.seedSamples().subscribe((resp:any) => {
      // Refresh after seeding
      setTimeout(() => { this.loadCounts(); this.loadDetections(1); }, 800);
    }, (err) => {
      console.error('seed failed', err);
      this.emptyBanner = 'Seed failed — check server logs';
    });
  }
}