export type CheatType =
  | 'Aimbot'
  | 'No-Recoil'
  | 'Robotic-Aim'
  | 'Trigger-Bot'
  | 'Wallhack';

export interface GameEvent {
  eventType: string;
  playerId: string;
  speed: number;
  deltaX: number;
  deltaY: number;
  timestamp: number;
  cheatType?: CheatType;
}
