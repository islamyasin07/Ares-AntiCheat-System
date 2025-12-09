import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-cyber-particles-background',
  standalone: true,
  imports: [NgFor],
  templateUrl: './cyber-particles-background.component.html',
  styleUrls: ['./cyber-particles-background.component.css']
})
export class CyberParticlesBackgroundComponent {
  particles = Array.from({ length: 60 });
}
