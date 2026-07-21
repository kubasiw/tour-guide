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
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { POI_TYPE_ICONS, POI_TYPE_MARKER_COLORS, Poi } from '../../core/poi.model';

const DEFAULT_CENTER: L.LatLngExpression = [50.06, 19.94];
const DEFAULT_ZOOM = 13;
const MARKER_RADIUS = 8;
const SELECTED_MARKER_RADIUS = 10;

@Component({
  selector: 'app-poi-map',
  templateUrl: './poi-map.html',
  styleUrl: './poi-map.scss',
})
export class PoiMap {
  public readonly pois = input.required<Poi[]>();
  public readonly selectedPoiIds = input.required<Set<string>>();
  public readonly toggled = output<Poi>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);

  private readonly mapSignal = signal<L.Map | undefined>(undefined);
  private markersLayer?: L.LayerGroup;

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
  }

  private initMap(): void {
    const map = L.map(this.mapContainer().nativeElement).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

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
    const layer = L.layerGroup();

    for (const poi of pois) {
      const selected = selectedIds.has(poi.id);
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: selected ? SELECTED_MARKER_RADIUS : MARKER_RADIUS,
        color: selected ? '#e0973d' : '#ffffff',
        weight: selected ? 3 : 1,
        fillColor: POI_TYPE_MARKER_COLORS[poi.type],
        fillOpacity: 0.9,
      });

      marker.bindPopup(this.buildPopupContent(poi, selected));
      layer.addLayer(marker);
    }

    layer.addTo(map);
    this.markersLayer = layer;

    if (pois.length > 0) {
      const bounds = L.latLngBounds(pois.map((poi): L.LatLngTuple => [poi.lat, poi.lng]));
      map.fitBounds(bounds, { padding: [24, 24] });
    }
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

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-sm mt-2 ${selected ? 'btn-outline-secondary' : 'btn-accent'}`;
    button.textContent = selected ? 'Usuń z planu' : 'Dodaj do planu';
    button.addEventListener('click', () => this.toggled.emit(poi));
    container.appendChild(document.createElement('br'));
    container.appendChild(button);

    return container;
  }
}
