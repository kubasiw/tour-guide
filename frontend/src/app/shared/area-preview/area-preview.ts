import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { activityLabel } from '../../core/activity.model';
import { Area } from '../../core/area.model';

@Component({
  selector: 'app-area-preview',
  templateUrl: './area-preview.html',
  styleUrl: './area-preview.scss',
})
export class AreaPreview {
  public readonly area = input.required<Area>();
  public readonly activities = input<string[]>([]);

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);

  public constructor() {
    // Read-only: the area never changes after this component is created (it's
    // only shown once a plan's area is already loaded), so a single init on
    // first render is enough — no reactive re-render needed the way the
    // editable area-picker/poi-map need.
    afterNextRender(() => this.initMap());
  }

  protected label(key: string): string {
    return activityLabel(key);
  }

  private initMap(): void {
    const map = L.map(this.mapContainer().nativeElement, { scrollWheelZoom: false }).setView(
      [0, 0],
      2,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Same trackpad/wheel scroll-jacking fix as every other L.map(...) call in
    // this app — only zoom once the user has deliberately clicked in.
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    const area = this.area();
    const layer: L.Layer =
      area.kind === 'radius'
        ? L.circle([area.center.lat, area.center.lng], { radius: area.radiusMeters })
        : L.polygon(area.points.map((point): L.LatLngTuple => [point.lat, point.lng]));
    layer.addTo(map);

    if (layer instanceof L.Circle || layer instanceof L.Polygon) {
      map.fitBounds(layer.getBounds(), { padding: [16, 16] });
    }

    const handleResize = (): void => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', handleResize);
      map.remove();
    });
  }
}
