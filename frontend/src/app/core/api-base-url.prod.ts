// Podmieniane w miejsce api-base-url.ts przy buildzie produkcyjnym (fileReplacements w
// angular.json, oba cele: `build` i `build-element`). Ścieżka względna — frontend i backend
// żyją pod tą samą domeną na VPS (Traefik rozdziela ruch przez PathPrefix('/api'), patrz
// backend/src/main.ts i tourguide-docker-compose.yml), więc nie trzeba wpisywać domeny na sztywno.
export const API_BASE_URL = '/api';
