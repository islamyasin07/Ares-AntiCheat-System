import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.css']
})
export class StatCardComponent {
  @Input() title!: string;
  @Input() value!: number | string;   // FIXED
  @Input() color: string = 'neonBlue';
}
