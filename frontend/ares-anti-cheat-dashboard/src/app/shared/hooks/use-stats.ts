/**
 * Angular Utility for Stats Data
 * 
 * In Angular, we use services instead of React-style hooks.
 * This file provides utility functions to work with statistics data.
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
 *   stats: any = null;
 * 
 *   constructor(private statsService: StatsService) {}
 * 
 *   ngOnInit() {
 *     this.statsService.stats$
 *       .pipe(takeUntil(this.destroy$))
 *       .subscribe(stats => this.stats = stats);
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

/**
 * Stats interface for type safety
 */
export interface DashboardStats {
  totalEvents: number;
  totalSuspicious: number;
  cheatersToday: number;
  livePlayers: number;
  perMinute?: number[];
  cheatTypes?: Record<string, number>;
  hourlyHeatmap?: number[];
}

/**
 * Utility function to get stats observable
 * Can be used with Angular's inject() in injection context
 */
export function useStats(): Observable<any> {
  const service = inject(StatsService);
  return service.stats$;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get trend direction from percentage
 */
export function getTrendDirection(percentChange: number): 'up' | 'down' | 'neutral' {
  if (percentChange > 5) return 'up';
  if (percentChange < -5) return 'down';
  return 'neutral';
}

/**
 * Format stat for display with optional animation
 */
export function formatStatValue(value: number, animated: boolean = false): string {
  if (!animated) {
    return formatNumber(value);
  }
  // For animated values, return raw number (animation handled in component)
  return value.toString();
}

/**
 * Get risk level from score
 */
export function getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Get color for risk level
 */
export function getRiskColor(level: 'critical' | 'high' | 'medium' | 'low'): string {
  const colors = {
    critical: '#FF2E97',
    high: '#FF6B6B',
    medium: '#FFB800',
    low: '#00FF88'
  };
  return colors[level];
}

/**
 * Calculate stats summary from raw data
 */
export function calculateStatsSummary(stats: DashboardStats): {
  healthScore: number;
  alertLevel: string;
  trend: string;
} {
  const suspiciousRate = stats.totalEvents > 0 
    ? (stats.totalSuspicious / stats.totalEvents) * 100 
    : 0;
  
  let healthScore = 100 - Math.min(suspiciousRate * 2, 100);
  let alertLevel = 'Normal';
  let trend = 'Stable';
  
  if (stats.cheatersToday > 10) {
    alertLevel = 'High Alert';
    trend = 'Increasing';
    healthScore = Math.max(healthScore - 20, 0);
  } else if (stats.cheatersToday > 5) {
    alertLevel = 'Elevated';
    trend = 'Rising';
    healthScore = Math.max(healthScore - 10, 0);
  }
  
  return { healthScore: Math.round(healthScore), alertLevel, trend };
}

/**
 * Get analytics observable
 */
export function useAnalytics(): Observable<any> {
  const service = inject(StatsService);
  return service.analytics$;
}
