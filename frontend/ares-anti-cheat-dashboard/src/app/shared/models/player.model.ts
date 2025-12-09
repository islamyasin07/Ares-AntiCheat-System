export interface Player {
  id: string;
  nickname: string;
  country: string;
  rank: string;
  totalEvents: number;
  suspiciousEvents: number;
  riskScore: number; // 0–100
}
