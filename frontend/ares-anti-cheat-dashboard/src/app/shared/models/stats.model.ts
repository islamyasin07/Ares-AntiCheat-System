export interface AresStats {
  totalEvents: number;
  totalSuspicious: number;
  cheatersToday: number;
  livePlayers: number;
  perMinuteSuspicious: { minute: string; count: number }[];
  cheatDistribution: { cheatType: string; count: number }[];
  hourlyHeatmap: number[]; // 24 values
}
