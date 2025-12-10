import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-live-feed-list',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './live-feed-list.component.html',
  styleUrls: ['./live-feed-list.component.css']
})
export class LiveFeedListComponent {
  @Input() events: any[] = [];

  getEventType(rule: string): string {
    if (!rule) return 'unknown';
    if (rule.includes('Aimbot')) return 'aimbot';
    if (rule.includes('Recoil')) return 'norecoil';
    if (rule.includes('Robotic')) return 'robotic';
    return 'unknown';
  }

  formatTime(timestamp: number): string {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
