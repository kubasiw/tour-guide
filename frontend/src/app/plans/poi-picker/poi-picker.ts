import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router, RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../../auth/auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { POI_TYPE_COLORS, POI_TYPE_ICONS, Poi } from '../../core/poi.model';
import { PoiService } from '../../core/poi.service';
import { Trail, TrailGeometry } from '../../core/trail.model';
import { TrailService } from '../../core/trail.service';
import { Loader } from '../../shared/loader/loader';
import { PlanItemWithPoi } from '../plan-item.model';
import { PlanChat } from '../plan-chat/plan-chat';
import { PlanService } from '../plan.service';
import { PLAN_STATUS_FINAL } from '../plan-status';
import { PoiMap } from '../poi-map/poi-map';
import { PoiTile } from '../poi-tile/poi-tile';
import { PinnedTrail, TrailMap } from '../trail-map/trail-map';
import { TrailTile } from '../trail-tile/trail-tile';

// Debounced, not fired on every tile the mouse passes over while scanning
// the list — same SEARCH_DEBOUNCE_MS precedent as plan-setup's own
// typeahead. Only gates the geometry *fetch*; the hover highlight itself
// (for an already-pinned, already-cached trail) is instant, see
// onTrailHoverChange.
const HOVER_GEOMETRY_FETCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-poi-picker',
  imports: [
    PoiTile,
    Loader,
    NgbAlert,
    DragDropModule,
    PoiMap,
    RouterLink,
    PlanChat,
    TrailTile,
    TrailMap,
  ],
  templateUrl: './poi-picker.html',
  styleUrl: './poi-picker.scss',
})
export class PoiPicker {
  public readonly planId = input.required<string>();
  public readonly planStatus = input<string>();
  public readonly activities = input<string[]>([]);

  private readonly planService = inject(PlanService);
  private readonly poiService = inject(PoiService);
  private readonly trailService = inject(TrailService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly planStatusFinal = PLAN_STATUS_FINAL;

  // Trail tiles/list only render at all when the plan's own setup step
  // selected "hiking" — per the user's own framing when this feature was
  // requested. `findTrailCandidates` itself has no such gate server-side
  // (it's a frontend display decision, see that endpoint's own comment).
  protected readonly hikingSelected = computed(() => this.activities().includes('hiking'));

  protected readonly candidates = rxResource({
    params: () => this.planId(),
    stream: ({ params: id }) => this.planService.getCandidates(id),
  });

  protected readonly items = rxResource({
    params: () => this.planId(),
    stream: ({ params: id }) => this.planService.getItems(id),
  });

  // Gated on hikingSelected in `params` — the resource simply never fires
  // when hiking isn't a selected activity, same "zero network noise for a
  // feature that isn't relevant" precedent as the AI-description resource's
  // own auth gating in `PlanDetail`.
  protected readonly trailCandidates = rxResource({
    params: () => (this.hikingSelected() ? this.planId() : undefined),
    stream: ({ params: id }) => this.planService.getTrailCandidates(id),
  });

  protected readonly trailItems = rxResource({
    params: () => (this.hikingSelected() ? this.planId() : undefined),
    stream: ({ params: id }) => this.planService.getTrailItems(id),
  });

  protected readonly toggleError = signal<string | null>(null);
  protected readonly trailToggleError = signal<string | null>(null);

  // Fetched trail geometries, keyed by Trail.id — a cache, not ephemeral
  // preview state: every currently-pinned (added-to-plan) trail's geometry
  // lives here permanently (fetched eagerly, see the constructor effect
  // below), and a not-yet-pinned trail's geometry is added here too the
  // first time it's hovered, so re-hovering it later is free.
  protected readonly trailGeometries = signal<Map<string, TrailGeometry>>(new Map());
  private readonly geometryFetchInFlight = new Set<string>();

  protected readonly hoveredTrailId = signal<string | null>(null);
  private hoverGeometryFetchTimeoutId?: ReturnType<typeof setTimeout>;

  // Every currently-pinned trail paired with its geometry — populated
  // progressively as each fetch completes (see the eager-load effect
  // below), consumed by TrailMap to render all of them permanently.
  protected readonly pinnedTrails = computed<PinnedTrail[]>(() => {
    const geometries = this.trailGeometries();
    return (this.trailItems.value() ?? []).flatMap((item) => {
      const geometry = geometries.get(item.trail.id);
      return geometry ? [{ trail: item.trail, geometry }] : [];
    });
  });

  // Only non-null for a trail that's hovered *and* not already pinned —
  // an already-pinned+hovered trail is highlighted in place by TrailMap
  // via `pinnedTrails`/`hoveredTrailId` instead of a separate preview layer.
  protected readonly hoverPreviewGeometry = computed(() => {
    const hoveredId = this.hoveredTrailId();
    if (!hoveredId || this.selectedTrailIds().has(hoveredId)) {
      return null;
    }
    return this.trailGeometries().get(hoveredId) ?? null;
  });

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

  protected readonly selectedTrailIds = computed(
    () => new Set((this.trailItems.value() ?? []).map((item) => item.trail.id)),
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

    // Eagerly fetches geometry for every currently-pinned trail — covers
    // both a freshly-added trail (trailItems reloads after the POST) and a
    // returning visit where trails were already pinned in an earlier
    // session (trailGeometries itself never persists across a reload).
    effect(() => {
      const items = this.trailItems.value();
      if (items) {
        for (const item of items) {
          this.ensureTrailGeometryLoaded(item.trail);
        }
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

  protected isTrailSelected(trail: Trail): boolean {
    return this.selectedTrailIds().has(trail.id);
  }

  // Mirrors `toggle(poi)`'s add/remove shape against the separate
  // Trail/PlanTrailItem models. Pinning a trail onto the map permanently is
  // handled by the eager-load effect (reacts to `trailItems` reloading),
  // not here directly.
  protected toggleTrail(trail: Trail): void {
    this.trailToggleError.set(null);

    if (this.isTrailSelected(trail)) {
      const item = this.trailItems.value()?.find((existing) => existing.trail.id === trail.id);
      if (!item) {
        return;
      }
      this.planService.removeTrailItem(this.planId(), item.id).subscribe({
        next: () => this.trailItems.reload(),
        error: (err: unknown) => this.trailToggleError.set(extractErrorMessage(err)),
      });
    } else {
      this.planService.addTrailItem(this.planId(), trail.id).subscribe({
        next: () => this.trailItems.reload(),
        error: (err: unknown) => this.trailToggleError.set(extractErrorMessage(err)),
      });
    }
  }

  // Hovering a tile sets `hoveredTrailId` immediately, so TrailMap can
  // instantly emphasize an already-pinned (already-cached) trail with no
  // network round-trip. Only the geometry *fetch* for a not-yet-pinned
  // trail is debounced — a brief hover while scanning the list shouldn't
  // fire a request at all.
  protected onTrailHoverChange(trail: Trail, hovered: boolean): void {
    if (this.hoverGeometryFetchTimeoutId !== undefined) {
      clearTimeout(this.hoverGeometryFetchTimeoutId);
      this.hoverGeometryFetchTimeoutId = undefined;
    }

    if (!hovered) {
      if (this.hoveredTrailId() === trail.id) {
        this.hoveredTrailId.set(null);
      }
      return;
    }

    this.hoveredTrailId.set(trail.id);
    this.hoverGeometryFetchTimeoutId = setTimeout(() => {
      this.ensureTrailGeometryLoaded(trail);
    }, HOVER_GEOMETRY_FETCH_DEBOUNCE_MS);
  }

  private ensureTrailGeometryLoaded(trail: Trail): void {
    if (this.trailGeometries().has(trail.id) || this.geometryFetchInFlight.has(trail.id)) {
      return;
    }

    this.geometryFetchInFlight.add(trail.id);
    this.trailService.getGeometry(trail.osmId).subscribe({
      next: (geometry) => {
        this.geometryFetchInFlight.delete(trail.id);
        this.trailGeometries.update((map) => {
          const next = new Map(map);
          next.set(trail.id, geometry);
          return next;
        });
      },
      // Fails silently, per-trail — a trail whose geometry can't be loaded
      // (a real risk given Overpass/Waymarked Trails' own known outages,
      // see CLAUDE.md) simply doesn't render on the map; its tile/list entry
      // is unaffected, and surfacing a dedicated error banner for a
      // background hover-fetch would be noisier than useful.
      error: () => {
        this.geometryFetchInFlight.delete(trail.id);
      },
    });
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
