import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router, RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../auth/auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { POI_TYPE_COLORS, POI_TYPE_ICONS, Poi } from '../../core/poi.model';
import { Loader } from '../../shared/loader/loader';
import { PlanItemWithPoi } from '../plan-item.model';
import { PlanService } from '../plan.service';
import { PLAN_STATUS_FINAL } from '../plan-status';
import { PoiMap } from '../poi-map/poi-map';
import { PoiTile } from '../poi-tile/poi-tile';

@Component({
  selector: 'app-poi-picker',
  imports: [PoiTile, Loader, NgbAlert, DragDropModule, PoiMap, RouterLink],
  templateUrl: './poi-picker.html',
  styleUrl: './poi-picker.scss',
})
export class PoiPicker {
  public readonly planId = input.required<string>();
  public readonly planStatus = input<string>();

  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly planStatusFinal = PLAN_STATUS_FINAL;

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

  protected readonly narration = signal<string | null>(null);
  protected readonly narrationLoading = signal(false);
  protected readonly narrationError = signal<string | null>(null);

  protected readonly finalizing = signal(false);
  protected readonly finalizeError = signal<string | null>(null);

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

  protected generateNarration(): void {
    this.narrationLoading.set(true);
    this.narrationError.set(null);

    this.planService.generateNarration(this.planId()).subscribe({
      next: ({ narration }) => {
        this.narrationLoading.set(false);
        this.narration.set(narration);
      },
      error: (err: unknown) => {
        this.narrationLoading.set(false);
        this.narrationError.set(extractErrorMessage(err));
      },
    });
  }

  protected finalize(): void {
    this.finalizing.set(true);
    this.finalizeError.set(null);

    this.planService.finalize(this.planId()).subscribe({
      next: () => {
        this.finalizing.set(false);
        void this.router.navigate(['/plans', this.planId(), 'summary']);
      },
      error: (err: unknown) => {
        this.finalizing.set(false);
        this.finalizeError.set(extractErrorMessage(err));
      },
    });
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
