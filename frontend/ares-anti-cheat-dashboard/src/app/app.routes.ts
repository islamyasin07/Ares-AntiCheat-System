import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/login-page.component';
import { LayoutComponent } from './core/layout/layout.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/overview-page.component').then(m => m.OverviewPageComponent)
      },
      {
        path: 'players/:id',
        loadComponent: () =>
          import('./features/players/player-details-page.component').then(m => m.PlayerDetailsPageComponent)
      },
      {
        path: 'suspicious',
        loadComponent: () =>
          import('./features/suspicious/suspicious-events-page.component').then(m => m.SuspiciousEventsPageComponent)
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/system-analytics-page.component').then(m => m.SystemAnalyticsPageComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent)
      }
    ]
  }
];
