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
import { POI_TYPE_ICONS, POI_TYPE_MARKER_COLORS, Poi } from '../../core/poi.model';

const DEFAULT_CENTER: L.LatLngExpression = [50.06, 19.94];
const DEFAULT_ZOOM = 13;
const MARKER_RADIUS = 8;
const SELECTED_MARKER_RADIUS = 10;
const HOVERED_MARKER_RADIUS = 12;
// Trail green, mirrors --color-trail-green in _variables.scss — Leaflet needs
// a plain color string here, not a CSS custom property, so the value is
// intentionally duplicated once (same precedent as this app's other
// frontend/backend token duplications).
const SELECTED_MARKER_COLOR = '#3b6d11';

@Component({
  selector: 'app-poi-map',
  templateUrl: './poi-map.html',
  styleUrl: './poi-map.scss',
})
export class PoiMap {
  public readonly pois = input.required<Poi[]>();
  public readonly selectedPoiIds = input.required<Set<string>>();
  public readonly hoveredPoiId = input<string | null>(null);
  public readonly readonly = input(false);
  public readonly toggled = output<Poi>();
  public readonly poiHovered = output<string | null>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapSignal = signal<L.Map | undefined>(undefined);
  private markersLayer?: L.LayerGroup;
  private readonly markersByPoiId = new Map<string, L.CircleMarker>();

  public constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const map = this.mapSignal();
      const pois = this.pois();
      const selectedIds = this.selectedPoiIds();
      if (map) {
        this.renderMarkers(map, pois, selectedIds);
      }
    });

    effect(() => {
      const hoveredId = this.hoveredPoiId();
      const selectedIds = this.selectedPoiIds();
      for (const [poiId, marker] of this.markersByPoiId) {
        const hovered = poiId === hoveredId;
        marker.setStyle(this.markerStyle(selectedIds.has(poiId), hovered));
        if (hovered) {
          marker.bringToFront();
        }
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

    // Trackpad/mouse-wheel scrolling over the map shouldn't hijack the page's
    // own scroll — only zoom once the user has deliberately clicked into the
    // map, same pattern as embedded Google Maps.
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

  private renderMarkers(map: L.Map, pois: Poi[], selectedIds: Set<string>): void {
    this.markersLayer?.remove();
    this.markersByPoiId.clear();
    const layer = L.layerGroup();
    // Read without tracking — this method runs synchronously inside the
    // pois()/selectedPoiIds() effect below, and Angular's effect() tracks
    // *any* signal read during its execution, even ones nested in a called
    // method. Without `untracked()`, that effect would also start firing on
    // every hover change (this method's caller), triggering a full marker
    // teardown/rebuild (plus this method's own `map.fitBounds()` call
    // re-animating the whole map) on every mouseover/mouseout — which is
    // exactly what was breaking the popup: it stayed open, but the constant
    // rebuild + view re-fit around it eventually closed it before a click on
    // its action button could land. The dedicated hover effect further below
    // already handles restyling the hovered marker; this initial value only
    // matters for a *genuine* rebuild (pois/selection changed while a marker
    // happened to be hovered).
    const hoveredId = untracked(() => this.hoveredPoiId());

    for (const poi of pois) {
      const selected = selectedIds.has(poi.id);
      const marker = L.circleMarker([poi.lat, poi.lng], {
        ...this.markerStyle(selected, poi.id === hoveredId),
        fillColor: POI_TYPE_MARKER_COLORS[poi.type],
        fillOpacity: 0.9,
      });

      marker.bindPopup(this.buildPopupContent(poi, selected));
      marker.on('mouseover', () => this.poiHovered.emit(poi.id));
      marker.on('mouseout', () => this.poiHovered.emit(null));

      layer.addLayer(marker);
      this.markersByPoiId.set(poi.id, marker);
    }

    layer.addTo(map);
    this.markersLayer = layer;

    if (pois.length > 0) {
      const bounds = L.latLngBounds(pois.map((poi): L.LatLngTuple => [poi.lat, poi.lng]));
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }

  private markerStyle(selected: boolean, hovered: boolean): L.CircleMarkerOptions {
    return {
      radius: hovered ? HOVERED_MARKER_RADIUS : selected ? SELECTED_MARKER_RADIUS : MARKER_RADIUS,
      color: selected ? SELECTED_MARKER_COLOR : '#ffffff',
      weight: selected ? 3 : 1,
    };
  }

  private buildPopupContent(poi: Poi, selected: boolean): HTMLElement {
    const container = document.createElement('div');

    const icon = document.createElement('i');
    icon.className = `bi ${POI_TYPE_ICONS[poi.type]} fs-5 me-1`;
    container.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'fw-semibold';
    name.textContent = poi.name;
    container.appendChild(name);

    if (poi.openingHours) {
      const hours = document.createElement('div');
      hours.className = 'small text-body-secondary';
      hours.textContent = poi.openingHours;
      container.appendChild(hours);
    }

    if (!this.readonly()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn-sm mt-2 ${selected ? 'btn-outline-secondary' : 'btn-accent'}`;
      button.textContent = selected ? 'Usuń z planu' : 'Dodaj do planu';
      button.addEventListener('click', () => this.toggled.emit(poi));
      container.appendChild(document.createElement('br'));
      container.appendChild(button);
    }

    return container;
  }
}
