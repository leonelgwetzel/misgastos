# misgastos

Control de finanzas personales con foco en tarjetas de crédito (Argentina).

## Stack

- **Backend:** Node.js 20, Express, Prisma
- **Frontend:** EJS, HTMX, Alpine.js, Pico.css
- **DB:** PostgreSQL 16 (Docker)
- **Auth:** express-session + bcrypt (sesiones en Postgres)

## Documentación de dominio

La lógica de negocio vive en `.domain/business-logic.md` (gitignored).

## Desarrollo local

### Con Docker (recomendado)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

En otra terminal, aplicar migraciones:

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name init
```

App: http://localhost:3000

### Sin Docker (Postgres local)

```bash
cp .env.example .env
# Ajustar DATABASE_URL en .env
npm install
npx prisma migrate dev --name init
npm run dev
```

## Producción

```bash
docker compose up --build
```

Configurar `SESSION_SECRET` en `.env` antes de deployar.

## Estructura

```
src/
├── controllers/   # HTTP handlers
├── services/      # Lógica de dominio
├── routes/
├── middleware/
├── views/         # EJS templates
└── lib/
prisma/
└── schema.prisma
```
