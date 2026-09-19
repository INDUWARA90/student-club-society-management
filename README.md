# Student Club & Society Management System

Full spec: [`full-spec.md`](./full-spec.md).

This repo holds two independent projects side by side (not a monorepo with shared tooling/workspaces — each has its own dependencies and build):

- [`backend/`](./backend) — Spring Boot (Maven)
- [`frontend/`](./frontend) — React (Vite)

## Local dev

Copy the env template and fill in real values (see [`.env.example`](./.env.example)):

```bash
cp .env.example .env
cp .env.example backend/.env   # only needed if you run the backend outside Docker
```

```bash
docker compose up
```

- Backend: http://localhost:5000
- Frontend: http://localhost:5173
- Swagger UI: http://localhost:5000/swagger-ui.html
- MySQL: localhost:3306

On first run against an empty database, demo/seed data is loaded automatically (2 clubs, sample students,
events, RSVPs, attendance). Demo accounts (password: `password123`):

- Super Admin: `superadmin@example.com`
- Faculty Advisor: `advisor@example.com`
- Student (Tech Innovators President): `alice@example.com`
- Student: `bob@example.com`, `carol@example.com`, `dave@example.com`

> Note: `full-spec.md` specifies PostgreSQL, but this project runs on MySQL instead (project decision).

Or run each separately:

```bash
cd backend && ./mvnw spring-boot:run
cd frontend && npm install && npm run dev
```

## Configuration switches

Set these in `.env` (see [`.env.example`](./.env.example)). The defaults suit local development and the demo `docker compose` stack; a real deployment should change them.

| Variable | Local / demo default | Real deployment |
|---|---|---|
| `SEED_DEMO_DATA` | `true` — loads the demo accounts above into an empty database | `false` (the backend's `prod` profile already defaults to this) |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | empty | Set both (password 12+ characters) to create the first Super Admin when none exists |
| `REQUIRE_EMAIL_VERIFICATION` | `false` — no SMTP needed to use the app | `true` — joining clubs, RSVPs, payments and proposing clubs need a verified email |
| `JPA_DDL_AUTO` | `validate` — Flyway creates and upgrades the schema; Hibernate only checks it | leave as `validate` |
| `TRUST_FORWARDED_HEADERS` | `false` | `true` only behind a proxy that overwrites `X-Forwarded-For` (needed for correct per-IP rate limiting there) |

## Behaviours worth knowing

- **Payments** are simulated but enforced: a fee event needs a successful payment before the RSVP is accepted, a club with a membership fee needs one before joining, and payments are refunded when an RSVP is cancelled (before the event starts), an event is cancelled, or a join request is rejected/withdrawn.
- **Check-in QR codes rotate** every few minutes and only work during the event; capacity-limited events require a confirmed RSVP to check in.
- **Certificates** use a per-club attendance threshold (default 3), are only issued to approved members, and carry a code that anyone can verify at `/verify-certificate/{code}`.
- **Clubs can be archived** by their President or a Super Admin (upcoming events are cancelled and refunded); only a Super Admin can restore them.
- **List endpoints** accept optional `page`/`size` (paged by the database, with an `X-Total-Count` response header); events also take `q`, `category`, `from`, `to`, and clubs take `q`.

See [`MANUAL_TEST_PLAN.md`](./MANUAL_TEST_PLAN.md) for how to verify each of these and [`JIRA_UPDATES.md`](./JIRA_UPDATES.md) for the story list.

## Database migrations

The schema is owned by Flyway (`backend/src/main/resources/db/migration`) and applied automatically at startup — there is
no manual SQL to run. Existing databases created by earlier builds are picked up (baselined at V1) and upgraded in
place. To change the schema, add a new `V<n>__description.sql`; never edit one that has been released. Hibernate only
validates, so an entity change without a migration fails the tests and the startup instead of silently altering data.

## Tests

```bash
cd backend && DB_USERNAME=root DB_PASSWORD=... ./mvnw verify   # unit + integration tests (~315)
cd frontend && npm ci && npm run lint && npm test              # ~22 tests
```

The backend integration tests run the real application against MySQL in a dedicated database
(`club_management_test`, created on first use; override with `TEST_DATASOURCE_URL`). They **wipe that database on every
test** and refuse to run unless its name contains `test`, so your development data is never touched.

## CI/CD

Backend and frontend have **separate pipelines** that only run when their own folder changes:

| Workflow | What it does |
|---|---|
| [`backend.yml`](./.github/workflows/backend.yml) | tests on MySQL → Docker image (GHCR, Trivy scan) → deploy to Render → waits for the new commit to report healthy → smoke tests |
| [`frontend.yml`](./.github/workflows/frontend.yml) | lint, tests, build, audit → Vercel PR previews → production deploy → live smoke test |

Setup (Render, Vercel, GitHub secrets), the first release, rollback and troubleshooting are in
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md). `GET /api/health` is the public health/version probe.
