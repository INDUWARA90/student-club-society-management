# Jira tickets to add manually

Project: **SCRUM** (`student-club-society-management`)
Issue type: **Story**
Status: leave in the default backlog/To Do column — do **not** mark any of these Done.

Batches: **items 1–14** are the earlier feature work; **items 15–27** (under "Second batch") are the workflow & logic hardening pass; **items 28–37** complete that work and add CI/CD.

These mirror the tickets already created via the Atlassian MCP connector (SCRUM-29 through SCRUM-42) for the work completed in this session. Use this if you need to recreate them on another board or hand them to someone else manually.

---

## 1. Security hardening: rate limiting on auth endpoints + configurable CORS origins

Added `RateLimitFilter` (10 req/min per IP on `/api/auth/**`) to stop brute-force/credential-stuffing on login/register/password-reset. Externalized CORS allowed origins via `CORS_ALLOWED_ORIGINS` env var (dev defaults to localhost:5173) instead of a hardcoded value, so a real deployed frontend domain can be used in prod.

Files: `backend/src/main/java/com/club/backend/security/RateLimitFilter.java`, `SecurityConfig.java`, `application.yml`.

## 2. Deployment: Dockerfiles, docker-compose stack, and GitHub Actions CI pipeline

Added `backend/Dockerfile` (multi-stage Maven build) and `frontend/Dockerfile` (Vite build served via nginx), a root `docker-compose.yml` wiring MySQL + backend + frontend with health checks, and `.env.example`. Added `.github/workflows/ci.yml` running backend tests (with a real MySQL service container) and frontend tests/build on every push/PR to main.

## 3. UI modernization: shared component primitives (Button, Card, Badge, Modal, EmptyState, Skeleton, PageHeader)

New `frontend/src/components/ui/` folder with reusable Button/Card/Badge/Modal/EmptyState/Skeleton/PageHeader primitives built on the existing Tailwind design tokens, replacing repeated ad-hoc class strings across pages. Existing key pages (Dashboard, Events, Clubs, Profile, Club Detail) refactored onto these for a consistent modern look.

## 4. New page: Calendar view of all events across every club

New `/calendar` route and `CalendarPage` showing a month grid of every published event across all clubs (reuses existing `GET /api/events` cross-club endpoint, no backend change needed). Event chips color-keyed by club, per-club filter, day click-through to event details, agenda/list view for small screens.

## 5. New page: Notifications Center (full-page notification list)

New `/notifications` route with a full list of the user's notifications (all/unread filter, mark-one-read, mark-all-read), backed by a new `notificationsSlice`. `NotificationBell` header dropdown becomes a short live preview linking to this page, keeping its existing websocket live-push.

## 6. New page: My Certificates

New `/certificates` route listing every certificate a student has earned across clubs (club name + issued date), with a per-certificate Download button that fetches the existing PDF endpoint (`GET /certificates/{id}/download`) as a blob.

## 7. New page: Club Member Directory

New `/clubs/{clubId}/members` route with a searchable/sortable read-only member directory (name, position, status, joined date), linked from the club detail page's Members section. Reuses the existing `GET /clubs/{clubId}/members` endpoint via a new `membershipsSlice`; officer-only controls stay on the existing club detail page unchanged.

## 8. Venue/room booking with conflict detection for events

New `Venue` entity (name, building, capacity, active) managed by Super Admin. Events can optionally book a venue + end time; `EventService` rejects overlapping bookings at the same venue with HTTP 409 (`ApiException.conflict`). New `/api/venues` endpoints (list/create/update, plus a venue's bookings in a date range). Frontend: venue picker + end-time field added to `CreateEventModal` (existing free-text `location` untouched), venue/time range shown on `EventDetailPage`, and a new Super-Admin-only `/admin/venues` management page.

## 9. Venue utilization report (busiest venues / upcoming bookings)

New `GET /api/venues/utilization` returns each active venue's total/upcoming booking counts and next booking, sorted busiest-first. `ManageVenuesPage` gains a "Busiest venues" section above the venue list.

## 10. Auto-suggest next available time slot for venue booking

New `GET /api/venues/{id}/next-available-slot?desiredStart=&durationMinutes=` greedily scans existing bookings to find the next free window. `CreateEventModal` gets a "Check availability" button once a venue + start time are chosen, offering to fill in the suggested time.

## 11. Bulk certificate issuance for event attendees

New `POST /api/clubs/{clubId}/events/{eventId}/certificates/bulk-issue` (officer-only) sweeps every attendee of an event through the existing `checkAndIssueCertificate` eligibility/dedup logic and returns a tally (issued / already had one / not yet eligible). Button added to `EventDetailPage` for officers.

## 12. Alumni directory

Adds nullable `graduationYear` to `User` (settable via existing profile-update flow). New `GET /api/users/alumni` lists users whose graduation year is in the past. New `/alumni` page lists them; "Alumni" is derived from the year field, not a new Role/status, so it can't affect existing permission checks.

## 13. Discussion threads on events

New `EventComment` entity/endpoints (`/api/events/{eventId}/comments`), mirroring the existing `AnnouncementComment` pattern exactly: any approved club member can post, author or club president can delete, listing is public. New "Discussion" section on `EventDetailPage`, separate from the existing star-rating feedback.

## 14. Club resource library (shared documents per club)

New `ClubResource` entity storing uploaded files as base64 (same convention as `Club.logoB64`/`Event.bannerB64` — no new storage mechanism). Officer-only upload, public listing, uploader-or-president delete, via `/api/clubs/{clubId}/resources`. New "Resources" section on `ClubDetailPage` for constitution/minutes/etc.

---

# Second batch — workflow & logic hardening

Stories 15–27 cover the backend workflow/logic review (missing pieces and logic holes, not UI styling); stories 28–37 finish everything that review left open and add the deployment pipelines. They are **not** in Jira yet — the SCRUM-29…SCRUM-42 tickets above only cover items 1–14. Same rules apply: issue type **Story**, leave in the default backlog/To Do column, do not mark Done until the matching section of `MANUAL_TEST_PLAN.md` has been run.

Suggested Jira **epic** for the batch: *Workflow & logic hardening*. Suggested labels: `backend`, `security`, `workflow`. Suggested order of work (most risk removed first): 15 → 18 → 22 → 23 → 16 → 17 → 19 → 34/35 → the rest.

Test-plan references are to `MANUAL_TEST_PLAN.md` sections. Automated coverage: backend tests grew from about 105 to 315 (41 of them integration tests on a real MySQL), all passing (rewritten `*ServiceTest` classes plus new `CheckInTokenServiceTest`, `LoginAttemptServiceTest`, `RateLimitFilterTest`, `JwtAuthenticationFilterTest`, `NotificationServiceTest`, `PageSupportTest`) and a scripted 66-check live run against a scratch MySQL database (concurrent RSVPs, refunds, hand-offs, lockout, token revocation).

## 15. Concurrency-safe RSVPs and a waitlist that stays correct

Every write service is now `@Transactional` (there were none, so multi-step actions could half-complete). RSVP and cancel lock the event row, so two people can no longer both take the last seat. Waitlist fixes: a cancelled RSVP can be re-created (it was a permanent 409), waitlist positions are renumbered 1..n after any cancellation (new joiners used to get `size+1`, producing duplicates), and raising an event's capacity — or removing the limit — promotes waitlisted people in order. RSVPs are refused for started, cancelled, unapproved or inactive-club events.

Files: `RsvpService`, `EventRules` (new), `EventRepository.findByIdForUpdate`, `EventService.updateEvent`. Test plan: 6.12, 6.15–6.17, 5.25, 18.5, 18.10.

## 16. Payments gate participation and can be refunded

Fee events now require a successful payment before the RSVP is accepted; clubs get a `membershipFee` that must be paid before joining (the amount is always derived server-side — the trusted client amount for membership payments is gone). Payments gain `refundedAt`: refunded automatically when an RSVP is cancelled before the event starts, when an event is cancelled (everyone who paid), and when a join request is rejected, withdrawn or declined. Refunded payments are excluded from the ledger, club stats and the university "Payments collected". Also fixes the "Payment of null confirmed" notification.

Files: `PaymentService`, `PaymentRepository`, `Payment`, `Club.membershipFee`, `MembershipService`, `RsvpService`. Test plan: 3.21–3.22, 6.13–6.14, 8.2, 8.7–8.9.

## 17. Event lifecycle: cancel, safer edits, approval resubmission, change notifications

New `POST /api/events/{id}/cancel` (any officer): notifies everyone signed up, refunds all payments, frees the venue slot, is audited, and shows as "Cancelled" in the UI and `.ics`. Editing rules: an approved event stays live unless the edit *raises* the approved fee; a rejected event is resubmitted by editing it (rejection reason cleared, advisors re-notified); the fee is locked once anyone has RSVP'd or paid; capacity can't drop below confirmed RSVPs; date/time/venue/location changes notify attendees. Creation rules: date must be in the future, club must be active, fee/capacity validated, venue capacity caps the event. Faculty Advisors are notified of pending events and can give a rejection reason. Unpublished events are only visible to officers and staff. `.ics` uses the real end time and escapes text.

Files: `EventService`, `EventController`, `Event` (`cancelled`, `cancelReason`, `rejectionReason`), `EventResponse`, `EventDetailPage`, `PendingEventsPage`, `EventsPage`. Test plan: 5.6, 5.10, 5.16–5.30.

## 18. Membership governance: a club can never lose its President

Fixes: the President can no longer demote themselves (club left without an admin); the one-President rule is now also enforced by a database unique index (`memberships.president_club_id`) and position changes run at READ_COMMITTED behind a club row lock, so concurrent hand-offs give one 200 and one 403 — never two Presidents or a 500. Joining a pending/rejected/archived club is refused; rejected applicants can re-apply; the President is notified of join requests; President can remove members (`DELETE /api/memberships/{id}`); position changes and removals notify the member and are audited; CSV export neutralises spreadsheet formulas.

Files: `MembershipService`, `Membership`, `MembershipController`, `GlobalExceptionHandler` (constraint conflicts → 409), `ClubDetailPage`. Test plan: 3.1, 3.9, 3.15, 3.19–3.30.

## 19. Attendance integrity: rotating QR tokens, check-in window, RSVP-only events

The check-in QR previously encoded only the event id, so anyone could check in remotely at any time. It now embeds an HMAC token that rotates every 5 minutes (current + previous window accepted); the on-screen QR refreshes itself every 2 minutes. Check-in is limited to the event window (until its end time, or 6 hours after start), capacity-limited events require a confirmed RSVP, cancelled events are refused. The QR image is officers-only; the attendance list shows officers/staff everyone and students only their own record. The student "QR check-in" button (which could no longer work) was replaced by guidance text.

Files: `CheckInTokenService` (new), `AttendanceService`, `EventService.generateQrCode`, `EventCheckInPage`, `EventDetailPage`. Test plan: 5.10, 7.3, 7.6, 7.9–7.13, 27.2–27.4, E2E-16.

## 20. Certificates: per-club threshold, membership required, public verification

The hard-coded threshold of 3 is now per club (`Club.certificateThreshold`, editable by the President, default 3). Only approved members can earn a certificate. Each certificate gets a verification code printed on the PDF, with a public page (`/verify-certificate/{code}`, `GET /api/certificates/verify/{code}`, no login) that confirms holder, club and date. Members are notified when a certificate is issued. The PDF no longer fails on non-Latin names.

Files: `CertificateService`, `Certificate.verificationCode`, `CertificateController`, `VerifyCertificatePage` (new). Test plan: 11.4–11.8, 27.10.

## 21. Club finance: audit trail, editable expenses, categories, event links, date ranges

Deleting an expense now writes a `DELETE_EXPENSE` audit entry first; expenses can be edited (`PUT`, audited), logged (audited), categorised, back-dated (not future-dated) and linked to one of the club's events; validation added (amount cap, description length). `GET /ledger?from=&to=` filters expenses and income by period. Log-expense dialog gains Category and Date.

Files: `ClubExpenseService`, `ClubExpenseController`, `ClubExpense`, `LogExpenseModal`. Test plan: 9.4, 9.6–9.10.

## 22. Account & API security hardening

Email verification is now enforced for joining, RSVPs, payments and proposing clubs (`REQUIRE_EMAIL_VERIFICATION`, on by default in prod). Per-account login lockout (5 failures → 15 min) on top of the IP limiter. Password change/reset revokes older JWTs (`passwordChangedAt`), and change-password returns a fresh token so the current session survives. The rate limiter now covers only the abuse-prone auth routes (not `/auth/me`), evicts expired windows, and ignores `X-Forwarded-For` unless `TRUST_FORWARDED_HEADERS=true`. Unexpected errors no longer echo exception text; malformed input returns 400; database constraint races return 409.

Files: `EmailVerificationPolicy` (new), `LoginAttemptService` (new), `AuthService`, `JwtAuthenticationFilter`, `JwtService`, `RateLimitFilter`, `GlobalExceptionHandler`, `ProfilePage`. Test plan: 1.3, 1.24–1.33, 18.9.

## 23. Deployment safety: no default admin, no unattended schema changes

The demo seeder used to run on any empty database — including production, creating `superadmin@example.com` / `password123`. It is now opt-in (`SEED_DEMO_DATA`, on for dev and the local docker-compose stack, off for prod). New `AdminBootstrapper` creates the first Super Admin from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (12+ chars) when none exists. The prod profile defaults to `ddl-auto: validate` (superseded by Flyway migrations — see 34); `.env.example` and `docker-compose.yml` document the switches. New columns use booleans/timestamps rather than new enum values, so existing MySQL enum columns don't need altering.

Files: `DataSeeder`, `AdminBootstrapper` (new), `application.yml`, `docker-compose.yml`, `.env.example`. Test plan: section 26.

## 24. Notifications: asynchronous fan-out, email preference, approver reminders

Announcements (and cancellations, changes, archive notices) fan out on a background thread instead of writing N rows and queuing N emails inside the request. Users can turn off email for their notifications (in-app ones are always kept) from their profile. A daily 09:00 job reminds Faculty Advisors of pending events and Super Admins of pending club proposals; the 08:00 event reminder now skips unpublished and cancelled events.

Files: `NotificationService`, `EventReminderScheduler`, `User.emailNotificationsEnabled`, `ClubAnnouncementService`. Test plan: 1.30, 12.8–12.9, 5.20, 2.16.

## 25. Club lifecycle: archive/unarchive, unique names, rejection reasons

A club can now be closed: `POST /api/clubs/{id}/archive` (President or Super Admin) hides it from browsing, blocks joins and new events, cancels upcoming events with refunds, and notifies members while keeping history; `POST …/unarchive` is Super-Admin-only. Club names are unique (case-insensitive) on create and rename. Super Admin rejections can carry a reason that reaches the creator; Super Admins are notified of new proposals.

Files: `ClubService`, `ClubController`, `Club.archived`, `ClubDetailPage`, `CreateClubModal`. Test plan: 2.13–2.21, E2E-15.

## 26. Scalability & discovery: aggregate analytics, filters, optional pagination

University analytics use `COUNT`/`SUM` queries instead of loading every event and payment. Events list gains filters (`q`, `category`, `from`, `to`) and is sorted soonest-first; clubs gain `q`. Optional `page`/`size` with an `X-Total-Count` header on events, clubs, members, notifications, payments and audit logs (omitting `size` keeps today's behaviour; slicing is in-memory for now, so it caps payload size rather than database work). Club analytics add attendance rate, average rating and per-event RSVP-vs-attendance (no-shows).

Files: `AnalyticsService`, `ClubStatsResponse`, `PageSupport` (new), list controllers, `EventService.listPublishedEvents`. Test plan: 2.21, 5.30, 14.7–14.8, 18.4.

## 27. Test coverage for the hardening work

Rewrote and extended the service tests (RSVP/waitlist, payments/refunds, membership governance, events, attendance, certificates, expenses, clubs, auth) and added tests for the check-in token, login lockout, rate limiter, JWT revocation filter, notifications and pagination. The Spring context (including every new derived query and the new entity mappings) was started against a scratch database, and a 66-check scripted run exercised the real HTTP API end to end.

Follow-ups that were listed here (real database pagination, generic registration responses, per-event budgets, comment reporting, Flyway) are done — see stories 28–34; stories 35–37 cover the bug found on the way, the integration test suite and the CI/CD pipelines.

## 28. Registration reveals nothing about existing accounts

When email verification is required (production), `POST /api/auth/register` now answers **202 with the same neutral message** whether or not the address is already registered, and issues no session. A new address gets the verification link; an existing owner gets a "you already have an account" email with sign-in and reset links; no duplicate is created. The React register page shows a matching "Check your email" screen. In dev mode (verification off) the old immediate sign-in and plain 409 are kept. Closes the last known account-enumeration hole (login and forgot-password were already neutral).

Files: `AuthService.register`, `AuthController`, `AuthResponse.pending()`, `MailService.sendAccountExistsEmail`, `RegisterPage`, `authSlice`. Test plan: 1.2, 1.34, 27.11.

## 29. Database-side filtering and pagination

Event and club lists are now built with JPA Specifications: filtering (text in title/description, category, club, date window; approved/non-archived clubs and published events only), sorting and `X-Total-Count` are done in SQL, and `?size=&page=` returns a real database page (member, notification, payment and audit-log lists use `Pageable` queries too). Omitting `size` keeps the old full-list behaviour, so the UI is unchanged. Search treats `%` and `_` literally. University analytics already used aggregate queries.

Files: `EventSpecifications`, `ClubSpecifications`, `EventService`, `ClubService`, `MembershipService`, `NotificationService`, `PaymentService`, `AuditLogService`, `PageSupport`, list controllers. Test plan: 3.35, 5.32, 18.4, 2.21, 5.30.

## 30. Event budgets and per-event ledger lines

Events get an optional `budget`; expenses already link to events, so the ledger now returns `eventBudgets` — for each event with a budget or any money movement: budget, spent, fees in, remaining. The Create event dialog gains a Budget field and the club page shows the per-event table (overspend in red).

Files: `Event.budget`, `CreateEventRequest`/`EventResponse`, `ClubLedgerResponse.EventBudgetLine`, `ClubExpenseService.computeLedger`, `CreateEventModal`, `ClubDetailPage`. Test plan: 5.31, 9.11, 27.14.

## 31. Comment reporting and moderation queue

Any club member can report an announcement or event comment (with a reason); the President is notified and reviews a queue on the club page: dismiss the report, or remove the comment — which also closes every other open report on it. Reports snapshot the comment text and author so the audit trail survives deletion. Guarded against self-reports, non-members, duplicates and cross-club ids.

Files: `CommentReport` (new table), `CommentReportService`, `CommentReportController`, `AnnouncementComments`, `EventComments`, `ClubDetailPage`. Test plan: section 28, 27.12, E2E-17.

## 32. President succession when the President graduates

A President who marks themselves as graduated notifies the club's officers; the Vice President (or, in a club with no VP, the Secretary/Treasurer) can then `POST /api/clubs/{id}/claim-presidency`. Refused while the President is still a student, so it can't be used to oust one; a Super Admin still cannot reassign a President. Runs behind the same club lock and READ_COMMITTED isolation as manual hand-offs, so simultaneous claims produce one winner and never two Presidents.

Files: `MembershipService.claimPresidency`, `AuthService.updateProfile`, `MembershipController`, `ClubDetailPage`. Test plan: 3.31–3.34, 27.13, E2E-18.

## 33. Daily email digest

New profile option to receive one daily digest email (18:00) of the last 24 hours of notifications instead of an email per notification; in-app notifications are unchanged and quiet days send nothing.

Files: `User.emailDigestEnabled`, `NotificationService.sendDailyDigests`, `MailService.sendDigestEmail`, `EventReminderScheduler`, `ProfilePage`. Test plan: 1.35, 12.10, 27.15.

## 34. Flyway migrations replace Hibernate auto-DDL

The schema is now owned by versioned migrations (`db/migration`): V1 = the original schema (column-for-column what existing dev databases have), V2 = venues/resource library/event comments/alumni, V3 = the hardening work — V2 and V3 are idempotent so they are safe on databases Hibernate already upgraded. Existing databases are baselined at V1 automatically; Hibernate only validates (`ddl-auto: validate`), so an entity change without a migration fails fast. Verified on an empty database, on a Hibernate-upgraded database, and on a clone of the real dev database (all rows and Presidents preserved).

Files: `db/migration/V1…V4`, `application.yml`, `spring-boot-starter-flyway`, `docker-compose.yml`, `.env.example`. Test plan: 26.3, 26.8, section 30.

## 35. Bug: images and long text could not be stored (tinytext columns)

Hibernate 7 created every `@Lob @Column` text field on MySQL as `tinytext` (255 bytes): club logos, event banners, profile pictures, resource-library files, announcement and comment bodies and notification text. Anything realistic failed to save. Fixed in the entity mappings and by V3 (`MODIFY … longtext`, which also repairs existing databases), with server-side limits (images about 2 MB, files about 10 MB, announcements 5,000 and comments 2,000 characters, notifications clipped) returning clear 400s instead of database errors. Regression tests store a ~200 KB image and a ~4 KB announcement.

Files: entity `@Column(length = Length.LONG32)`, `InputLimits`, V3 migration. Test plan: 18.2, 30.2.

## 36. Integration tests against a real MySQL, and more frontend tests

41 integration tests run the whole application on a dedicated test database (same Flyway migrations, wiped per test, refuses to touch any database whose name lacks "test"): every role/route rule through the real filter chain (401/403, forged and revoked tokens, CORS), real-thread races (simultaneous RSVPs, simultaneous cancellations, concurrent President hand-offs and claims, the unique-President constraint), database filters and paging, aggregate queries, and end-to-end workflows (registration to club approval, paid events and every refund path, membership fees, QR check-in, comment moderation, archiving, oversized input). They found a real production bug during development (DB-side search on LOB columns). Backend total 315 tests; frontend 22 (new: check-in page, public certificate page, registration screen, club fee/threshold form).

Files: `src/test/java/com/club/backend/integration/*`, `application-test.yml`, frontend `*.test.jsx`. Test plan: 26.10, 29.3.

## 37. Separate CI/CD pipelines for backend and frontend, with deployment

`backend.yml` (path-filtered): MySQL-backed test job → Docker image to GHCR with Trivy scan → deploy to Render via deploy hook → waits until `/api/health` reports the exact commit as UP → smoke-tests the live API. `frontend.yml` (path-filtered): lint, tests, build, `npm audit` → Vercel PR previews (commented on the PR) → production deploy with a live smoke test (including SPA deep links) → optional nginx image. Production deploys sit behind a `production` environment (optional required reviewers), never overlap and never cancel mid-flight; missing secrets skip deployment with a visible warning instead of failing. Supporting work: public `/api/health` (DB check + deployed version), hardened backend Dockerfile (non-root, health check, container-aware JVM, `PORT` support), nginx and Vercel security headers/SPA fallback/caching, `render.yaml` blueprint, Dependabot, `docs/DEPLOYMENT.md` (setup, first release, rollback, troubleshooting). The old combined `ci.yml` was replaced.

Files: `.github/workflows/backend.yml`, `.github/workflows/frontend.yml`, `.github/dependabot.yml`, `render.yaml`, `backend/Dockerfile`, `frontend/nginx.conf`, `frontend/vercel.json`, `docs/DEPLOYMENT.md`, `HealthController`. Test plan: section 29, 26.9, 26.11, E2E-19.

Note for the team: workflow YAML was schema-validated and the deploy scripts' shell logic was exercised against a locally started instance, but GitHub Actions and the Docker images could not be run during authoring — watch the first run of each pipeline.

## 38. Project-proposal gaps closed: user management, richer reports, participation history, backups, accessibility

Checked the app against `PROJECT_PROPOSAL new.pdf` and closed what was missing.

- **UC02 / US14 Manage users (Super Admin):** `GET/POST /api/admin/users`, `PUT /api/admin/users/{id}`, `POST …/{id}/deactivate|activate`, page `/admin/users` (search, role filter, paging, create, edit name/email/role, deactivate/reactivate). New `users.active` column (V4). A deactivated account can't sign in (checked after the password, so it isn't revealed to guessers) and its existing tokens stop working immediately. Guard rails: you can't change or deactivate yourself and the last active Super Admin can't be demoted or deactivated. Every action is written to the audit log.
- **UC12 Cancel membership:** "Leave club" now asks for confirmation.
- **UC11/UC13 Reports:** club CSV/PDF gain "Club information", "Activities and participation" (per event: going, attended, no-shows, rating) and, for officers/staff only, "Members"; the university report lists each approved club with its member and event counts. The PDF is now multi-page tables, safe for non-Latin text. CSV escaping moved to a shared `CsvSupport`.
- **Student participation view:** `GET /api/attendance/me` and page `/participation` ("My participation").
- **NFR11 Backups:** compose `backup` service running `scripts/backup.sh` (daily gzipped dump, verified complete, newest 14 kept) and `scripts/restore.sh`; `docs/DEPLOYMENT.md` "Backups" also covers managed-MySQL backups.
- **NFR10 Accessibility:** skip-to-content link, dialogs move/trap/restore focus, error toasts are announced as alerts.

Files: `UserAdminController/Service`, `MyAttendanceController`, `AnalyticsService`, `CsvSupport`, `V4__user_active_flag.sql`, `UserManagementPage`, `MyParticipationPage`, `Modal`, `AppLayout`, `scripts/*.sh`, `docker-compose.yml`, `.gitattributes`, `docs/DEPLOYMENT.md`. Test plan: section 31.

Note for the team: the backup container and restore script could not be run against Docker during authoring (Docker Desktop was not running); the script's dump/verify/prune logic was exercised locally with a stand-in `mysqldump`. Try `docker compose up` and section 31.21–31.24 once.

---

### How to add these manually in Jira

1. Open the `SCRUM` project → Backlog.
2. Create issue → type **Story** → paste the heading as the **Summary** and the paragraph below it as the **Description**.
3. Leave **Status** at its default (To Do) — don't move any of these to Done.
4. Repeat for all 38 (items 1–14 mirror SCRUM-29…SCRUM-42 if those already exist; items 15–38 are new).
