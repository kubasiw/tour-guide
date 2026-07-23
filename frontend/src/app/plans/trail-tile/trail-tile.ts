import { Component, computed, input, output } from '@angular/core';
import { Trail } from '../../core/trail.model';

@Component({
  selector: 'app-trail-tile',
  templateUrl: './trail-tile.html',
  styleUrl: './trail-tile.scss',
})
export class TrailTile {
  public readonly trail = input.required<Trail>();
  public readonly selected = input(false);
  public readonly toggled = output<void>();

  protected readonly metaLine = computed(() =>
    [this.trail().ref, this.trail().distanceKm ? `${this.trail().distanceKm} km` : null]
      .filter((part) => part)
      .join(' · '),
  );
}
