# Tourist App

Monorepo aplikacji turystyczno-krajoznawczej. Szczegóły w [PROJECT_BRIEF.md](./PROJECT_BRIEF.md).

## Struktura

- `frontend/` — Angular (standalone components, signals)
- `backend/` — NestJS API

## Uruchomienie (dev)

```
cd backend && npm run start:dev
```

```
cd frontend && npm start
```

Backend nasłuchuje na `http://localhost:3000`, frontend na `http://localhost:4200`.
Frontend przy starcie odpytuje `GET /health` na backendzie i wyświetla status połączenia.

## Status MVP (Faza 1)

- [x] Szkielety Angular + NestJS, health check
- [ ] Auth (rejestracja/logowanie)
- [ ] Area picker (mapa)
- [ ] Zapis prostego Planu w bazie
- [ ] Integracja z Open-Meteo
