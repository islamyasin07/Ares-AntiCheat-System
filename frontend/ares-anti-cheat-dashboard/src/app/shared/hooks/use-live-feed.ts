/**
 * Angular Utility for Live Feed Data
 * 
 * In Angular, we use services instead of React-style hooks.
 * This file provides utility functions to work with live feed data.
 * 
 * The main implementation is in: src/app/shared/services/stats.service.ts
 * 
 * Usage Example:
 * 
 * ```typescript
 * import { StatsService } from '../services/stats.service';
 * 
 * @Component({...})
 * export class MyComponent implements OnInit, OnDestroy {
 *   private destroy$ = new Subject<void>();
 *   events: any[] = [];
 * 
 *   constructor(private statsService: StatsService) {}
 * 
 *   ngOnInit() {
 *     this.statsService.liveFeed$
 *       .pipe(takeUntil(this.destroy$))
 *       .subscribe(events => this.events = events);
 *   }
 * 
 *   ngOnDestroy() {
 *     this.destroy$.next();
 *     this.destroy$.complete();
 *   }
 * }
 * ```
 */

import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StatsService } from '../services/stats.service';
import { GameEvent } from '../models/event.model';

/**
 * Utility function to get live feed observable
 * Can be used with Angular's inject() in injection context
 */
export function useLiveFeed(): Observable<any[]> {
  const service = inject(StatsService);
  return service.liveFeed$;
}

/**
 * Get formatted timestamp for display
 */
export function formatEventTime(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get severity color class based on cheat type
 */
export function getEventSeverityClass(cheatType: string): string {
  const severityMap: Record<string, string> = {
    'aimbot': 'severity-critical',
    'wallhack': 'severity-high',
    'speedhack': 'severity-high',
    'no-recoil': 'severity-medium',
    'recoil_mod': 'severity-medium',
    'robotic-aim': 'severity-medium',
    'robotic_movement': 'severity-medium',
    'trigger-bot': 'severity-high',
    'snap_lock': 'severity-critical'
  };
  return severityMap[cheatType?.toLowerCase()] || 'severity-low';
}

/**
 * Get severity level from cheat type
 */
export function getSeverityLevel(cheatType: string): 'critical' | 'high' | 'medium' | 'low' {
  const criticalTypes = ['aimbot', 'snap_lock', 'snap-lock'];
  const highTypes = ['wallhack', 'speedhack', 'trigger-bot'];
  const mediumTypes = ['no-recoil', 'recoil_mod', 'robotic-aim', 'robotic_movement'];
  
  const type = cheatType?.toLowerCase() || '';
  
  if (criticalTypes.some(t => type.includes(t))) return 'critical';
  if (highTypes.some(t => type.includes(t))) return 'high';
  if (mediumTypes.some(t => type.includes(t))) return 'medium';
  return 'low';
}

/**
 * Filter events by severity
 */
export function filterBySeverity(events: GameEvent[], severity: string): GameEvent[] {
  if (severity === 'all') return events;
  return events.filter(e => {
    if (!e.cheatType) return false;
    return getSeverityLevel(e.cheatType) === severity;
  });
}
