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
2. ✅ `PoiModule` — ingest/cache POI data from Overpass/OSM. `GET /pois?south=&west=&north=&east=`
   (bbox, not exact-polygon — matches how `WeatherModule` takes a plain `lat`/`lng` rather than an
   `Area`, decoupled from `PlansModule` since a POI isn't 1:1 with any one plan). Cache-first: if
   any `Poi` rows already fall inside the requested bbox, return those; only on a miss does it
   query Overpass, upsert results (deduped by `osmId`), and return them — see the note below for
   this strategy's known limitation. Queries OSM `node` elements only against a small curated tag
   map (`backend/src/poi/overpass-tags.ts`) covering the brief's 5 `PoiType`s (`trail`, `monument`,
   `restaurant`, `shelter`, `accommodation`) — `way`/`relation` geometries (e.g. real trail paths)
   are deferred; a `tourism=trailhead` node is used as a `trail` proxy for now.
   **Idea captured, not built (2026-07-21):** the real fix for the trail-proxy limitation above —
   [Waymarked Trails](https://hiking.waymarkedtrails.org/) is a free, OSM-based API
   ([waymarkedtrails-api](https://github.com/waymarkedtrails/waymarkedtrails-api) on GitHub) that
   serves actual hiking/cycling/MTB route *geometries* (real paths, not just trailhead points) —
   same free/no-key family as Overpass/Nominatim/Open-Meteo already used in this app. A genuinely
   separate integration from AI narration (new external API, new geometry type for `PlanItem`/the
   map), not something to fold into that work. Before building: confirm the exact endpoint/response
   shape with a live curl first, same precedent as Overpass QL was confirmed early on — don't
   assume the API shape from documentation/memory alone.
   **Reinforced (2026-07-22):** user asked again whether the map itself needs to change, or a
   trails-specific API added, to show/search real trail geometry. Answer stays Waymarked Trails —
   worth noting explicitly: it's consumed as an **additional tile/overlay layer on the existing
   Leaflet map**, not a map replacement (same `L.tileLayer`-style integration already used for the
   OSM base tiles), plus their own separate query API for trail search. No reason to swap away from
   Leaflet/OSM for this.
   **✅ Built (2026-07-22), first slice — tile overlay + toggle on `area-picker`:** before
   implementing, walked through 4 options with the user from safe to fancy (raster tile overlay only;
   + a toggle/legend; a dedicated trail-search typeahead; full vector trail geometry rendered as
   real `L.polyline`s clickable into `PlanItem`s) — **confirmed via live curl that the tile endpoint
   works** (`https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png` returns real transparent PNG
   tiles, 200 OK) but explicitly flagged that the vector/GeoJSON API's shape was *not* verified
   (guessed endpoints 404'd) — user chose to start safely with **options 1+2 only** (tile overlay +
   toggle button + legend chip), leaving vector geometry/search for a later pass if this proves
   useful. `AreaPicker` gained `trailsLayer` (`L.tileLayer(...)`, attribution `"Waymarked Trails,
   CC-BY-SA OpenStreetMap contributors"`, per their own attribution requirement), off by default
   (same "don't clutter the map unasked" precedent as `PoiMap`'s marker clustering non-decision) and
   toggled via a custom `L.Control` icon button (`bi-signpost-2-fill`, trail-green `--active` state
   when on) plus a small legend chip crediting Waymarked Trails, both built the same way as any custom
   Leaflet control in this app (`new L.Control({...})` with a plain `.onAdd` function, not the
   classical `L.Control.extend()` pattern — avoids classical-inheritance TS typing friction).
   **Two gotchas hit, worth generalizing for any future custom `L.Control` in this app:**
   (1) **imperative DOM bypasses Angular's view encapsulation** — `L.DomUtil.create(...)` builds
   these elements directly in TypeScript, entirely outside Angular's template compiler, so they
   never receive the `_ngcontent-*` attribute Emulated encapsulation uses to scope component
   styles. Rules written in `area-picker.scss` were syntactically valid but silently matched
   nothing at runtime (confirmed via `getComputedStyle` showing Leaflet's own defaults still
   winning) — fixed by moving them to the global `_leaflet-overrides.scss` partial instead (already
   the established home for unscoped Leaflet CSS, just not previously spelled out this explicitly).
   (2) **Leaflet's own CSS has ancestor-scoped selectors that beat flat single-class overrides
   regardless of source order** — confirmed by reading `node_modules/leaflet/dist/leaflet.css`
   directly: `.leaflet-touch .leaflet-bar a` and `.leaflet-bottom .leaflet-control` are both
   2-class-specificity rules that out-rank a plain `.area-picker__trails-toggle a` /
   `.area-picker__trails-legend` selector. Fixed by matching Leaflet's own ancestor-class shape
   explicitly (`.leaflet-touch .area-picker__trails-toggle a`, `.leaflet-bottom
   .area-picker__trails-legend`) — same underlying fix already used once for the zoom-control
   44px bump, just not previously generalized as a rule until this feature hit it again for a new
   control. **Positioning (original): `bottomright` (toggle) / `bottomleft` (legend)** — originally
   guessed `topright`/`topleft` from memory (a real slip against this project's own "verify, don't
   assume" principle), corrected after live DOM inspection showed leaflet-draw's toolbar actually
   lives at `.leaflet-top.leaflet-left` alongside the zoom control, and either top corner also
   collided with `.area-picker__search`'s floating pill at mobile widths (confirmed via overlapping
   `getBoundingClientRect()` measurements). Verified end-to-end via `getComputedStyle`/
   `getBoundingClientRect`/`elementFromPoint` (44px touch targets, legend's `margin-bottom` clearing
   Leaflet's attribution bar, nothing covering the legend's center point) plus a real screenshot
   showing the trail overlay rendering correctly over a live Kraków view, at both mobile (375px, no
   horizontal overflow) and desktop width.
   **Repositioned to `topleft` (2026-07-22), real user feedback:** a `bottomright` toggle was too
   easy to miss — had to be hunted for on first use. Moved to `topleft` instead, next to the map's
   own functional controls (zoom + draw toolbar), where users already look for map features.
   Leaflet auto-stacks separate `L.Control` instances added to the same corner (each gets its own
   `margin-top: 10px`, confirmed by reading `leaflet.css` directly) — the toggle simply appends
   below the draw toolbar with the same natural gap already separating the zoom control from the
   draw toolbar, no manual position math needed. Re-verified live (not assumed) that this doesn't
   collide with the search pill either: the zoom+draw stack already extends to ~y:349 at mobile
   width, well clear of the search pill's ~y:157 bottom edge, so anything appended after it starts
   already clear — confirmed via `getBoundingClientRect()` (`overlaps: false`) at both mobile and
   desktop width, with zero horizontal page overflow at either. Icon color also changed to
   trail-green even at rest (was the plain ink/gray of the zoom/draw glyphs) — a second, smaller
   discoverability cue so the button visually differs from its monochrome neighbors, not just its
   position.
   **Bug caught and fixed in the same pass: the active/inactive toggle states were visually
   identical.** `toggleTrails()` (`area-picker.ts`) adds the `--active` class directly to the `<a>`
   button, not to a wrapping container — but the original CSS rule
   (`.area-picker__trails-toggle--active a`) was a descendant-combinator selector expecting that
   class on an *ancestor*, so it silently never matched (confirmed via `getComputedStyle` showing
   identical color/background before and after a click, in both the original and the just-fixed
   selector shape). Fixing the selector shape alone still didn't work: `.leaflet-touch
   .area-picker__trails-toggle a` (2-class specificity) out-ranked a plain
   `a.area-picker__trails-toggle--active` (1-class) — the *exact same* ancestor-specificity trap as
   gotcha (2) above, just hit again for an active-state override instead of a base rule. Fixed by
   matching that specificity explicitly for both the touch and non-touch base rules
   (`.area-picker__trails-toggle a.area-picker__trails-toggle--active`, `.leaflet-touch
   .area-picker__trails-toggle a.area-picker__trails-toggle--active`). Verified end-to-end via
   `getComputedStyle` across three clicks (rest → active → rest): background/color genuinely swap
   (white+green → green+white → white+green), confirmed at both mobile and desktop width.
   **Generalized lesson for any future toggleable custom `L.Control` in this app:** a state-modifier
   class needs its own specificity math checked against Leaflet's ancestor-scoped base rules just
   like the base selector does — getting the descendant-vs-same-element selector shape right isn't
   sufficient on its own if the fix still loses the specificity race.
   **On by default (2026-07-22), user request:** `trailsVisible` now starts `true` instead of
   `false` — now that the toggle is easy to find and visually distinct, the extra click to turn
   trails on no longer earns its keep. `addTrailsToggleControl`'s `onAdd` calls the same
   `applyTrailsVisibility(map, button, visible)` helper the click handler uses (extracted from the
   former `toggleTrails` body) to apply this initial state — layer, legend, and active class are
   now set from exactly one code path regardless of whether the state changes at init or via a
   click, rather than duplicating that logic. Still fully toggleable off. Verified live: on a fresh
   page load the toggle renders already active (solid green), the Waymarked Trails tile images are
   already in the DOM, and the legend chip is already present — no click needed.
3. ✅ `PlanGeneratorModule` — `GET /plans/:id/candidates` maps the plan's `activities` to
   `PoiType`s (`plan-generator/activity-poi-mapping.ts`), fetches matches via
   `PoiService.findInBoundingBox`, and returns them balanced round-robin across the matched
   `PoiType`s, capped at a flat `MAX_CANDIDATES = 24` — not just naively truncated; an early
   version truncated first and produced a plan that was 100% monuments and 0% restaurants despite
   "food" being selected, since Postgres/Overpass return order isn't type-balanced. `POST
   /plans/:id/items` / `DELETE /plans/:id/items/:itemId` / `GET /plans/:id/items` let the user
   manually add/remove specific candidates into their plan (a DB `@@unique([planId, poiId])`
   constraint blocks double-adding the same POI, surfaced as a 409). **Correction (2026-07-20):**
   this module originally also auto-assigned items to days with weather-aware ordering (dropped
   `PlanItem`s into a `POST /plans/:id/generate` transaction) — replaced after user feedback that
   the day-by-day list wasn't the intended UX. The real target is a tile grid the user browses and
   manually selects from (`/plans/:id`'s new `<app-poi-picker>`, tiles styled per `PoiType` via
   Bootstrap `bg-*-subtle` utilities, no new hex colors), with day/time organization deferred to a
   real future step rather than auto-guessed. `PlanItem.dayNumber` is now nullable (`Int?`) to
   represent "not yet organized into days." This also means `PlanGeneratorModule` no longer depends
   on `WeatherModule` (weather forecast display stays independent, unaffected, still on
   `plan-detail`). **Deliberately not done here:** real per-POI photos — would need resolving each
   POI's OSM `wikipedia`/`wikidata` tag through Wikipedia's API into an actual image URL, a new
   external integration most POI types won't even have data for; tiles get a type-styled
   icon+color placeholder instead. Google ratings/photos remain a separate, deferred decision (not
   forgotten, see the AI integration note below for the same "free vs. paid API" tension).
   **Idea captured, not built (2026-07-21):** user asked whether `PoiTile` should also show a short
   description alongside name/icon, not just opening hours. Two possible sources, neither built
   yet: (a) OSM's own `description`/`note` tags via Overpass when present (free, but sparse — most
   POIs won't have one), or (b) the per-POI AI description caching already noted in the "AI
   integration" section below (`Poi.aiDescription`/`aiDescriptionGeneratedAt`, originally deferred
   until `AiModule` existed — it now does, since step 8's first slice, so this is no longer blocked
   on that). Revisit and decide the concrete source/scope when actually building this — likely
   worth trying the free OSM-tag route first, given `PoiTile` can render up to `MAX_CANDIDATES = 24`
   tiles at once and a naive "generate on first render" AI approach would mean up to 24 LLM calls
   per page load unless carefully cached/batched.
   **Reinforced (2026-07-22):** user asked again — same answer stands (try OSM `description`/`note`
   tags first, free and already-fetched via Overpass; AI-cached descriptions are the fallback for
   POIs with nothing usable, not the first move given the 24-tiles-per-render cost concern above).
   Not yet checked how commonly these OSM tags are actually populated in this app's real ingested
   data — worth a quick real-data check (e.g. a count of non-null `description`/`note` keys inside
   already-cached `Poi.sourceData`) before committing to the OSM-first plan, in case it turns out too
   sparse to be worth shipping on its own.
   **Real-data check done (2026-07-22), changes the recommendation:** queried all 3692 cached `Poi`
   rows directly (one-off script, same technique as this project's other DB inspections) —
   `description`/`note` tags: only **2.6%** (97 rows) have either. `wikipedia`/`wikidata` tags (the
   *other* free route, for resolving a real Wikipedia extract/photo): only **3.7%** (136 rows). Both
   free OSM-tag routes are too sparse to be a visible feature on their own — a user browsing the
   usual `MAX_CANDIDATES = 24` tiles would see a description on 0-1 of them. **The OSM-first plan is
   no longer the right call** — per-POI AI-generated descriptions, cached forever on `Poi.aiDescription`/
   `aiDescriptionGeneratedAt` (generated once per POI, reused across every plan/user that later
   selects that same POI — cost amortizes over time, unlike a per-plan narration), are now the
   only route to meaningful coverage. Not built yet — still needs its own design pass (e.g. generate
   lazily on first selection vs. a batch job, and how it interacts with the existing
   24-tiles-per-render cost concern for tiles that were never AI-described yet).
   **Idea captured, not built (2026-07-20):** a small map preview on every pre-generation screen
   (`activity-selector`, `trip-details`), not just `area-picker` — user's own framing was that this
   could later double as a way to show selected attractions/trails once `PlanItem`s carry real
   geometry. Revisit once there's an actual reason to render POIs on a map (this module's own trail
   proxy is currently a single node, not a real path, so "show the trail" isn't meaningful yet
   either) — don't build a bare decorative minimap just for its own sake.
   **Graduated to a real roadmap step (2026-07-21):** the above "actual reason" now exists — see
   step 10 below ("Map view for POIs").
   **✅ Built (2026-07-22), a more specific reframing of the idea above:** user asked whether
   `activity-selector` and `trip-details` could show a **read-only preview** of what's already been
   confirmed — the drawn `Area` on a small non-interactive map, and (once past `activity-selector`)
   the selected activity badges too — so the user isn't just staring at a bare form with no visual
   continuity from the step before. New shared dumb component `shared/area-preview/` (`area =
   input.required<Area>()`, `activities = input<string[]>([])`) — a small Leaflet map (`L.tileLayer`
   + a plain `L.circle`/`L.polygon` built directly from the `Area`, no `L.Control.Draw`, no
   `FeatureGroup`/edit tracking needed since the shape never changes once the component exists) plus
   the same activity-badge markup `plan-detail`/`plan-summary` already use, via the existing
   `activityLabel()` helper. Single `afterNextRender()` init only (not a reactive `effect()` the way
   `area-picker`/`poi-map` need) — deliberately simpler, since this component is only ever created
   *after* the plan's area has already loaded and never changes afterward. **Layout resolved**: a
   `row g-4` / `col-12 col-lg-7` (form) + `col-12 col-lg-5` (preview) split on both screens, same
   stacking-below-`lg` precedent as `plan-detail`'s info/weather layout — `activity-selector` shows
   only the area (activities are the *current* step being edited, redundant to preview); `trip-details`
   shows both the area and the now-confirmed activity badges (both prior steps). Same scroll-wheel-zoom
   fix as every other `L.map(...)` call in this app.
   **Verified:** real screenshots on both screens showing the actual drawn circle fit to bounds
   (`activity-selector`) and the circle plus "Zwiedzanie"/"Jedzenie" badges (`trip-details`), no
   horizontal overflow at 375px mobile width (stacks below the form).
   **Gotcha found while migrating this:** `prisma migrate dev` refuses to run at all (even with
   `--create-only`) for any schema change with a warning attached (e.g. "this could fail if
   duplicate data exists") when the shell is non-interactive — no bypass flag exists for `migrate
   dev` itself. Worked around by hand-writing the migration SQL into a new
   `prisma/migrations/<timestamp>_<name>/migration.sql` folder (matching Prisma's own naming/
   format) and applying it with `prisma migrate deploy`, which is designed for non-interactive use.
4. ✅ **UX polish batch** (agreed 2026-07-20, five small/independent tweaks, no big design forks —
   done together before the bigger step below): short description text under each `shared/stepper/`
   step saying what that screen lets you do (only the *current* step's, sourced from
   `StepperStep.description`, not all steps at once — keeps the horizontal layout clean); `/plans/:id`
   lays out the area/activity/trip-details card and `<app-weather-forecast>` side by side (`row` +
   `col-lg-6` each, `h-100` so both cards match height — stacks below `lg`, weather's own card border
   added to match the info card's for visual parity now that they sit next to each other) instead of
   one under the other, since neither needs full width; a search box on `area-picker`'s map (plain
   template-ref input, no `FormsModule`/`ngModel` needed for one transient field — `map.fitBounds()`
   when Nominatim returns a bounding box, e.g. for a whole region like "Karkonosze", else
   `map.flyTo()`) so the user doesn't have to pan/zoom the whole world by hand; the raw `AreaSummary`
   jargon ("Polygon with 6 points") on `/plans/:id` replaced with a real reverse-geocoded place name
   (`rxResource` keyed on `center()`, e.g. "Kraków — Stare Miasto" — built from Nominatim's
   structured `address` fields, not its own much longer `display_name`) — `AreaSummary` itself is
   untouched and still used as-is on `area-picker`, where technical drawing feedback ("6 points") is
   still the right call; both the search and the place name use a new standalone **`GeocodingModule`**
   (`backend/src/geocoding/`, `GET /geocode/search`, `GET /geocode/reverse`) wrapping **Nominatim**
   (OpenStreetMap's own free geocoding, same free-API family as Overpass/Open-Meteo). **Browsers
   refuse to let `fetch()` set a custom `User-Agent` header** (forbidden header name) — since
   Nominatim's usage policy requires identifying the app via that header exactly like Overpass does,
   these calls have to go through the backend (Node's `fetch` has no such restriction), same pattern
   as every other external API in this app; there's no frontend-only way to do this. And
   `PoiService` skips Overpass elements with no `name` tag before caching/returning them — an
   unnamed tile isn't useful to the user and wastes cache rows (accepted trade-off: some real but
   unnamed OSM features, e.g. a bare `tourism=trailhead` node, are now silently dropped); existing
   `"Unnamed POI"` rows were manually flushed from the dev DB, same one-off-cleanup precedent as the
   nightlife fix.
   **Graduated to a real roadmap step (2026-07-21):** turning the search box into a live typeahead
   — see step 9 below ("Search typeahead in `area-picker`").
5. ✅ **Editable `Area` + 3-step stepper**: `shared/stepper/` now includes `area-picker` as a real
   step 1 — `PATCH /plans/:id/area` (`PlansService.updateArea`, a Prisma *nested* update through
   the `Plan.area` relation: `{ data: { area: { update: { geometry: ... } } } }`, since `Area` is
   its own related row via `planId @unique`, not a plain `Plan` column) plus a new
   `plans/:id/area` route reusing `AreaPicker` in "edit" mode (`id` is now an optional `input()` —
   unbound on the original `''` create route). Pre-drawing the existing shape adds the Leaflet
   layer into the *same* `drawnItems` `FeatureGroup` the edit control already watches — that's what
   makes leaflet-draw's native vertex-drag editing work on it for free, no custom edit UI needed;
   this also meant listening for `L.Draw.Event.EDITED` for the first time (previously only
   `CREATED` was handled — dragging an existing shape's vertices is a different event, and without
   this listener the drag would look like it worked but never update the signal `confirm()` reads).
   The stepper only renders in edit mode (`id()` present) — in pure create mode there's no `Plan`
   yet for "Aktywności"/"Termin" to be meaningfully locked/completed against, so 2 dead stub nodes
   would be noise. **Deliberately not doing:** cascading resets — editing an already-generated
   plan's area doesn't reset `Plan.status`, activities, trip details, or touch existing
   `PlanItem`s, even though they may now be geographically stale. Auto-resetting user data as a
   side effect of an edit is a bigger, separate product decision nobody's asked for yet.
   **Idea captured, not built (2026-07-20):** user asked to think about showing Obszar/Aktywności/
   Termin all on **one single view** instead of the current 3 separate routed steps
   (`/plans/:id/area` → `/plans/:id/activities` → `/plans/:id/trip-details`) users click through one
   at a time. This is a real redesign of the already-built stepper flow, not a new sequential step
   — the map, activity toggles, and date/duration fields would all need to sit together on one
   screen (e.g. a single form with 3 sections, each still `PATCH`ing its own slice of `Plan`
   independently as today, or one combined save). Worth doing as its own deliberate UX pass rather
   than folding it into an unrelated step — revisit and decide timing/phasing then, don't build it
   as a side effect of other work.
   **Reinforced with a concrete entry point (2026-07-21):** user's follow-up framing — add a small
   edit affordance (`+`/pencil icon) directly on `plan-detail`'s info card, next to the place
   name/activity badges/dates, so editing doesn't require hunting for the stepper. This part is low
   risk and can ship standalone even before the single-view redesign above: the three edit routes
   (`/plans/:id/area`, `/plans/:id/activities`, `/plans/:id/trip-details`) already exist and already
   fully support editing an existing `Plan` (confirmed working end-to-end for area editing in step
   5 itself) — the icon(s) just need to `routerLink` there. Once the single-view redesign happens,
   this same icon would naturally become the entry point *into* that combined view instead.
   **✅ Built (2026-07-22): the single-view redesign itself.** The 3 separate routed steps are gone
   — `area-picker/`, `activity-selector/`, `trip-details/`, `shared/stepper/`, and
   `shared/area-preview/` were all deleted (confirmed unused elsewhere via grep first) and merged
   into one new `frontend/src/app/plan-setup/` (`PlanSetup`, `<app-plan-setup>`) — a rename, not
   just a move, since the component's scope grew well past "pick an area" (same precedent as the
   `panel-card` mixin rename below when its own scope outgrew `auth-card`). One screen: the
   interactive Leaflet map (draw/edit area, search typeahead, Waymarked Trails toggle — all
   unchanged) now renders as a normal boxed block (~420px, same convention as `poi-map.scss`'s
   `.poi-map__container`) instead of the old full-viewport-height flex host, with the activity
   toggles and the date-range picker stacked as plain sections below it, and one "Utwórz plan"/
   "Zapisz zmiany" button at the bottom — confirmed via `AskUserQuestion` over the floating-side-
   panel-on-a-fullscreen-map alternative. **Validation: only an area is required to submit** —
   activities and dates stay optional and are simply included in the save if filled in, matching
   `PATCH /plans/:id`'s existing independently-optional fields; this was a deliberate choice over
   forcing all three fields, since the old per-step "Dalej" gating was a UI suggestion, never a
   real server-enforced order. **Backend: `CreatePlanDto` gained the same optional
   `activities`/`startDate`/`durationDays` fields `UpdatePlanDto` already had** (identical
   validators), so a brand-new plan's full setup now persists in a single `POST /plans` call
   instead of the old create-then-two-PATCHes chain; `PlansService.create`'s transaction was
   extended with the same conditional-spread pattern `update()` already used. **Frontend submit
   logic**: create mode calls `planService.create(area, extra)` directly; edit mode fires
   `updateArea` and `update` together via `forkJoin` (new to this app, plain `rxjs`, no new
   dependency) and maps the tuple result down to a single `Plan` via `map()` so both branches of
   the `id() ? ... : ...` ternary produce the same `Observable<Plan>` type — the naive version (a
   union of `Observable<[Plan,Plan]>` and `Observable<Plan>`) fails to typecheck since `.subscribe()`
   can't unify incompatible callback signatures across the union. **Routes**: `''` and
   `plans/:id/setup` (renamed from `plans/:id/area`) both map to `PlanSetup`;
   `plans/:id/activities`/`plans/:id/trip-details` are gone entirely — grepped first to confirm
   `plan-detail.html`/`my-plans.html` never linked to them (only to `/` and `/plans/:id`), so no
   dangling links were left behind. **Verified end-to-end**: a full anonymous create (draw area,
   toggle 2 activities, pick a 3-day range, submit) landed on `/plans/:id` with all fields
   persisted in one call (checked via a direct `GET /plans/:id`); revisiting `/plans/:id/setup` on
   that plan correctly seeded the existing area/activities/dates back into the form; changing the
   area and swapping one activity and saving persisted both through the `forkJoin`d edit path;
   checked at both desktop and mobile width (375px, no horizontal overflow, all 6 activity buttons
   and their selected state confirmed via direct DOM query after the environment's screenshot
   renderer showed a visually truncated — but not actually broken — layout, same known scaling
   quirk documented elsewhere in this file).
   **✅ Built (2026-07-22): the `Stepper` restored as a persistent 3-stage progress indicator.**
   The single-view redesign above initially deleted `shared/stepper/` along with the 3 old
   micro-steps it tracked (Obszar/Aktywności/Termin) — the user asked to bring it back, repurposed
   for the app's actual 3 macro stages instead: **Planowanie** (`plan-setup`, area+activities+dates)
   → **Ustal szczegóły** (`plan-detail`+`poi-picker`, picking places) → **Twój plan**
   (`plan-summary`, the finalized read-only view) — shown persistently at the top of all three
   screens now, not just during initial creation. Since nothing had been committed yet, the
   deleted `shared/stepper/*` and `plans/plan-steps.ts` files were restored verbatim via `git
   checkout --` rather than reconstructed from memory — confirmed the exact original template
   logic first (`stepper.html`): a step only renders as a clickable link when `completed`, the
   `current` step is a plain highlighted (non-link) bubble, and anything neither current nor
   completed is an inert gray number — this meant no changes to `Stepper`/`stepper.html`/
   `stepper.scss` themselves were needed at all, only a new `buildPlanSteps(plan, id, current)` in
   `plan-steps.ts` (same filename, rewritten contents) producing the 3 new stages. **Completion
   rules, decided pragmatically since a plan is always fully editable regardless of stage (no
   cascading resets, existing precedent):** stage 1 "completed" = a plan exists (`id` present) —
   the setup screen is freely revisitable any time; stage 2 "completed" = `plan.status ===
   'final'` — reads as done specifically once the user has actually finalized (matches the user's
   own framing: finishing planning via "Zakończ planowanie" is what unlocks the summary stage);
   stage 3 is never "completed" (nothing comes after it). Each of the 3 host components computes
   its own `steps = computed(() => buildPlanSteps(plan.value(), id(), '<its-own-stage>'))` and
   renders `<app-stepper [steps]="steps()" />` as the first thing on the page, above its own
   heading. **Verified live**: on `plan-setup` (no plan yet) stage 1 shows as the current bubble,
   stages 2/3 as locked plain numbers; after creating a plan and viewing `plan-detail`, stage 1
   flips to a completed clickable link back to `/setup` (confirmed the link actually navigates)
   while stage 2 becomes current; after finalizing and viewing `plan-summary`, stage 2 also
   becomes a completed clickable link back to `/plans/:id` while stage 3 is current — checked at
   mobile width too (no horizontal overflow).
   **✅ Built (2026-07-22): switched trip dates from start-date-plus-duration to a real date-range
   picker** (arrival + departure, not arrival + "number of nights" requiring mental math) — prompted
   by the user noticing the native `input[type=date]` had visibly different internal spacing than
   the plain `input[type=number]` duration field next to it (a browser-native calendar-icon/padding
   quirk that can't be fully harmonized via CSS), and asking whether to just patch the spacing or
   finally do the date-range picker already captured above. **Confirmed via `AskUserQuestion`: do
   the real picker, not a spacing patch** — the native-input inconsistency was a symptom, not the
   root problem.
   **First pass used two independent `NgbInputDatepicker` fields** (arrival/departure as separate
   inputs) as a simpler alternative to `NgbDatepicker`'s single-calendar range recipe — **but the
   user asked for the real thing**: one input, one calendar, click-click to select a range, same
   as ng-bootstrap's own documented pattern. Rebuilt around that: a single `<input readonly
   ngbDatepicker [autoClose]="false" [dayTemplate]="dayTemplate">` whose displayed value is a
   formatted `"yyyy-mm-dd  →  yyyy-mm-dd"` string computed from two component signals
   (`fromDate`/`toDate`, both `NgbDate | null`) — **not** Reactive-Forms-bound (no `formControlName`
   on this input at all), since the two-click range state machine doesn't map onto a single
   `ControlValueAccessor` value the way one plain date would. Same "one transient field doesn't
   need Reactive Forms" precedent as `area-picker`'s search box — confirmed this scales to a
   stateful multi-step widget too, not just a single debounced input. `onDateSelect(date,
   datepicker)` is the actual state machine: first click sets `fromDate` (clears `toDate`,
   calendar stays open — `autoClose="false"` is required for this, the default would close after
   one click); second click either sets `toDate` and calls `datepicker.close()` if after
   `fromDate`, or restarts the range if not. A custom `#dayTemplate` (verified `DayTemplateContext`
   shape — `$implicit`/`date`/`focused`/`selected` — by reading the installed
   `@ng-bootstrap/ng-bootstrap@21.0.0` type defs directly) renders each day with
   `isFrom`/`isTo`/`isInRange` classes (trail-green solid for the two endpoints, a light
   `--color-trail-green-bg` tint for days between — `isInRange` falls back to `hoveredDate` when
   `toDate` isn't picked yet, previewing the range as the user moves the mouse before the second
   click). **`Plan.startDate`/`durationDays` stayed exactly as planned** — `submit()` converts the
   two `NgbDate`s to an ISO date string + a day-count (`NgbCalendar.getNext`/manual UTC-day-diff
   math) purely client-side; zero backend/DTO changes either way.
   **Also fixed in the same pass: box-height mismatch.** The user noticed the form card and the
   `area-preview` map box next to it had visibly different heights. Fixed with `row
   align-items-stretch` (Bootstrap already stretches columns to equal height, but the *card inside*
   the column also needs `h-100` to actually fill it) plus `d-flex flex-column
   justify-content-center` on `.trip-details-card` so the now-much-shorter form (one input instead
   of two) centers vertically in the stretched space instead of leaving empty space pinned below
   it. Also dropped the card's inherited `max-width: 420px` (from the shared `panel-card` mixin) via
   a local `max-width: none` override — `trip-details` is the one `panel-card` user that's paired
   side-by-side with another box, so it should fill its column width like `area-preview` does,
   unlike the auth screens which stay intentionally narrow and centered.
   Also bundled in the same overall pass: the `shared/area-preview/` component (see step 3's note
   above) is wired into both `activity-selector` and `trip-details` via a `row g-4` /
   `col-lg-7`+`col-lg-5` layout.
   **Verified:** confirmed via `window.ng.getComponent()` (synthetic clicks on ng-bootstrap's
   calendar grid are unreliable in this automated browser environment, same documented class of
   issue as Leaflet vertex-drag/`NgbTypeahead` selection — worked around by calling `.click()`
   directly on the day-cell DOM nodes instead of coordinate-based clicks) that: a date before
   `minDate` (today) is correctly `aria-disabled`; a first click sets `fromDate` and leaves the
   calendar open with no `toDate` yet; a second click after it sets `toDate` and closes the
   calendar; submitting persists the correct `startDate`/`durationDays` (checked via a direct
   `fetch` against `GET /plans/:id` post-submit, e.g. July 28 → July 31 saved as `startDate:
   "2026-07-28"`, `durationDays: 3`). Box heights confirmed equal via `getBoundingClientRect()`
   (294.4px both) after the fix. No horizontal overflow at 375px on either screen.
6. ✅ **`my-plans/`** (saved templates, listing a user's plans) — the first feature that inherently
   requires an account, split out from "plan editing" below since the two don't depend on each
   other (reorder needs no auth, `my-plans/` needs no reorder) and each is substantial on its own.
   `GET /plans/mine` (`JwtAuthGuard`-protected) lists the logged-in user's plans, newest first;
   `POST /plans` (still unauthenticated per "Auth is not a hard gate" — anonymous users keep
   creating plans exactly as before) now runs behind a new `OptionalJwtAuthGuard`
   (`backend/src/auth/guards/`) that never rejects a missing/invalid token but still attaches
   `req.user` when one is present, so a plan created while logged in gets `Plan.userId` set and
   shows up in `my-plans/` later — zero migrations needed, `Plan.userId`/`User.plans` already
   existed in the schema, unused until now. Added a shared `@CurrentUser()` param decorator
   (`backend/src/auth/current-user.decorator.ts`) since this is the second endpoint reading the
   authenticated user (`/auth/me` was refactored to use it too, dropping its old locally-declared
   `AuthenticatedRequest` interface). **Gotcha:** `@Get('mine')` must be declared *before*
   `@Get(':id')` in `PlansController` — Nest/Express match literal routes in declaration order, so
   `GET /plans/mine` would otherwise be swallowed by `:id` treating `"mine"` as a plan id. Frontend:
   `{ path: 'my-plans', canActivate: [authGuard] }` is the first real use of the already-built
   `authGuard` anywhere in the app; a "Moje plany" nav link shows only when logged in.
   **Deliberately not doing:** a return-url round-trip after a forced login — landing on `/` and
   clicking "Moje plany" again is an accepted minor rough edge, not worth the plumbing yet.
7. ✅ **Plan editing — reorder `PlanItem`s** (add/remove was already done, see step 3 above).
   `PlanGeneratorService.reorderItems(planId, itemIds)` takes the full new id order, validates it's
   exactly the plan's current item-id set (`BadRequestException` on any mismatch — guards against a
   stale client, e.g. another tab having added/removed an item meanwhile), then `$transaction`s an
   `order = index + 1` update per id; `PATCH /plans/:planId/items/reorder`. Frontend: first use of
   **`@angular/cdk`** (`DragDropModule`/`cdkDropList`/`cdkDrag`/`cdkDragHandle`) anywhere in the app
   — installed fresh for this step. `poi-picker.html` gained a new "Twój plan" ordered-list section
   (Bootstrap `list-group`, drag handle + `POI_TYPE_ICONS`/`POI_TYPE_COLORS` + name + a small
   `btn-outline-secondary btn-sm` remove button per row) above the existing candidates grid — the
   first view anywhere showing "your selected items in their current order," not just a selected
   badge overlay on the browsable grid. `PoiPicker` gained a local writable `orderedItems =
   signal<PlanItemWithPoi[]>([])`, synced from the `items` resource via a constructor `effect()` —
   needed because CDK's `cdkDropList` requires a mutable array it can reorder for immediate drag
   feedback, while `items` itself stays the server-fetched source of truth. `onDrop()` optimistically
   reorders `orderedItems` locally, PATCHes the new order, and on success calls `items.reload()`
   (which re-syncs `orderedItems` via the effect); on failure it reverts `orderedItems` to the last
   known-good `items.value()` and surfaces the error via the existing `toggleError` signal. The list
   row's remove button reuses the existing `toggle(poi)` method (already handles the
   "selected → remove" branch) rather than adding a new method. **Gotcha hit during verification:**
   installing a new npm dependency (`@angular/cdk`) while `ng serve` was already running left the new
   component's template completely missing from the rendered page with zero console errors — Vite's
   dependency pre-bundling cache doesn't pick up a new package.json/lockfile entry on its own; a full
   dev-server restart (not just HMR) was required, after which Vite logged "Re-optimizing
   dependencies because lockfile has changed" and the section rendered correctly. Worth remembering
   for any future new-dependency addition: restart `ng serve` afterward, don't assume HMR covers it.
   Verified end-to-end: curl `PATCH .../items/reorder` with a reversed id list + persisted-order
   check, both mismatch/incomplete `itemIds` 400 cases, then in-browser via
   `window.ng.getComponent(el).onDrop({previousIndex, currentIndex})` (same technique established
   earlier for untrustworthy drag simulation — see the Leaflet vertex-drag note above) confirmed
   against a fresh `GET .../items`, plus a real click on the list's remove button — all at both
   mobile and desktop width.
8. ✅ AI integration — see `PROJECT_BRIEF.md`'s "Integracja AI" section for the full design
   (`AiModule` wrapping the Claude API, `PlanGeneratorModule` gets an AI narration layer on top of
   the rule-based candidates, `PlanChatModule`/`plan-chat/` for tool-calling plan edits). Also
   gated behind login, for cost control this time (anonymous users get a non-LLM overview instead).
   All three slices below are now done — area description, narration, and the `PlanChatModule`
   tool-calling assistant.
   **First slice done (2026-07-21): short AI-written area description.** New standalone
   `AiModule` (`backend/src/ai/`, mirrors `GeocodingModule`'s shape) wraps `@anthropic-ai/sdk` —
   `AiService.generateAreaDescription(placeName)` calls `claude-haiku-4-5-20251001` (cheap/fast,
   appropriate for a short non-critical text snippet) with a system prompt instructing 2-3 honest,
   non-generic sentences about the area's general character, explicitly told not to invent specific
   named places/facts (avoids hallucination, matches the brief's "retrieve then generate"
   principle). `Plan` gained `aiDescription String?` / `aiDescriptionGeneratedAt DateTime?` —
   `PlansService.getAiDescription(id)` returns the cached value if already generated, else computes
   `areaCenter` → `GeocodingService.reverse()` for the place name → `AiService`, persists, and
   returns it (cache-forever, no TTL, no regeneration — same "accepted, revisit if it matters"
   precedent as `PoiService`'s cache-first limitation). `GET /plans/:id/ai-description` is a hard
   login gate (`JwtAuthGuard`, not `OptionalJwtAuthGuard`) per the brief's AI-gating decision — any
   valid account works, not just the plan's owner, consistent with every other `plans/:id` endpoint.
   Frontend: `PlanDetail` gates the whole section on `AuthService.isAuthenticated()` in the
   `rxResource`'s `params` function so the resource simply never fires for anonymous users (zero
   401 network noise, verified via `read_network_requests`) rather than firing-and-handling-401.
   **Deliberately not doing:** invalidating the cached description when the plan's `Area` is later
   edited via `PATCH /plans/:id/area` — same no-cascading-resets precedent as that endpoint's own
   note above. **Gotcha hit during this step:** `backend/.env`'s `DATABASE_URL` line had a stray
   `ANTHROPIC_API_KEY="sk-ant-..."` placeholder fragment appended to the *same physical line* with
   no newline (from an earlier accidental edit) — dotenv's multiline-value parsing greedily matched
   from `DATABASE_URL`'s opening quote all the way to the *last* quote in the file, silently
   swallowing everything in between into one corrupted value. NestJS's own `ConfigModule` tolerated
   it (or wasn't exercised in a way that surfaced it), but the Prisma CLI's `dotenv/config` loading
   in `prisma.config.ts` errored with a raw Postgres syntax error mentioning `ANTHROPIC_API_KEY`.
   Diagnosed by running `dotenv` directly in a one-off `node -e` script and printing
   `DATABASE_URL`'s *length* and whether it `.includes('ANTHROPIC')` — never printing the actual
   secret values. Fixed with a targeted `sed` removing only the known-safe placeholder literal
   `ANTHROPIC_API_KEY="sk-ant-..."` from the end of the `DATABASE_URL` line, leaving the real key
   (on its own line further down) untouched. Worth remembering: a single-line env var value that
   silently absorbs everything after it is very hard to spot from `cat`/`grep` alone since each
   *individual* var still looks fine — count quote characters per line (`grep -o '"' | wc -l`,
   should be even, exactly 2 for a simple quoted value) when something like this happens again.
   **Second slice done (2026-07-21): narration of the currently-selected plan.** Given
   `PlanItem.dayNumber` is nullable/unused since the manual-selection redesign, "narrates the day"
   from the original brief doesn't apply — instead a short (3-5 zdania) paragraph narrating
   whatever's currently in "Twój plan", grounded in the real selected POI names/types (same
   anti-hallucination instruction as the area description). `AiService.generatePlanNarration(items,
   activities)` — a separate `NARRATION_MAX_TOKENS = 400` constant, not the area description's
   `MAX_TOKENS = 200`, after a live curl test showed 200 cutting the longer narration off
   mid-sentence. `PlanGeneratorService.generateNarration(planId)` (now injects `AiService`, so
   `PlanGeneratorModule` imports `AiModule`) throws `BadRequestException` if the plan has zero
   items yet; `POST /plans/:planId/narration`, hard `JwtAuthGuard` (same gating as the area
   description). **Deliberately explicit-trigger, not cached or auto-generated:** unlike the area
   description (generated once, cached forever), the selected-items set changes constantly during
   editing — caching would go stale immediately and auto-regenerating on every add/remove/reorder
   would fire unpredictable LLM costs. Frontend: a "Wygeneruj podsumowanie AI" button in
   `poi-picker`'s "Twój plan" section (only shown when logged in and at least one item is
   selected), calling `PlanService.generateNarration()` directly (plain `Observable` + `subscribe`,
   not `rxResource` — matches the established "one-shot mutation triggered by a button" pattern,
   not a reactively-recomputed resource) — deliberately minimal display (plain paragraph, no
   dedicated styling pass); the polished presentation belongs to the new "finalized-plan summary
   view" step (step 11 below), not this one.
   **Third slice done (2026-07-21): `PlanChatModule` — the tool-calling plan-editing assistant,
   and this app's first use of tool-calling anywhere.** New `backend/src/plan-chat/` (per the
   brief's own module list, the last piece of "Integracja AI"): `AiService.sendToolMessage(system,
   messages, tools)` is a thin wrapper returning the raw SDK `Message` (unlike the existing
   text-only helpers, the tool loop needs to inspect `stop_reason`/`content` blocks directly) —
   `Tool`/`ToolUseBlock`/`ToolResultBlockParam` shapes were confirmed by reading the installed
   `@anthropic-ai/sdk@0.112.4` type defs directly rather than assumed. `PlanChatService
   .handleMessage(planId, message, history)` builds a system prompt embedding the plan's current
   items and available candidates (via the already-built `PlanGeneratorService.findItems`/
   `findCandidates` — which needed a new `exports: [PlanGeneratorService]` on
   `PlanGeneratorModule`, its first cross-module consumer), then runs a tool loop
   (`MAX_TOOL_ITERATIONS = 4`) against three tools that map 1:1 onto existing service methods:
   `add_item`/`remove_item`/`reorder_items`. "Zamień" (swap) needs no dedicated tool — the model
   just emits `remove_item` + `add_item` as two `tool_use` blocks in the same turn, confirmed
   working via a real "usuń X i dodaj zamiast tego Y" curl test. **Confirmed via `AskUserQuestion`:
   tool calls apply immediately** (not a propose-then-approve flow) — the simpler first slice,
   since add/remove/reorder are all cheaply reversible via the same chat or the existing list's own
   remove button. `POST /plans/:planId/chat` is hard `JwtAuthGuard`-gated, same AI-cost-gating
   precedent as narration/ai-description. **Stateless, no new Prisma model:** the frontend holds
   the full conversation array and echoes it back each request — matches every other endpoint in
   this app (no server-side session state anywhere) and confirmed working across multiple turns via
   curl (a `history` array sent back correctly continued the same conversation, resolving "usuń
   pomnik Fryderyka Chopina" against an item added two turns earlier). **Anti-hallucination scope
   limits, told to the model directly rather than silently glossed over:** neither `Poi` nor any
   other model has price/rating data — verified via a real curl test that asking "która restauracja
   ma najlepsze oceny i jest najtańsza" gets an honest "I don't have that data" instead of an
   invented answer; `PlanItem.dayNumber` is nullable/unused (no day-scheduling since the
   manual-selection redesign) — the prompt says so too, so "dodaj to na drugi dzień" adds the item
   but admits days aren't tracked. Frontend: new `plans/plan-chat.service.ts` (plain `Observable`,
   same one-shot-mutation pattern as every other action method, not a `resource()`) and
   `plans/plan-chat/plan-chat.ts` (smart component — `itemsChanged = output<void>()` lets
   `PoiPicker` reload its `items` resource after the chat mutates the plan, same
   reload-after-mutation pattern already used for toggle/reorder; chat message input is a plain
   `viewChild` template-ref read directly, no `FormsModule`/`ReactiveForms`, matching this app's
   established "one transient field" precedent). Mounted in `poi-picker.html` gated on
   `authService.isAuthenticated()` but deliberately **not** gated on having ≥1 item already (unlike
   the finalize/narration buttons) — the chat should work to add the very first item too.
   **Deliberately out of scope for this pass:** streaming/SSE (brief says "rozważyć", not required)
   and a dedicated `find_candidates`/search tool (dumping the already-capped `MAX_CANDIDATES = 24`
   list into context every turn avoids needing one for now).
   **Idea captured, not built (2026-07-22):** user wants the assistant to eventually go beyond
   `PlanItem` edits — e.g. "zmień zainteresowania na X" (change activities), "zwiększ trochę obszar"
   (nudge the area), or jumping to a specific step of the flow. If built, the same "reuse existing
   service methods, don't invent new mutation logic" pattern the current 3 tools already follow
   should carry over: `update_activities`/`update_trip_details` would map directly onto
   `PlansService.update(...)` (already validates activity keys server-side via
   `plans/activity-keys.ts`). **`update_area` is the genuinely risky one** — unlike the other
   fields, an `Area` is real geometry (polygon points or a radius+center); asking the model to
   compute "slightly bigger" itself risks it inventing coordinates with no anti-hallucination
   guardrail the way text generation has one. If this is ever built, scope it to something
   deterministic and safe first — e.g. only "increase/decrease a *radius*-type area by N meters"
   (simple arithmetic on an existing value, no invented coordinates), not freeform polygon edits.
   **Step navigation is a separate mechanism, not a tool call** — the chat's backend response only
   ever mutates data today; jumping to a route is inherently a frontend action
   (`Router.navigate`), so this would need a distinct signal in the chat response (e.g. a
   `navigateTo` field) that `PlanChat` itself interprets and acts on, not something
   `PlanChatService.handleMessage`'s tool loop can do on its own. Bigger scope than the current
   3-tool set, especially the area-safety question — worth its own dedicated design pass, not a
   quick addition to the existing tools.
   **Gotcha hit during browser verification:** this automated environment's `computer` tool clicks
   (both by `ref` and by raw screenshot-space coordinates) silently failed to focus the chat input
   — `document.activeElement` stayed `BODY` after the click with no error, and the screenshot pixel
   space itself turned out scaled down from the reported viewport size (800×569 screenshot for a
   requested 1280×900 viewport). Same class of issue as the previously-documented Leaflet
   vertex-drag/`NgbTypeahead`-selection simulation limits — worked around identically: set the
   input's value via the native `HTMLInputElement` value setter + a dispatched `input` event, then
   called `.click()` on the send button directly via `javascript_tool`, and confirmed the real
   `POST /plans/:id/chat` network call fired and the reply/live item-list update rendered correctly.
   **Scope note (2026-07-20):** narration/chat need real design before starting (the current data
   model has no day structure — `PlanItem.dayNumber` is nullable/unused since the manual-selection
   redesign in step 3 — so "AI narrates the day" from the original brief needs rethinking against
   what's actually there now). The place *name* itself ships via free Nominatim geocoding (step 4);
   only the *description* needed the LLM this step builds.
   **Fix (2026-07-21): reverse geocoding ignored the drawn area's size.** User reported a big
   circle around a whole town still produced a description/place-name for one specific
   street/suburb — confirmed via a live Nominatim test that `reverse()` always requested `zoom=18`
   (Nominatim's own default, since the code never passed a `zoom` param at all), so a big circle's
   *center point* got reverse-geocoded at maximum precision regardless of how large the actual area
   was. Fixed with `estimateReverseZoom(area)` (`backend/src/plans/area.type.ts`, mirrored in
   `frontend/src/app/core/area.model.ts` — same `areaCenter` duplication precedent) — computes the
   area's bounding-box diagonal in meters and maps it to a Nominatim `zoom` (0-18) via fixed
   thresholds (`≤1km→17` down to `>60km→7`, deliberate/tunable, not rigorously derived), threaded
   through both call sites of `GeocodingService.reverse()`: `PlansService.getAiDescription()`
   (backend-only) and `plan-detail.ts`'s `placeName` resource (`GET /geocode/reverse?...&zoom=`,
   new optional query param). Verified with a real 15 km vs. 300 m circle at the same center: the
   large one now reads "Kraków" (city-level, both place name and AI description); the small one
   still correctly reads "Kraków — Stare Miasto".
9. ✅ **Search typeahead in `area-picker`** — as the user types (e.g. "Kra...") a dropdown of
   matching place suggestions now appears to pick from, instead of the old submit-then-jump.
   `GeocodingService.search()` (`backend/src/geocoding/geocoding.service.ts`) now asks Nominatim
   for up to `SEARCH_RESULT_LIMIT = 5` results and returns `GeocodeSearchResult[]` (was a single
   `| null`) — the only caller anywhere was `area-picker`, so this was a clean breaking change with
   no other consumers. Frontend uses `@ng-bootstrap/ng-bootstrap`'s built-in `NgbTypeahead`
   directive (already a dependency, no new package) instead of hand-rolling a dropdown — it handles
   rendering/keyboard-nav/highlighting for free; the only app code is the `(text$) =>
   Observable<readonly T[]>` search function piped through `debounceTime(300)` →
   `distinctUntilChanged()` → `switchMap()`, plus `resultFormatter`/`inputFormatter` and a
   `(selectItem)` handler reusing the existing `map.fitBounds()`/`map.flyTo()` logic. Terms under
   `SEARCH_MIN_LENGTH = 3` chars short-circuit to an empty result (no request) and search errors
   are swallowed to an empty result rather than an alert — both the concrete answer to Nominatim's
   ~1 req/sec usage-policy constraint noted when this step was captured, verified via
   `read_network_requests` showing exactly one request per typed term, not one per keystroke.
   **Reactive Forms, not `ngModel`:** bound via `[formControl]` on a plain `FormControl<string>` to
   stay consistent with `login`/`register`/`trip-details`'s existing `ReactiveFormsModule` pattern
   — `FormsModule`/`ngModel` still isn't used anywhere in this app. **Gotcha hit during
   verification:** this automated browser environment's synthetic mouse clicks and keydown events
   don't reliably trigger `NgbTypeahead`'s internal selection commit (dropdown stayed open, no
   selection registered) — same class of issue as the earlier documented Leaflet vertex-drag
   simulation limitation. Worked around the same way: verified the actual app logic
   (`onSelectItem()`'s `fitBounds`/`flyTo` branches) directly via
   `window.ng.getComponent(el).onSelectItem({item, preventDefault(){}})` with constructed
   `GeocodeSearchResult` objects (one with a `boundingBox`, one without), confirming both branches
   move the map correctly — the dropdown rendering/debouncing/formatting itself was independently
   confirmed via real typed input (suggestions appeared, correctly debounced, min-length respected).
10. ✅ **Map view for POIs** — a grid/map toggle (`bi-grid`/`bi-map` button group) inside
    `poi-picker`, not a separate screen — `poi-picker` already owns candidates/selection state,
    `area-picker`'s map is a different screen with a different purpose. New dumb `PoiMap` component
    (`frontend/src/app/plans/poi-map/`, inputs `pois`/`selectedPoiIds`, output `toggled` — no
    injected services, mirrors why `PoiTile`/`WeatherForecast`/`Stepper` are separately extracted)
    plots the full candidate set as `L.circleMarker` dots (vector-drawn, so none of
    `area-picker.ts`'s default-marker-image-path gotcha applies here), colored via a new
    `POI_TYPE_MARKER_COLORS` hex map (`core/poi.model.ts` — Bootstrap's own stock semantic hex
    values, since `POI_TYPE_COLORS`' `bg-*-subtle` utility classes aren't usable as real Leaflet
    fill colors) — already-*selected* POIs get a thicker `$accent`-colored stroke instead of a
    separate mode, satisfying both framings from the original "undecided" note in one view. Marker
    popups are built as real `HTMLElement`s (not HTML strings) via `document.createElement`, each
    with a native `addEventListener('click', ...)` calling `toggled.emit(poi)` — the only correct
    way to get interactive content into a Leaflet popup; `PoiPicker.toggle()` is reused unchanged
    as the handler. An `effect()` watching `pois()`/`selectedPoiIds()` clears and rebuilds the whole
    marker layer on any change, which also naturally closes/refreshes any open popup — no extra
    popup-lifecycle code needed. Because `PoiMap` is only ever instantiated while the toggle is on
    "map" (`@if`), its own `afterNextRender()` fires correctly on every (re-)creation, simpler than
    `area-picker.ts`'s `viewChild()`-signal-timing dance for its conditionally-rendered confirm-card
    (that one reacts to a child element appearing *within* an already-alive component; here the
    whole component is freshly created each time). **Accepted limitation, not built:** marker
    clustering — candidates can render as visually overlapping dots when close together; fine for a
    first pass at `MAX_CANDIDATES = 24`, revisit if it becomes a real usability problem.
    **✅ Fixed (2026-07-22), root-caused via live in-browser investigation (user-reported
    2026-07-21):** the popup closing on mouseout wasn't Leaflet's own autoclose or the marker's
    `mouseout` handler directly — it was `renderMarkers()` (the method the `pois()`/
    `selectedPoiIds()` effect calls) reading `this.hoveredPoiId()` on its own (to compute each new
    marker's initial hover style). Because that read happened *synchronously inside* the effect's
    execution, Angular's `effect()` tracked it too — Angular tracks every signal read during an
    effect's run, even ones nested inside a called method, not just reads at the effect's own top
    level. So *every* hover change (mouseover **and** mouseout) was also re-triggering the
    "rebuild on pois/selection change" effect: a full marker-layer teardown + recreate, plus that
    method's own `map.fitBounds()` call re-animating the whole map — on every single hover.
    Confirmed via a `MutationObserver` on the map container (counted `<path>` marker elements being
    removed and recreated on each mouseover/mouseout, one full rebuild per hover transition) before
    touching any code — the popup itself turned out to survive the marker swap immediately, but
    closed shortly after, consistent with the disruption from the constant rebuild/re-fit. Fixed by
    wrapping that one read in `untracked(() => this.hoveredPoiId())` so the rebuild effect no
    longer depends on hover state at all — the existing dedicated hover effect below it already
    handles per-marker hover restyling without any rebuild, exactly as originally intended.
    **Verified:** the same `MutationObserver` check now shows zero marker removals across
    mouseover/click/mouseout, the popup survives 2+ seconds after mouseout, and clicking its
    "Dodaj do planu" button now actually persists a new `PlanItem` (confirmed via a follow-up
    `GET .../items`). **Worth remembering for any future `effect()` in this app:** a signal read
    inside a *private method the effect calls*, not just one read directly in the effect's own
    callback body, still creates a reactive dependency — an easy way to accidentally over-track.
    **Follow-up (2026-07-21), also done: split view with live hover sync.** Third `viewMode`
    (`'split'`, `bi-layout-split` icon) — half tile grid, half map (`row`/`col-12 col-lg-6` ×2, same
    stacking-below-`lg` precedent as `plan-detail.html`'s info/weather layout), hovering either side
    highlights the other in real time (Airbnb/Zillow-style linked list+map). `PoiTile` gained
    `hovered` input / `hoverChange` output (native `(mouseenter)`/`(mouseleave)`, orthogonal to its
    existing pure-CSS `:hover` lift); `PoiMap` gained `hoveredPoiId` input / `poiHovered` output
    (Leaflet `mouseover`/`mouseout` per marker). **Deliberately not a full marker-layer rebuild on
    hover** — hover fires far more often than selection changes (every mouse-move across the grid),
    so `PoiMap` keeps a `Map<string, L.CircleMarker>` keyed by POI id and a *separate*, lightweight
    `effect()` that only calls `.setStyle()`/`.bringToFront()` on the specific markers affected,
    never a teardown/recreate — a shared private `markerStyle(selected, hovered)` helper avoids
    duplicating the radius/color logic between this path and the existing full-rebuild path. Hover
    always renders as the biggest radius regardless of selected state, so a selected+hovered marker
    shows both cues at once without clashing. **Deliberately not hiding the split toggle on
    mobile** — hover doesn't exist on touch and a side-by-side split is cramped narrow, but below
    `lg` it just stacks (grid above, map below) via the same responsive columns, which is still a
    perfectly usable view; no extra code to detect/hide it on small screens.
    **`'split'` made the default view mode (2026-07-22), user request** — `PoiPicker.viewMode`
    now starts `'split'` instead of `'grid'`, now that the hover-synced list+map exists and is
    more immediately useful than a plain grid on first load. A one-line default change, no new
    logic; verified live (a fresh plan load renders both the tile grid and `<app-poi-map>`
    simultaneously with the split button already showing active) at both mobile (stacks, no
    horizontal overflow) and desktop (true side-by-side) width.
11. ✅ **Finalized-plan summary view (2026-07-21)** — a real approval action plus a dedicated
    read-only summary screen. `Plan.status` (existed since Faza 1, always `"draft"`, never read or
    written until now) gets a genuine `'final'` transition: `PlansService.finalize(id)` requires
    at least one `PlanItem` (`BadRequestException` otherwise, same style as
    `PlanGeneratorService`'s zero-item guards), sets `status: 'final'`, `PATCH /plans/:id/finalize`
    (no guard, same as `update`/`updateArea` — "auth is not a hard gate"). **Deliberately not
    doing:** an "un-finalize" action or blocking further edits on an already-finalized plan — same
    no-invariant-enforcement precedent as `Area` edits not resetting `aiDescription`; `/plans/:id`
    stays fully editable regardless of status, and finalizing again is idempotent.
    Frontend: new `plans/plan-summary/` (smart component, mirrors `plan-detail.ts`'s
    `httpResource`/`rxResource` shapes for `plan`/`items`/`placeName`/`aiDescription` almost
    verbatim — the place-name/`areaCenter`/`estimateReverseZoom` resource logic is now duplicated
    across the two files; accepted for a 2nd occurrence, same "extract only at a 3rd/4th call site"
    judgment call made for the password-match validator earlier this session, revisit if a third
    screen needs it). **New pattern, deliberately different from `poi-picker`'s narration
    button:** `plan-summary`'s narration is an `rxResource` that auto-fires once when the page has
    both an authenticated user and ≥1 item — confirmed via `AskUserQuestion` — since a summary
    visit is inherently the low-frequency "I'm done" moment (unlike `poi-picker`'s heavy-iteration
    editing, where a manual button controls cost); `poi-picker`'s own manual
    "Wygeneruj podsumowanie AI" button is untouched. `plans/poi-map/poi-map.ts` gained a
    `readonly = input(false)` — when true, `buildPopupContent` skips the "Dodaj/Usuń z planu"
    button entirely (name + opening hours still show), letting `PoiMap` serve both the editable
    `poi-picker` map and the new read-only summary map without a second component. Entry points:
    a "Zakończ planowanie" button in `poi-picker` (disabled with zero items; calls `finalize()`
    then navigates to `/plans/:id/summary`) that swaps to "Zobacz podsumowanie" once
    `planStatus() === PLAN_STATUS_FINAL` (new tiny `plans/plan-status.ts` constant, avoids a
    duplicated `'final'` string literal across `poi-picker`/`plan-detail`); `plan-detail.html` also
    shows a persistent "✓ Plan zakończony · Zobacz podsumowanie" link once finalized, so a
    returning user doesn't have to scroll back into `poi-picker` to reach it again.
    `{ path: 'plans/:id/summary' }` has no guard, same as `plans/:id` — plan-viewing has never
    required login. Zero-item plans show a friendly empty state with a link back to the editable
    view instead of an empty map.
    Verified: backend curl (finalize with 0 items → 400; add an item, finalize → 200 persisted
    `status: "final"`; finalize again → still 200, idempotent) + full browser walkthrough (fresh
    finalize from `poi-picker` → navigates to summary → narration auto-appears with no click →
    map popup has no interactive button → "Edytuj plan" returns to the working view →
    `plan-detail`'s persistent link works on a revisit → zero-item empty state → both mobile and
    desktop width, no horizontal overflow).
    **Known UI bug — already fixed (confirmed 2026-07-22 while checking on user request):** the
    `poi-picker` finalize/narration button visibility issue described above is resolved in the
    current code — their wrapper is `<div class="d-flex flex-wrap gap-2 mb-2">` (real spacing
    between them) and the finalize button is `btn btn-accent` (visually distinct from the muted
    `btn-outline-secondary` narration button), not the blended `btn-outline-secondary btn-sm` pair
    this note originally described. Left unclear exactly which pass fixed it since the note was
    never marked resolved at the time — worth remembering to update/remove notes like this once
    addressed, rather than leaving them to look like an open bug indefinitely.
12. ✅ **Adaptive per-region theming (2026-07-21)** — `AiService.generateAreaDescription` now
    returns `{ description, theme }` from a **single combined Claude call** rather than two (the
    system prompt requires a fixed `THEME: <label>` first line, parsed with a regex; falls back to
    `theme: 'default'` if the line is missing or not one of the five curated `AreaTheme` values —
    defensive against imperfect LLM formatting, never crashes). New `ai/area-theme.type.ts`:
    `AreaTheme = 'coastal' | 'mountain-trail' | 'urban' | 'countryside' | 'default'` — AI only picks
    the label, never generates CSS/colors (avoids broken contrast/dark-mode/component-consistency
    risk, per the brief). `Plan.themePreset String?` (new migration, no new timestamp column —
    reuses `aiDescriptionGeneratedAt`) is cached alongside `aiDescription` in the same
    `PlansService.getAiDescription` call/cache-check (`if (plan.aiDescription && plan.themePreset)`
    — both fields must be present, so the couple of already-cached dev-DB rows that predate this
    field self-heal by regenerating once, no backfill migration needed).
    **Verified with real, distinct classifications, not forced values** — curl-tested against real
    plans centered on Zakopane (→ `mountain-trail`), Sopot beachfront (→ `coastal`), central Gdynia
    (→ `urban`), and a wooded Gdynia suburb (→ `countryside`), each grounded in the actual
    reverse-geocoded place name text, confirming the classification is real reasoning over retrieved
    data, not a hardcoded guess. Frontend: new `core/area-theme.model.ts` (mirrors the backend
    union + `AREA_THEME_ICONS`/`AREA_THEME_LABELS` lookup maps, verified against the installed
    `bootstrap-icons` package rather than assumed from memory: `bi-water`, `bi-signpost-2-fill`,
    `bi-building`, `bi-tree-fill`, `bi-geo-alt-fill` default). Applied **only** on
    `plan-summary` (never `plan-detail`'s working view, per the brief's explicit scoping) via a
    `theme-${theme}` class on the root container, driving a single `--theme-color` CSS custom
    property scoped entirely to `plan-summary.scss` — a colored left border on the info card plus a
    small icon+label tag ("Wybrzeże", "Górski szlak", "Miasto", "Wieś i natura"), both a deliberately
    small, honest first slice rather than a full Bootstrap-variable rewrite. Anonymous (logged-out)
    users get zero visual change (`themeClass` computed returns `''` when not authenticated, since
    `aiDescription` never fires for them anyway — same AI-cost-gating precedent as everywhere else).
    **Note for future theming/dark-mode work:** this app has no dark-mode implementation at all yet
    — cards render white regardless of `prefers-color-scheme` — so a dark-mode contrast check was
    inconclusive by necessity, not skipped; the chosen colors are safe mid-tones against the one
    light surface that actually renders today.
    **User feedback (2026-07-21): the four themes are hard to tell apart in practice.** The current
    slice (a border-stripe color + a small icon+label tag) is too subtle to read as a real "the app
    changed based on my location" moment — confirms the "deliberately small first slice" framing
    above was *too* small, not just appropriately minimal.
    **✅ Fixed (2026-07-22): themed hero band.** Wrapped the heading + theme tag in a new
    `.plan-summary__hero` box with a flat tinted background — `color-mix(in srgb, var(--theme-color,
    transparent) 16%, var(--color-page-bg))` — instead of retuning the four hex values (confirmed via
    the earlier note that the *mechanism*, not the colors, was the real limit). No gradient, stays
    flat per this app's own surface rule; falls back to a barely-there alpha tint of the plain page
    background when there's no theme yet (anonymous users, or before the AI description loads).
    Kept the existing `.plan-summary__info-card` left border too — the hero is the primary "this is
    themed" signal, the border is a secondary consistent touch, no reason to remove a working detail.
    **Verified:** temporarily swapped the live container's theme class in the browser (`theme-coastal`
    → `theme-mountain-trail` → `theme-urban` → `theme-countryside` → `theme-default`) and confirmed
    via `getComputedStyle` that the hero's background color is genuinely distinct for all four real
    themes (not just the 4px border from before) and cleanly falls back for the untheme'd default
    case; real classification re-checked live too (a Kraków-Stare-Miasto plan → `urban`/"Miasto").
    No horizontal overflow at 375px.
13. **Harden auth: password confirmation + forgot/change password** (captured 2026-07-21, prompted
    by a real incident — forgot a password with no recovery path, had to manually delete the
    account from the dev DB to register again). Today's `auth/` (Faza 1 step 2) is deliberately
    simple email+password+JWT with none of this. Three pieces, not all the same size: (a) ✅
    **Password confirmation at registration (2026-07-21)** — `register`'s form gained a
    `confirmPassword` field and a `FormGroup`-level `passwordsMatchValidator` (identical shape to
    `reset-password`'s own cross-field validator, added moments earlier in the same session —
    copy-pasted the pattern deliberately rather than extracting a shared helper for two call
    sites). Frontend-only, no backend changes — `submit()`'s `getRawValue()` destructure already
    only pulled `email`/`password`, so `confirmPassword` naturally never reaches
    `AuthService.register()`. (b) ✅ **Forgot password (2026-07-21)** — real
    reset-token flow. New `PasswordResetToken` model (`userId`, `user` relation with
    `onDelete: Cascade` — tokens are ephemeral/dependent data, unlike `Plan`'s deliberately
    non-cascading `User` relation; direct lesson from the FK-constraint block hit deleting a user
    manually earlier this session — see the note on `AuthService` below), `tokenHash String
    @unique`, `expiresAt`. `AuthService.forgotPassword(email)` / `resetPassword(token,
    newPassword)` (`POST /auth/forgot-password` / `POST /auth/reset-password`, both unguarded, same
    as `register`/`login`) — three deliberate, cheap-to-do-right security choices: the raw token is
    SHA-256-hashed (Node's built-in `crypto`, no new dependency) before storing, so a DB dump alone
    can't be used to reset accounts; the API always returns the same generic message regardless of
    whether the email is registered, to prevent account enumeration; requesting a new token or
    completing a reset both delete any other outstanding tokens for that user.
    **Delivery mechanism: `console.log`s the full reset link** (`http://localhost:4200/reset-password
    ?token=<raw>`) rather than a real email provider — same no-cost/no-new-integration precedent as
    every other external API in this app; revisit only if this ever needs to work for real,
    non-developer users. Frontend: new `auth/forgot-password/` (email-only form) and
    `auth/reset-password/` (`token = input<string>()`, bound straight from the `?token=` query
    param via the already-enabled `withComponentInputBinding()` — confirmed this binds query params
    too, not just route params, same mechanism `AreaPicker.id` relies on for route params; new
    `newPassword`/`confirmPassword` fields with a `FormGroup`-level cross-field
    `passwordsMatchValidator`), both mirroring `login`/`register`'s exact
    `FormBuilder`/`submitting`/`errorMessage`/`extractErrorMessage`/`<app-loader variant="spinner">`
    pattern; a "Zapomniałeś hasła?" link added to `login`. (c) ✅ **Change password
    (2026-07-21)** — `AuthService.changePassword(email, currentPassword, newPassword)` verifies
    the current password via `bcrypt.compare` (throws `UnauthorizedException` on mismatch, same
    generic-shape pattern as `login`'s own invalid-credentials error) then reuses the existing
    `UsersService.updatePassword` already built for the reset-password flow — no new
    `UsersService` method needed. `POST /auth/change-password` is hard `JwtAuthGuard`-gated (unlike
    forgot/reset, which are inherently unauthenticated) and reads the acting user's email via the
    existing `@CurrentUser()` decorator rather than trusting a client-supplied id. Frontend: new
    `auth/change-password/` mirrors `reset-password`'s exact shape (a `newPassword`/
    `confirmPassword` cross-field `passwordsMatchValidator`, deliberately copy-pasted again rather
    than extracted — now three near-identical validators across `register`/`reset-password`/
    `change-password`; worth extracting into a shared `shared/validators/` helper if a fourth call
    site ever shows up, not before). **First entry point into an account-scoped settings area** —
    since none existed yet, added a small icon-only gear button (`bi-gear-fill`, `aria-label`/
    `title="Zmień hasło"`) to the authenticated nav in `app.html`, between the email span and "Log
    out". Icon-only (not text, unlike "Moje plany") was a deliberate choice to keep it narrow
    regardless of screen width, rather than the `d-none d-sm-inline` hide-below-breakpoint pattern
    `my-plans/`'s nav addition used — confirmed via `document.documentElement.scrollWidth -
    clientWidth === 0` at 320px that this 4th nav item doesn't reintroduce the overflow regression
    documented under `my-plans/` above. `{ path: 'change-password', canActivate: [authGuard] }` —
    genuinely account-bound, same reasoning as `my-plans/`.

Re-sequence this list if priorities change, but don't skip straight to POI/AI without the
preference-capture steps first — that was a real point of confusion once already (see git history
around the "step 4" clarification).

`Poi` also deviates from the brief's data model: no `aiDescription`/`aiDescriptionGeneratedAt`
columns yet (those cache LLM-written descriptions — pointless before `AiModule` exists to write
them; add via a migration when that step needs them), and `type` is a plain `String` validated
against an app-level `POI_TYPES` const (`backend/src/poi/poi.types.ts`), not a Prisma `enum` — same
pattern as `Plan.status`/`activities`, for consistency. **Known limitation of the cache-first-by-
bbox strategy:** it checks "does *any* cached POI fall in this bbox," not "has this exact region
been ingested" — a bbox that partly overlaps an already-cached area but extends into fresh
territory won't trigger a fetch for the new part, and a bbox with genuinely zero matching POIs will
re-hit Overpass on every request. No TTL/staleness tracking either. Accepted for this first pass;
revisit if real usage shows it matters. **Gotcha found while building this:** Overpass's public
server (`overpass-api.de`) responds `406 Not Acceptable` to requests with no `User-Agent` header —
`curl` sends one by default so this only shows up with Node's `fetch` (which doesn't); `poi.service.
ts` sets an explicit `User-Agent`. Its shared public instance can also return a "server too busy"
error under rapid repeated testing from the same IP — a real `BadGatewayException`, not a bug, just
space out manual verification requests.

`activities` deliberately deviates from `PROJECT_BRIEF.md`'s "wstępny" data model, which proposes a
separate `Activity` dictionary model with a many-to-many relation to `Plan` — same judgment call
already made for `Area`/`AreasModule`: a fixed, small interest list doesn't need DB-managed
metadata or an admin UI yet, so it's just a validated `String[]` column (`backend/src/plans/
activity-keys.ts` is the single source of truth for valid keys server-side; the frontend duplicates
the same keys with labels/icons in `core/activity.model.ts`, no shared package). Revisit if
activities ever need i18n or admin-editable metadata. `PlansModule` also gained `PATCH /plans/:id`
(partial update — either step can PATCH independently) alongside the existing `POST`/`GET`.

`PlanGeneratorModule`'s activity→`PoiType` mapping (`backend/src/plan-generator/
activity-poi-mapping.ts`) is a new decision, not something the brief specifies — `ACTIVITY_KEYS`
(6) and `POI_TYPES` (6) were designed independently in steps 1 and 2 and never cross-referenced.
Current mapping: `hiking`→trail+shelter, `sightseeing`/`culture`→monument, `food`→restaurant,
`nightlife`→nightlife, `relax`→accommodation.
**Correction (2026-07-20):** `nightlife` originally mapped to `restaurant` (sharing `PoiType` with
`food`, on the reasoning that adding tags to an existing type was cheaper than a 6th `PoiType`) —
user reported a plan generated for "Życie nocne" only returned cafes/restaurants. Two compounding
causes: (1) even with correct tag data, sharing a `PoiType` means nightlife results are
indistinguishable from food results (same icon, same label) — no amount of tag-list fixing solves
that on its own; (2) the `amenity=bar`/`pub`/`nightclub` tags had only just been added to
`restaurant`'s Overpass query in the *same* step that introduced the mapping, but `PoiService`'s
cache-first-by-bbox strategy (see its own limitation note above) meant already-cached bboxes never
re-fetched under the new tags — bars/pubs/nightclubs were silently never ingested for any
previously-tested area. Fixed by giving `nightlife` its own `PoiType` (`overpass-tags.ts`'s
`nightlife` entry now owns `amenity=bar`/`pub`/`nightclub`, split out of `restaurant`) and manually
clearing the `Poi`/`PlanItem` tables in dev to force a fresh Overpass fetch under the corrected
tags. That manual `DELETE` was a deliberate one-off, not a new cache-invalidation mechanism — there
are no real users yet, so wiping dev-only cached data is the pragmatic fix; if tag-list edits like
this keep requiring a manual flush, that's the signal to build real invalidation, not before.
`PlanGeneratorModule` also required adding `exports: [XxxService]` to `PlansModule`/`PoiModule`
(first time this codebase needed cross-module service injection — none had an `exports` array
before; `WeatherModule` got one too at the time, though `PlanGeneratorModule` no longer imports it
after the manual-selection redesign above). Explicitly not implemented yet, both honest
simplifications: opening-hours-aware time-of-day scheduling (`PlanItem` has no time field, matching
the brief's own model) and proximity/distance-based candidate ranking within a type (selection is
type-balanced but not distance-sorted from the area's center).

## Key technical decisions

- **Backend = NestJS (TypeScript)**, not e.g. a non-TS stack — chosen specifically for language
  consistency with the Angular frontend and because its module/DI style mirrors Angular's.
- **DB = PostgreSQL + Prisma** — typed queries and straightforward migrations.
- **Map = Leaflet + leaflet-draw** — open source, no licensing cost (vs. e.g. Google Maps); chosen
  over MapLibre GL because it needs zero-config free OSM raster tiles (no vector tile/style source
  to pick) and leaflet-draw already has mature polygon *and* circle(radius) drawing tools, matching
  the area-picker requirement directly.
- **Weather = Open-Meteo** — free, no API key required. `GET /weather` now targets the plan's
  actual `startDate`/`durationDays` (was hardcoded to "next 5 days from today," ignoring the trip
  date entirely — a plan for 3 weeks out showed today's weather). Within `FORECAST_HORIZON_DAYS`
  (`14`, comfortably inside Open-Meteo's real ~16-day forecast limit, matches the "2 weeks" framing
  agreed with the user) it's a real forecast via `start_date`/`end_date` params; beyond that, no
  real forecast exists yet, so `WeatherService.fetchHistoricalAverage` queries Open-Meteo's
  separate free **Historical Weather API** (`archive-api.open-meteo.com`, same account/no-key
  family, just a second endpoint — no new integration) for the same calendar dates across
  `HISTORICAL_YEARS` (`5`) past years and averages temps/precipitation numerically, taking the
  most-frequent WMO code as the representative one. Both constants are deliberate, tunable
  choices, not rigorously chosen statistics. `Forecast.source: 'forecast' | 'historical-estimate'`
  lets the frontend show a clear "this is an estimate" banner
  (`weather-forecast.html`) rather than silently presenting averaged data as a real forecast. The
  returned `daily[].date` values are always the actual planned trip dates, never the historical
  sample dates the average was computed from. No `startDate`/`durationDays` (e.g. a `Plan` that
  hasn't reached `trip-details` yet) falls back to the original "next 5 days from today" behavior.
  **Polish pass (2026-07-21): ±`CONTEXT_DAYS` (2) days of context around the trip, real-forecast
  path only** (not `historical-estimate` — confirmed via `AskUserQuestion`) — `getForecast()`
  widens the requested range by `CONTEXT_DAYS` on each side before calling `fetchForecast`.
  Frontend already has the plan's real `startDate`/`durationDays` in hand (`plan-detail.html`
  passes both to `<app-weather-forecast>`), so "which returned days are actually the trip" is a
  pure client-side string-range check (`WeatherForecast.isInTrip()`) — no new backend response
  fields needed. Non-trip days get `.weather-forecast__day--context` (reduced opacity); trip days
  get `.weather-forecast__day--highlighted` (accent border, same `border-color: v.$accent` pattern
  as `poi-tile--selected`). Same polish pass also fixed a **layout-shift (CLS) issue**: both the AI
  description's loading state (was a small `variant="spinner"`, far smaller than the eventual 2-3
  sentence paragraph) and the weather card's loading state (was a single generic vertical
  `skeleton` block, shaped nothing like the real horizontal row of day-cards) caused a visible jump
  once content arrived. Fixed by sizing the loading placeholder to approximate the final content:
  AI description now uses `variant="skeleton" [lines]="3"`; weather now renders a same-shaped row
  of `.weather-forecast__day`-sized placeholder cards (count estimated from `durationDays + 4`,
  capped at 9) each containing its own skeleton loader, instead of one generic block.
  no-cost/open-source constraint.
- **Geocoding (map search + reverse place names) = Nominatim** — OpenStreetMap's own free
  geocoding service, same free/no-key family as Overpass and Open-Meteo. Proxied through a new
  backend `GeocodingModule` rather than called directly from the frontend — browsers block
  `fetch()` from setting a custom `User-Agent` header, which Nominatim's usage policy requires
  (identical constraint to Overpass).
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
  server-side only in a new `AiModule`). This is genuinely gated behind login — `my-plans/` (see the
  Roadmap above) already established the `authGuard`/`JwtAuthGuard`/`@CurrentUser()` pattern this
  reuses — unauthenticated users get a non-LLM overview (e.g. a Wikipedia/Wikivoyage extract) to
  keep anonymous traffic free of API cost. **First slice built (2026-07-21)** — see the Roadmap's
  step 8 note above for the short AI-written area description; narration/chat are still ahead.

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

## Verification workflow

Always run `npm run lint`, `npm run build`, `npm test` in whichever package(s) a change touches —
cheap, catches real regressions, no reason to ever skip. Manual browser verification is the
expensive part (many tool calls, occasional flakiness in this environment) — scope it to the actual
risk instead of a full click-through after every step (revisited 2026-07-20 after several sessions
of testing every small change end-to-end regardless of size):
- Backend-only change with no UI surface: a targeted `curl` against the changed endpoint is enough
  — skip the browser.
- Docs-only change: skip both manual and browser verification entirely.
- A brand-new user-facing screen/flow: do one full walkthrough — this is genuinely where
  integration bugs hide that lint/tests can't catch (e.g. the Leaflet sprite-icon regression caught
  by eye in the activity-selector/trip-details step, invisible to any automated check).
- A later change to a screen that's already proven working: verify only the part that changed,
  don't re-walk the whole flow from scratch.
- Prefer light `read_page`/`javascript_tool` checks (DOM state, `getComputedStyle`,
  `window.location.href`) over screenshot-driven verification unless the change has real visual/CSS
  risk — screenshots have been slow and occasionally flaky in this environment, and add cost
  without proportional benefit for purely structural checks.

## Architecture notes

- Backend follows Nest's module-per-domain pattern; new domains get their own
  `src/<domain>/<domain>.module.ts` + controller/service, registered in `src/app.module.ts`'s
  `imports`. `src/health/` is the existing example to follow.
- Frontend uses standalone components (no NgModules) with `inject()` for DI and `signal()` for
  local state, wired up via `app.config.ts` (`provideRouter`, `provideHttpClient`, etc.) rather
  than a root module. Cross-cutting services (e.g. `src/app/core/health.service.ts`) live under
  `src/app/core/`.
- The frontend brief calls for feature folders under `src/app/` mirroring the user flow: `auth/` ✅,
  `plan-view/` (currently `plans/plan-detail/`, a minimal stand-in — may get renamed/expanded once
  real generation exists), `plan-chat/` ✅ (built as `plans/plan-chat/`, nested under `plans/`
  alongside `poi-picker`/`plan-summary` rather than the brief's own top-level sketch — deliberate
  deviation, consistent with this project's established practice of nesting all plan-specific
  components under `plans/`), `my-plans/` ✅ — the rest don't exist yet, add them in the order in
  the Roadmap above. **`area-picker/`/`activity-selector/`/`trip-details/` no longer exist as
  separate folders** (2026-07-22 single-view redesign, see the Roadmap's step 5 entry) — merged
  into one `plan-setup/` covering the whole area+activities+dates setup flow.
- The backend brief calls for one Nest module per bounded concern: `HealthModule` ✅, `AuthModule` ✅
  (+ `UsersModule` ✅ used internally by it), `PlansModule` ✅ (also owns `Area` — see the Roadmap's
  step 4 note for why there's no separate `AreasModule`), `WeatherModule` ✅, `PoiModule` ✅,
  `PlanGeneratorModule` ✅ (backend-only — its display lives in `plan-detail`, not a new frontend
  feature folder, since it's inherently the plan's own view), `AiModule` ✅, `PlanChatModule` ✅ —
  every module in the brief's original list now exists.
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
  **Button-loading pattern (fixed 2026-07-22, real user complaint):** never swap a button's label
  for `<app-loader variant="spinner">` outright — every submit/action button in the app used to do
  this (`@if (loading) { <app-loader variant="spinner" /> } @else { label }`, or for the auth forms,
  the entire `<button>` replaced by a bare loader), and since the spinner is much smaller than most
  labels, the button visibly shrank while loading. Fixed globally via a new `.btn-loading` /
  `.btn-loading__label` / `.btn-loading__spinner` class set in `frontend/src/styles/
  _button-loading.scss` (imported once in `styles.scss`, same one-global-file-for-a-repeated-
  pattern precedent as `_trail-list.scss`) — the label stays in the DOM and keeps reserving its
  normal layout space (`visibility: hidden`, not removed), while the spinner overlays it via
  `position: absolute; inset: 0` on the button (`position: relative` via `.btn-loading`). Applied
  to every submit/action button in the app: `<button [class.btn-loading]="loading()" [disabled]="
  loading()"><span class="btn-loading__label">…label…</span>@if (loading()) { <app-loader
  variant="spinner" class="btn-loading__spinner" /> }</button>` — the label `<span>` is always
  rendered, never behind an `@if`/`@else`. Verified via `getBoundingClientRect()` before/during/
  after toggling the loading signal directly (`window.ng.getComponent(...)`) that button width and
  height are now identical in all three states, and that the spinner renders centered within the
  button's bounds. Applies to: `login`, `register`, `forgot-password`, `reset-password`,
  `change-password` (all previously the "whole button replaced" variant), `area-picker`'s confirm
  button, `activity-selector`/`trip-details`'s submit buttons, `poi-picker`'s finalize/narration
  buttons, and `plan-chat`'s send button. Does **not** apply to the full-page/section
  `<app-loader variant="spinner">` uses (`plan.isLoading()`, `placeName.isLoading()`, etc.) — those
  aren't inside a button and were never affected by this bug. Follow this same pattern for any new
  loading button in the app rather than reverting to the old swap-the-label style.
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
  bug in this repo.
  **Spacing convention (confirmed 2026-07-22):** don't invent a parallel spacing-token system —
  Bootstrap 5.3 already ships one as a `$spacers` Sass map (`0, 1=.25rem, 2=.5rem, 3=1rem,
  4=1.5rem, 5=3rem`), which is exactly the "map-get-based design values" idea, already wired
  through every `m*-`/`p*-`/`gap-*` utility class. Customize *that* map in `_variables.scss` (same
  spot `$border-radius`/`$primary` already live, set before the Bootstrap `@import`) if the default
  steps ever need adjusting app-wide, rather than adding a second, competing token file. Default to
  reaching for the existing utility classes (`mt-3`, `ps-2`, `gap-2`, ...) directly in templates for
  anything that fits the scale; reserve component `.scss` for genuinely bespoke values that aren't
  spacing at all (e.g. the datepicker's 2rem day-circle, `poi-tile`'s icon size) — same "don't
  duplicate what already has a variable" rule above, just applied to spacing specifically. A scoped
  local override (e.g. `trip-details-card`'s `margin-top: 0`, overriding what `panel-card` sets) is
  fine when a specific layout genuinely needs an exception — that's not a sign the scale itself
  needs replacing, just that one spot deviates from the shared card pattern on purpose.
  **Design direction: "Trail journal / mapa turystyczna"** (confirmed 2026-07-21,
  supersedes the earlier "Trail & earth" palette) — a full app-wide redesign pass, prompted by user
  feedback that the growing number of components had started to look generic/thrown-together rather
  than like one coherent app. Full inventory of every view done first (compared against this file's
  own architecture/roadmap sections to confirm nothing from the MVP plan was missed), order
  confirmed with the user before touching any code, then one view-group at a time: foundation →
  auth (5 screens) → `area-picker` → `activity-selector`/`trip-details`/`stepper` →
  `plan-detail`/`poi-picker`/`poi-tile`/`poi-map`/`plan-chat` → `plan-summary` →
  `my-plans`/shared components. Each pass followed the same loop: propose 2-3 sentences on how the
  direction applies to *that* view specifically (never a 1:1 copy of a mockup), implement, run
  lint/build/test, verify in the browser at desktop + mobile width, show the result before moving on.
  - **Palette**: trail green `$primary` (`#3b6d11`) + a muted amber `$accent` (`#854f0b`, still not
    a native Bootstrap theme slot — same `_theme-extras.scss` utility classes as before, just a new
    hex). `$body-bg` is a warm, muted off-white (`#f6f5ee`) — deliberately *not* the cream+terracotta
    pairing (reads as a generic "AI default" look). `$body-color`/`$body-secondary-color` are the
    ink tones (`#2c2c2a`/`#5f5e5a`). **`$success` is now set to `$primary`** — Bootstrap's default
    `$success` is a *different* green than our trail green, and left alone the two visibly clashed
    anywhere both appeared (a success alert next to a primary button, `text-success` icons). The
    same palette is also exposed as plain CSS custom properties on `:root` in `_variables.scss`
    (`--color-trail-green`, `--color-amber`, `--color-ink`, `--color-page-bg`, `--font-heading`,
    `--font-body`, ...) — component SCSS should reference these, not the Sass variables (which only
    exist to feed Bootstrap's own compile-time build) and never a hardcoded hex.
  - **Typography**: headings use **Fraunces** (weights 500/600 + italic, loaded via a Google Fonts
    `<link>` in `index.html`, confirmed actually loading via `document.fonts` in the browser rather
    than assumed) through `$headings-font-family`/`$headings-font-weight: 600`; body text is
    **Inter** via `$font-family-sans-serif`. Max two font weights per view, per the confirmed
    direction — don't add a third without a real reason.
  - **One accent, used sparingly**: amber (`btn-accent`/`text-accent`/`bg-accent`) is reserved for
    the single most important action on a screen (e.g. `poi-picker`'s "Zakończ planowanie", a map
    popup's contextual add/remove button, the stepper's *current* step — always exactly one at a
    time). Anything that can be selected/highlighted **more than one at once** uses trail green
    instead (`btn-primary`/`var(--color-trail-green)`) — this was a real bug caught during the pass,
    not a stylistic nicety: activity multi-select, POI tile selection, the grid/map/split view
    toggle, every highlighted trip-day in `weather-forecast`, and selected markers on `poi-map` had
    all been using amber, which meant several amber elements could appear on screen simultaneously.
    Don't reintroduce `btn-accent`/`$accent` on any multi-select or multi-highlight state.
  - **Flat surfaces**: no decorative shadows or gradients. `poi-tile`'s hover state used to lift
    (`translateY`) with a drop shadow — removed in favor of a flat border-color change. The
    skeleton-loader shimmer in `shared/loader/` is the one exception (a neutral-gray functional
    loading indicator, not a decorative surface effect) and was left as-is.
  - **Signature element — the "trail list"**: a dashed vertical line connecting numbered circular
    waypoints, in a new global partial `frontend/src/styles/_trail-list.scss` (`.trail-list` /
    `.trail-list__item` / `.trail-list__marker` / `.trail-list__content`, imported once in
    `styles.scss` — global rather than a component `@use`d partial because both `poi-picker`'s
    "Twój plan" list and `plan-summary`'s item list need the identical classes). Used **only** where
    there's a real sequence in time; the browsable POI candidate grid (`poi-tile` cards) stays a
    plain grid on purpose, per the confirmed rule that numbering shouldn't be decorative.
  - **`shared/stepper/`** was reskinned as part of this pass too (not deferred) — its connector line
    is now dashed (`.stepper__connector`, a small nod to the trail motif) instead of solid, using
    `var(--color-ink-secondary)`.
  - **New `panel-card` Sass mixin** (`_mixins.scss`, renamed from an earlier `auth-card` once
    `trip-details` started using it too) — a flat, bordered, centered card for standalone narrow
    forms (all 5 auth screens, `trip-details`). Its border-radius is a literal `0.6rem` kept in sync
    by hand with `$border-radius`, since the mixin is `@use`d from each component's own module scope
    and can't reach that Sass variable without re-importing `variables.scss` a second time (which
    would double-emit its `:root` custom-property block when mixed with the global `@import` in
    `styles.scss`).
  - **Global shell fix**: `app.html`'s `<router-outlet>` was a sibling of `<main>`, not inside it —
    every routed view individually re-wrapped itself in `container py-4` with no shared page frame.
    Moved `router-outlet` inside `<main>`. Also removed the permanent "Backend status: ok" line that
    sat above every single page (Faza-1 scaffolding leftover) — the health check still runs, it just
    only surfaces as an alert when it actually fails.
  - App icon/favicon stays `bi-backpack-fill` — deliberately generic/universal, unchanged by this
    pass.
  - **Adaptive per-region theming** (roadmap step 12, ✅ already built — see that entry above for
    the full design) still applies only to `plan-summary`, never this shared chrome/palette.
  - **✅ Nav/shell polish, done (2026-07-22)** (captured same day, small enough to build
    immediately rather than deferred): (a) **sticky nav** — added Bootstrap's own `.sticky-top`
    utility class to the `<nav>` (`position: sticky; top: 0; z-index: 1020`, no custom CSS needed);
    near-universal practice now across modern web apps (Gmail, Notion, Linear, GitHub all do this).
    Kept flat per this app's "no decorative shadows" rule — the existing `bg-body-tertiary` vs.
    `$body-bg` contrast is enough separation once pinned, no shadow added.
    **Verification gotcha:** the Browser tool's `computer` screenshot action rendered the scrolled
    page incorrectly here (nav appeared to scroll away with the content instead of staying pinned) —
    a real instance of this environment's previously-documented screenshot flakiness, not an actual
    bug. Confirmed the *real* behavior instead via `document.elementFromPoint(x, 20)` after
    `window.scrollTo` in a separate tool call (letting the scroll actually flush before reading) —
    the element rendered at the top of the viewport was still inside `<nav>` at `scrollY` > 500,
    proving sticky positioning genuinely works. Trust `elementFromPoint`/`getBoundingClientRect`
    over a screenshot when the two disagree on anything scroll-position-related in this
    environment. (b) **the "Tourist App" brand/icon in the nav is now a link to `/`** (`<a
    routerLink="/">` instead of a plain `<span>`) — "the logo always links home" is one of the
    oldest, most consistently-followed web conventions (documented by Nielsen Norman Group as a
    baseline user expectation for decades).
  - **✅ `plan-chat` converted to a floating chat + FAB, done (2026-07-22)** (captured same day —
    user's own observation was that the chat panel sat as just another stacked block between the
    trail-list and the "Miejsca" browsing section, getting visually lost in that column of cards;
    asked for a UX-designer take, chose the floating pattern over moving it into the item-list
    column). `PlanChat` gained an `open = signal(false)`; its template now renders a circular
    `.plan-chat__fab` button (bottom-right, `position: fixed`, `z-index: 1040` — above the sticky
    nav's `1020`) that toggles an `@if`-rendered `.plan-chat__panel` card (also `position: fixed`,
    `max-width: calc(100vw - 2rem)` so it never overflows narrow viewports, `max-height: 70vh`) with
    its own header (title + a Bootstrap `.btn-close`) plus the pre-existing messages/input markup
    unchanged. No CDK Overlay or portal needed — plain fixed positioning is enough since the panel
    doesn't need to escape any `overflow: hidden` ancestor. `poi-picker.html`'s mount point dropped
    its now-meaningless `class="d-block mb-4"` (a fixed-position element takes no space in normal
    flow, so those layout classes did nothing). The existing `itemsChanged` → `items.reload()`
    wiring, `authService.isAuthenticated()` gating, and all chat logic (`send()`, history echo) are
    completely unchanged — this was purely a template/CSS restructure of an already-working
    component. **Verified:** open/close via the FAB and the header's close button, a real message
    round-trip through the floating panel (asked "ile miejsc mam w planie?", got the correct live
    count back), and no horizontal overflow at 375px mobile width (the panel visibly narrows to fit
    while staying anchored bottom-right).
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
  - **Real regression caught (2026-07-20, `my-plans/` step):** adding a third item ("Moje plany")
    to the authenticated nav (`app.html`) overflowed at 320-395px — the nav previously only ever
    had to fit two items (email + Log out) at that width. Fixed by hiding the email span below the
    `sm` breakpoint (`d-none d-sm-inline`) — least essential info at that width, the user already
    knows they're logged in from context. A reminder that adding *any* nav item, not just wide
    ones, is worth a mobile-width check — this one wasn't obviously risky until it was measured.
- **UI components**: `@ng-bootstrap/ng-bootstrap` (standalone components: `NgbAlert`, dropdown,
  modal, accordion, tooltip, ...) for interactive UI, `bootstrap-icons` (`bi bi-*` classes, loaded
  globally via `angular.json`'s `styles` array) for icons. Chosen over Angular Material to keep one
  coherent design system (Bootstrap) instead of two competing ones layered on top of each other.
  Gotcha: several ng-bootstrap components (e.g. `NgbAlert`'s close button) use `$localize` tagged
  strings, which throws `ReferenceError: $localize is not defined` unless `@angular/localize/init`
  is loaded — already added to `angular.json`'s `polyfills` array, so no action needed for new
  ng-bootstrap usage, just don't remove it. This app is zoneless by default (no `zone.js`
  dependency) — don't add `zone.js` back to `polyfills` unless a real reason emerges.
- **Drag-and-drop**: `@angular/cdk`'s `DragDropModule` (`cdkDropList`/`cdkDrag`/`cdkDragHandle`),
  added for `PlanItem` reordering (`plans/poi-picker/`) — the only CDK usage so far, standalone
  directives imported directly into the component that needs them, no global registration. Needs a
  local writable `signal()` synced from the backing `resource()`/`rxResource()` via an `effect()`
  (see `PoiPicker.orderedItems`) since CDK needs a mutable array to reorder for live drag feedback,
  while the resource itself stays the fetched-from-server source of truth — reload the resource
  after a successful persist to reconcile, revert the local signal on failure. **Gotcha:** adding a
  new npm dependency while `ng serve` is already running isn't picked up by Vite's dependency
  pre-bundling cache/HMR — restart the dev server after `npm install`ing anything new, don't assume
  the running server will notice on its own.
- **Dumb vs. smart components**: presentational ("dumb") components — like
  `shared/loader/loader.ts` — take `input()`s and emit `output()`s only; no `inject()` of services,
  no direct HTTP/resource calls, no app-specific business logic. They live under `shared/` (or a
  future `ui/`) and are the default whenever a piece of markup/behavior repeats across views.
  Container ("smart") components own state — they `inject()` services, hold
  `resource()`/`rxResource()` calls — and pass data down to dumb components via inputs (see `App`
  passing loading state to `<app-loader>`). When a component starts doing both (owning state *and*
  being reused verbatim with different data), that's the signal to split it.
  `shared/stepper/stepper.ts` (added 2026-07-20 for `activity-selector`/`trip-details` back/forward
  navigation) is a case where extracting a shared component was initially skipped — an earlier pass
  judged "just 2 screens, a one-line 'Step X of 2' text" not worth it — then revisited once the
  actual ask (click a completed step to go back, or forward to an already-confirmed one, with
  correct locked/current/completed states) turned out to be real interaction logic, not "three
  similar lines." `StepperStep`'s `completed` flag is computed from the `Plan` itself
  (`plans/plan-steps.ts`'s `buildPlanSteps()`, e.g. `activities.length > 0`), not from route
  position — a step you've already confirmed still reads as completed even after navigating back
  past it. Building this required `ActivitySelector`/`TripDetails` to load the `Plan` for the first
  time (previously write-only, PATCH without a GET) — used that same load to fix a real gap:
  navigating back had been showing a blank form even when that step was already filled in, since
  neither component seeded its state from existing `Plan` data. Both now do via an `effect()`
  reacting to the loaded `Plan`.
- **Avoid duplicated/bloated logic**: extract repeated logic into a helper function, a shared
  service method, or a dumb component rather than copy-pasting or letting one method grow to handle
  multiple concerns (backend `auth.service.ts`'s shared `buildToken` helper is the existing example
  to follow). Run the `simplify` skill after finishing a feature slice as the concrete check for
  this, rather than relying on manual vigilance alone.
- **Leaflet** (`frontend/src/app/plan-setup/plan-setup.ts`, moved here from the deleted
  `area-picker/` during the 2026-07-22 single-view redesign): import as `import * as L from
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
  **Gotcha (2026-07-21):** Leaflet's default `scrollWheelZoom: true` hijacks trackpad/mouse-wheel
  scrolling anywhere over the map, zooming it instead of letting the page scroll past — a real
  usability complaint, not just a testing-environment artifact (same "scroll-jacking" class of
  problem as embedded Google Maps without click-to-activate). Fixed in both `area-picker.ts` and
  `plans/poi-map/poi-map.ts` identically: create the map with `scrollWheelZoom: false`, then
  `map.on('click', () => map.scrollWheelZoom.enable())` /
  `map.on('mouseout', () => map.scrollWheelZoom.disable())` — scroll-to-zoom only activates once
  the user has deliberately clicked into the map, and turns back off once the cursor leaves it, so
  the page underneath always scrolls normally otherwise. Apply the same fix to any future
  `L.map(...)` call in this app.
