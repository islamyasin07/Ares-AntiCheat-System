import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, NgIf, NgFor, DecimalPipe, DatePipe } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { StatsService, AdminAction, SystemInfo } from '../../shared/services/stats.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, NgClass, NgIf, NgFor, DecimalPipe, DatePipe],
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.css']
})
export class SettingsPageComponent implements OnInit, OnDestroy {
  // Active tab
  activeTab: 'general' | 'data' | 'players' | 'system' = 'general';
  
  // ========================================
  // GENERAL SETTINGS
  // ========================================
  theme = 'dark';
  particlesEnabled = true;
  animationsEnabled = true;
  desktopAlerts = true;
  soundEnabled = false;
  alertThreshold = 75;
  refreshRate = '2000';
  maxEvents = '100';
  chartSmoothing = true;
  apiUrl = 'http://localhost:3000/api';
  
  // ========================================
  // CONNECTION STATUS
  // ========================================
  isConnected = false;
  isChecking = false;
  lastChecked = '';
  
  // ========================================
  // DATA MANAGEMENT
  // ========================================
  isClearing = false;
  clearConfirmType: 'detections' | 'events' | 'all' | null = null;
  
  // ========================================
  // SYSTEM INFO
  // ========================================
  systemInfo: SystemInfo | null = null;
  isLoadingSystem = false;
  
  // ========================================
  // ACTION HISTORY
  // ========================================
  actionHistory: AdminAction[] = [];
  isLoadingHistory = false;
  
  // ========================================
  // FLAGGED PLAYERS
  // ========================================
  flaggedPlayers: any[] = [];
  isLoadingFlagged = false;
  
  // Stats
  totalEvents = 0;
  totalSuspicious = 0;
  livePlayers = 0;
  
  private subs: Subscription[] = [];

  constructor(private statsService: StatsService) {}

  ngOnInit() {
    this.loadSettings();
    this.checkConnection();
    this.loadSystemInfo();
    this.loadActionHistory();
    this.loadFlaggedPlayers();
    
    // Auto-check connection every 15 seconds
    this.subs.push(
      interval(15000).subscribe(() => this.checkConnection())
    );
    
    // Refresh system info every 30 seconds
    this.subs.push(
      interval(30000).subscribe(() => this.loadSystemInfo())
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ========================================
  // TAB NAVIGATION
  // ========================================
  setTab(tab: 'general' | 'data' | 'players' | 'system') {
    this.activeTab = tab;
    if (tab === 'system') {
      this.loadSystemInfo();
      this.loadActionHistory();
    }
    if (tab === 'players') {
      this.loadFlaggedPlayers();
    }
  }

  // ========================================
  // SETTINGS MANAGEMENT
  // ========================================
  loadSettings() {
    const saved = localStorage.getItem('ares-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      Object.assign(this, settings);
    }
  }

  saveSettings() {
    const settings = {
      theme: this.theme,
      particlesEnabled: this.particlesEnabled,
      animationsEnabled: this.animationsEnabled,
      desktopAlerts: this.desktopAlerts,
      soundEnabled: this.soundEnabled,
      alertThreshold: this.alertThreshold,
      refreshRate: this.refreshRate,
      maxEvents: this.maxEvents,
      chartSmoothing: this.chartSmoothing,
      apiUrl: this.apiUrl
    };
    localStorage.setItem('ares-settings', JSON.stringify(settings));
    this.showToast('Settings saved successfully!', 'success');
  }

  resetDefaults() {
    this.theme = 'dark';
    this.particlesEnabled = true;
    this.animationsEnabled = true;
    this.desktopAlerts = true;
    this.soundEnabled = false;
    this.alertThreshold = 75;
    this.refreshRate = '2000';
    this.maxEvents = '100';
    this.chartSmoothing = true;
    this.apiUrl = 'http://localhost:3000/api';
    localStorage.removeItem('ares-settings');
    this.showToast('Settings reset to defaults', 'info');
  }

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================
  checkConnection() {
    this.isChecking = true;
    this.statsService.getSystemInfo().subscribe({
      next: (data) => {
        this.isConnected = true;
        this.isChecking = false;
        this.lastChecked = new Date().toLocaleTimeString();
        this.systemInfo = data;
        this.totalEvents = data.counts.totalEvents;
        this.totalSuspicious = data.counts.totalDetections;
      },
      error: () => {
        this.isConnected = false;
        this.isChecking = false;
        this.lastChecked = new Date().toLocaleTimeString();
      }
    });
  }

  // ========================================
  // DATA MANAGEMENT
  // ========================================
  confirmClear(type: 'detections' | 'events' | 'all') {
    this.clearConfirmType = type;
  }

  cancelClear() {
    this.clearConfirmType = null;
  }

  executeClear() {
    if (!this.clearConfirmType) return;
    
    this.isClearing = true;
    let clearObs;
    
    switch (this.clearConfirmType) {
      case 'detections':
        clearObs = this.statsService.clearDetections();
        break;
      case 'events':
        clearObs = this.statsService.clearEvents();
        break;
      case 'all':
        clearObs = this.statsService.clearAllData();
        break;
    }
    
    clearObs.subscribe({
      next: (result) => {
        this.isClearing = false;
        this.clearConfirmType = null;
        if (result.success) {
          this.showToast(result.message, 'success');
          this.loadSystemInfo();
          this.loadActionHistory();
        } else {
          this.showToast('Failed to clear data: ' + result.message, 'error');
        }
      },
      error: () => {
        this.isClearing = false;
        this.clearConfirmType = null;
        this.showToast('Failed to clear data', 'error');
      }
    });
  }

  // ========================================
  // SYSTEM INFO
  // ========================================
  loadSystemInfo() {
    this.isLoadingSystem = true;
    this.statsService.getSystemInfo().subscribe({
      next: (data) => {
        this.systemInfo = data;
        this.isLoadingSystem = false;
      },
      error: () => {
        this.isLoadingSystem = false;
      }
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(seconds: number): string {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // ========================================
  // ACTION HISTORY
  // ========================================
  loadActionHistory() {
    this.isLoadingHistory = true;
    this.statsService.getActionHistory(100).subscribe({
      next: (data) => {
        this.actionHistory = data;
        this.isLoadingHistory = false;
      },
      error: () => {
        this.isLoadingHistory = false;
      }
    });
  }

  clearHistory() {
    if (!confirm('Are you sure you want to clear action history?')) return;
    
    this.statsService.clearActionHistory().subscribe({
      next: (result) => {
        if (result.success) {
          this.showToast('History cleared', 'success');
          this.actionHistory = [];
        }
      }
    });
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'FLAG_PLAYER': return '🚩';
      case 'UNFLAG_PLAYER': return '✅';
      case 'BAN_PLAYER': return '🚫';
      case 'UNBAN_PLAYER': return '🔓';
      case 'CLEAR_DETECTIONS': return '🗑️';
      case 'CLEAR_EVENTS': return '📭';
      case 'CLEAR_ALL_DATA': return '💣';
      default: return '📋';
    }
  }

  getActionClass(action: string): string {
    if (action.includes('BAN') || action.includes('CLEAR')) return 'danger';
    if (action.includes('FLAG')) return 'warning';
    if (action.includes('UN')) return 'success';
    return 'info';
  }

  // ========================================
  // FLAGGED PLAYERS
  // ========================================
  loadFlaggedPlayers() {
    this.isLoadingFlagged = true;
    this.statsService.getFlaggedPlayers().subscribe({
      next: (data) => {
        this.flaggedPlayers = data;
        this.isLoadingFlagged = false;
      },
      error: () => {
        this.isLoadingFlagged = false;
      }
    });
  }

  unflagPlayer(playerId: string) {
    this.statsService.unflagPlayer(playerId).subscribe({
      next: (result) => {
        if (result.success) {
          this.showToast(`Player ${playerId} unflagged`, 'success');
          this.loadFlaggedPlayers();
          this.loadActionHistory();
        } else {
          this.showToast(result.message, 'error');
        }
      }
    });
  }

  unbanPlayer(playerId: string) {
    this.statsService.unbanPlayer(playerId).subscribe({
      next: (result) => {
        if (result.success) {
          this.showToast(`Player ${playerId} unbanned`, 'success');
          this.loadFlaggedPlayers();
          this.loadActionHistory();
        } else {
          this.showToast(result.message, 'error');
        }
      }
    });
  }

  // ========================================
  // TOAST NOTIFICATIONS
  // ========================================
  private showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const colors: Record<string, string> = {
      success: 'rgba(34, 197, 94, 0.9)',
      error: 'rgba(239, 68, 68, 0.9)',
      info: 'rgba(59, 199, 255, 0.9)',
      warning: 'rgba(249, 115, 22, 0.9)'
    };
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
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
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
