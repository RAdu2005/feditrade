# Feditrade MVP

Next.js marketplace MVP with:
- Mastodon OAuth login (dynamic instance registration)
- Public listing feed and listing details
- Authenticated listing CRUD
- S3-compatible image uploads (MinIO/S3)
- ActivityPub endpoints (`WebFinger`, actor, inbox, outbox, objects)
- Postgres-backed federation delivery queue + worker
- Minimal admin tooling for takedown/retry

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Prisma + PostgreSQL
- Auth.js (`/api/auth/*`) with credentials bridge
- AWS S3 SDK (MinIO-compatible)
- Vitest + Playwright

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Ensure PostgreSQL is running on `localhost:5432` with:
- user: `postgres`
- password: `1234`

3. Copy `.env.example` to `.env` if needed, then apply schema:

```bash
npx prisma migrate dev --name init
```

4. Run the web app:

```bash
npm run dev
```

5. Run the federation worker in a second terminal:

```bash
npm run worker:dev
```

Open `http://localhost:3000`.

Uploads use S3/MinIO via backend (`POST /api/uploads`).  
Set `ALLOW_LOCAL_UPLOAD_FALLBACK="true"` only if you explicitly want fallback to `public/uploads` when S3 is unavailable.
If running behind a reverse proxy or cloudflared tunnel, set `AUTH_TRUST_HOST="true"`.

UI priority configuration:
- `NEXT_PUBLIC_PRIORITY_CURRENCIES` (CSV, default `EUR,USD,CNY`)
- `NEXT_PUBLIC_PRIORITY_COUNTRIES` (CSV of ISO-3166 alpha-2, default `FI,US,CN`)

## Docker Compose (One Command Local Stack)

```bash
docker compose up --build
```

This starts:
- `app` on `http://localhost:3300`
- `worker` for delivery queue
- `postgres` on `127.0.0.1:55432`
- `minio` on `http://127.0.0.1:3900` (console `:3901`)

PostgreSQL runs inside Docker Compose with defaults:
- user: `postgres`
- password: `1234`
- database: `market`

You can override these with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
You can override host port bindings with `APP_PORT_BIND`, `MINIO_API_PORT_BIND`, `MINIO_CONSOLE_PORT_BIND`, `POSTGRES_PORT_BIND`.

## API Surface

- `GET /api/listings`
- `POST /api/listings`
- `PATCH /api/listings/:id`
- `DELETE /api/listings/:id`
- `POST /api/uploads`
- `GET /api/health`
- `GET /api/admin/federation/failures`
- `POST /api/admin/federation/retry/:jobId`
- `POST /api/admin/listings/:id/takedown`

ActivityPub:
- `GET /.well-known/webfinger`
- `GET /ap/actor/:name`
- `GET /ap/actor/:name/followers`
- `POST /ap/inbox`
- `GET /ap/outbox`
- `GET /ap/objects/:id`

## Tests

```bash
npm run test
npm run lint
npm run typecheck
```

E2E:

```bash
npx playwright install
npm run test:e2e
```
