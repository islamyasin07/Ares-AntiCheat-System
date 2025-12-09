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

    return {
      eventType: 'mouseMove',
      playerId: `player${(i % 24) + 1}`,
      speed: Math.random() * 160,
      deltaX: Math.random() * 6 - 3,
      deltaY: Math.random() * 6 - 3,
      timestamp: Date.now(),
      cheatType
    };
  }
}
