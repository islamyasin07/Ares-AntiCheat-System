import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StatsService } from '../../shared/services/stats.service';

@Component({
  selector: 'app-players-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './players-list-page.component.html',
  styleUrls: ['./players-list-page.component.css']
})
export class PlayersListPageComponent implements OnInit {
  players: any[] = [];
  loading = true;

  constructor(private stats: StatsService) {}

  ngOnInit() {
    this.stats.getPlayers().subscribe(list => {
      this.players = list || [];
      this.loading = false;
    });
  }
}
