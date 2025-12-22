import { Injectable } from '@angular/core';
import { interval, map, scan, startWith } from 'rxjs';
import { GameEvent } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class LiveFeedService {
  private cheatTypes = ['Aimbot', 'No-Recoil', 'Robotic-Aim', 'Trigger-Bot', 'Wallhack'];

  stream() {
    return interval(900).pipe(
      map(i => this.generateEvent(i)),
      scan<GameEvent, GameEvent[]>((acc, curr) => {
        const updated = [curr, ...acc];
        return updated.slice(0, 30);
      }, []),
      startWith([])
    );
  }

  private generateEvent(i: number): GameEvent {
    const cheatType =
      Math.random() > 0.4
        ? (this.cheatTypes[Math.floor(Math.random() * this.cheatTypes.length)] as any)
        : undefined;

    // Provide a normalized `cheatScore` in the 0..1 range so UI shows percentages
    const cheatScore = cheatType
      ? Math.min(0.99, Math.max(0.2, Math.random())) // suspicious events get higher scores
      : Math.random() * 0.15; // benign events have low scores

    return {
      eventType: 'mouseMove',
      playerId: `player${(i % 24) + 1}`,
      speed: Math.random() * 160,
      deltaX: Math.random() * 6 - 3,
      deltaY: Math.random() * 6 - 3,
      timestamp: Date.now(),
      cheatType,
      cheatScore
    };
  }
}
