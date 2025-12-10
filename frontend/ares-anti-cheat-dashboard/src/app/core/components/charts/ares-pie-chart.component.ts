import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-ares-pie-chart',
  standalone: true,
  templateUrl: './ares-pie-chart.component.html',
  styleUrls: ['./ares-pie-chart.component.css']
})
export class AresPieChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  chart?: Chart;
  private initialized = false;

  ngAfterViewInit() {
    setTimeout(() => {
      this.build();
      this.initialized = true;
    }, 100);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.initialized || !this.chart) return;
    
    // Only update if data actually changed
    if (changes['labels'] || changes['data']) {
      this.chart.data.labels = this.labels;
      this.chart.data.datasets[0].data = this.data;
      this.chart.update('none'); // 'none' prevents animation on updates
    }
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
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
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        animation: {
          duration: 500
        },
        plugins: {
          legend: {
            position: 'right',
            labels: { 
              color: '#ffffff',
              padding: 12,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }
}
