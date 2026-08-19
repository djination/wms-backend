# WMS Backend API

NestJS REST API untuk WMS Platform — PostgreSQL (Prisma), JWT auth, Redis, RabbitMQ, dan upload S3 opsional.

Dokumentasi monorepo: [`../README.md`](../README.md)

## Prasyarat

- Node.js 22+
- PostgreSQL
- Redis (opsional untuk fitur cache tertentu)
- RabbitMQ (opsional; microservice consumer dinonaktifkan jika `RABBITMQ_URL` kosong)

## Setup cepat

```bash
cp .env.example .env
# Isi DATABASE_URL atau PSQL_* di .env
npm install
npm run prisma:migrate
npm run seed:access
npm run start:dev
```

- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`
- Health: `GET /health`, `GET /health/ready`

## Struktur folder

```txt
backend/
  src/
    modules/          # Modul NestJS per domain
    common/           # Guard, filter, decorator, util
    config/           # Validasi env, bootstrap DATABASE_URL
  prisma/
    schema.prisma     # Model data & relasi
    migrations/       # Migrasi SQL
  scripts/
    prisma-env.cjs    # Wrapper Prisma CLI (baca .env)
    seed-access.cjs   # Seed role, menu, user admin
    seed-uom.cjs      # Seed satuan dasar
  uploads/            # File lokal (jika S3 tidak dikonfigurasi)
  Dockerfile
```

## Modul API

| Modul | Prefix | Keterangan |
| --- | --- | --- |
| Auth | `/auth` | Register, login, profil JWT |
| Health | `/health` | Liveness & readiness |
| Upload | `/upload` | Multipart → S3 atau lokal |
| Integration | `/integration` | Webhook inbound |
| Master data | `/master-data` | Customer, warehouse, produk, UOM, inventory, dll. |
| Access | `/access` | Role, menu, user |
| Import consignment | `/import-consignments` | Transit import, manifest review, dokumen |
| Inbound | `/inbound` | ASN, receiving, customs release |
| Outbound | `/outbound` | Sales order, wave, task, alokasi |
| Process flow | `/process-flow` | Transfer, transformasi, resep, genealogy |
| Billing | `/billing` | Kontrak, rate, transaksi, summary |
| KPI | `/kpi` | Ringkasan operasional & transit customs |

Semua endpoint bisnis (kecuali auth register/login, health, webhook) memerlukan header `Authorization: Bearer <token>`.

## Scripts npm

| Perintah | Fungsi |
| --- | --- |
| `npm run start:dev` | Dev server dengan hot reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start:prod` | Jalankan `dist/main.js` |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Migrasi dev (`migrate dev`) |
| `npm run prisma:deploy` | Migrasi production (`migrate deploy`) |
| `npm run seed:access` | Seed admin + menu default |
| `npm run seed:uom` | Seed unit of measure dasar |
| `npm run lint` | ESLint |

## Environment (`.env`)

Salin dari `.env.example`. Variabel utama:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` atau `PSQL_*` | Ya | Koneksi PostgreSQL |
| `JWT_SECRET` | Ya | Min. 16 karakter |
| `JWT_EXPIRES_IN` | — | Default `1d` |
| `API_PORT` | — | Default `4000` |
| `REDIS_HOST` / `REDIS_URL` | — | Redis |
| `RABBITMQ_URL` | — | AMQP; kosong = tanpa consumer |
| `CORS_ORIGIN` | — | Origin frontend (koma-separated) |
| `AWS_*` | — | S3 upload (opsional) |
| `INTEGRATION_WEBHOOK_SECRET` | — | Validasi header webhook |

Seed admin opsional: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`.

## Database

Model ORM ada di `prisma/schema.prisma`. **DDL SaaS (schema-per-tenant)** dikelola **Flyway** (`db/migration/`); Prisma untuk generate client & query saja.

### Flyway (SaaS — fase S1+)

| Folder | Schema target | Isi |
| --- | --- | --- |
| `db/migration/platform/` | `platform` | Control plane SaaS (registry tenant, plan, …) |
| `db/migration/tenant/` | `tenant_<slug>` | Semua tabel WMS operasional |

```bash
# Regenerate baseline tenant dari prisma/migrations (sekali / saat baseline berubah)
npm run flyway:baseline:build

# Migrate platform + tenant dev (set FLYWAY_DEV_TENANT_SCHEMA di .env)
npm run flyway:platform
npm run flyway:tenants:all

# Atau satu perintah
npm run db:migrate

# Satu tenant tertentu
npm run flyway:tenant -- tenant_default

# Seed plan + platform admin + registry tenant dev (fase S2+)
npm run flyway:platform
npm run seed:platform
npm run flyway:tenants:all

# Provision tenant baru (fase S3) — registry + CREATE SCHEMA + Flyway + seed admin
npm run provision:tenant -- --slug=demo --name="Demo Tenant" --admin-email=admin@demo.local --admin-password=password123

# Seed ulang access di schema tenant yang sudah ada
npm run seed:tenant -- tenant_demo
```

**Platform schema (S2):** `platform.tenants`, `plans`, `tenant_subscriptions`, `platform_users`, `tenant_provisioning_jobs`, `platform_audit_logs`, `platform_settings`, `tenant_feature_flags`.  
ORM terpisah: `prisma/schema-platform.prisma` → client di `src/generated/platform-prisma`.

Env Flyway: lihat `backend/.env.example` (`FLYWAY_RUNNER`, `FLYWAY_DEV_TENANT_SCHEMA`, …).  
Runner `auto` memakai CLI `flyway` jika terpasang, else Docker image `flyway/flyway`.

Setelah mengubah model Prisma (ORM):

```bash
npm run prisma:generate
```

Migrasi DDL baru: tambah `db/migration/tenant/V{n}__....sql` (atau `platform/`), jangan `prisma migrate` setelah cutover SaaS.

### Tenant context (SaaS — fase S4)

Setiap request operasional memakai schema tenant via Prisma `?schema=tenant_<slug>` (routing per request + middleware). Jangan set `?schema=public` di `DATABASE_URL`.

| Sumber tenant | Contoh |
| --- | --- |
| Header | `X-Tenant-Slug: demo` |
| Subdomain | `demo.wms.app` atau `demo.localhost` |
| JWT | claims `tenantSlug`, `schemaName`, `tenantId` |
| Fallback dev | `TENANT_DEFAULT_SLUG=default` di `.env` |

Login tenant (contoh `tenant_demo`):

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: demo" \
  -d "{\"email\":\"admin@demo.local\",\"password\":\"password123\"}"
```

Status tenant `SUSPENDED` / `PROVISIONING` (kecuali endpoint status) ditolak dengan 403.

### Platform admin (SaaS — fase S5)

API control plane di prefix `/platform/*` — JWT terpisah (`tokenType: platform`), tidak memakai tenant middleware.

```bash
# Login platform admin (seed: platform@wms.local)
curl -X POST http://localhost:4000/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"platform@wms.local","password":"password123"}'

# List tenants
curl http://localhost:4000/platform/tenants \
  -H "Authorization: Bearer <platform_token>"
```

| Endpoint | Role | Fungsi |
| --- | --- | --- |
| `POST /platform/auth/login` | public | Login platform admin |
| `GET /platform/auth/me` | authenticated | Profil platform admin |
| `GET /platform/tenants` | SUPPORT+ | Daftar tenant |
| `GET /platform/tenants/:id` | SUPPORT+ | Detail + usage |
| `POST /platform/tenants` | SUPPORT+ | Buat + provision tenant |
| `PATCH /platform/tenants/:id/suspend` | SUPER_ADMIN | Suspend |
| `PATCH /platform/tenants/:id/reactivate` | SUPER_ADMIN | Aktifkan kembali |
| `POST /platform/tenants/:id/retry-provision` | SUPPORT+ | Ulang provisioning |
| `POST /platform/tenants/:id/impersonate` | SUPER_ADMIN | JWT tenant sementara (audit) |
| `GET/PUT /platform/settings` | SUPPORT+ / SUPER_ADMIN | Platform settings (key-value JSON) |
| `GET/POST/PATCH /platform/users` | SUPER_ADMIN | Kelola platform admin users |
| `GET/PATCH /platform/plans` | BILLING+ | Paket langganan SaaS |
| `GET/PUT /platform/feature-flags/catalog` | SUPPORT+ / SUPER_ADMIN | Catalog feature flag |
| `GET/PUT /platform/feature-flags/tenants/:id` | SUPPORT+ | Override flag per tenant |
| `GET /platform/audit-logs` | SUPPORT+ | Audit log platform admin |

### Tenant signup publik (SaaS — fase S6)

```bash
# Daftar tenant baru (async provisioning)
curl -X POST http://localhost:4000/tenants/signup \
  -H "Content-Type: application/json" \
  -d '{"slug":"acme","name":"PT Acme","adminEmail":"admin@acme.com","adminPassword":"password123"}'

# Polling sampai ready=true (status TRIAL/ACTIVE)
curl http://localhost:4000/tenants/acme/provision-status
```

- `POST /auth/register` **nonaktif di production** kecuali `AUTH_ALLOW_OPEN_REGISTER=true`
- User tenant baru dibuat via provisioning seed di schema `tenant_<slug>`

### Legacy (single-tenant `public`, sebelum cutover)

```bash
npm run prisma:migrate
npm run prisma:generate
```

## Docker

Image production memakai entrypoint `scripts/docker-entrypoint.sh`:

1. `wait-for-postgres.cjs` (jika `WAIT_FOR_DB=true`)
2. `npm run db:migrate` — Flyway platform + tenants (`FLYWAY_RUNNER=local`, CLI terpasang di image)
3. `node dist/main.js`

```bash
# Dari root monorepo
docker compose up -d --build api

# Seed pertama kali (dev)
docker compose exec api npm run seed:platform
docker compose exec api npm run seed:tenant -- tenant_default
```

Env container: `SKIP_DB_MIGRATE=true` lewati Flyway; `FLYWAY_DEV_TENANT_SCHEMA` untuk tenant dev saat registry kosong.

Pastikan `backend/.env` ada sebelum menjalankan Compose. Dari container ke Postgres di host Windows/macOS, gunakan `host.docker.internal` di `DATABASE_URL`.

CI: `.github/workflows/ci.yml` — Postgres service + `npm run db:migrate` + `npm run build`.

## RabbitMQ

Consumer pattern yang didaftarkan:

- `wms.ping`
- `wms.inbound.received`

Publisher service (`MessagingModule`) siap emit event ke `RABBITMQ_PUBLISH_QUEUE`.
