import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { PoiMap } from '../plans/poi-map/poi-map';
import { API_BASE_URL } from '../core/api-base-url';
import { BoundingBox } from '../core/area.model';
import { Poi } from '../core/poi.model';

// Widget jest osadzany jako custom element (patrz main-element.ts) — nie ma tu ani Plan, ani
// zalogowanego użytkownika, więc obszar nie jest wybierany interaktywnie, tylko po nazwie
// z małego, wbudowanego zestawu demo-obszarów. Kraków Stare Miasto (nie cały Kraków — węższy
// obszar dał ~1000 realnych POI na pierwszej próbie, stanowczo za dużo dla małego podglądu).
const DEMO_AREAS: Record<string, BoundingBox> = {
  'krakow-demo': { south: 50.0555, west: 19.925, north: 50.068, east: 19.948 },
};
const DEFAULT_AREA_ID = 'krakow-demo';

// Sam węższy obszar to nadal potencjalnie sporo realnych POI (gęste centrum) — dodatkowy twardy
// limit tak jak MAX_CANDIDATES w plan-generator, tu dla czystej czytelności podglądu, nie kosztu.
const MAX_DEMO_POIS = 40;

@Component({
  selector: 'app-mini-map-widget',
  templateUrl: './mini-map-widget.html',
  // bootstrap-icons.css (użyty przez PoiMap.buildPopupContent do ikony typu POI) świadomie
  // pominięty tutaj — to ~97KB CSS + osobny plik fontu tylko dla jednej małej ikonki w popupie,
  // nieproporcjonalny koszt dla tego widgetu; ikona po prostu nie renderuje się (pusty <i>, zero
  // błędów), nazwa/godziny nadal w pełni czytelne.
  styleUrls: ['../../../node_modules/leaflet/dist/leaflet.css', './mini-map-widget.scss'],
  // Shadow DOM — widget żyje na cudzej stronie (portfolio shell), więc jego style muszą być
  // w pełni odizolowane w obie strony: styl hosta nie może przebić się do środka, a Leaflet/
  // Bootstrap Icons (zwykle ładowane globalnie w tej appce) muszą zostać zapakowane per-komponent
  // powyżej, bo globalny <head> hosta jest niewidoczny z wnętrza shadow roota.
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [PoiMap],
})
export class MiniMapWidget {
  // @angular/elements mapuje to automatycznie na atrybut HTML "area-id" (camelCase -> kebab-case,
  // zweryfikowane w node_modules/@angular/elements/.../camelToDashCase) — bez potrzeby aliasu.
  public readonly areaId = input(DEFAULT_AREA_ID);

  // Stały, pusty Set — PoiMap oczekuje selectedPoiIds jako wymaganego inputu, ale ten widget
  // jest czysto podglądowy (readonly), nic nigdy nie jest "wybrane". Referencja musi być stabilna
  // (nie tworzona na nowo w szablonie), inaczej PoiMap renderowałby markery od zera przy każdym CD.
  protected readonly emptySelection = new Set<string>();

  private readonly bbox = computed((): BoundingBox => DEMO_AREAS[this.areaId()] ?? DEMO_AREAS[DEFAULT_AREA_ID]);

  protected readonly pois = httpResource<Poi[]>(() => {
    const b = this.bbox();
    return `${API_BASE_URL}/pois?south=${b.south}&west=${b.west}&north=${b.north}&east=${b.east}`;
  });

  protected readonly displayedPois = computed((): Poi[] => (this.pois.value() ?? []).slice(0, MAX_DEMO_POIS));
}
