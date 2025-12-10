import { Component, OnDestroy } from '@angular/core';
import { NgForOf, NgIf, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-suspicious-events',
  standalone: true,
  imports: [NgForOf, NgIf, AsyncPipe, FormsModule],
  templateUrl: './suspicious-events-page.component.html',
  styleUrls: ['./suspicious-events-page.component.css']
})
export class SuspiciousEventsPageComponent implements OnDestroy {
  suspicious$ = this.statsService.suspiciousEvents$;
  
  searchTerm = '';
  activeFilters: string[] = [];
  cheatTypes = ['Aimbot-Speed', 'Aimbot-Flick', 'No-Recoil', 'Robotic-Aim'];
  
  private allEvents: any[] = [];
  filteredEvents: any[] = [];
  private sub: Subscription;

  constructor(
    private statsService: StatsService,
    private router: Router
  ) {
    this.sub = this.suspicious$.subscribe(events => {
      this.allEvents = events || [];
      this.applyFilters();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  toggleFilter(type: string) {
    const idx = this.activeFilters.indexOf(type);
    if (idx >= 0) {
      this.activeFilters.splice(idx, 1);
    } else {
      this.activeFilters.push(type);
    }
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.allEvents];
    
    if (this.searchTerm) {
      result = result.filter(e => 
        e.playerId?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    
    if (this.activeFilters.length > 0) {
      result = result.filter(e => 
        this.activeFilters.includes(e.cheatType)
      );
    }
    
    this.filteredEvents = result.slice(0, 100); // Limit to 100 for performance
  }

  getPlayerInitial(playerId: string): string {
    return playerId ? playerId.charAt(0).toUpperCase() : '?';
  }

  getBadgeType(rule: string): string {
    if (!rule) return 'unknown';
    if (rule.includes('Aimbot')) return 'aimbot';
    if (rule.includes('Recoil')) return 'norecoil';
    if (rule.includes('Robotic')) return 'robotic';
    return 'unknown';
  }

  getScoreLevel(score: number): string {
    if (!score) return 'low';
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }

  formatTime(timestamp: number): string {
    if (!timestamp) return '--:--:--';
    const d = new Date(timestamp);
    return d.toLocaleTimeString();
  }

  viewPlayer(playerId: string) {
    this.router.navigate(['/players', playerId]);
  }

  flagPlayer(playerId: string) {
    this.statsService.flagPlayer(playerId, 'Flagged from suspicious events').subscribe(result => {
      if (result.success) {
        this.showToast(`Player ${playerId} flagged`, 'success');
      } else {
        this.showToast(result.message || 'Failed to flag player', 'error');
      }
    });
  }

  banPlayer(playerId: string) {
    if (!confirm(`Are you sure you want to ban player ${playerId}?`)) return;
    
    this.statsService.banPlayer(playerId, 'Banned from suspicious events').subscribe(result => {
      if (result.success) {
        this.showToast(`Player ${playerId} banned`, 'success');
      } else {
        this.showToast(result.message || 'Failed to ban player', 'error');
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
}
