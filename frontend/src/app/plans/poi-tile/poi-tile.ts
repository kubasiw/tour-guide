import { Component, computed, input, output } from '@angular/core';
import { POI_TYPE_COLORS, POI_TYPE_ICONS, Poi } from '../../core/poi.model';

@Component({
  selector: 'app-poi-tile',
  templateUrl: './poi-tile.html',
  styleUrl: './poi-tile.scss',
})
export class PoiTile {
  public readonly poi = input.required<Poi>();
  public readonly selected = input(false);
  public readonly toggled = output<void>();

  protected readonly icon = computed(() => POI_TYPE_ICONS[this.poi().type]);
  protected readonly colorClass = computed(() => POI_TYPE_COLORS[this.poi().type]);
}
