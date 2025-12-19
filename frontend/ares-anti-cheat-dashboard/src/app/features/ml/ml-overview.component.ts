import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatCardComponent } from '../../core/components/stat-card/stat-card.component';
import { MlService } from '../../shared/services/ml.service';
import { SparkService } from '../../shared/services/spark.service';

@Component({
  selector: 'app-ml-overview',
  standalone: true,
  imports: [CommonModule, StatCardComponent],
  template: `
    <div class="overview-grid">
      <app-stat-card title="Total ML Detections" [value]="counts.total" color="neonBlue"></app-stat-card>
      <app-stat-card title="Detections (5m)" [value]="counts.recent" color="neonPink"></app-stat-card>
      <app-stat-card title="High Risk" [value]="counts.highRisk" color="neonPurple"></app-stat-card>
      <app-stat-card title="Model" [value]="modelInfo?.model_name || 'N/A'" [subtitle]="modelStatus" color="softWhite"></app-stat-card>
    </div>
  `,
  styles: [
    `.overview-grid { display:flex; gap:12px; align-items:stretch }`,
  ]
})
export class MlOverviewComponent implements OnInit {
  counts = { total: 0, recent: 0, highRisk: 0 };
  modelInfo: any = null;
  modelStatus = 'Unknown';

  constructor(private ml: MlService, private spark: SparkService) {}

  ngOnInit(): void {
    this.refresh();
    setInterval(() => this.refresh(), 5000);
  }

  refresh() {
    this.ml.getCounts().subscribe((c) => (this.counts = c), (e) => console.error(e));
    this.ml.getModelInfo().subscribe((m) => (this.modelInfo = m), () => (this.modelInfo = null));
    this.ml.health().subscribe((h) => (this.modelStatus = h?.ml_service?.status || h?.status || 'Connected'), () => (this.modelStatus = 'ML offline'));
  }
}