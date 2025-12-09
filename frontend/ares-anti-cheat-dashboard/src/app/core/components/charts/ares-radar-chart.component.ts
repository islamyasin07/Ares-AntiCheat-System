import { Component, Input, AfterViewInit, ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-ares-radar-chart',
  standalone: true,
  template: `<canvas></canvas>`,
  styleUrls: ['./ares-radar-chart.component.css']
})
export class AresRadarChartComponent implements AfterViewInit {

  @Input() labels: string[] = [];
  @Input() data: number[] = [];

  constructor(private host: ElementRef) {}

  ngAfterViewInit() {
    const canvas = this.host.nativeElement.querySelector('canvas');

    new Chart(canvas, {
      type: 'radar',
      data: {
        labels: this.labels,
        datasets: [{
          label: 'Behavior Analysis',
          data: this.data,
          borderColor: '#3BC7FF',
          backgroundColor: 'rgba(59, 199, 255, 0.2)',
          pointBackgroundColor: '#FF2E97',
          borderWidth: 2,
        }]
      },
      options: {
        scales: {
          r: {
            angleLines: { color: '#444' },
            grid: { color: '#444' },
            pointLabels: { color: '#fff' }
          }
        }
      }
    });
  }
}
