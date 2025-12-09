import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

interface Butterfly {
  left: number;
  delay: number;
  duration: number;
  scale: number;
  hue: number;
}

@Component({
  selector: 'app-floating-butterflies-effect',
  standalone: true,
  imports: [NgFor],
  templateUrl: './floating-butterflies-effect.component.html',
  styleUrls: ['./floating-butterflies-effect.component.css']
})
export class FloatingButterfliesEffectComponent {
  butterflies: Butterfly[] = Array.from({ length: 22 }).map((_, i) => ({
    left: (i * 100 / 22) + (i % 2 === 0 ? 3 : -3),
    delay: i * 0.5,
    duration: 9 + (i % 5),
    scale: 0.6 + (i % 4) * 0.15,
    hue: 280 + (i * 12) // بين البنفسجي والوردي
  }));
}
