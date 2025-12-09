import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-glow-card',
  standalone: true,
  templateUrl: './glow-card.component.html',
  styleUrl: './glow-card.component.css'
})
export class GlowCardComponent {
  @Input() padding = 'p-6';
}
