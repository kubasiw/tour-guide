// Podmieniane w miejsce api-base-url.ts tylko dla celu `build-element` (fileReplacements w
// angular.json). Widget nie ma już żadnego backendu (2026-11-20) — dane demo to statyczny JSON
// ładowany wprost w mini-map-widget.ts, nic w tym bundlu nie woła API_BASE_URL. Pusty string
// zamiast martwego adresu, żeby ewentualne przypadkowe użycie było od razu widoczne (żądanie do
// samego siebie), a nie po cichu szło na nieistniejącą domenę.
export const API_BASE_URL = '';
