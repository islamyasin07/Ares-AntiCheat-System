import { Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-live-feed-list',
  standalone: true,
  imports: [NgFor],
  templateUrl: './live-feed-list.component.html',
  styleUrl: './live-feed-list.component.css'
})
export class LiveFeedListComponent {
  @Input() events: any[] = [];
}
