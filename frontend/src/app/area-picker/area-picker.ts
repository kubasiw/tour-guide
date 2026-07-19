import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-draw';
import { Area } from './area.model';

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
  imports: [DecimalPipe],
  templateUrl: './area-picker.html',
  styleUrl: './area-picker.scss',
})
export class AreaPicker {
  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly area = signal<Area | null>(null);

  private drawnItems?: L.FeatureGroup;

  public constructor() {
    afterNextRender(() => this.initMap());
  }

  protected clear(): void {
    this.area.set(null);
    this.drawnItems?.clearLayers();
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
      this.area.set(this.toArea(created));
    });

    const handleResize = (): void => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', handleResize));

    this.drawnItems = drawnItems;
  }

  private toArea(event: L.DrawEvents.Created): Area {
    if (event.layerType === 'circle') {
      const layer = event.layer as L.Circle;
      const center = layer.getLatLng();
      return {
        kind: 'radius',
        center: { lat: center.lat, lng: center.lng },
        radiusMeters: layer.getRadius(),
      };
    }

    const layer = event.layer as L.Polygon;
    const points = (layer.getLatLngs()[0] as L.LatLng[]).map((point) => ({
      lat: point.lat,
      lng: point.lng,
    }));
    return { kind: 'polygon', points };
  }
}
