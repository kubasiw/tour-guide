import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { Trail, TrailGeometry } from '../../core/trail.model';

const DEFAULT_CENTER: L.LatLngExpression = [50.06, 19.94];
const DEFAULT_ZOOM = 13;

// Trail green — a pinned (added-to-plan) trail; several can be pinned at
// once, same multi-select-uses-green convention as poi-tile/poi-map.
const PINNED_COLOR = '#3b6d11';
const PINNED_WEIGHT = 4;
// Amber — a not-yet-pinned trail currently being previewed via hover; only
// one preview exists at a time, matching this app's single-highlight
// convention (same amber plan-setup's own trail preview already used).
const PREVIEW_COLOR = '#854f0b';
// A pinned trail that's also currently hovered gets a heavier version of its
// own green rather than switching to amber — it's still a committed plan
// item, just momentarily emphasized (same "hovered stays green" precedent
// as .poi-tile--hovered/.poi-map's selected-marker hover style).
const HOVERED_PINNED_WEIGHT = 7;

export interface PinnedTrail {
  trail: Trail;
  geometry: TrailGeometry;
}

// A small, self-contained trail-geometry preview — deliberately its own dumb
// component rather than extending `PoiMap` with trail-specific concerns,
// same separate-list boundary the trail plan-item feature itself was scoped
// to. Renders every currently-pinned (added-to-plan) trail permanently, plus
// a single temporary preview for whichever trail is currently hovered (tile
// or map side) but not yet pinned.
@Component({
  selector: 'app-trail-map',
  templateUrl: './trail-map.html',
  styleUrl: './trail-map.scss',
})
export class TrailMap {
  public readonly pinnedTrails = input<PinnedTrail[]>([]);
  public readonly hoveredTrailId = input<string | null>(null);
  // Geometry for the currently-hovered trail — only meaningful (non-null)
  // when that trail isn't already pinned; the parent resolves this since
  // this component does no HTTP of its own.
  public readonly hoverPreviewGeometry = input<TrailGeometry | null>(null);
  public readonly trailHovered = output<string | null>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapSignal = signal<L.Map | undefined>(undefined);
  private pinnedLayerGroup?: L.FeatureGroup;
  private readonly pinnedLayersByTrailId = new Map<string, L.Polyline[]>();
  private previewLayer?: L.FeatureGroup;
  // Fit the view once, to whatever content appears first (pinned set or an
  // early hover preview) — deliberately not re-fit on every subsequent
  // hover, which would re-animate the whole map on each mouse pass (the
  // exact rebuild-on-hover bug already hit and fixed once for PoiMap).
  private hasFitBounds = false;

  public constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const map = this.mapSignal();
      const pinned = this.pinnedTrails();
      if (map) {
        this.renderPinnedTrails(map, pinned);
      }
    });

    effect(() => {
      const map = this.mapSignal();
      const hoveredId = this.hoveredTrailId();
      const previewGeometry = this.hoverPreviewGeometry();
      if (map) {
        this.applyHover(map, hoveredId, previewGeometry);
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

  private renderPinnedTrails(map: L.Map, pinned: PinnedTrail[]): void {
    this.pinnedLayerGroup?.remove();
    this.pinnedLayersByTrailId.clear();

    // Read without tracking — this effect should only rerun when the pinned
    // set itself changes, not on every hover (same untracked-read fix
    // PoiMap's own renderMarkers already needed for the identical reason).
    const hoveredId = untracked(() => this.hoveredTrailId());

    const group = L.featureGroup();
    for (const { trail, geometry } of pinned) {
      const layers = geometry.segments.map((segment) =>
        L.polyline(
          segment.map((point): L.LatLngTuple => [point.lat, point.lng]),
          this.pinnedStyle(trail.id === hoveredId),
        ),
      );
      for (const layer of layers) {
        layer.on('mouseover', () => this.trailHovered.emit(trail.id));
        layer.on('mouseout', () => this.trailHovered.emit(null));
        group.addLayer(layer);
      }
      this.pinnedLayersByTrailId.set(trail.id, layers);
    }

    group.addTo(map);
    this.pinnedLayerGroup = group;

    if (pinned.length > 0) {
      map.fitBounds(group.getBounds(), { padding: [24, 24] });
      this.hasFitBounds = true;
    }
  }

  private applyHover(
    map: L.Map,
    hoveredId: string | null,
    previewGeometry: TrailGeometry | null,
  ): void {
    for (const [trailId, layers] of this.pinnedLayersByTrailId) {
      const hovered = trailId === hoveredId;
      for (const layer of layers) {
        layer.setStyle(this.pinnedStyle(hovered));
        if (hovered) {
          layer.bringToFront();
        }
      }
    }

    this.previewLayer?.remove();
    this.previewLayer = undefined;

    const isPinned = hoveredId !== null && this.pinnedLayersByTrailId.has(hoveredId);
    if (hoveredId && !isPinned && previewGeometry) {
      const layer = L.featureGroup(
        previewGeometry.segments.map((segment) =>
          L.polyline(
            segment.map((point): L.LatLngTuple => [point.lat, point.lng]),
            { color: PREVIEW_COLOR, weight: PINNED_WEIGHT },
          ),
        ),
      );
      layer.eachLayer((polyline) => {
        (polyline as L.Polyline).on('mouseover', () => this.trailHovered.emit(hoveredId));
        (polyline as L.Polyline).on('mouseout', () => this.trailHovered.emit(null));
      });
      layer.addTo(map);
      this.previewLayer = layer;

      if (!this.hasFitBounds) {
        map.fitBounds(layer.getBounds(), { padding: [24, 24] });
        this.hasFitBounds = true;
      }
    }
  }

  private pinnedStyle(hovered: boolean): L.PolylineOptions {
    return { color: PINNED_COLOR, weight: hovered ? HOVERED_PINNED_WEIGHT : PINNED_WEIGHT };
  }
}
