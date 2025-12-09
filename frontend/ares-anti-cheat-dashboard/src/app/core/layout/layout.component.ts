import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { FloatingButterfliesEffectComponent } from '../components/floating-butterflies-effect/floating-butterflies-effect.component';
import { CyberParticlesBackgroundComponent } from '../components/cyber-particles-background/cyber-particles-background.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    FloatingButterfliesEffectComponent,
    CyberParticlesBackgroundComponent
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {}
