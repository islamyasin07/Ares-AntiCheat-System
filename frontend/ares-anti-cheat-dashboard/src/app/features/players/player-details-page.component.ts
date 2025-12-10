import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import { GlowCardComponent } from '../../core/components/glow-card/glow-card.component';
import { AresRadarChartComponent } from '../../core/components/charts/ares-radar-chart.component';
import { StatsService, PlayerStatus } from '../../shared/services/stats.service';

@Component({
  selector: 'app-player-details',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    AsyncPipe,
    GlowCardComponent,
    AresRadarChartComponent
  ],
  templateUrl: './player-details-page.component.html',
  styleUrls: ['./player-details-page.component.css']
})
export class PlayerDetailsPageComponent implements OnInit, OnDestroy {

  playerId = '';
  totalEvents = 0;
  suspiciousCount = 0;
  lastSeen = 'Loading...';
  
  // Player status for flag/ban
  playerStatus: PlayerStatus | null = null;
  isActioning = false;

  player$ = this.route.paramMap.pipe(
    switchMap(params => {
      this.playerId = params.get('id') ?? '';
      this.loadPlayerStatus();
      return this.statsService.getPlayerDetails(this.playerId);
    }),
    tap(player => {
      if (player) {
        this.totalEvents = player.totalEvents || 0;
        this.suspiciousCount = player.suspiciousEvents || 0;
        
        // Calculate last seen from recent detections
        if (player.recentDetections && player.recentDetections.length > 0) {
          const lastTime = player.recentDetections[0].timestamp;
          this.lastSeen = this.formatTimeAgo(lastTime);
          
          // Transform detections for the table
          this.detections = player.recentDetections.map((d: any) => ({
            type: d.cheatType || 'Unknown',
            score: Math.round((d.cheatScore || 0) * 100),
            details: `Speed: ${d.speed?.toFixed(1) || 'N/A'} px/s`,
            time: this.formatTime(d.timestamp)
          }));
          
          // Generate activity from detections
          this.recentActivity = player.recentDetections.slice(0, 5).map((d: any) => ({
            type: this.getActivityType(d.cheatType),
            description: this.getActivityDescription(d),
            time: this.formatTimeAgo(d.timestamp)
          }));
        } else {
          this.lastSeen = 'No activity';
          this.detections = [];
          this.recentActivity = [];
        }
      }
    })
  );

  recentActivity: Array<{type: string; description: string; time: string}> = [];
  detections: Array<{type: string; score: number; details: string; time: string}> = [];
  
  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private statsService: StatsService
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  loadPlayerStatus() {
    this.statsService.getPlayerStatus(this.playerId).subscribe(status => {
      this.playerStatus = status;
    });
  }

  flagPlayer() {
    this.isActioning = true;
    this.statsService.flagPlayer(this.playerId, 'Manual flag from player details').subscribe(result => {
      this.isActioning = false;
      if (result.success) {
        this.showToast('Player flagged successfully', 'success');
        this.loadPlayerStatus();
      } else {
        this.showToast(result.message || 'Failed to flag player', 'error');
      }
    });
  }

  unflagPlayer() {
    this.isActioning = true;
    this.statsService.unflagPlayer(this.playerId).subscribe(result => {
      this.isActioning = false;
      if (result.success) {
        this.showToast('Flag removed successfully', 'success');
        this.loadPlayerStatus();
      } else {
        this.showToast(result.message || 'Failed to unflag player', 'error');
      }
    });
  }

  banPlayer() {
    if (!confirm(`Are you sure you want to ban player ${this.playerId}?`)) return;
    
    this.isActioning = true;
    this.statsService.banPlayer(this.playerId, 'Manual ban from player details').subscribe(result => {
      this.isActioning = false;
      if (result.success) {
        this.showToast('Player banned successfully', 'success');
        this.loadPlayerStatus();
      } else {
        this.showToast(result.message || 'Failed to ban player', 'error');
      }
    });
  }

  unbanPlayer() {
    this.isActioning = true;
    this.statsService.unbanPlayer(this.playerId).subscribe(result => {
      this.isActioning = false;
      if (result.success) {
        this.showToast('Player unbanned successfully', 'success');
        this.loadPlayerStatus();
      } else {
        this.showToast(result.message || 'Failed to unban player', 'error');
      }
    });
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const colors: Record<string, string> = {
      success: 'rgba(34, 197, 94, 0.9)',
      error: 'rgba(239, 68, 68, 0.9)',
      info: 'rgba(59, 199, 255, 0.9)'
    };
    
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  getRiskLevel(score: number): string {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getLegendColor(index: number): string {
    const colors = ['#3BC7FF', '#FF2E97', '#A854FF', '#22C55E', '#F97316'];
    return colors[index % colors.length];
  }

  private formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private getActivityType(cheatType: string): string {
    if (!cheatType) return 'Normal';
    const t = cheatType.toLowerCase();
    if (t.includes('aimbot')) return 'Aimbot';
    if (t.includes('speed')) return 'SpeedHack';
    if (t.includes('recoil')) return 'No-Recoil';
    if (t.includes('wall')) return 'Wallhack';
    return 'Suspicious';
  }

  private getActivityDescription(detection: any): string {
    const type = detection.cheatType || 'Unknown';
    const speed = detection.speed?.toFixed(1) || 'N/A';
    
    if (type.toLowerCase().includes('aimbot')) {
      return `High velocity aim detected (${speed} px/s)`;
    }
    if (type.toLowerCase().includes('speed')) {
      return `Abnormal movement speed detected`;
    }
    if (type.toLowerCase().includes('recoil')) {
      return `Minimal recoil pattern detected`;
    }
    return `Suspicious behavior flagged`;
  }
}
