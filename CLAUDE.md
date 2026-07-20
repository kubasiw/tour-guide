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

**Faza 1 (MVP)** — get a working skeleton first, in this order. ✅ All 5 steps done — the skeleton
is complete; work now moves to "Beyond MVP" below.

1. ✅ Angular app + NestJS API skeletons wired together via a health check endpoint
2. ✅ Auth (register/login, simple email+password, JWT) — backend + frontend `auth/` both done
   (login/register pages, `AuthService`, HTTP interceptor, route guard built but deliberately not
   applied to any route yet — see "Auth is not a hard gate" below)
3. ✅ Area picker (map, draw polygon or radius from a point) — frontend `area-picker/` done
   (Leaflet + leaflet-draw, mounted at the default route, unauthenticated)
4. ✅ Persist a plain Plan in the DB — structure only, no generation logic yet. `area-picker` has a
   "Zatwierdź obszar" button that `POST /plans`s the drawn `Area` (status `draft`, no `userId` yet —
   unauthenticated, see "Auth is not a hard gate") and navigates to `/plans/:id`
   (`GET /plans/:id`, `httpResource`-driven). `Area` lives inside `PlansModule`, not a separate
   `AreasModule` as the brief originally sketched — it's 1:1 with `Plan` and only ever created
   alongside it; split it out later if Areas ever need independent reuse/listing.
5. ✅ Integrate one external API (Open-Meteo) as a proof of concept — standalone `WeatherModule`
   (`GET /weather?lat=&lng=`, no key needed, uses Node's global `fetch`), surfaced on `/plans/:id`
   as a 5-day forecast for the plan's `Area` centroid (`areaCenter()` in `core/area.model.ts`)

**Beyond MVP** — next up, in this agreed order:

1. ✅ Frontend `activity-selector/` (multi-select: hiking, sightseeing, culture, food, nightlife,
   relax) + `trip-details/` (arrival date + duration) — capture the preferences the generator
   needs. Both unauthenticated, same as `area-picker`. Flow is now `area-picker` → `POST /plans` →
   `/plans/:id/activities` → `PATCH /plans/:id` → `/plans/:id/trip-details` → `PATCH /plans/:id` →
   `/plans/:id` (`PlanDetail`, now also rendering the captured activities/dates). `Plan` extended
   with `activities: string[]` (Postgres array, not a separate `Activity` model — see the note
   below), `startDate: DateTime?`, `durationDays: Int?`.
2. `PoiModule` — ingest/cache POI data from Overpass/OSM for a given `Area`.
3. `PlanGeneratorModule` — starts as a simple rule-based algorithm combining `Area` + `Activity`
   selections + `WeatherModule` forecast into a concrete list of `PlanItem`s (no AI yet).
4. Plan editing (reorder/add/remove `PlanItem`s) + `my-plans/` (saved templates, listing a user's
   plans) — the first feature that inherently requires an account, since "my plans" only makes
   sense for a logged-in user; a natural candidate for finally applying the already-built
   `authGuard` to a route.
5. AI integration — see `PROJECT_BRIEF.md`'s "Integracja AI" section for the full design
   (`AiModule` wrapping the Claude API, `PlanGeneratorModule` gets an AI narration layer on top of
   the rule-based candidates, `PlanChatModule`/`plan-chat/` for tool-calling plan edits). Also
   gated behind login, for cost control this time (anonymous users get a non-LLM overview instead).
6. Adaptive per-region theming on the generated plan view, once AI can classify an area's
   character — see the "Design direction" bullet below and `PROJECT_BRIEF.md`'s "Integracja AI".

Re-sequence this list if priorities change, but don't skip straight to POI/AI without the
preference-capture steps first — that was a real point of confusion once already (see git history
around the "step 4" clarification).

`activities` deliberately deviates from `PROJECT_BRIEF.md`'s "wstępny" data model, which proposes a
separate `Activity` dictionary model with a many-to-many relation to `Plan` — same judgment call
already made for `Area`/`AreasModule`: a fixed, small interest list doesn't need DB-managed
metadata or an admin UI yet, so it's just a validated `String[]` column (`backend/src/plans/
activity-keys.ts` is the single source of truth for valid keys server-side; the frontend duplicates
the same keys with labels/icons in `core/activity.model.ts`, no shared package). Revisit if
activities ever need i18n or admin-editable metadata. `PlansModule` also gained `PATCH /plans/:id`
(partial update — either step can PATCH independently) alongside the existing `POST`/`GET`.

## Key technical decisions

- **Backend = NestJS (TypeScript)**, not e.g. a non-TS stack — chosen specifically for language
  consistency with the Angular frontend and because its module/DI style mirrors Angular's.
- **DB = PostgreSQL + Prisma** — typed queries and straightforward migrations.
- **Map = Leaflet + leaflet-draw** — open source, no licensing cost (vs. e.g. Google Maps); chosen
  over MapLibre GL because it needs zero-config free OSM raster tiles (no vector tile/style source
  to pick) and leaflet-draw already has mature polygon *and* circle(radius) drawing tools, matching
  the area-picker requirement directly.
- **Weather = Open-Meteo** — free, no API key required.
- **POI / trails / monuments / restaurants = OpenStreetMap + Overpass API** — free, matches the
  no-cost/open-source constraint.
- Frontend/backend talk over plain HTTP; no BFF or GraphQL layer planned.
- **Auth is not a hard gate** — this app follows the modern-SPA pattern (like Figma/Notion/Canva):
  unauthenticated users can see and use most features (pick an area, get a generic overview)
  but with reduced functionality; logging in unlocks the richer, customizable experience (choosing
  accommodation/restaurant/trail/museum/attraction/parking categories once the generator exists).
  Consequence: don't reflexively wrap new routes in `authGuard` — gate at the feature/response
  level instead, and reserve route-level gating for things that inherently require an account
  (e.g. a future "my saved plans" list, or the AI plan generator/chat below).
- **AI = Claude API (Anthropic)** for plan narration and a chat-based plan-editing assistant — see
  `PROJECT_BRIEF.md`'s "Integracja AI" for the full design (rule-filtered candidates + LLM narrates
  rather than invents, tool-calling for structured edits, per-POI description caching, API key
  server-side only in a new `AiModule`). This is genuinely gated behind login (one of the first real
  uses of `authGuard`, alongside `my-plans/` — see the Roadmap below for which comes first) —
  unauthenticated users get a non-LLM overview (e.g. a Wikipedia/Wikivoyage extract) to keep
  anonymous traffic free of API cost.

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

After editing `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` — but don't
assume that alone regenerates the client; if `npm run lint`/`build` suddenly reports every Prisma
model method as untyped (`no-unsafe-*` errors), run `npx prisma generate` explicitly to refresh
`node_modules/@prisma/client`.

Backend listens on port 3000 (`process.env.PORT` override) and has CORS enabled for
`http://localhost:4200` (see `src/main.ts`). Health check: `GET /health`.

### Frontend (`frontend/`)

```
npm start              # ng serve, dev server on http://localhost:4200
npm run build          # ng build
npm test               # ng test (vitest-based @angular/build:unit-test builder)
npm run lint           # ng lint (angular-eslint + typescript-eslint, type-checked)
npm run format         # prettier --write over src/**/*.{ts,html,scss}
```

## Architecture notes

- Backend follows Nest's module-per-domain pattern; new domains get their own
  `src/<domain>/<domain>.module.ts` + controller/service, registered in `src/app.module.ts`'s
  `imports`. `src/health/` is the existing example to follow.
- Frontend uses standalone components (no NgModules) with `inject()` for DI and `signal()` for
  local state, wired up via `app.config.ts` (`provideRouter`, `provideHttpClient`, etc.) rather
  than a root module. Cross-cutting services (e.g. `src/app/core/health.service.ts`) live under
  `src/app/core/`.
- The frontend brief calls for feature folders under `src/app/` mirroring the user flow: `auth/` ✅,
  `area-picker/` ✅, `activity-selector/` ✅, `trip-details/` ✅, `plan-view/` (currently `plans/
  plan-detail/`, a minimal stand-in — may get renamed/expanded once real generation exists),
  `plan-chat/`, `my-plans/` — the rest don't exist yet, add them in the order in the Roadmap above.
- The backend brief calls for one Nest module per bounded concern: `HealthModule` ✅, `AuthModule` ✅
  (+ `UsersModule` ✅ used internally by it), `PlansModule` ✅ (also owns `Area` — see the Roadmap's
  step 4 note for why there's no separate `AreasModule`), `WeatherModule` ✅. Not built yet:
  `PoiModule`, `PlanGeneratorModule`, `AiModule`, `PlanChatModule` — build them in that order (see
  Roadmap above).
- Frontend talks to backend over plain HTTP (`HttpClient`); the base URL is the shared
  `API_BASE_URL` constant in `frontend/src/app/core/api-base-url.ts` (hardcoded to
  `http://localhost:3000` during this early stage — no environment-based config exists yet, but at
  least it's a single constant now, not copy-pasted per service). New services calling the backend
  should import it rather than hardcoding the URL again.

## Code style & conventions

Both packages run TypeScript `strict: true` plus `noUnusedLocals`/`noUnusedParameters`, and both
lint configs enforce (as errors, not warnings): explicit return types on every function/method
(`@typescript-eslint/explicit-function-return-type`, `explicit-module-boundary-types`) and explicit
`public`/`private`/`protected` on every class member (`explicit-member-accessibility`). Local
variables with obvious inferred types don't need annotations — only functions/methods/class
members are required to be explicit. New code must pass `npm run lint` in whichever package it
touches; run `npm run format` for Prettier formatting (backend `.prettierrc` / frontend
`.prettierrc`, already wired into each lint config).

Frontend-specific:
- Prefer signals for local component state and component APIs: `signal()`, `computed()`, and the
  signal-based `input()`/`output()`/`model()` — not the decorator-based `@Input()`/`@Output()`.
- Use the new control-flow syntax (`@if`/`@for`/`@switch`) in templates, not
  `*ngIf`/`*ngFor`/`*ngSwitch`.
- For async/remote data, use Angular's built-in `resource()` / `rxResource()` (from
  `@angular/core/rxjs-interop`) / `httpResource()` (from `@angular/common/http`) as the
  state-machine primitive — they expose `.value()`, `.isLoading()`, `.error()`, `.status()` as
  signals, so there's no need for hand-rolled loading booleans or a custom store. Use
  `rxResource()` when the source is (or should be) an Observable that needs RxJS operators (e.g.
  wrapping an existing service method); use `httpResource()` for a plain direct HTTP GET. This was
  chosen over `@ngrx/signals` because that library's peer dependency (`@angular/core: ^21.0.0`,
  as of writing) doesn't yet support Angular 22 — revisit if/when it catches up.
  **Gotcha (caused a real bug in `AuthService.me`):** reading a signal *inside* the `stream`/
  `loader` callback does **not** make the resource re-run when that signal changes — only signal
  reads inside the separate `params` function are tracked; `stream`/`loader` just receives the
  resolved value via `({ params }) => ...`. Without a `params` function, the resource computes once
  at creation and never reruns on its own. See `frontend/src/app/auth/auth.service.ts`'s `me`
  resource for the correct shape (`params: () => this.tokenSignal()`, `stream: ({ params: token }) => ...`).
- Pair loading state with the shared `<app-loader>` component
  (`frontend/src/app/shared/loader/loader.ts`): `variant="spinner"` for inline/small UI (buttons,
  small checks), `"skeleton"` for lists/cards, `"bar"` for full-view long-running operations (e.g.
  future plan generation).
- `frontend/src/app/core/health.service.ts` + `frontend/src/app/app.ts` are the canonical example
  of this whole pattern end to end (service returns an `Observable`, component wraps it in
  `rxResource()`, template branches on `.isLoading()`/`.error()`/`.value()` and shows `<app-loader>`
  while loading) — follow the same shape for new async data in other components.
- `resource()`/`rxResource()`/`httpResource()` are for data you load/display *reactively* (GETs,
  derived from some signal state — see `AuthService.me` re-fetching whenever the token signal
  changes). One-shot mutations triggered by a form submit (login, register, and similar "do a
  thing" actions) don't fit that reactive-recompute shape — keep those as plain
  `Observable`-returning service methods that the component `.subscribe()`s to directly (see
  `frontend/src/app/auth/login/login.ts`). Don't force a `resource()` around a submit button.
- **Styling**: no inline `style="..."` in templates — enforced by
  `@angular-eslint/template/no-inline-styles` (lint error, not just convention). Use Bootstrap
  utility classes for layout/spacing/typography where Bootstrap already provides them (`container`,
  `d-flex`, `text-danger`, `mb-3`, ...); put anything custom in the component's `.scss` file,
  pulling shared values from `frontend/src/styles/_variables.scss` and shared patterns from
  `_mixins.scss` — both importable by bare name (`@use 'variables' as v;` / `@use 'mixins' as m;`)
  thanks to `stylePreprocessorOptions.includePaths` in `angular.json`, no relative-path chains.
  Don't duplicate a color/spacing/breakpoint value that already has a variable; add a mixin instead
  of copy-pasting a rule block (see `loader.scss`'s `@include m.flex-center`). Bootstrap itself is
  customized by setting its Sass variables (e.g. `$border-radius`) in `_variables.scss` *before*
  it's `@import`ed in `styles.scss` — Bootstrap 5.3's Sass still uses classic `@import` internally
  (not `@use`), so overrides must use plain variable assignment + `@import`, not `@use ... with`.
  Expect (and ignore) Dart Sass's "`@import` rules are deprecated" build warnings until Bootstrap
  migrates its own source — this is a known, ecosystem-wide, currently-unavoidable warning, not a
  bug in this repo. **Design direction: "Trail & earth"** (confirmed 2026-07-19) — forest green
  `$primary` (`#2f6b4f`) + a warm amber `$accent` (`#e0973d`, not a native Bootstrap theme slot; see
  `_theme-extras.scss` for its `.btn-accent`/`.text-accent`/`.bg-accent` utility classes, built with
  Bootstrap's own `shade-color()`/`color-contrast()` functions for consistent hover/contrast
  behavior). App icon/favicon is `bi-backpack-fill` — deliberately generic/universal, not
  hiking-specific, since it's the default identity across every area type (city, coast, mountains).
  **Adaptive per-region theming (planned, not built yet):** once the AI plan generator exists, the
  same AI call that analyzes the area should also classify it into one of a small set of *curated,
  pre-built* theme presets (e.g. coastal, mountain-trail, urban, countryside) — applied only to the
  generated `plan-view`, via a wrapper class swapping CSS custom properties, never via AI-generated
  freeform CSS (that risks broken contrast/dark-mode/component consistency). Default/shared chrome
  (nav, auth, area-picker, activity-selector, trip-details) always stays on the base "Trail & earth"
  theme regardless of region. See `PROJECT_BRIEF.md`'s "Integracja AI" for the full note.
- **Mobile verification**: when checking a UI change in the Browser tool, check it at *both* the
  default desktop-ish size *and* a phone width (`resize_window` with `preset: "mobile"`, or width
  320 for the narrowest common phones) — don't rely on whatever size the pane happened to already
  be at. Resizing an *already-loaded* page can leave Leaflet's tile grid stale (see the Leaflet
  gotcha below) — navigate fresh after resizing, or open a new tab already at the target size.
  Touch targets (buttons, form controls, map controls) should be close to ~44px (2026-07-19 mobile
  audit found no layout/overflow bugs at all, only undersized touch targets — a good sign the
  Bootstrap-first approach is paying off, but don't assume that holds for every future screen
  without checking). Two fixes from that audit, both easy to accidentally undo:
  - Don't reach for `.btn-sm` on primary nav/action buttons (nav login/register/logout,
    area-picker's confirm/clear) — it was removed everywhere it had been used, in favor of the
    default button size (bumped via `$input-btn-padding-y` in `_variables.scss`) specifically so
    real controls stay comfortably tappable. `.btn-sm` is still fine for genuinely secondary/dense
    UI, just not the main actions.
  - Leaflet adds a `.leaflet-touch` class on touch-capable devices, and its own
    `.leaflet-touch .leaflet-control-zoom a` rule (extra class = higher specificity) overrides a
    plain `.leaflet-control-zoom a` override *regardless of source order*.
    `_leaflet-overrides.scss` targets `.leaflet-touch .leaflet-control-zoom a` explicitly for
    exactly this reason — don't simplify it back to a single selector. Relatedly, `angular.json`'s
    `styles` array lists `src/styles.scss` *last* so our own SCSS loads after Bootstrap/Leaflet's
    CSS and wins the cascade on equal specificity without `!important` — don't reorder it back
    without a reason.
  - **Correction (2026-07-20):** the touch-target bump originally also targeted
    `.leaflet-draw-toolbar a` (broad `.leaflet-bar a` selector) — this broke the draw toolbar's
    icons (spotted via a screenshot: extra clipped icon slivers, main icon off-center). Those icons
    aren't glyphs like the zoom control; leaflet-draw paints them from a single sprite sheet
    (`background-image`) with per-icon `background-position` offsets hardcoded for its native
    ~30px box. Stretching the box to 44px without rescaling `background-size` and every icon's
    `background-position` misaligns the icon and reveals a sliver of the neighboring sprite icon.
    Fixed by scoping the 44px override to `.leaflet-control-zoom a` only (plain
    text glyphs, safe to resize) and leaving `.leaflet-draw-toolbar a` at Leaflet's native size.
    Don't re-widen the override to cover sprite-based Leaflet controls without also rescaling
    `background-size`/`background-position` per icon.
- **UI components**: `@ng-bootstrap/ng-bootstrap` (standalone components: `NgbAlert`, dropdown,
  modal, accordion, tooltip, ...) for interactive UI, `bootstrap-icons` (`bi bi-*` classes, loaded
  globally via `angular.json`'s `styles` array) for icons. Chosen over Angular Material to keep one
  coherent design system (Bootstrap) instead of two competing ones layered on top of each other.
  Gotcha: several ng-bootstrap components (e.g. `NgbAlert`'s close button) use `$localize` tagged
  strings, which throws `ReferenceError: $localize is not defined` unless `@angular/localize/init`
  is loaded — already added to `angular.json`'s `polyfills` array, so no action needed for new
  ng-bootstrap usage, just don't remove it. This app is zoneless by default (no `zone.js`
  dependency) — don't add `zone.js` back to `polyfills` unless a real reason emerges.
- **Dumb vs. smart components**: presentational ("dumb") components — like
  `shared/loader/loader.ts` — take `input()`s and emit `output()`s only; no `inject()` of services,
  no direct HTTP/resource calls, no app-specific business logic. They live under `shared/` (or a
  future `ui/`) and are the default whenever a piece of markup/behavior repeats across views.
  Container ("smart") components own state — they `inject()` services, hold
  `resource()`/`rxResource()` calls — and pass data down to dumb components via inputs (see `App`
  passing loading state to `<app-loader>`). When a component starts doing both (owning state *and*
  being reused verbatim with different data), that's the signal to split it.
- **Avoid duplicated/bloated logic**: extract repeated logic into a helper function, a shared
  service method, or a dumb component rather than copy-pasting or letting one method grow to handle
  multiple concerns (backend `auth.service.ts`'s shared `buildToken` helper is the existing example
  to follow). Run the `simplify` skill after finishing a feature slice as the concrete check for
  this, rather than relying on manual vigilance alone.
- **Leaflet** (`frontend/src/app/area-picker/area-picker.ts`): import as `import * as L from
  'leaflet'; import 'leaflet-draw';` (the second is a side-effect import that attaches
  `L.Control.Draw`/`L.Draw.*` to the `L` namespace). Gotcha: Leaflet's default marker icon paths
  (used by leaflet-draw for polygon vertex handles) don't resolve through a bundler — fixed by
  copying `node_modules/leaflet/dist/images` to `leaflet-images/` via an `angular.json` asset glob
  and calling `L.Icon.Default.mergeOptions({...})` once at module scope pointing at that path;
  also listens for `window`'s `resize` event to call `map.invalidateSize()` (registered/cleaned up
  via `DestroyRef`), since Leaflet caches its container size at init and won't otherwise notice a
  later layout change;
  don't remove either half of that fix. Leaflet is imperative (not signal/template-driven), so it's
  initialized in `afterNextRender` against a template-referenced `div` — this is the accepted
  pattern for wrapping imperative DOM libraries in Angular, not a convention violation.
