import { Component, Input, AfterViewInit, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-ares-radar-chart',
  standalone: true,
  template: `<div class="radar-wrapper"><canvas></canvas></div>`,
  styleUrls: ['./ares-radar-chart.component.css']
})
export class AresRadarChartComponent implements AfterViewInit, OnChanges {

  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  
  private chart?: Chart;

  constructor(private host: ElementRef) {}

  ngAfterViewInit() {
    this.buildChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['labels'] || changes['data'])) {
      this.chart.data.labels = this.labels;
      this.chart.data.datasets[0].data = this.data;
      this.chart.update();
    }
  }

  private buildChart() {
    const canvas = this.host.nativeElement.querySelector('canvas');
    if (!canvas) return;

    this.chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: this.labels,
        datasets: [{
          label: 'Behavior Analysis',
          data: this.data,
          borderColor: '#3BC7FF',
          backgroundColor: 'rgba(59, 199, 255, 0.15)',
          pointBackgroundColor: '#FF2E97',
          pointBorderColor: '#FF2E97',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#FF2E97',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            angleLines: { 
              color: 'rgba(255, 255, 255, 0.1)',
              lineWidth: 1
            },
            grid: { 
              color: 'rgba(59, 199, 255, 0.15)',
              circular: true
            },
            pointLabels: { 
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 11,
                weight: 'bold' as const
              }
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.4)',
              backdropColor: 'transparent',
              stepSize: 25
            }
          }
        }
      }
    });
  }
}
