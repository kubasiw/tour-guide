import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  NgbAlert,
  NgbCalendar,
  NgbDate,
  NgbInputDatepicker,
  NgbTypeahead,
  NgbTypeaheadSelectItemEvent,
} from '@ng-bootstrap/ng-bootstrap';
import * as L from 'leaflet';
// leaflet-draw (old-style plugin, no import/require of its own) mutates a bare global `L`
// (`L.Draw = {}`, etc.) — it has no way to see the module-scoped `L` from the import above.
// In dev (`ng serve`) this happens to line up by accident; in the real production bundle it
// doesn't, so leaflet-draw's mutations land on a different object than the one this file reads,
// leaving `L.Draw` undefined here (crashes on `L.Draw.Event.CREATED` in initMap). Confirmed live
// 2026-07-27: broken on tourguide.kubsiw.com (production build), fine on localhost:4200 (dev
// server). Explicitly forcing `window.L` to be this exact object closes that gap regardless of
// how the bundler treats the import.
(window as unknown as { L: typeof L }).L = L;
import 'leaflet-draw';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';
import { ACTIVITIES } from '../core/activity.model';
import { API_BASE_URL } from '../core/api-base-url';
import { Area, areaBoundingBox } from '../core/area.model';
import { GeocodeSearchResult, GeocodingService } from '../core/geocoding.service';
import { extractErrorMessage } from '../core/http-error';
import { Trail } from '../core/trail.model';
import { TrailService } from '../core/trail.service';
import { buildPlanSteps } from '../plans/plan-steps';
import { Plan } from '../plans/plan.model';
import { PlanService, UpdatePlanPayload } from '../plans/plan.service';
import { AreaSummary } from '../shared/area-summary/area-summary';
import { Loader } from '../shared/loader/loader';
import { Stepper } from '../shared/stepper/stepper';

const SEARCH_MIN_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_CENTER: L.LatLngExpression = [50.06, 19.94];
const DEFAULT_ZOOM = 13;

// Amber, not trail-green — only one trail can be highlighted at a time here
// (picking a new one replaces the last), matching this app's "amber for the
// single most-important/selected element" convention rather than green's
// "can be multi-selected" one.
const SELECTED_TRAIL_COLOR = '#854f0b';

// Leaflet's default marker icon paths don't resolve through a bundler; the actual
// files are copied to `leaflet-images/` via an angular.json asset glob.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet-images/marker-icon-2x.png',
  iconUrl: 'leaflet-images/marker-icon.png',
  shadowUrl: 'leaflet-images/marker-shadow.png',
});

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatNgbDate(date: NgbDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function daysBetween(start: NgbDate, end: NgbDate): number {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

@Component({
  selector: 'app-plan-setup',
  imports: [
    AreaSummary,
    Loader,
    NgbAlert,
    ReactiveFormsModule,
    NgbTypeahead,
    NgbInputDatepicker,
    Stepper,
  ],
  templateUrl: './plan-setup.html',
  styleUrl: './plan-setup.scss',
})
export class PlanSetup {
  public readonly id = input<string>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly planService = inject(PlanService);
  private readonly geocodingService = inject(GeocodingService);
  private readonly trailService = inject(TrailService);
  private readonly router = inject(Router);
  private readonly calendar = inject(NgbCalendar);

  protected readonly plan = httpResource<Plan>(() =>
    this.id() ? `${API_BASE_URL}/plans/${this.id()}` : undefined,
  );

  protected readonly steps = computed(() => buildPlanSteps(this.plan.value(), this.id(), 'setup'));

  protected readonly area = signal<Area | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  // On by default per user request (2026-07-22) — trails are useful enough on first
  // view that requiring an extra click no longer earns its keep now that the toggle
  // itself is easy to find (see addTrailsToggleControl's own positioning note).
  protected readonly trailsVisible = signal(true);

  // Real trail geometry, distinct from the raster tile overlay above —
  // discovery is explicit-trigger (a button, not auto-fired whenever the
  // drawn area changes) to respect Overpass's own light rate-limit, same
  // "don't auto-fire external calls aggressively" precedent as the AI
  // narration button elsewhere in this app.
  protected readonly discoveredTrails = signal<Trail[]>([]);
  protected readonly trailsSearched = signal(false);
  protected readonly trailsDiscoveryLoading = signal(false);
  protected readonly trailsDiscoveryError = signal<string | null>(null);
  protected readonly selectedTrailId = signal<string | null>(null);
  protected readonly trailGeometryLoading = signal<string | null>(null);

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly activities = ACTIVITIES;
  protected readonly selectedActivities = signal<ReadonlySet<string>>(new Set());

  // Not a Reactive Form — this is a single transient date-range field, same
  // "no form needed for one field" precedent as the search box below.
  // fromDate/toDate/hoveredDate drive a custom day template for range
  // highlighting (ng-bootstrap's own documented range-picker recipe).
  protected readonly fromDate = signal<NgbDate | null>(null);
  protected readonly toDate = signal<NgbDate | null>(null);
  protected readonly hoveredDate = signal<NgbDate | null>(null);
  protected readonly minDate = this.calendar.getToday();

  protected readonly rangeDisplay = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from) {
      return '';
    }
    return to ? `${formatNgbDate(from)}  →  ${formatNgbDate(to)}` : formatNgbDate(from);
  });

  private readonly mapSignal = signal<L.Map | undefined>(undefined);
  private drawnItems?: L.FeatureGroup;
  private hasSeededExisting = false;
  private trailsLayer?: L.TileLayer;
  private trailsLegendControl?: L.Control;
  private selectedTrailLayer?: L.FeatureGroup;

  public constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const map = this.mapSignal();
      const plan = this.plan.value();
      if (map && plan && !this.hasSeededExisting) {
        this.hasSeededExisting = true;
        this.drawExistingArea(map, plan.area);
        this.selectedActivities.set(new Set(plan.activities));

        if (plan.startDate) {
          const [year, month, day] = plan.startDate.slice(0, 10).split('-').map(Number);
          const startDate = new NgbDate(year, month, day);
          const endDate = this.calendar.getNext(startDate, 'd', plan.durationDays ?? 3);
          this.fromDate.set(startDate);
          this.toDate.set(endDate);
        }
      }
    });
  }

  protected clear(): void {
    this.area.set(null);
    this.drawnItems?.clearLayers();
    this.discoveredTrails.set([]);
    this.trailsSearched.set(false);
    this.trailsDiscoveryError.set(null);
    this.clearSelectedTrail();
  }

  // Explicit-trigger button, not auto-fired on every area edit — Overpass
  // has its own light rate-limit (documented elsewhere in this app) and a
  // user actively dragging/resizing the area shouldn't fire a request per
  // tweak.
  protected discoverTrails(): void {
    const area = this.area();
    if (!area) {
      return;
    }

    this.trailsDiscoveryLoading.set(true);
    this.trailsDiscoveryError.set(null);
    this.clearSelectedTrail();

    this.trailService.findInBoundingBox(areaBoundingBox(area)).subscribe({
      next: (trails) => {
        this.discoveredTrails.set(trails);
        this.trailsDiscoveryLoading.set(false);
        this.trailsSearched.set(true);
      },
      error: (err: unknown) => {
        this.trailsDiscoveryLoading.set(false);
        this.trailsDiscoveryError.set(extractErrorMessage(err));
        this.trailsSearched.set(true);
      },
    });
  }

  protected selectTrail(trail: Trail): void {
    const map = this.mapSignal();
    if (!map) {
      return;
    }

    this.selectedTrailId.set(trail.id);
    this.trailGeometryLoading.set(trail.id);

    this.trailService.getGeometry(trail.osmId).subscribe({
      next: (geometry) => {
        this.trailGeometryLoading.set(null);
        this.selectedTrailLayer?.remove();

        // `featureGroup`, not `layerGroup` — only `FeatureGroup` exposes
        // `getBounds()`, needed right below to fit the map to the trail.
        const layer = L.featureGroup(
          geometry.segments.map((segment) =>
            L.polyline(
              segment.map((point): L.LatLngTuple => [point.lat, point.lng]),
              { color: SELECTED_TRAIL_COLOR, weight: 4 },
            ),
          ),
        ).addTo(map);

        this.selectedTrailLayer = layer;
        map.fitBounds(layer.getBounds());
      },
      error: () => {
        this.trailGeometryLoading.set(null);
        this.selectedTrailId.set(null);
      },
    });
  }

  private clearSelectedTrail(): void {
    this.selectedTrailLayer?.remove();
    this.selectedTrailLayer = undefined;
    this.selectedTrailId.set(null);
    this.trailGeometryLoading.set(null);
  }

  protected toggleActivity(key: string): void {
    const next = new Set(this.selectedActivities());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedActivities.set(next);
  }

  protected onDateSelect(date: NgbDate, datepicker: NgbInputDatepicker): void {
    const from = this.fromDate();
    const to = this.toDate();

    if (!from || to) {
      this.fromDate.set(date);
      this.toDate.set(null);
    } else if (date.after(from)) {
      this.toDate.set(date);
      datepicker.close();
    } else {
      this.fromDate.set(date);
      this.toDate.set(null);
    }
  }

  protected isFrom(date: NgbDate): boolean {
    const from = this.fromDate();
    return from !== null && date.equals(from);
  }

  protected isTo(date: NgbDate): boolean {
    const to = this.toDate();
    return to !== null && date.equals(to);
  }

  protected isInRange(date: NgbDate): boolean {
    const from = this.fromDate();
    const to = this.toDate() ?? this.hoveredDate();
    return from !== null && to !== null && date.after(from) && date.before(to);
  }

  protected readonly searchTypeahead = (
    text$: Observable<string>,
  ): Observable<readonly GeocodeSearchResult[]> =>
    text$.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((term) =>
        term.trim().length < SEARCH_MIN_LENGTH
          ? of([])
          : this.geocodingService.search(term.trim()).pipe(catchError(() => of([]))),
      ),
    );

  protected readonly resultFormatter = (result: GeocodeSearchResult): string => result.displayName;
  protected readonly inputFormatter = (result: GeocodeSearchResult): string => result.displayName;

  protected onSelectItem(event: NgbTypeaheadSelectItemEvent<GeocodeSearchResult>): void {
    const result = event.item;
    const map = this.mapSignal();

    if (result.boundingBox) {
      const { south, west, north, east } = result.boundingBox;
      map?.fitBounds([
        [south, west],
        [north, east],
      ]);
    } else {
      map?.flyTo([result.lat, result.lng], DEFAULT_ZOOM);
    }
  }

  protected submit(): void {
    const area = this.area();
    if (!area) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const from = this.fromDate();
    const to = this.toDate();

    const extra: UpdatePlanPayload = {
      // Always sent, including empty — lets clearing all activities in edit
      // mode actually persist, rather than silently being dropped.
      activities: [...this.selectedActivities()],
      ...(from !== null &&
        to !== null &&
        to.after(from) && {
          startDate: formatNgbDate(from),
          durationDays: daysBetween(from, to),
        }),
    };

    const id = this.id();
    const request: Observable<Plan> = id
      ? forkJoin([this.planService.updateArea(id, area), this.planService.update(id, extra)]).pipe(
          map(([, updated]) => updated),
        )
      : this.planService.create(area, extra);

    request.subscribe({
      next: (plan) => {
        void this.router.navigate(['/plans', plan.id]);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }

  private initMap(): void {
    const map = L.map(this.mapContainer().nativeElement, { scrollWheelZoom: false }).setView(
      DEFAULT_CENTER,
      DEFAULT_ZOOM,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Trackpad/mouse-wheel scrolling over the map shouldn't hijack the page's
    // own scroll — only zoom once the user has deliberately clicked into the
    // map, same pattern as embedded Google Maps.
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    const drawnItems = new L.FeatureGroup().addTo(map);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {},
        circle: {},
        polyline: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (event: L.LeafletEvent) => {
      const created = event as L.DrawEvents.Created;
      drawnItems.clearLayers();
      drawnItems.addLayer(created.layer);
      this.area.set(this.layerToArea(created.layer));
    });

    map.on(L.Draw.Event.EDITED, (event: L.LeafletEvent) => {
      const edited = event as L.DrawEvents.Edited;
      edited.layers.eachLayer((layer) => {
        this.area.set(this.layerToArea(layer));
      });
    });

    this.trailsLayer = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
      attribution:
        '<a href="https://waymarkedtrails.org">Waymarked Trails</a>, CC-BY-SA OpenStreetMap contributors',
      maxZoom: 18,
    });
    this.addTrailsToggleControl(map);

    const handleResize = (): void => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', handleResize));

    this.drawnItems = drawnItems;
    this.mapSignal.set(map);
  }

  // Waymarked Trails' hiking tiles are transparent line overlays meant to sit
  // on top of a normal base map (confirmed via a live fetch — a real PNG,
  // same free/no-key family as Overpass/Nominatim/Open-Meteo). On by default
  // (per user request, 2026-07-22) now that the toggle itself is easy to
  // find — still fully toggleable off for anyone who finds it distracting.
  private addTrailsToggleControl(map: L.Map): void {
    // 'topleft' — user feedback (2026-07-22): a 'bottomright' toggle was
    // easy to miss entirely, had to be hunted for. Moved next to the map's
    // own functional controls (zoom + draw toolbar), where users already
    // look for map features — Leaflet auto-stacks separate `L.Control`
    // instances added to the same corner (each gets its own 10px
    // `margin-top`, confirmed by reading leaflet.css directly), so this
    // simply appends below the draw toolbar with the same natural gap that
    // already separates the zoom control from the draw toolbar above it —
    // no manual positioning/collision math needed.
    const toggleControl = new L.Control({ position: 'topleft' });

    toggleControl.onAdd = (): HTMLElement => {
      const container = L.DomUtil.create('div', 'leaflet-bar plan-setup__trails-toggle');
      const button = L.DomUtil.create('a', '', container);
      button.href = '#';
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Przełącz warstwę szlaków turystycznych');
      button.title = 'Szlaki turystyczne (Waymarked Trails)';
      button.innerHTML = '<i class="bi bi-signpost-2-fill"></i>';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, 'click', (event: Event) => {
        event.preventDefault();
        this.toggleTrails(map, button);
      });

      // Reflects the default-on initial state (`trailsVisible` starts `true`)
      // — reuses the same apply-state logic the click handler uses, so the
      // layer/legend/active-class are never set in only one of the two
      // places this state can change.
      this.applyTrailsVisibility(map, button, this.trailsVisible());

      return container;
    };

    toggleControl.addTo(map);
  }

  private toggleTrails(map: L.Map, button: HTMLElement): void {
    const visible = !this.trailsVisible();
    this.trailsVisible.set(visible);
    this.applyTrailsVisibility(map, button, visible);
  }

  private applyTrailsVisibility(map: L.Map, button: HTMLElement, visible: boolean): void {
    button.classList.toggle('plan-setup__trails-toggle--active', visible);

    if (visible) {
      this.trailsLayer?.addTo(map);
      this.addTrailsLegend(map);
    } else {
      if (this.trailsLayer) {
        map.removeLayer(this.trailsLayer);
      }
      this.trailsLegendControl?.remove();
      this.trailsLegendControl = undefined;
    }
  }

  private addTrailsLegend(map: L.Map): void {
    // 'bottomleft' — same reasoning as the toggle button above; this corner
    // has no pre-existing control at all, so no stacking/collision concern.
    const legendControl = new L.Control({ position: 'bottomleft' });

    legendControl.onAdd = (): HTMLElement => {
      const container = L.DomUtil.create('div', 'plan-setup__trails-legend py-1 px-2');
      container.innerHTML =
        'Szlaki: <a href="https://waymarkedtrails.org" target="_blank" rel="noopener">Waymarked Trails</a>';
      L.DomEvent.disableClickPropagation(container);
      return container;
    };

    legendControl.addTo(map);
    this.trailsLegendControl = legendControl;
  }

  private drawExistingArea(map: L.Map, area: Area): void {
    const layer: L.Layer =
      area.kind === 'radius'
        ? L.circle([area.center.lat, area.center.lng], { radius: area.radiusMeters })
        : L.polygon(area.points.map((point): L.LatLngTuple => [point.lat, point.lng]));

    this.drawnItems?.addLayer(layer);
    this.area.set(area);

    if (layer instanceof L.Circle || layer instanceof L.Polygon) {
      map.fitBounds(layer.getBounds());
    }
  }

  private layerToArea(layer: L.Layer): Area {
    if (layer instanceof L.Circle) {
      const center = layer.getLatLng();
      return {
        kind: 'radius',
        center: { lat: center.lat, lng: center.lng },
        radiusMeters: layer.getRadius(),
      };
    }

    const points = ((layer as L.Polygon).getLatLngs()[0] as L.LatLng[]).map((point) => ({
      lat: point.lat,
      lng: point.lng,
    }));
    return { kind: 'polygon', points };
  }
}
