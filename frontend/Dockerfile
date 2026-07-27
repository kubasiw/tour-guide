# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Dwa osobne buildy z jednego źródła: główna appka (routing, wszystkie ekrany) i wyodrębniony
# widget (Angular Elements, `<tour-guide-mini-map>`) — oba serwowane przez ten sam kontener nginx,
# pod różnymi ścieżkami, patrz stage `serve` niżej.
RUN npm run build
RUN npx ng run frontend:build-element:production

# --- serve stage ---
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY --from=build /app/dist/frontend-element/browser /usr/share/nginx/html/elements
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
