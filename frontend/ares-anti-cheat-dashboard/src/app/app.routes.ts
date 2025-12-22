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
        path: 'players',
        loadComponent: () =>
          import('./features/players/players-list-page.component').then(m => m.PlayersListPageComponent)
      },
      {
        path: 'suspicious',
        loadComponent: () =>
          import('./features/suspicious/suspicious-events-page.component').then(m => m.SuspiciousEventsPageComponent)
      },
      {
        path: 'live-feed',
        loadComponent: () =>
          import('./features/live-feed/live-feed-page.component').then(m => m.LiveFeedPageComponent)
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/system-analytics-page.component').then(m => m.SystemAnalyticsPageComponent)
      },
      {
        path: 'analytics-report',
        loadComponent: () =>
          import('./features/analytics-report/analytics-report.component').then(m => m.AnalyticsReportComponent)
      },
      {
        path: 'ml',
        loadComponent: () =>
          import('./features/ml/ml-dashboard.component').then(m => m.MlDashboardComponent)
      },
      {
        path: 'ml/player/:id',
        loadComponent: () =>
          import('./features/ml/ml-player-drill.component').then(m => m.MlPlayerDrillComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent)
      },
      {
        path: 'kafka',
        loadComponent: () =>
          import('./features/dashboard/kafka-monitoring.component').then(m => m.KafkaMonitoringComponent)
      }
    ]
  }
];
