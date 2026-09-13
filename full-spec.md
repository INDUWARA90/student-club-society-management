# Student Club & Society Management System — Full Project Spec

Group 2 — Software Engineering module. This single file combines the build prompt, database schema, and UI design tokens so you have everything in one place.

---

# Project build prompt — Student Club & Society Management System

You are building a full-stack group software engineering project. Set up the complete monorepo, backend, and frontend skeleton per the specification below, then implement the modules.

## Project overview
A system for managing university clubs, memberships, activities, and participation. Group 2, software engineering module, group of 4-5 students, full-featured scope. No fixed deadline.

## Tech stack
- **Frontend:** React (Vite) + Redux Toolkit (state) + React Router (routing) + Tailwind CSS (styling) + Axios (HTTP client)
- **Backend:** Spring Boot, Maven, Lombok, plain layered architecture (controller → service → repository, no DDD)
- **Database:** PostgreSQL, schema managed via Hibernate auto-DDL (no Flyway/Liquibase)
- **Auth:** Spring Security with JWT — access token only, no refresh token (user re-logs in on expiry)
- **API docs:** springdoc-openapi (Swagger UI)
- **Email:** Spring Mail (SMTP), sent asynchronously via `@Async`
- **Repo:** monorepo — `/backend` and `/frontend` in one repo
- **Local dev:** Docker Compose (backend + Postgres + frontend containerized)
- **Testing:** JUnit + Mockito (backend), React component tests (frontend) — full coverage expected
- **CI/CD:** GitHub Actions
- **Hosting:** must be entirely free — backend on Render, frontend on Vercel, Postgres on Render free tier
- **Git workflow:** `main` + feature branches, PR review required
- **Task tracking:** GitHub Projects/Issues

## API / code conventions
- DTOs for all request/response bodies — JPA entities never exposed directly via API
- JSON in camelCase matching Java field names
- Backend input validation done manually in the service layer (not Bean Validation annotations)
- API error responses: simple error messages, no fixed envelope/format
- Config and secrets via `application.yml` with `dev`/`prod` profiles
- Images (club logos, event banners, profile pics) stored as **base64 strings in the database** — explicitly NOT local file storage (avoids Render free-tier ephemeral disk wiping uploaded files on redeploy/sleep). Keep images compressed/resized before encoding to avoid database bloat.
- Demo/seed data should be pre-loaded (sample clubs, users, events) for a viva/demo presentation

## Roles
- **Student** — browses/joins clubs, RSVPs and attends events, receives notifications
- **Club Admin** — this is NOT a separately assigned role. It automatically equals whoever holds the **President** position in a club. When the President position changes hands, Club Admin rights transfer automatically. Super Admin cannot override or reassign a club's President — that's entirely internal to the club.
- **Faculty Advisor** — university-wide (not per-club), read-only oversight of all clubs EXCEPT for one functional power: approving events above a certain fee threshold (threshold value to be decided during implementation) before they can be published
- **Super Admin** — creates clubs directly, approves student-proposed clubs, sees university-wide analytics

## Module breakdown (for a 4-5 person team split)

### 1. Auth & user management
- Registration, login, JWT issuance (access token only)
- Forgot-password / reset flow via emailed link
- Role-based access control enforced via method-level `@PreAuthorize`

### 2. Club & membership
- Club creation: **two flows** — Super Admin creates a club directly, OR a student proposes a club which Super Admin must approve
- Clubs have predefined categories/tags (Sports, Academic, Cultural, Tech, etc.)
- Membership joining is **mixed per club**: some clubs are open (auto-join), others require Club Admin approval of a join request
- Club positions: **President, VP, Secretary, Treasurer, Member** — these carry real permissions (e.g. Secretary can post events), not just titles. Positions are assigned manually by the Club Admin (there is NO in-app election/voting feature — that was considered and explicitly removed from scope; assume positions are set by the club admin based on an offline process).
- President = Club Admin automatically (see Roles above)
- Club announcement/post feed — any officer (President/VP/Secretary/Treasurer) can post updates to their club's feed
- Club budget/ledger tracker — tracks income (fees collected via the Payment module) minus manually-logged expenses, giving a running balance per club. Both the Treasurer and the Club Admin (President) can log expenses.
- Students can browse/search/filter clubs (by category etc.)

### 3. Events & attendance
- Event creation tied to a club, with an optional fee
- Events above a Faculty-Advisor-approval fee threshold require Faculty Advisor sign-off before they can be published (threshold configurable, exact value TBD)
- Event capacity limits with a **waitlist** — when a spot opens up (someone drops), the next waitlisted student is auto-promoted
- RSVP feature — students can RSVP before the event, tracked **separately** from attendance
- Attendance tracking on the day via **both** QR-code check-in and manual marking by Club Admin
- Auto-generated PDF attendance certificate for students who meet an attendance threshold in a club (define the threshold sensibly, e.g. configurable per club or a sitewide default)
- Students can browse/search/filter events (by category, date, etc.)

### 4. Payments & notifications
- Simulated payment gateway only — no real money integration — covering both membership fees and event fees
- Notifications via email (Spring Mail, sent async via `@Async`) and in-app notifications
- Notification triggers should cover at minimum: membership approval/rejection, event RSVP confirmation, waitlist promotion, payment confirmation, club announcement posted, password reset

### 5. Analytics & admin dashboard
- Club-level stats (members, events, engagement) for Club Admins
- University-wide stats (across all clubs) for Super Admin and Faculty Advisor

## Data model (finalized — build JPA entities to match this exactly)

A companion `schema.sql` (PostgreSQL DDL) has already been produced as the reference for this data model. The backend uses Hibernate auto-DDL, so `schema.sql` is documentation only — Hibernate will generate the live schema from your `@Entity` classes — but every entity, field, constraint, and relationship below must match it.

**Tables / entities:**
- `users` — id, name, email (unique), password_hash, role (`STUDENT` | `FACULTY_ADVISOR` | `SUPER_ADMIN`), profile_image_b64 (base64), created_at
- `password_reset_tokens` — id, user_id FK, token (unique), expires_at, used, created_at
- `clubs` — id, name, description, category, status (`PENDING`|`APPROVED`|`REJECTED`), join_policy (`OPEN`|`APPROVAL_REQUIRED`), logo_b64 (base64), created_by FK users, created_at
- `memberships` — id, user_id FK, club_id FK, position (`PRESIDENT`|`VP`|`SECRETARY`|`TREASURER`|`MEMBER`, default MEMBER), status (`PENDING`|`APPROVED`|`REJECTED`), joined_at. Unique on (user_id, club_id). **Enforce exactly one PRESIDENT per club** (partial unique index in schema.sql) — this is the Club Admin, derived automatically, never a separate assigned role.
- `events` — id, club_id FK, title, description, banner_b64 (base64), event_date, fee, capacity (nullable = unlimited), requires_fa_approval (bool), approval_status (`NOT_REQUIRED`|`PENDING`|`APPROVED`|`REJECTED`)
- `rsvps` — id, event_id FK, user_id FK, status (`GOING`|`WAITLISTED`|`CANCELLED`), waitlist_order (nullable), rsvp_at. Unique on (event_id, user_id). This table doubles as the waitlist — when a `GOING` row is cancelled, promote the lowest `waitlist_order` row to `GOING`.
- `attendance` — id, event_id FK, user_id FK, method (`QR`|`MANUAL`), marked_at. Unique on (event_id, user_id). Separate from RSVP by design (RSVP = before, attendance = day-of).
- `payments` — id, user_id FK, type (`MEMBERSHIP`|`EVENT`), reference_id (club_id or event_id depending on type), amount, status (`PENDING`|`SUCCESS`|`FAILED`), paid_at — simulated gateway only
- `notifications` — id, user_id FK, channel (`EMAIL`|`IN_APP`), message, is_read, created_at
- `club_announcements` — id, club_id FK, author_id FK users, content, created_at — author must hold an officer position in that club
- `club_expenses` — id, club_id FK, logged_by FK users, description, amount, expense_date, created_at — loggable by Treasurer or Club Admin (President) only
- `certificates` — id, user_id FK, club_id FK, issued_at. Unique on (user_id, club_id) — generated as a PDF on demand once a student crosses an attendance threshold for that club

Key relationships: User 1—N Membership N—1 Club · Club 1—N Event · Event 1—N Rsvp, Event 1—N Attendance · User 1—N Payment/Notification · Club 1—N ClubAnnouncement/ClubExpense.

## UI / design spec

Style: **minimal/clean** (generous whitespace, subtle accents) — not a boring/dated admin-panel look. Full design tokens (colors, typography, shadows, motion) are in the companion `design-tokens.md` file; summary below:

- **Typography:** Poppins (headings 600, body 400)
- **Theme:** light + dark mode with a toggle
- **Shape:** rounded corners, soft shadows (friendly/modern, not flat/sharp)
- **Motion:** subtle transitions, hover lift on cards, skeleton loaders (not spinners) while data loads, smooth page transitions
- **Icons:** Lucide icon set
- **Color:** one shared brand accent plus **distinct accent colors per role** (Student / Club Admin / Faculty Advisor / Super Admin) used for sidebar highlights, badges, and role-specific sections
- **Navigation:** persistent left sidebar on desktop; collapses to a hamburger/drawer menu on mobile
- **Notifications:** bell icon in the header with a dropdown panel for in-app notifications
- **Browsing:** clubs and events shown as **image cards** (using the base64-stored images), not tables — category/status shown as small pill badges
- **Dashboards:** each role lands on a **different, role-specific homepage** after login, with widgets/stats relevant to that role (e.g. Student sees their clubs/upcoming events, Club Admin sees membership requests/budget, Faculty Advisor sees pending event approvals, Super Admin sees university-wide stats and pending club proposals)
- **Quick actions:** joining a club, RSVPing, and logging an expense all happen in **modal dialogs**, not dedicated full pages
- **Empty states:** illustration + friendly message (e.g. "No clubs yet — create one!") rather than a bare text message
- **Search/filtering:** dropdown filters in a toolbar above the club/event grid (not a persistent sidebar filter panel)
- **Admin-facing lists** (member management, pending approvals): card view, consistent with clubs/events — not tables
- **Form validation:** inline field errors as the user types, not only on submit
- **Feedback:** toast/snackbar confirmation on every action's success or error (join club, RSVP, submit, etc.)
- **Breadcrumbs:** shown on nested pages (e.g. Club > Events > Event Detail)
- **Certificates:** accessed via a downloadable PDF button on the student's profile/club page


1. Scaffold the monorepo: `/backend` (Spring Boot + Maven) and `/frontend` (React + Vite), Docker Compose for local dev (Postgres + backend + frontend), `.github/workflows/ci.yml` for GitHub Actions.
2. Backend: entities, repositories, Spring Security + JWT config, Swagger config, `@Async` mail config, package-by-layer structure (`controller/`, `service/`, `repository/`, `entity/`, `dto/`, `config/`, `security/`).
3. Auth module end-to-end (register, login, forgot-password) as the first vertical slice.
4. Then Club & Membership, then Events & Attendance, then Payments & Notifications, then Analytics — matching the team's module split.
5. Seed data loader for demo/viva.
6. Frontend: Vite + Tailwind (using the design tokens spec above) + Redux Toolkit store + React Router shell with sidebar/drawer navigation + Axios instance wired to the backend + dark mode toggle, mobile-responsive layout throughout. Build role-specific dashboard homepages once auth is working, then layer in card-based club/event browsing, modal quick-actions, the notification bell, and empty states as each backend module comes online.

Build incrementally, one module at a time, keeping the layered/DTO conventions above consistent across all modules.
-e 
---

# Database schema (schema.sql)

```sql
-- ============================================================
-- Student Club & Society Management System
-- PostgreSQL schema (reference DDL)
-- Note: the backend uses Hibernate auto-DDL, so this file will
-- not be run directly by the app -- keep it as documentation /
-- a manual reference, and update it if the entities change.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(150) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    role              VARCHAR(20)  NOT NULL DEFAULT 'STUDENT'
                      CHECK (role IN ('STUDENT', 'FACULTY_ADVISOR', 'SUPER_ADMIN')),
    profile_image_b64 TEXT,                 -- base64-encoded profile picture
    created_at        TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- PASSWORD RESET TOKENS
-- ------------------------------------------------------------
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CLUBS
-- ------------------------------------------------------------
CREATE TABLE clubs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    category        VARCHAR(50) NOT NULL,   -- Sports, Academic, Cultural, Tech, ...
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    join_policy     VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                    CHECK (join_policy IN ('OPEN', 'APPROVAL_REQUIRED')),
    logo_b64        TEXT,                   -- base64-encoded club logo
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- MEMBERSHIPS  (position PRESIDENT == Club Admin, auto-derived)
-- ------------------------------------------------------------
CREATE TABLE memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    position    VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
                CHECK (position IN ('PRESIDENT', 'VP', 'SECRETARY', 'TREASURER', 'MEMBER')),
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    joined_at   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (user_id, club_id)
);

-- Only one PRESIDENT per club at a time (enforced via partial unique index)
CREATE UNIQUE INDEX uq_one_president_per_club
    ON memberships (club_id)
    WHERE position = 'PRESIDENT';

-- ------------------------------------------------------------
-- EVENTS
-- ------------------------------------------------------------
CREATE TABLE events (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title                 VARCHAR(150) NOT NULL,
    description           TEXT,
    banner_b64            TEXT,             -- base64-encoded event banner
    event_date            TIMESTAMP NOT NULL,
    fee                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    capacity              INT,              -- NULL = unlimited
    requires_fa_approval  BOOLEAN NOT NULL DEFAULT FALSE,
    approval_status       VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED'
                          CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')),
    created_at            TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- RSVPS  (also carries the waitlist)
-- ------------------------------------------------------------
CREATE TABLE rsvps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'GOING'
                    CHECK (status IN ('GOING', 'WAITLISTED', 'CANCELLED')),
    waitlist_order  INT,                    -- position in queue when status = WAITLISTED
    rsvp_at         TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- ------------------------------------------------------------
-- ATTENDANCE
-- ------------------------------------------------------------
CREATE TABLE attendance (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method      VARCHAR(10) NOT NULL CHECK (method IN ('QR', 'MANUAL')),
    marked_at   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- ------------------------------------------------------------
-- PAYMENTS  (simulated gateway — no real money)
-- ------------------------------------------------------------
CREATE TABLE payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          VARCHAR(20) NOT NULL CHECK (type IN ('MEMBERSHIP', 'EVENT')),
    reference_id  UUID NOT NULL,            -- club_id or event_id depending on type
    amount        NUMERIC(10,2) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    paid_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel     VARCHAR(10) NOT NULL CHECK (channel IN ('EMAIL', 'IN_APP')),
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CLUB ANNOUNCEMENTS  (posted by any officer)
-- ------------------------------------------------------------
CREATE TABLE club_announcements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CLUB EXPENSES / BUDGET LEDGER  (Treasurer or Club Admin)
-- ------------------------------------------------------------
CREATE TABLE club_expenses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    logged_by     UUID NOT NULL REFERENCES users(id),
    description   VARCHAR(255) NOT NULL,
    amount        NUMERIC(10,2) NOT NULL,
    expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- CERTIFICATES  (attendance-based, PDF generated on demand)
-- ------------------------------------------------------------
CREATE TABLE certificates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    issued_at   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (user_id, club_id)
);

-- ------------------------------------------------------------
-- Helpful indexes
-- ------------------------------------------------------------
CREATE INDEX idx_memberships_club   ON memberships(club_id);
CREATE INDEX idx_memberships_user   ON memberships(user_id);
CREATE INDEX idx_events_club        ON events(club_id);
CREATE INDEX idx_rsvps_event        ON rsvps(event_id);
CREATE INDEX idx_attendance_event   ON attendance(event_id);
CREATE INDEX idx_payments_user      ON payments(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_announcements_club ON club_announcements(club_id);
CREATE INDEX idx_expenses_club      ON club_expenses(club_id);
-e 
```

---

# Design tokens — Club & Society Management System

Minimal/clean aesthetic, light + dark mode, rounded/soft-shadow components, Poppins typeface, role-tinted accent colors, sidebar navigation, card-based browsing.

## Typography
```js
fontFamily: {
  sans: ['Poppins', 'system-ui', 'sans-serif'],
}
```
- Headings: Poppins 600 (semibold)
- Body: Poppins 400 (regular)
- Base size: 16px, scale 1.25 (12 / 14 / 16 / 20 / 25 / 31 / 39px)

## Color system (Tailwind config)
```js
colors: {
  // Neutral base (light mode)
  surface: '#FFFFFF',
  'surface-muted': '#F7F7F8',
  border: '#E5E5E8',
  ink: '#18181B',
  'ink-muted': '#71717A',

  // Dark mode base
  'surface-dark': '#121214',
  'surface-dark-muted': '#1C1C1F',
  'border-dark': '#2A2A2E',
  'ink-dark': '#F4F4F5',
  'ink-dark-muted': '#A1A1AA',

  // Shared brand accent (primary actions, links)
  brand: {
    50: '#EEF2FF', 100: '#E0E7FF', 300: '#A5B4FC',
    500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
  },

  // Role accent colors (badges, sidebar highlight, role-specific pages)
  role: {
    student:  '#22C55E', // green  — everyday/participation
    admin:    '#6366F1', // indigo — club admin / president
    advisor:  '#F59E0B', // amber  — faculty advisor / oversight
    super:    '#EF4444', // red    — super admin / system-level
  },

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  danger:  '#EF4444',
  info:    '#3B82F6',
}
```

## Shape & elevation
```js
borderRadius: {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',   // cards
  full: '9999px', // avatars, pills, badges
}
boxShadow: {
  card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
  'card-hover': '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10)',
  sidebar: '1px 0 0 rgba(0,0,0,0.05)',
}
```

## Motion
```js
transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' }
transitionTimingFunction: { standard: 'cubic-bezier(0.2, 0, 0, 1)' }
```
- Cards: lift + shadow increase on hover (`shadow-card` → `shadow-card-hover`, 200ms)
- Buttons: subtle scale (0.98 on press) + background transition
- Route/page transitions: fade + 8px slide-up, 200ms
- Skeleton loaders (not spinners) for card grids while data loads
- Toast notifications slide in from top-right, auto-dismiss

## Layout
- **Sidebar:** persistent left nav, 240px wide, collapses to 64px icon rail on smaller screens; role-colored active-item indicator (uses `role.*` color per logged-in user's role)
- **Content area:** max-width 1280px, generous padding (32px desktop / 16px mobile)
- **Cards:** used for clubs and events — image on top (16:9, base64-decoded), rounded-xl, soft shadow, hover lift; category shown as a small pill badge
- **Dark mode:** class-based toggle (`dark:` variants throughout), persisted in Redux + localStorage-equivalent (React state, since browser storage isn't available in artifacts — for the real app, localStorage is fine)

## Component defaults
- Buttons: rounded-md, Poppins 500, 120ms hover transition, role-accent for primary actions inside that role's section
- Inputs: rounded-md, subtle border, focus ring in `brand.500`
- Badges (position/category/status): rounded-full, soft background tint of the relevant color at 10% opacity with full-strength text
