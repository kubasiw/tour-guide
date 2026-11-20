import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { PoiMap } from '../plans/poi-map/poi-map';
import { Poi } from '../core/poi.model';

// Widget jest osadzany jako custom element (patrz main-element.ts) — nie ma tu ani Plan, ani
// zalogowanego użytkownika, ani backendu: dane to statyczny snapshot POI z zatwierdzonego
// demo-obszaru, serwowany jako zwykły plik JSON obok samego skryptu widgetu (portfolio-shell
// hostuje oba pod /elements/tour-guide/). Snapshot to 40 realnych POI z Overpass/OSM (Kraków,
// Stare Miasto), wybranych po równo z 4 typów (po 10) — wygenerowany jednorazowo z działającego
// wtedy backendu (`GET /pois?south=50.0555&west=19.925&north=50.068&east=19.948`), patrz
// CLAUDE.md, krok 15. Backend tour-guide nie jest już nigdzie wdrożony (2026-11-20).
// URL pliku liczony względem samego skryptu (ES module -> import.meta.url), nie zahardkodowana
// domena: JSON leży obok main.js, więc działa identycznie na kubsiw.com, podglądzie *.pages.dev i
// lokalnie.
const dataUrl = (areaId: string): string => new URL(`${areaId}-pois.json`, import.meta.url).href;
const KNOWN_AREA_IDS: readonly string[] = ['krakow-demo'];
const DEFAULT_AREA_ID = 'krakow-demo';

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

  private readonly resolvedAreaId = computed((): string =>
    KNOWN_AREA_IDS.includes(this.areaId()) ? this.areaId() : DEFAULT_AREA_ID,
  );

  protected readonly pois = httpResource<Poi[]>(() => dataUrl(this.resolvedAreaId()));

  protected readonly displayedPois = computed((): Poi[] => this.pois.value() ?? []);
}
