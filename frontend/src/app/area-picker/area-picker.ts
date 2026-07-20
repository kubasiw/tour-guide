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
import { Router } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import * as L from 'leaflet';
import 'leaflet-draw';
import { API_BASE_URL } from '../core/api-base-url';
import { Area } from '../core/area.model';
import { GeocodingService } from '../core/geocoding.service';
import { extractErrorMessage } from '../core/http-error';
import { buildPlanSteps } from '../plans/plan-steps';
import { Plan } from '../plans/plan.model';
import { PlanService } from '../plans/plan.service';
import { AreaSummary } from '../shared/area-summary/area-summary';
import { Loader } from '../shared/loader/loader';
import { Stepper } from '../shared/stepper/stepper';

const DEFAULT_CENTER: L.LatLngExpression = [50.06, 19.94];
const DEFAULT_ZOOM = 13;

// Leaflet's default marker icon paths don't resolve through a bundler; the actual
// files are copied to `leaflet-images/` via an angular.json asset glob.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet-images/marker-icon-2x.png',
  iconUrl: 'leaflet-images/marker-icon.png',
  shadowUrl: 'leaflet-images/marker-shadow.png',
});

@Component({
  selector: 'app-area-picker',
  imports: [AreaSummary, Loader, NgbAlert, Stepper],
  templateUrl: './area-picker.html',
  styleUrl: './area-picker.scss',
})
export class AreaPicker {
  public readonly id = input<string>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly confirmCard = viewChild<ElementRef<HTMLDivElement>>('confirmCard');
  private readonly destroyRef = inject(DestroyRef);
  private readonly planService = inject(PlanService);
  private readonly geocodingService = inject(GeocodingService);
  private readonly router = inject(Router);

  protected readonly plan = httpResource<Plan>(() =>
    this.id() ? `${API_BASE_URL}/plans/${this.id()}` : undefined,
  );

  protected readonly steps = computed(() => {
    const id = this.id();
    return id ? buildPlanSteps(this.plan.value(), id, 'area') : null;
  });

  protected readonly area = signal<Area | null>(null);
  protected readonly confirming = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);

  private readonly mapSignal = signal<L.Map | undefined>(undefined);
  private drawnItems?: L.FeatureGroup;
  private hasDrawnExisting = false;

  public constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const map = this.mapSignal();
      const plan = this.plan.value();
      if (map && plan && !this.hasDrawnExisting) {
        this.hasDrawnExisting = true;
        this.drawExistingArea(map, plan.area);
      }
    });

    // Scroll the confirm/clear card into view as soon as it appears — otherwise
    // it renders below the map with no visual cue, and the user has to guess
    // they need to scroll down to find it.
    // The `@if`-rendered card's viewChild ref isn't populated yet during this
    // same synchronous effect run (Angular hasn't flushed the template update),
    // so a queued microtask reads it once rendering has actually happened.
    effect(() => {
      if (this.area()) {
        queueMicrotask(() => {
          this.confirmCard()?.nativeElement.scrollIntoView({
            behavior: 'instant',
            block: 'nearest',
          });
        });
      }
    });
  }

  protected clear(): void {
    this.area.set(null);
    this.drawnItems?.clearLayers();
  }

  protected onSearchSubmit(event: SubmitEvent, query: string): void {
    event.preventDefault();
    this.search(query);
  }

  protected search(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    this.searching.set(true);
    this.searchError.set(null);

    this.geocodingService.search(trimmed).subscribe({
      next: (result) => {
        this.searching.set(false);
        if (!result) {
          this.searchError.set('Nie znaleziono takiego miejsca.');
          return;
        }

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
      },
      error: (err: unknown) => {
        this.searching.set(false);
        this.searchError.set(extractErrorMessage(err));
      },
    });
  }

  protected confirm(): void {
    const area = this.area();
    if (!area) {
      return;
    }

    this.confirming.set(true);
    this.errorMessage.set(null);

    const id = this.id();
    const request = id ? this.planService.updateArea(id, area) : this.planService.create(area);

    request.subscribe({
      next: (plan) => {
        void this.router.navigate(['/plans', plan.id, 'activities']);
      },
      error: (err: unknown) => {
        this.confirming.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }

  private initMap(): void {
    const map = L.map(this.mapContainer().nativeElement).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

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

    const handleResize = (): void => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', handleResize));

    this.drawnItems = drawnItems;
    this.mapSignal.set(map);
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
