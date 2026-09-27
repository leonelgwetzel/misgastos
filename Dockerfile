FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY package.json ./
COPY src ./src
COPY public ./public

EXPOSE 3000
# APP_ROLE=bot → worker de Telegram. Cualquier otro valor → web + migraciones.
CMD ["sh", "-c", "if [ \"$APP_ROLE\" = \"bot\" ]; then node src/bot/index.js; else npx prisma migrate deploy && node src/index.js; fi"]
