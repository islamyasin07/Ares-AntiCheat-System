import { Component, Input } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';

@Component({
  selector: 'app-ares-heatmap',
  standalone: true,
  imports: [NgForOf, NgIf],
  template: `
    <div class="heatmap-grid">
      <div *ngFor="let row of values" class="row">
        <div
          *ngFor="let cell of row"
          class="cell"
          [style.background]="getColor(cell)">
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./ares-heatmap.component.css']
})
export class AresHeatmapComponent {
  @Input() values: number[][] = [];

  getColor(v: number) {
    return `rgba(255,0,0,${Math.min(1, v / 10)})`;
  }
}
