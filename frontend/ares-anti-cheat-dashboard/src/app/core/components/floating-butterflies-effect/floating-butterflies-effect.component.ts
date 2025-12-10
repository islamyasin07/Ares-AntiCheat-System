import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

interface Butterfly {
  left: number;
  delay: number;
  duration: number;
  scale: number;
  hue: number;
}

interface Sparkle {
  left: number;
  top: number;
  delay: number;
  duration: number;
}

interface Orb {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}

@Component({
  selector: 'app-floating-butterflies-effect',
  standalone: true,
  imports: [NgFor],
  templateUrl: './floating-butterflies-effect.component.html',
  styleUrls: ['./floating-butterflies-effect.component.css']
})
export class FloatingButterfliesEffectComponent {
  // Real butterflies with flapping wings
  butterflies: Butterfly[] = Array.from({ length: 15 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: i * 1.2 + Math.random() * 2,
    duration: 12 + Math.random() * 8,
    scale: 0.5 + Math.random() * 0.5,
    hue: Math.random() * 60 - 30 // Varies between pink and purple
  }));

  // Sparkle particles
  sparkles: Sparkle[] = Array.from({ length: 30 }).map(() => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 2 + Math.random() * 3
  }));

  // Floating glowing orbs
  orbs: Orb[] = Array.from({ length: 8 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: i * 2 + Math.random() * 3,
    duration: 15 + Math.random() * 10,
    size: 4 + Math.random() * 8,
    color: ['rgba(59, 199, 255, 0.6)', 'rgba(255, 46, 151, 0.6)', 'rgba(168, 84, 255, 0.6)'][i % 3]
  }));
}
