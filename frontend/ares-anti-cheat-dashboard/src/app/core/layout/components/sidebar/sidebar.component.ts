import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgFor, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  menu = [
    { name: 'Dashboard', path: '/', icon: '🏠' },
    { name: 'Live Feed', path: '/live-feed', icon: '📡' },
    { name: 'Suspicious Events', path: '/suspicious', icon: '🔍' },
    { name: 'Players', path: '/players/P01', icon: '👤' },
    { name: 'Analytics', path: '/analytics', icon: '📊' },
    { name: 'Analytics Report', path: '/analytics-report', icon: '📈' },
    { name: 'Kafka Monitor', path: '/kafka', icon: '🔗' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ];
}
