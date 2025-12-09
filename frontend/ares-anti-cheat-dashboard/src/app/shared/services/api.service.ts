import { Injectable } from '@angular/core';
import { delay, map, of } from 'rxjs';
import { GameEvent } from '../models/event.model';
import { Player } from '../models/player.model';
import { AresStats } from '../models/stats.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  getEvents() {
    const events: GameEvent[] = Array.from({ length: 120 }).map((_, i) => ({
      eventType: 'mouseMove',
      playerId: `player${(i % 24) + 1}`,
      speed: Math.random() * 140,
      deltaX: Math.random() * 4 - 2,
      deltaY: Math.random() * 4 - 2,
      timestamp: Date.now() - i * 1000 * 15,
      cheatType: Math.random() > 0.7
        ? (['Aimbot', 'No-Recoil', 'Robotic-Aim', 'Trigger-Bot', 'Wallhack'] as const)[
            Math.floor(Math.random() * 5)
          ]
        : undefined
    }));
    return of(events).pipe(delay(300));
  }

  getPlayers() {
    const players: Player[] = Array.from({ length: 16 }).map((_, i) => ({
      id: `player${i + 1}`,
      nickname: `Player_${i + 1}`,
      country: ['US', 'EU', 'MENA', 'ASIA'][i % 4],
      rank: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][i % 5],
      totalEvents: 800 + Math.floor(Math.random() * 2000),
      suspiciousEvents: 20 + Math.floor(Math.random() * 120),
      riskScore: 20 + Math.floor(Math.random() * 80)
    }));
    return of(players).pipe(delay(250));
  }

  getStats() {
    const perMinuteSuspicious = Array.from({ length: 12 }).map((_, i) => ({
      minute: `${i * 5}–${i * 5 + 5}`,
      count: 5 + Math.floor(Math.random() * 35)
    }));

    const cheatTypes = ['Aimbot', 'No-Recoil', 'Robotic-Aim', 'Trigger-Bot', 'Wallhack'];
    const cheatDistribution = cheatTypes.map(t => ({
      cheatType: t,
      count: 20 + Math.floor(Math.random() * 160)
    }));

    const hourlyHeatmap = Array.from({ length: 24 }).map(
      () => 5 + Math.floor(Math.random() * 40)
    );

    const stats: AresStats = {
      totalEvents: 128920,
      totalSuspicious: 4831,
      cheatersToday: 82,
      livePlayers: 6291,
      perMinuteSuspicious,
      cheatDistribution,
      hourlyHeatmap
    };

    return of(stats).pipe(delay(220));
  }
}
