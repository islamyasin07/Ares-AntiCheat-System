import { Component, Input, OnChanges } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';

@Component({
  selector: 'app-ares-heatmap',
  standalone: true,
  imports: [NgForOf, NgIf],
  template: `
    <div class="heatmap-wrapper">
      <div class="heatmap-header">
        <span class="time-label" *ngFor="let h of hours">{{ h }}</span>
      </div>
      <div class="heatmap-grid">
        <div *ngFor="let val of flatValues; let i = index" 
             class="heatmap-cell"
             [style.backgroundColor]="getColor(val)"
             [title]="getTooltip(i, val)">
          <span class="cell-value" *ngIf="val > 0">{{ val }}</span>
        </div>
      </div>
      <div class="heatmap-legend">
        <span class="legend-label">Low</span>
        <div class="legend-gradient"></div>
        <span class="legend-label">High</span>
      </div>
    </div>
  `,
  styleUrls: ['./ares-heatmap.component.css']
})
export class AresHeatmapComponent implements OnChanges {
  @Input() values: number[][] | number[] = [];
  
  hours = ['00', '04', '08', '12', '16', '20', '24'];
  flatValues: number[] = [];

  ngOnChanges() {
    // Flatten 2D array or use directly if 1D
    if (Array.isArray(this.values) && this.values.length > 0) {
      if (Array.isArray(this.values[0])) {
        this.flatValues = (this.values as number[][]).flat();
      } else {
        this.flatValues = this.values as number[];
      }
    }
    // Ensure we have 24 values for hours
    if (this.flatValues.length < 24) {
      this.flatValues = [...this.flatValues, ...Array(24 - this.flatValues.length).fill(0)];
    }
  }

  getColor(v: number): string {
    if (!v || v === 0) return 'rgba(59, 199, 255, 0.05)';
    const intensity = Math.min(1, v / 20);
    // Gradient from blue to pink based on intensity
    const r = Math.round(59 + (255 - 59) * intensity);
    const g = Math.round(199 - (199 - 46) * intensity);
    const b = Math.round(255 - (255 - 151) * intensity);
    return `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.6})`;
  }

  getTooltip(index: number, value: number): string {
    const hour = index % 24;
    return `${hour}:00 - ${value} events`;
  }
}
