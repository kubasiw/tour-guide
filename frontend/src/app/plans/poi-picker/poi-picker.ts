import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router, RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../auth/auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { POI_TYPE_COLORS, POI_TYPE_ICONS, Poi } from '../../core/poi.model';
import { PoiService } from '../../core/poi.service';
import { Loader } from '../../shared/loader/loader';
import { PlanItemWithPoi } from '../plan-item.model';
import { PlanChat } from '../plan-chat/plan-chat';
import { PlanService } from '../plan.service';
import { PLAN_STATUS_FINAL } from '../plan-status';
import { PoiMap } from '../poi-map/poi-map';
import { PoiTile } from '../poi-tile/poi-tile';

@Component({
  selector: 'app-poi-picker',
  imports: [PoiTile, Loader, NgbAlert, DragDropModule, PoiMap, RouterLink, PlanChat],
  templateUrl: './poi-picker.html',
  styleUrl: './poi-picker.scss',
})
export class PoiPicker {
  public readonly planId = input.required<string>();
  public readonly planStatus = input<string>();

  private readonly planService = inject(PlanService);
  private readonly poiService = inject(PoiService);
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

  // 'split' is the default per user request (2026-07-22) — the linked list+map view is more
  // useful out of the box than a plain grid, now that hover-sync between the two exists.
  protected readonly viewMode = signal<'grid' | 'map' | 'split'>('split');

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

  // Freshly-generated descriptions, keyed by POI id — the `candidates`
  // resource itself isn't mutated in place when one is generated after the
  // initial fetch, so this is a local overlay on top of it.
  protected readonly generatedDescriptions = signal<Record<string, string>>({});
  protected readonly generatingDescriptionIds = signal<ReadonlySet<string>>(new Set());
  protected readonly descriptionError = signal<string | null>(null);

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

  protected descriptionFor(poi: Poi): string | null {
    return poi.aiDescription ?? this.generatedDescriptions()[poi.id] ?? null;
  }

  protected isGeneratingDescription(poi: Poi): boolean {
    return this.generatingDescriptionIds().has(poi.id);
  }

  // Explicit, per-tile trigger only — never called in bulk for a whole
  // candidates list (see PoiService.getOrGenerateDescription's own comment
  // for why: up to MAX_CANDIDATES=24 tiles per render, so an auto-generate-
  // on-load approach would mean up to 24 LLM calls per page view).
  protected generateDescription(poi: Poi): void {
    if (this.isGeneratingDescription(poi)) {
      return;
    }

    this.descriptionError.set(null);
    this.generatingDescriptionIds.update((ids) => new Set(ids).add(poi.id));

    this.poiService.getDescription(poi.id).subscribe({
      next: ({ description }) => {
        this.generatingDescriptionIds.update((ids) => {
          const next = new Set(ids);
          next.delete(poi.id);
          return next;
        });
        this.generatedDescriptions.update((map) => ({ ...map, [poi.id]: description }));
      },
      error: (err: unknown) => {
        this.generatingDescriptionIds.update((ids) => {
          const next = new Set(ids);
          next.delete(poi.id);
          return next;
        });
        this.descriptionError.set(extractErrorMessage(err));
      },
    });
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
