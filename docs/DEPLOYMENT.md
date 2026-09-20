# Deployment guide

The backend and the frontend have **separate pipelines**. A change under `backend/` runs only the backend pipeline; a
change under `frontend/` runs only the frontend one. Each pipeline tests first and deploys only if everything passed.

```
                    ┌────────────────────────── GitHub Actions ──────────────────────────┐
  push / PR         │                                                                    │
  backend/**  ────► │ backend.yml   test ─► image (GHCR + scan) ─► deploy ─► verify live │ ─► Render (API)  ─► MySQL
                    │                                                                    │
  frontend/** ────► │ frontend.yml  lint+test+build ─► preview (PR) / deploy ─► verify   │ ─► Vercel (SPA)
                    └────────────────────────────────────────────────────────────────────┘
```

| | Backend | Frontend |
|---|---|---|
| Workflow | `.github/workflows/backend.yml` | `.github/workflows/frontend.yml` |
| Runs when | changes in `backend/**` | changes in `frontend/**` |
| Hosting | Render (Docker web service) | Vercel (static SPA) |
| Also publishes | image `ghcr.io/<owner>/<repo>-backend` | image `ghcr.io/<owner>/<repo>-frontend` (self-hosting) |
| Database | external MySQL 8 (migrated by Flyway at startup) | – |

## What each pipeline does

### Backend (`backend.yml`)
1. **Test** – starts a real MySQL 8.4, runs the Flyway migrations from scratch and executes all unit **and integration**
   tests (`./mvnw verify`, ~315 tests: security rules, concurrency races, constraints, whole workflows over HTTP).
   Surefire reports are uploaded and summarised on the run page.
2. **Image** *(push to main / manual)* – builds the Docker image (non-root, health-checked, stamped with the commit),
   pushes it to GitHub Container Registry and scans it with Trivy; a **CRITICAL** fixable vulnerability fails the run.
3. **Deploy** *(main only)* – calls the Render deploy hook for this exact commit, then **waits until `/api/health`
   reports that same commit as `UP`** (it only says `UP` if the app can reach its database), then smoke-tests the live
   API (protected routes still refuse anonymous calls; public ones still answer). If the new version never becomes
   healthy the job fails — and Render keeps serving the previous version, so the site is never taken down.

### Frontend (`frontend.yml`)
1. **Lint, test, build, audit** – `oxlint`, the Vitest suite, a production build and `npm audit` (high severity or
   worse fails the run). The build is uploaded as an artifact.
2. **Preview** *(pull requests from this repo)* – deploys the PR to a Vercel preview URL and comments the link.
3. **Deploy** *(main only)* – builds with the production API address and deploys to Vercel, then checks the live site
   serves the app and that deep links (`/clubs/123`) fall back to it instead of 404.
4. **Image** *(main)* – also publishes an nginx image for people who self-host instead of using Vercel.

A deploy step **skips itself with a visible warning** (never a silent pass) when its secrets are not configured, so the
tests and image build stay useful before hosting is set up.

## One-time setup

### 1. Database (MySQL 8)
Render has no managed MySQL, so use an external one. Any of these work: Aiven (free tier), TiDB Cloud Serverless,
Railway, a VPS/RDS. Create an empty database and a user with full rights on it, and note the JDBC URL, e.g.
`jdbc:mysql://HOST:3306/club_management?useSSL=true&serverTimezone=UTC`.
**You do not create tables by hand** — the app applies the Flyway migrations on first start.

### 2. Backend on Render
1. Render dashboard → **New → Blueprint** → select this repository. It reads `render.yaml`.
2. Fill the variables marked `sync: false`: `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `FRONTEND_URL`,
   `CORS_ALLOWED_ORIGINS`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and — for the very first start only —
   `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters). `JWT_SECRET` is generated for you.
3. In the service → **Settings → Deploy Hook**, copy the hook URL (it looks like
   `https://api.render.com/deploy/srv-xxxx?key=yyyy`).
4. Auto-deploy is intentionally **off**: the pipeline triggers deploys after the tests pass.

### 3. Frontend on Vercel
1. Vercel → **Add New → Project** → import the repository.
   Leave **Root Directory empty** (the pipeline runs the CLI from `frontend/`), framework **Vite**.
2. Create a token (Account Settings → Tokens). From the project's settings copy the **Project ID** and your **Team/Org ID**.
3. If you enable Vercel "Deployment Protection", the public production domain is still open; the smoke test uses the
   `FRONTEND_URL` variable below for that reason.

### 4. GitHub repository settings
**Settings → Environments → New environment → `production`** (optionally add *Required reviewers* for a manual
approval before every production deploy), then add:

| Kind | Name | Value |
|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_URL` | the Render deploy hook URL from step 2.3 |
| Variable | `BACKEND_URL` | public API origin, e.g. `https://club-society-backend.onrender.com` (no `/api`) |
| Secret | `VERCEL_TOKEN` | Vercel token |
| Secret | `VERCEL_ORG_ID` | Vercel team/org ID |
| Secret | `VERCEL_PROJECT_ID` | Vercel project ID |
| Variable | `VITE_API_BASE_URL` | API address baked into the frontend, e.g. `https://club-society-backend.onrender.com/api` |
| Variable | `FRONTEND_URL` | production site, e.g. `https://club-society.vercel.app` |

For pull-request previews also add the three `VERCEL_*` secrets at repository level (Settings → Secrets and variables →
Actions), since PR runs don't use the `production` environment. Images need no setup: they use the built-in
`GITHUB_TOKEN`. Recommended: protect `main` and require the **Backend CI/CD / Test** and **Frontend CI/CD / Lint, test
and build** checks before merging.

### 5. First deployment
1. Merge to `main` (or run the workflow manually: Actions → *Backend CI/CD* → Run workflow → tick *deploy*).
2. On first start Flyway creates the schema and the bootstrap admin is created. Check
   `GET https://<backend>/api/health` → `{"status":"UP","database":"UP","version":"<commit>"}`.
3. Sign in with the bootstrap admin, then **remove `BOOTSTRAP_ADMIN_*`** from Render (they are ignored once an admin
   exists, but there is no reason to keep a password in the environment).
4. Set `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` on Render to the real site origin if you have not already (the QR
   check-in links and e-mails use it), and confirm e-mail sending works (register a test account).

## Day to day

| I want to… | Do this |
|---|---|
| Ship a change | Open a PR → checks run (and a frontend preview appears) → merge → tests re-run on `main` → deploy |
| Deploy without a code change | Actions → the workflow → **Run workflow** on `main`, tick *deploy* |
| Change the database schema | Add a **new** migration file (below) — never edit one that has been released |
| Rotate a secret | Change it in Render/GitHub, then run the workflow manually (or redeploy in Render) |
| Roll back | See *Rollback* |

### Database migrations (Flyway)
Migrations live in `backend/src/main/resources/db/migration` and run automatically at startup, in order:

| File | Purpose |
|---|---|
| `V1__baseline_schema.sql` | the original schema |
| `V2__venues_resources_event_comments_alumni.sql` | venues, resource library, event discussion, alumni (idempotent) |
| `V3__workflow_and_logic_hardening.sql` | fees/archive/cancel/refunds/verification codes/…, real-size text columns (idempotent) |
| `V4__user_active_flag.sql` | `users.active`, so an admin can deactivate an account without deleting it |

Rules: add `V5__short_description.sql`, `V6__…` — **never edit a migration that has run anywhere** (Flyway rejects a
changed checksum); Hibernate only *validates* (`ddl-auto: validate`), so an entity change without a matching migration
fails the tests and the startup loudly instead of silently altering production. Existing databases created before Flyway
are baselined at V1 automatically. Integration tests apply the same migrations to an empty database on every run.

### Rollback
* **A release that fails its health check** never goes live: Render keeps the previous version, and the deploy job fails.
* **A bad release that is live**: Render dashboard → the service → **Events/Deploys → Rollback** to the previous deploy
  (instant), or revert the merge on `main` and let the pipeline redeploy.
* **Database**: migrations are forward-only. Ship a corrective `V<n+1>` migration; take a provider snapshot before a risky one.
* **Frontend**: Vercel → Deployments → the previous deployment → **Promote to Production**.

## Backups
Data loss protection has two layers; use the one that matches how you host the database.

**Docker Compose stack (local / VPS).** The `backup` service in `docker-compose.yml` runs `scripts/backup.sh --loop`: it
writes a gzipped `mysqldump` of `club_management` to `./backups/` every `BACKUP_INTERVAL_SECONDS` (default daily) and
keeps the newest `BACKUP_KEEP` (default 14). Each dump is checked to be complete before it is kept; a failed or
truncated dump is discarded and retried at the next interval. Take one on demand with
`docker compose exec backup sh /backup.sh`. Copy `./backups/` off the machine (another disk, cloud storage) — a backup
on the same disk as the database does not survive losing that disk.

**Managed MySQL (Aiven, RDS, Railway, …).** Turn on the provider's automated backups / point-in-time recovery and note
the retention period. This is the layer that protects the Render deployment above, since the compose `backup` service
isn't part of it.

**Restore** (compose stack), from the repository root:
```bash
scripts/restore.sh backups/club_management-<timestamp>.sql.gz
```
It asks for confirmation, stops the backend, replaces the database contents with the dump, and starts the backend
again. Test a restore into a scratch stack before you rely on it.

## Running the same things locally
```bash
# full stack, demo data (Flyway builds the schema)
cp .env.example .env && docker compose up

# backend tests need a MySQL user; a dedicated database is created on first use
cd backend
DB_USERNAME=root DB_PASSWORD=... ./mvnw verify          # uses database "club_management_test" (never your dev data)
TEST_DATASOURCE_URL='jdbc:mysql://host:3306/my_test_db?...' ./mvnw verify   # or point it elsewhere

# frontend
cd frontend && npm ci && npm run lint && npm test && npm run build
```
The integration tests **wipe the database they run against**, and refuse to start unless its name contains `test`.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Deploy job prints *Deployment skipped* | `RENDER_DEPLOY_HOOK_URL` / `BACKEND_URL` (or the Vercel secrets / `VITE_API_BASE_URL`) not set on the `production` environment |
| "The new version never reported healthy" | open the Render logs: bad `DATABASE_URL`/credentials, a failing migration, or missing `JWT_SECRET`/`FRONTEND_URL` |
| Health shows the old commit | Render is still building, or the deploy hook URL points at a different service |
| App fails at startup with a Flyway checksum error | a released migration file was edited — restore it and add a new migration instead |
| App fails with *Schema-validation: missing column/table* | an entity changed without a migration — add one |
| Browser shows CORS errors after deploy | `CORS_ALLOWED_ORIGINS` on Render must contain the exact site origin (scheme + host, no trailing slash) |
| Frontend calls `localhost` | `VITE_API_BASE_URL` was empty when the site was built — set the variable and redeploy |
| Emails don't arrive | check `MAIL_USERNAME`/`MAIL_PASSWORD` (Gmail needs an app password); the app logs a warning per failed send |
| 429 "Too many requests" for everyone | `TRUST_FORWARDED_HEADERS` is `false` behind a proxy, so all users share one IP — set it to `true` on Render |
| Trivy fails the image job | a fixable CRITICAL CVE in the base image or a dependency — bump it (Dependabot opens these PRs) |

## Notes on what has and hasn't been exercised
The workflow files are validated against the GitHub Actions schema and their shell logic (version wait loop, smoke
checks) was run against a locally started instance, but a workflow can only truly run on GitHub — expect to watch the
first run of each and adjust names/URLs if your hosting differs. The Docker images were not built during authoring (no
Docker daemon was available); `docker compose up` and the first `image` job are their first real test.
