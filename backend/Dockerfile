# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime stage ---
# Cały node_modules (nie tylko production deps) skopiowany wprost z build stage — prostsze i
# mniej podatne na błędy niż osobny `npm ci --omit=dev` w tym stage'u (musiałby trafić dokładnie
# te same wygenerowane pliki @prisma/client), kosztem nieco większego obrazu. Akceptowalne przy
# tej skali (portfolio, nie produkcja na dużą skalę) — ten sam pragmatyzm co w Dockerfile
# portfolio-shell.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
# prisma.config.ts (root, sibling do prisma/) dostarcza datasource.url z DATABASE_URL — bez niego
# `prisma migrate deploy` w runtime nie znajduje URL-a i failuje, mimo że schema.prisma się ładuje
# (złapane realnie przy pierwszym buildzie tego obrazu, nie tylko teoretycznie).
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000
# `prisma migrate deploy` przy każdym starcie kontenera — idempotentne (nie robi nic, jeśli
# migracje już zastosowane), więc bezpieczne przy restarcie/re-deployu, nie tylko przy pierwszym
# uruchomieniu.
# Uwaga: `dist/src/main.js`, nie `dist/main.js` — nest build zachowuje prefiks src/ w outDir, bo
# tsconfig.json nie ustawia rootDir (zweryfikowane realnie uruchomieniem kontenera, nie założone —
# package.json's `start:prod` miał ten sam, dotąd nigdy realnie nieużywany błąd, poprawiony przy
# okazji).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
