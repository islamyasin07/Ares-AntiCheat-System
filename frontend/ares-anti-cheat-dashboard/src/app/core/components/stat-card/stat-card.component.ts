import { Component, Input } from '@angular/core';
import { NgIf, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgIf, DecimalPipe],
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.css']
})
export class StatCardComponent {
  @Input() title!: string;
  @Input() value!: number | string;
  @Input() color: string = 'neonBlue';
  @Input() trend?: number;
  @Input() subtitle?: string;
}
