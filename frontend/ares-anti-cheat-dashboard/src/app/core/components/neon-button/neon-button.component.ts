import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-neon-button',
  standalone: true,
  templateUrl: './neon-button.component.html',
  styleUrl: './neon-button.component.css'
})
export class NeonButtonComponent {
  @Input() label = "Button";
  @Input() color = "neonBlue";
}
