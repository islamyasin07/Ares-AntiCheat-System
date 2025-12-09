import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  ViewChild
} from '@angular/core';
import { NgIf } from '@angular/common';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-ares-line-chart',
  standalone: true,
  imports: [NgIf],
  templateUrl: './ares-line-chart.component.html',
  styleUrls: ['./ares-line-chart.component.css']
})
export class AresLineChartComponent implements AfterViewInit, OnChanges {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  chart?: Chart;

  ngAfterViewInit() {
    this.buildChart();
  }

  ngOnChanges() {
    if (this.chart) {
      this.chart.data.labels = this.labels;
      this.chart.data.datasets[0].data = this.data;
      this.chart.update();
    }
  }

  private buildChart() {
    if (!this.canvasRef) return;

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.labels,
        datasets: [
          {
            label: 'Suspicious / minute',
            data: this.data,
            borderColor: '#3BC7FF',
            backgroundColor: 'rgba(59,199,255,0.18)',
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: '#FF2E97'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: '#ffffff'
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9CA3AF' },
            grid: { color: 'rgba(148,163,184,0.08)' }
          },
          y: {
            ticks: { color: '#9CA3AF' },
            grid: { color: 'rgba(148,163,184,0.08)' }
          }
        }
      }
    });
  }
}
