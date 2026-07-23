import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { TrailGeometry } from '../../core/trail.model';

const DEFAULT_CENTER: L.LatLngExpression = [50.06, 19.94];
const DEFAULT_ZOOM = 13;

// Amber, matching plan-setup's own trail preview — only one trail is ever
// previewed at a time here too.
const TRAIL_COLOR = '#854f0b';

// A small, self-contained trail-geometry preview — deliberately its own dumb
// component rather than extending `PoiMap` with trail-specific concerns,
// same "separate list, don't touch what already works" boundary the trail
// plan-item feature itself was scoped to.
@Component({
  selector: 'app-trail-map',
  templateUrl: './trail-map.html',
  styleUrl: './trail-map.scss',
})
export class TrailMap {
  public readonly geometry = input<TrailGeometry | null>(null);

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapSignal = signal<L.Map | undefined>(undefined);
  private trailLayer?: L.FeatureGroup;

  public constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const map = this.mapSignal();
      const geometry = this.geometry();
      if (map) {
        this.renderGeometry(map, geometry);
      }
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

    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    const handleResize = (): void => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', handleResize);
      map.remove();
    });

    this.mapSignal.set(map);
  }

  private renderGeometry(map: L.Map, geometry: TrailGeometry | null): void {
    this.trailLayer?.remove();
    this.trailLayer = undefined;

    if (!geometry) {
      return;
    }

    const layer = L.featureGroup(
      geometry.segments.map((segment) =>
        L.polyline(
          segment.map((point): L.LatLngTuple => [point.lat, point.lng]),
          { color: TRAIL_COLOR, weight: 4 },
        ),
      ),
    ).addTo(map);

    this.trailLayer = layer;
    map.fitBounds(layer.getBounds(), { padding: [24, 24] });
  }
}
