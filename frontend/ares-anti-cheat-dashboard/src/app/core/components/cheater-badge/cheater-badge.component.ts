import { Component, Input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'app-cheater-badge',
  standalone: true,
  imports: [NgClass, NgIf],
  templateUrl: './cheater-badge.component.html',
  styleUrls: ['./cheater-badge.component.css']
})
export class CheaterBadgeComponent {
  @Input() type: 'aimbot' | 'no-recoil' | 'robotic' | 'wallhack' | 'trigger' = 'aimbot';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get icon(): string {
    const icons: Record<string, string> = {
      'aimbot': '🎯',
      'no-recoil': '🔫',
      'robotic': '🤖',
      'wallhack': '👁️',
      'trigger': '⚡'
    };
    return icons[this.type] || '⚠️';
  }

  get label(): string {
    const labels: Record<string, string> = {
      'aimbot': 'Aimbot',
      'no-recoil': 'No Recoil',
      'robotic': 'Robotic Aim',
      'wallhack': 'Wallhack',
      'trigger': 'Trigger Bot'
    };
    return labels[this.type] || 'Unknown';
  }

  get colorClass(): string {
    const colors: Record<string, string> = {
      'aimbot': 'badge-aimbot',
      'no-recoil': 'badge-norecoil',
      'robotic': 'badge-robotic',
      'wallhack': 'badge-wallhack',
      'trigger': 'badge-trigger'
    };
    return colors[this.type] || 'badge-default';
  }
}
