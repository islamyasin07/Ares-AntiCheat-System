import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  ViewChild
} from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-ares-pie-chart',
  standalone: true,
  templateUrl: './ares-pie-chart.component.html',
  styleUrls: ['./ares-pie-chart.component.css']
})
export class AresPieChartComponent implements AfterViewInit, OnChanges {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  chart?: Chart;

  ngAfterViewInit() {
    this.build();
  }

  ngOnChanges() {
    if (this.chart) {
      this.chart.data.labels = this.labels;
      this.chart.data.datasets[0].data = this.data;
      this.chart.update();
    }
  }

  private build() {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.labels,
        datasets: [
          {
            data: this.data,
            backgroundColor: ['#3BC7FF', '#FF2E97', '#A854FF', '#22C55E', '#F97316'],
            borderWidth: 0
          }
        ]
      },
      options: {
        cutout: '60%',
        plugins: {
          legend: {
            labels: { color: '#ffffff' }
          }
        }
      }
    });
  }
}
