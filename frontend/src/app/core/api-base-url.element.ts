// Podmieniane w miejsce api-base-url.ts tylko dla celu `build-element` (fileReplacements w
// angular.json). NIE relatywne, w przeciwieństwie do api-base-url.prod.ts (używanego przez zwykły
// `build`) — ten widget żyje osadzony na CUDZEJ stronie (portfolio-shell, kubsiw.com), więc
// względna ścieżka fetch('/api/...') rozwiązałaby się względem domeny gospodarza, nie tour-guide.
// Absolutny URL to jedyny poprawny wybór tutaj, niezależnie od tego, gdzie skrypt zostanie osadzony.
export const API_BASE_URL = 'https://tourguide.kubsiw.com/api';
