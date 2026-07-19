# Tourist App — Project Brief

## Idea
Aplikacja turystyczno-krajoznawcza pomagająca turyście zorientować się w wybranym obszarze:
sugeruje atrakcje i aktywności dopasowane do jego zainteresowań, terminu i długości pobytu,
a na końcu generuje gotowy plan pobytu (mapa, noclegi, szlaki, restauracje, schroniska),
który można edytować i zapisać jako szablon do ponownego użycia.

## Stack
- **Frontend:** Angular (najnowsza stabilna wersja, standalone components, signals)
- **Backend:** NestJS (TypeScript — spójność z frontendem, moduły/DI podobne do Angulara)
- **Baza danych:** PostgreSQL + Prisma (ORM, typowane query, łatwe migracje)
- **Mapa:** Leaflet lub MapLibre GL (open source, bez kosztów licencyjnych)
- **Zewnętrzne API:**
  - Pogoda: Open-Meteo (darmowe, bez klucza API)
  - POI / szlaki / zabytki / restauracje: OpenStreetMap + Overpass API

## Główny flow użytkownika
1. **Logowanie** (auth — na start można zacząć od prostego email+hasło, JWT)
2. **Zaznaczenie obszaru** na mapie (rysowanie poligonu lub promień od punktu)
3. **Wybór aktywności** (multi-select): wędrówki, zabytki, kultura, jedzenie, itd.
4. **Termin i długość pobytu** — data przyjazdu + liczba dni
5. **Generowanie planu** — backend łączy dane z POI + pogody i buduje propozycję
6. **Wyświetlenie planu**: mapa + lista miejsc (noclegi, szlaki, restauracje, schroniska),
   z uwzględnieniem godzin otwarcia / warunków pogodowych
7. **Edycja planu** — zmiana trasy, dodawanie/usuwanie punktów
8. **Zapis jako szablon** — możliwość ponownego otwarcia i edycji później

## Model danych (wstępny)

**User**
- id, email, passwordHash, createdAt

**Area**
- id, planId, geometry (polygon/GeoJSON) lub centerPoint + radius

**Activity** (słownik typów aktywności)
- id, name (hiking, sightseeing, culture, food, ...)

**Plan**
- id, userId, name, areaId, startDate, durationDays, status (draft/generated/saved)
- activities: Activity[] (many-to-many)

**POI** (punkt zainteresowania — mogą być cache'owane z Overpass API)
- id, name, type (trail/monument/restaurant/shelter/accommodation), lat, lng,
  openingHours, sourceData (raw OSM tags)

**PlanItem** (POI przypisany do konkretnego planu, w konkretnej kolejności/dniu)
- id, planId, poiId, order, dayNumber, note, userModified (bool)

## Backend — proponowany podział na moduły NestJS
- `AuthModule` — rejestracja/logowanie, JWT
- `UsersModule` — profil użytkownika
- `AreasModule` — zapis geometrii obszaru
- `PoiModule` — pobieranie i cache'owanie danych z Overpass/OSM
- `WeatherModule` — integracja z Open-Meteo
- `PlansModule` — CRUD planów, edycja, zapisywanie szablonów
- `PlanGeneratorModule` — silnik łączący POI + pogodę + preferencje w gotowy plan
  (na start: prosty algorytm regułowy, docelowo można rozbudować)

## Frontend — proponowany podział na Angular features
- `auth/` — logowanie/rejestracja
- `area-picker/` — komponent mapy do zaznaczania obszaru
- `activity-selector/` — wybór aktywności (multi-select)
- `trip-details/` — data + długość pobytu
- `plan-view/` — wyświetlanie i edycja wygenerowanego planu (mapa + lista)
- `my-plans/` — lista zapisanych planów/szablonów użytkownika

## Faza 1 (MVP) — sugerowany zakres na pierwszy działający szkielet
1. Angular app + NestJS API — szkielety, połączenie ze sobą (health check endpoint)
2. Auth (rejestracja/logowanie)
3. Area picker (mapa, zaznaczanie obszaru)
4. Zapis prostego Planu w bazie (bez generowania — na razie tylko struktura)
5. Integracja z jednym zewnętrznym API (np. Open-Meteo) jako proof of concept

Dopiero po działającym szkielecie: POI z Overpass, silnik generowania planu, edycja, szablony.

## Uwagi
- Projekt eksperymentalny — celem jest też poznanie możliwości Claude Code w praktyce,
  więc małe, weryfikowalne kroki > duże skoki na raz.
- Repo na GitHubie: żeby Claude Code mogło samodzielnie zakładać repo i pushować,
  warto mieć wcześniej zrobione `gh auth login`.
