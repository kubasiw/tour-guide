# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tourist/trip-planning app for travelers who arrive in an unfamiliar area and want a ready-made
itinerary instead of researching it themselves. The user marks an area on a map, picks interests
(hiking, sightseeing, culture, food, ...) and a trip window (arrival date + number of days); the
app combines POI data and weather to generate a plan (map + list of accommodations, trails,
restaurants, shelters) that respects opening hours and weather conditions. The plan is editable
(reorder/add/remove points) and can be saved as a reusable template.

Full idea, data model, and module breakdown live in `PROJECT_BRIEF.md` — read it before planning
non-trivial work. The brief also frames this as an experiment in using Claude Code itself, so
prefer small, verifiable steps over large ones.

Monorepo with two independent npm projects, no shared root package.json or workspace tooling:

- `frontend/` — Angular 22, standalone components, signals, no SSR
- `backend/` — NestJS 11

## Roadmap

**Faza 1 (MVP)** — get a working skeleton first, in this order:

1. ✅ Angular app + NestJS API skeletons wired together via a health check endpoint
2. Auth (register/login, simple email+password, JWT)
3. Area picker (map, draw polygon or radius from a point)
4. Persist a plain Plan in the DB — structure only, no generation logic yet
5. Integrate one external API (Open-Meteo) as a proof of concept

**Beyond MVP** (only after the skeleton above works): POI ingestion from Overpass, the actual
plan-generation engine (starts as a simple rule-based algorithm, can grow later), plan editing,
and saved templates.

## Key technical decisions

- **Backend = NestJS (TypeScript)**, not e.g. a non-TS stack — chosen specifically for language
  consistency with the Angular frontend and because its module/DI style mirrors Angular's.
- **DB = PostgreSQL + Prisma** — typed queries and straightforward migrations.
- **Map = Leaflet or MapLibre GL** — open source, no licensing cost (vs. e.g. Google Maps).
- **Weather = Open-Meteo** — free, no API key required.
- **POI / trails / monuments / restaurants = OpenStreetMap + Overpass API** — free, matches the
  no-cost/open-source constraint.
- Frontend/backend talk over plain HTTP; no BFF or GraphQL layer planned.

## Commands

Run all commands from within `frontend/` or `backend/` respectively — there is no root-level script runner.

### Backend (`backend/`)

```
npm run start:dev      # dev server with watch (nest start --watch)
npm run build          # nest build
npm run lint           # eslint --fix over src,apps,libs,test
npm test               # jest unit tests (*.spec.ts, rootDir src)
npm run test:e2e       # jest e2e tests via test/jest-e2e.json
npx jest path/to/file.spec.ts   # run a single unit test file
```

Backend listens on port 3000 (`process.env.PORT` override) and has CORS enabled for
`http://localhost:4200` (see `src/main.ts`). Health check: `GET /health`.

### Frontend (`frontend/`)

```
npm start              # ng serve, dev server on http://localhost:4200
npm run build          # ng build
npm test               # ng test (vitest-based @angular/build:unit-test builder)
```

## Architecture notes

- Backend follows Nest's module-per-domain pattern; new domains get their own
  `src/<domain>/<domain>.module.ts` + controller/service, registered in `src/app.module.ts`'s
  `imports`. `src/health/` is the existing example to follow.
- Frontend uses standalone components (no NgModules) with `inject()` for DI and `signal()` for
  local state, wired up via `app.config.ts` (`provideRouter`, `provideHttpClient`, etc.) rather
  than a root module. Cross-cutting services (e.g. `src/app/core/health.service.ts`) live under
  `src/app/core/`.
- The frontend brief calls for feature folders under `src/app/` mirroring the user flow: `auth/`,
  `area-picker/`, `activity-selector/`, `trip-details/`, `plan-view/`, `my-plans/` — not all exist
  yet, add them as those features are built.
- The backend brief calls for one Nest module per bounded concern: `AuthModule`, `UsersModule`,
  `AreasModule`, `PoiModule`, `WeatherModule`, `PlansModule`, `PlanGeneratorModule` — only
  `HealthModule` exists so far.
- Frontend talks to backend over plain HTTP (`HttpClient`), hardcoded to `http://localhost:3000`
  during this early stage (see `health.service.ts`) — no environment-based API URL config exists yet.
