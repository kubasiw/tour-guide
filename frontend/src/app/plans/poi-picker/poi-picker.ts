import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { extractErrorMessage } from '../../core/http-error';
import { POI_TYPE_COLORS, POI_TYPE_ICONS, Poi } from '../../core/poi.model';
import { Loader } from '../../shared/loader/loader';
import { PlanItemWithPoi } from '../plan-item.model';
import { PlanService } from '../plan.service';
import { PoiMap } from '../poi-map/poi-map';
import { PoiTile } from '../poi-tile/poi-tile';

@Component({
  selector: 'app-poi-picker',
  imports: [PoiTile, Loader, NgbAlert, DragDropModule, PoiMap],
  templateUrl: './poi-picker.html',
  styleUrl: './poi-picker.scss',
})
export class PoiPicker {
  public readonly planId = input.required<string>();

  private readonly planService = inject(PlanService);

  protected readonly candidates = rxResource({
    params: () => this.planId(),
    stream: ({ params: id }) => this.planService.getCandidates(id),
  });

  protected readonly items = rxResource({
    params: () => this.planId(),
    stream: ({ params: id }) => this.planService.getItems(id),
  });

  protected readonly toggleError = signal<string | null>(null);

  protected readonly orderedItems = signal<PlanItemWithPoi[]>([]);

  protected readonly viewMode = signal<'grid' | 'map' | 'split'>('grid');

  protected readonly hoveredPoiId = signal<string | null>(null);

  protected readonly selectedPoiIds = computed(
    () => new Set((this.items.value() ?? []).map((item) => item.poi.id)),
  );

  protected readonly poiTypeIcons = POI_TYPE_ICONS;
  protected readonly poiTypeColors = POI_TYPE_COLORS;

  public constructor() {
    effect(() => {
      const loaded = this.items.value();
      if (loaded) {
        this.orderedItems.set(loaded);
      }
    });
  }

  protected isSelected(poi: Poi): boolean {
    return this.selectedPoiIds().has(poi.id);
  }

  protected toggle(poi: Poi): void {
    this.toggleError.set(null);

    if (this.isSelected(poi)) {
      const item = this.items.value()?.find((existing) => existing.poi.id === poi.id);
      if (!item) {
        return;
      }
      this.planService.removeItem(this.planId(), item.id).subscribe({
        next: () => this.items.reload(),
        error: (err: unknown) => this.toggleError.set(extractErrorMessage(err)),
      });
    } else {
      this.planService.addItem(this.planId(), poi.id).subscribe({
        next: () => this.items.reload(),
        error: (err: unknown) => this.toggleError.set(extractErrorMessage(err)),
      });
    }
  }

  protected onDrop(event: CdkDragDrop<PlanItemWithPoi[]>): void {
    this.toggleError.set(null);

    const reordered = [...this.orderedItems()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.orderedItems.set(reordered);

    this.planService
      .reorderItems(
        this.planId(),
        reordered.map((item) => item.id),
      )
      .subscribe({
        next: () => this.items.reload(),
        error: (err: unknown) => {
          this.toggleError.set(extractErrorMessage(err));
          this.orderedItems.set(this.items.value() ?? []);
        },
      });
  }
}
