# Manual Test Plan — Student Club & Society Management System

Covers every role, every feature area, and the end-to-end flows that tie them together. Use the seeded demo accounts (`backend/Seed.sql`, password `password123` for all) unless a scenario says to register a fresh user.

| Account | Global role | Club position |
|---|---|---|
| `superadmin@example.com` | SUPER_ADMIN | — |
| `advisor@example.com` | FACULTY_ADVISOR | — |
| `alice@example.com` | STUDENT | PRESIDENT — Tech Innovators; MEMBER — Creative Arts |
| `bob@example.com` | STUDENT | VP — Tech Innovators |
| `carol@example.com` | STUDENT | MEMBER — Tech Innovators |
| `dave@example.com` | STUDENT | PRESIDENT — Creative Arts Society |

**Configuration switches used below** (see section 26): `REQUIRE_EMAIL_VERIFICATION`, `SEED_DEMO_DATA`, `JPA_DDL_AUTO`, `TRUST_FORWARDED_HEADERS`, `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`. Local dev and `docker compose` default to demo data on and email verification off.

Many checks below need the real dates to be in the future/past: the seed data's events may already be in the past, so create fresh events when a scenario needs an upcoming one.

Load seed data: `mysql -u root -p club_management < backend/Seed.sql` (after Hibernate has created the schema).

Legend: ✅ expected success, 🚫 expected rejection (403/401/400/404 as noted).

---

## 1. Authentication & Account (`/api/auth/**`)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1.1 | Register new student | Register with a fresh email/password | ✅ Account created as `STUDENT`, `email_verified=false`, verification email sent |
| 1.2 | Duplicate email registration | Register again with an address that already has an account | Dev / `REQUIRE_EMAIL_VERIFICATION=false`: 🚫 409 "An account with this email already exists". Production / `true`: **the same neutral 202** as a brand-new address (see 1.34) — the existing owner gets a "you already have an account" email instead. Both are correct for their mode |
| 1.3 | Login before verifying email | Try to log in immediately after 1.1 | ✅ Login succeeds (the account exists). With `REQUIRE_EMAIL_VERIFICATION=true` (default in the `prod` profile) joining clubs, RSVPs, payments and proposing clubs are refused with 403 "Please verify your email address first…" until 1.4 is done; with `false` (default for local dev / docker-compose) they are allowed. Test both settings — **fixed**: `emailVerified` used to be stored but never enforced anywhere |
| 1.4 | Verify email | Click/paste the verification token from the email into `/verify-email` | ✅ `email_verified=true` |
| 1.5 | Resend verification | As an unverified logged-in user, call resend | ✅ New email sent |
| 1.6 | Expired/invalid verification token | Use a garbage or already-used token | 🚫 400/404 |
| 1.7 | Login success | Correct email/password | ✅ JWT returned |
| 1.8 | Login wrong password | Correct email, wrong password | 🚫 401 |
| 1.9 | Login unknown email | Non-existent email | 🚫 401 (not "user not found" — check it doesn't leak which part was wrong) |
| 1.10 | Forgot password | Submit known email to `/forgot-password` | ✅ Reset email sent |
| 1.11 | Forgot password unknown email | Submit unregistered email | Should still return 200 (no user enumeration) — verify |
| 1.12 | Reset password | Use token from 1.10 to set new password | ✅ Old password no longer works, new one does |
| 1.13 | Reset password expired/reused token | Reuse the same token twice | 🚫 second attempt fails |
| 1.14 | Get current user | `GET /auth/me` while logged in | ✅ Correct profile returned |
| 1.15 | Get current user unauthenticated | Call `/auth/me` with no/invalid token | 🚫 401 |
| 1.16 | Update profile | Change name via `/auth/me/profile` | ✅ Reflected everywhere (announcements, comments, member lists) |
| 1.17 | Update profile image | Upload a base64 image | ✅ Shows on profile |
| 1.18 | Change password | Provide correct current password + new one | ✅ Can log in with new password |
| 1.19 | Change password wrong current password | Provide incorrect current password | 🚫 400/401 |
| 1.20 | Change email (if supported via profile update) | Update email | ✅ Triggers re-verification flow (per commit history: "email verification on registration and email change") |
| 1.21 | Token expiry / tampering | Wait for JWT to expire, or edit the token | 🚫 401 on any protected call |
| 1.22 | CORS from frontend origin | Load the app at `http://localhost:5173` and hit any API | ✅ No CORS console errors (this was the bug just fixed — regression-test it) |
| 1.23 | CORS origin is env-configurable | Set `CORS_ALLOWED_ORIGINS` to a different value and restart the backend | ✅ Only that origin is allowed; the old hardcoded `localhost:5173` is no longer special-cased in code |
| 1.24 | Auth rate limiting | Hit `POST /auth/login` (or `register`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`) more than 10 times within a minute from the same IP | 🚫 11th+ request returns 429 "Too many requests, please try again later." Each path has its own budget |
| 1.25 | Rate limit does not affect other endpoints | After tripping 1.24, immediately call an unrelated endpoint (e.g. `GET /clubs`) and the authenticated auth routes (`GET /auth/me`, `PUT /auth/me/password`) | ✅ All succeed normally — **fixed**: the limiter used to cover every `/api/auth/**` route including `/auth/me`, and its counters were never evicted (memory leak); expired windows are now purged every minute |
| 1.26 | Rate limit window resets | Wait 60+ seconds after tripping 1.24, retry login | ✅ Allowed again |
| 1.27 | Per-account lockout | Submit 5 wrong passwords for the same email (space them out or use different IPs so the 10/min IP limit isn't what you hit), then the **correct** password | 🚫 429 "Too many failed sign-in attempts. Please try again in a few minutes." for 15 minutes even with the right password; an unknown email locks the same way (no account enumeration); a successful login before the 5th failure resets the counter |
| 1.28 | Password change revokes other sessions | Log in as the same user in two browsers (A and B). In A: Profile → change password | ✅ A stays signed in (the response carries a fresh token that the page stores automatically). B's next request gets 401 and is sent to login; the pre-change token returns 401 on `GET /auth/me` (allow ~1 s) — **fixed**: old JWTs used to stay valid for up to an hour |
| 1.29 | Password reset revokes sessions | Reset a password via the emailed link (1.12) while another browser is logged in | ✅ The other browser's token stops working; logging in with the new password works |
| 1.30 | Email notification opt-out | Profile → untick "Email me my notifications" → Save, then trigger a notification (e.g. an announcement in your club) | ✅ The in-app notification still appears; no email is sent. Re-tick to restore |
| 1.31 | Rate limiter ignores spoofed headers | Send 11 logins from one machine with a different `X-Forwarded-For` value each time (curl `-H`) with `TRUST_FORWARDED_HEADERS=false` | 🚫 Still 429 on the 11th — the header is only honoured behind a trusted proxy (`TRUST_FORWARDED_HEADERS=true`) |
| 1.32 | Errors don't leak internals; bad input is 400 | Send malformed JSON, a non-UUID in a path (`/clubs/abc`), `GET /events?from=not-a-date`; force a server fault (e.g. stop MySQL) | ✅ Client mistakes → 400 "Invalid request"; a server fault → generic "Something went wrong. Please try again." with **no exception text** (used to echo `ex.getMessage()`) |
| 1.33 | Unverified user is gated (enforcement on) | With `REQUIRE_EMAIL_VERIFICATION=true`, as an unverified user try: join a club, RSVP, pay, propose a club | 🚫 403 "Please verify your email address first" on each; after 1.4 all succeed. Browsing, profile and notifications keep working |
| 1.34 | Registration reveals nothing (verification required) | With `REQUIRE_EMAIL_VERIFICATION=true`: register a new address, then the same address again (also in a different letter case) | 🚫 no token in either case; both return **202** with the identical body `{"message":"Check your email to finish creating your account."}`; the UI shows a "Check your email" screen. A new address gets a verification link; the existing owner gets "You already have an account" (with sign-in / reset links). No second account is created. Invalid input (blank name, bad email, short password) still gets a helpful 400 — **fixed**: registration used to disclose which emails are registered |
| 1.35 | Daily digest preference | Profile → tick "Send one daily digest instead of an email for each notification" (needs "Email me my notifications" on) → Save; trigger several notifications | ✅ In-app notifications appear immediately; **no per-notification emails**; the 18:00 job sends one digest email listing the last 24 h (nothing is sent on a quiet day). Turning email off entirely sends nothing |

---

## 2. Clubs (`/api/clubs/**`)

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 2.1 | Create club | Any logged-in student | `POST /clubs` with name/description/category/joinPolicy | ✅ Club created with status `PENDING`; creator auto-becomes `PRESIDENT` |
| 2.2 | List approved clubs | Anyone | `GET /clubs` | ✅ Only `APPROVED` clubs shown; new pending club from 2.1 NOT listed |
| 2.3 | Filter clubs by category | Anyone | `GET /clubs?category=Tech` | ✅ Only matching category |
| 2.4 | View club detail | Anyone | `GET /clubs/{id}` | ✅ Works for approved club; check behavior for pending/unknown id (404?) |
| 2.5 | Update club info (no identity change) | President, editing only description/join policy/logo | `PUT /clubs/{id}` | ✅ Success, club stays `APPROVED` |
| 2.5b | Rename or recategorize an approved club | President changes `name` or `category` on an `APPROVED` club | `PUT /clubs/{id}` | ✅ Saved, but status reverts to `PENDING` and disappears from `GET /clubs` until `superadmin` re-approves; president is notified — **fixed**: previously a president could silently rename a club to anything post-approval with zero re-review |
| 2.6 | Update club info as non-president | A `MEMBER` or outsider | `PUT /clubs/{id}` | 🚫 Forbidden |
| 2.7 | List pending clubs | `superadmin` | `GET /clubs/pending` | ✅ Shows club from 2.1 |
| 2.8 | List pending clubs as non-admin | `alice` or `advisor` | Same call | 🚫 403 |
| 2.9 | List all clubs (any status) | `superadmin` and `advisor` | `GET /clubs/all` | ✅ Both roles succeed; a student gets 🚫 403 |
| 2.10 | Approve club | `superadmin` | `POST /clubs/{id}/approve` | ✅ Status → `APPROVED`; now appears in `GET /clubs`; creator notified |
| 2.11 | Reject club | `superadmin` | `POST /clubs/{id}/reject` on a different pending club | ✅ Status → rejected; does not appear publicly; creator notified |
| 2.12 | Approve/reject as non-superadmin | `advisor` or `alice` | Call approve/reject | 🚫 403 |
| 2.13 | Duplicate club name | Any student / President | Create a club, or rename one, to an existing name (any letter case) | 🚫 409 "A club with this name already exists" — **fixed**: duplicates used to be allowed |
| 2.14 | Fee / threshold validation | President or creator | President or creator sends `membershipFee` of -5 or 100001, and `certificateThreshold` of 0 or 101 | 🚫 400 "Membership fee must be between 0 and 100000" / "Certificate threshold must be between 1 and 100" |
| 2.15 | Set membership fee and certificate threshold | President | President: Edit club → "Membership fee" and "Events for certificate" → Save | ✅ Saved without re-approval (not an identity change); returned on `GET /clubs/{id}`; leaving the fields out of an update keeps the existing values; the Join button now reads "Join club (fee N)" |
| 2.16 | Super Admins are told about proposals | Student / `superadmin` | A student proposes a club (2.1); rename/recategorize an approved club (2.5b) | ✅ Every Super Admin gets an in-app notification ("New club proposal awaiting review…" / "…needs re-approval"); a daily 09:00 reminder repeats while proposals are pending |
| 2.17 | Rejection reason | `superadmin` | `superadmin`: `POST /clubs/{id}/reject` with body `{"reason":"Overlaps with the Games society"}` | ✅ Creator's notification ends with "Reason: Overlaps with the Games society"; sending no body still works |
| 2.18 | Archive a club (President) | President | President: club page → "Archive club" (or `POST /clubs/{id}/archive`) | ✅ `archived=true`; club disappears from `GET /clubs` and from event lists; **upcoming events are cancelled** (attendees notified, paid fees refunded); every approved member is notified; joining is refused (400 "not accepting members"); members, ledger and certificates remain readable; audit entry `ARCHIVE_CLUB`; the page shows an "archived" banner |
| 2.19 | Archive permission and repeat | Plain member / VP / `superadmin` | Plain member / VP tries; `superadmin` archives any club; archive an already archived club | 🚫 403 "Only the Club Admin or a Super Admin can archive a club" for members; ✅ Super Admin allowed even without membership; 🚫 400 "already archived" on repeat |
| 2.20 | Unarchive | `superadmin` / President | `superadmin`: `POST /clubs/{id}/unarchive`; then try as the President | ✅ Super Admin restores the club to browsing (cancelled events stay cancelled); 🚫 403 for the President; audit `UNARCHIVE_CLUB` |
| 2.21 | Club search and pagination | Anyone | `GET /clubs?q=chess`, `?category=Tech&q=robot`, `?size=5&page=1`, no `size` | ✅ Case-insensitive match on name or description; archived clubs never listed; with `size` you get that page and an `X-Total-Count` header (size capped at 200); without `size` the full list is returned as before |

---

## 3. Memberships (`/api/clubs/{id}/join`, `/api/memberships/**`)

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 3.1 | Join a club | Student (e.g. `dave` joining Tech Innovators) | `POST /clubs/{id}/join` | ✅ `OPEN` club → membership immediately `APPROVED`; `APPROVAL_REQUIRED` → `PENDING` **and the President gets an in-app notification** ("<name> asked to join … — review the request") — **fixed**: presidents used to have to poll the pending list |
| 3.2 | Join club twice | Same student, same club, call join again | 🚫 Conflict — already a member/pending |
| 3.3 | List pending requests | President (`alice`) | `GET /clubs/{id}/members/pending` | ✅ Sees 3.1's request |
| 3.4 | List pending requests as non-president | `bob` (VP) or `carol` (member) | Same call | 🚫 Forbidden (per `MembershipService` — only `PRESIDENT` reviews) |
| 3.5 | Approve join request | President | `POST /memberships/{id}/approve` | ✅ Status → `APPROVED`; requester notified; requester can now RSVP/pay |
| 3.6 | Reject join request | President | `POST /memberships/{id}/reject` | ✅ Status → rejected; requester notified |
| 3.7 | Approve/reject as non-president | VP/member/outsider | Call approve/reject | 🚫 Forbidden |
| 3.8 | Leave club | Approved member (`carol`) | `DELETE /clubs/{id}/join` | ✅ Membership removed |
| 3.9 | President tries to leave without reassigning | `alice` on Tech Innovators | `DELETE /clubs/{id}/join` | 🚫 400 "Transfer the President position to another member before leaving" |
| 3.10 | List members | Anyone | `GET /clubs/{id}/members` | ✅ Shows approved roster with positions |
| 3.11 | Export members CSV | President or Secretary | `GET /clubs/{id}/members/csv` | ✅ Downloads CSV with name/email/position/joined-at — **fixed**: this endpoint previously had zero access control (any authenticated user, even a non-member, could export any club's full roster including emails); now restricted to President/Secretary, matching the Secretary's new recordkeeping duty |
| 3.11b | Export members CSV as VP/Treasurer/outsider | `bob` (VP) or a non-member | Same call | 🚫 403 "Only the Club Admin or Secretary can perform this action" |
| 3.12 | Bulk import members | President or Secretary | `POST /clubs/{id}/members/import` with a list of emails | ✅ Creates memberships for existing users, skips unknown emails / already-members with a reason in the response — **Secretary can now do this too** (real-world duty: Secretary owns membership records), previously President-only |
| 3.13 | Bulk import as non-president/non-secretary | VP/Treasurer/member | Same call | 🚫 Forbidden |
| 3.14 | Assign position | President | `PUT /memberships/{id}/position` → set a member to `TREASURER` | ✅ Position updated |
| 3.15 | Reassign PRESIDENT | President assigns `PRESIDENT` to another approved member | Same endpoint | ✅ New member becomes `PRESIDENT`; old president is demoted to `MEMBER` and immediately loses officer powers; **both are notified** ("You are no longer President of …" / "Your position in … is now PRESIDENT") and an `ASSIGN_POSITION` audit entry is written |
| 3.16 | Assign position as non-president | VP/member | Try to change someone's position | 🚫 Forbidden |
| 3.17 | My memberships | Any logged-in user | `GET /memberships/me` | ✅ Lists all clubs the user belongs to/has requested, with position/status |
| 3.18 | Cross-club privilege escalation (regression) | `dave` (PRESIDENT of Creative Arts only) tries to approve/reject a Tech Innovators join request, or promote himself to PRESIDENT of Tech Innovators, using its `membershipId` | `POST /memberships/{id}/approve` / `PUT /memberships/{id}/position` | 🚫 403 "Only the Club Admin can perform this action" — fixed: these three endpoints previously had no ownership check at all, so any authenticated user could approve/reject/reassign positions in *any* club by guessing a membership id |
| 3.19 | Join a club that isn't active | Any student, by id | Join a `PENDING`, `REJECTED` or archived club | 🚫 400 "This club is not accepting members right now" — **fixed**: these used to accept members |
| 3.20 | Re-apply after rejection | The student rejected in 3.6 | Join the same club again | ✅ The request goes back to `PENDING` (or `APPROVED` if the club is open) — **fixed**: a rejected applicant used to get 409 forever |
| 3.21 | Fee-gated join | Club with a membership fee (2.15) | Join without paying; then `POST /payments` `{type:MEMBERSHIP, referenceId:clubId, amount:1}` and join again | 🚫 400 "Pay the club's membership fee before joining"; after paying ✅ the join goes through and the payment is the club's real fee (the sent `amount` is ignored). In the UI, Join shows a "pay and join" confirmation |
| 3.22 | Fee refunds | Reject a paid request (3.6); withdraw a pending paid request (`DELETE /clubs/{id}/join`); President removes a pending applicant | Check `GET /payments/me`, the club ledger, notifications | ✅ `refundedAt` is set and a "…was refunded (…)" notification is sent; income drops accordingly. An **approved** member leaving is NOT refunded. After a rejection, joining again needs a new payment |
| 3.23 | Remove a member | President | President: members list → remove icon (or `DELETE /memberships/{id}`) | ✅ Membership deleted, member notified "You have been removed from …", audit `REMOVE_MEMBER` |
| 3.24 | Remove permissions and the President | Non-president / President | Non-president tries; President tries to remove the President | 🚫 403 "Only the Club Admin can perform this action"; 🚫 400 "The President can't be removed — transfer the role to another member first" |
| 3.25 | President cannot demote themselves | `alice` (President) | `alice` (President) sets her own position to `MEMBER` | 🚫 400 "To step down, assign the President position to another member instead" — **fixed**: this used to leave the club with no President and no admin |
| 3.26 | Position rules | President | Assign a position to a `PENDING`/`REJECTED` member; send an empty position; assign `TREASURER` to two different members | 🚫 400 "Only approved members can be assigned a position" / "A position is required"; two Treasurers (or VPs/Secretaries) are allowed on purpose (assistant officers) — only `PRESIDENT` is unique. Every position change notifies the member |
| 3.27 | Concurrent President hand-offs | President (scripted) | Script two simultaneous `PUT /memberships/{id}/position` (`PRESIDENT`) from the current President to two different members | ✅ One request 200, the other 403 (it is no longer President) or 409; never 500; afterwards exactly one `PRESIDENT`. DB check: `memberships.president_club_id` has a unique index, so the database itself refuses a second President |
| 3.28 | CSV formula injection | President / Secretary | A member whose display name starts with `=`, `+`, `-` or `@` (e.g. `=HYPERLINK("http://evil")`) → export members CSV and open in Excel/Sheets | ✅ The cell shows text (value is prefixed with `'`), not a live formula; commas/quotes/newlines in names are quoted correctly |
| 3.29 | Roster audit | President or Secretary | Bulk-import members (3.12) | ✅ An `IMPORT_MEMBERS` audit entry records the count and club |
| 3.30 | Members list pagination | Anyone | `GET /clubs/{id}/members?size=10&page=0` | ✅ 10 rows and `X-Total-Count`; no `size` returns everyone (the club page still works) |
| 3.31 | Claim presidency (succession) | Vice President | Club page → "Claim presidency" (or `POST /clubs/{id}/claim-presidency`) while the President is **not** marked graduated | 🚫 400 "The current President hasn't graduated — they need to hand the role over themselves"; nothing changes |
| 3.32 | President marks themselves graduated | President | Profile → graduation year set to a past year | ✅ The club's VP/Secretary/Treasurer are notified ("… is now marked as graduated. The Vice President can take over from the club page ("Claim presidency")"); a future year or an unchanged year notifies nobody; ordinary members are not notified |
| 3.33 | Claim presidency after graduation | Vice President | Same call as 3.31 now that 3.32 is done | ✅ VP becomes `PRESIDENT`, the graduated President becomes `MEMBER`, both are notified, audit `CLAIM_PRESIDENCY`; a Super Admin still cannot reassign a President |
| 3.34 | Who may claim | VP / Secretary / Treasurer / member / outsider / the President | Claim on a club whose President has graduated | ✅ VP always; Secretary or Treasurer **only when the club has no VP** (otherwise 403 "Only the Vice President can claim the presidency"); plain member 403 "Only an officer can claim…"; non-member 403; the President themselves 400 "You are already the President". Two officers claiming at once → exactly one winner (VP), never two Presidents |
| 3.35 | Pagination is done by the database | Anyone | `GET /clubs/{id}/members?size=2&page=1` on a club with pending applicants | ✅ Only approved members are counted; `X-Total-Count` is the total of approved members; pages don't overlap or skip. Same for `/clubs`, `/events`, `/notifications/me`, `/payments/me`, `/audit-logs` |

---

## 4. Club Announcements & Comments

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 4.1 | Post announcement | Officer (`PRESIDENT/VP/SECRETARY/TREASURER`) | `POST /clubs/{id}/announcements` | ✅ Created |
| 4.2 | Post announcement as plain member | `carol` | Same call | 🚫 Forbidden (only officer positions per `ClubAnnouncementService.OFFICER_POSITIONS`) |
| 4.3 | List announcements | Anyone | `GET /clubs/{id}/announcements` | ✅ Shows all, newest presumably first |
| 4.4 | Delete announcement | Author (any officer) OR the President, even if not the author | `DELETE /clubs/{id}/announcements/{id}` | ✅ Removed — confirmed: `deleteAnnouncement` allows the original author OR the President, not "any officer" |
| 4.5 | Delete announcement as non-president, non-author officer | `bob` (VP), on an announcement `alice` (President) posted | Same call | 🚫 Forbidden — confirmed |
| 4.5b | Delete announcement from a different club (regression check) | `dave` (PRESIDENT of Creative Arts) targets a Tech Innovators announcement via `DELETE /clubs/{creativeArtsId}/announcements/{techAnnouncementId}` | Same call | 🚫 404 "Announcement not found" — `deleteAnnouncement` already validates `announcement.club.id == clubId` correctly, unlike the comment bug below |
| 4.6 | Comment on announcement | Any approved club member | `POST .../comments` | ✅ Created — confirmed: requires an `APPROVED` membership in that club |
| 4.7 | Comment as non-member/outsider | Non-member student | Same call | 🚫 Forbidden "Only club members can comment" — confirmed |
| 4.8 | List comments | Anyone | `GET .../comments` | ✅ Shows thread |
| 4.9 | Delete own comment | Comment author | `DELETE .../comments/{id}` | ✅ Removed |
| 4.10 | Delete someone else's comment | Different member (not author, not president) | Same call | 🚫 Forbidden |
| 4.11 | Delete any comment in own club | President | Delete another member's comment within their own club | ✅ Allowed (moderation power) |
| 4.12 | Cross-club comment-delete (regression, fixed) | `dave` (PRESIDENT of Creative Arts, president of nothing in Tech Innovators) calls `DELETE /clubs/{creativeArtsId}/announcements/{anyId}/comments/{techCommentId}` — a real Tech Innovators comment id | Same call | 🚫 404 "Comment not found" — **fixed**: `deleteComment` previously never checked the comment's actual club against the path's `clubId`, so any club president could delete *any comment anywhere in the system* just by using their own club's id in the URL and a guessed/enumerated comment id from another club |

---

## 5. Events (`/api/clubs/{id}/events`, `/api/events/**`)

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 5.1 | Create free event, no FA approval | Officer | `POST /clubs/{id}/events`, no fee | ✅ Created with `approval_status=NOT_REQUIRED`, immediately visible in `GET /events` |
| 5.2 | Create event requiring FA approval | Officer | Create with fee/flag that triggers `requires_fa_approval` (check `CreateEventRequest` fields — e.g. ticketed/paid events) | ✅ Created as `PENDING`; NOT visible in public `GET /events` until approved |
| 5.3 | Create event as plain member | `carol` | Same call | 🚫 Forbidden (only officer positions per `EventService.EVENT_CREATOR_POSITIONS`) |
| 5.4 | List published events | Anyone | `GET /events` | ✅ Only approved/not-required events shown |
| 5.5 | List events filtered by club | Anyone | `GET /events?clubId={id}` | ✅ Scoped correctly |
| 5.6 | Get single event | Anyone / officer / Faculty Advisor | `GET /events/{id}` | ✅ Published events are visible to any logged-in user. A `PENDING` or `REJECTED` event returns 404 to ordinary students and is visible only to that club's officers, Faculty Advisors and Super Admins — **fixed**: any id-holder could read unpublished events |
| 5.7 | Update event | Officer of the owning club | `PUT /events/{id}` | ✅ Success |
| 5.8 | Update event as outsider/non-officer | Different club's officer, or a plain member | Same call | 🚫 Forbidden |
| 5.9 | Download event .ics | Anyone | `GET /events/{id}/ics` | ✅ Valid calendar file downloads and imports cleanly into a calendar app |
| 5.10 | Get event QR code | Officer vs anyone else | `GET /events/{id}/qr-code` | ✅ Officers get a PNG (`Cache-Control: no-store`) whose link embeds a rotating check-in token; 🚫 403 "Only club officers can show the check-in QR code" for everyone else — **fixed** |
| 5.11 | List pending event approvals | `advisor` | `GET /events/pending` | ✅ Shows event from 5.2 |
| 5.12 | List pending approvals as non-FA | `superadmin` or `alice` | Same call | 🚫 403 (endpoint is `hasRole('FACULTY_ADVISOR')` only — even super admin is blocked; confirm this is intentional) |
| 5.13 | Approve event | `advisor` | `POST /events/{id}/approve` | ✅ Status → approved; now public; club/organizer notified |
| 5.14 | Reject event | `advisor` | `POST /events/{id}/reject` on another pending event | ✅ Status → rejected; not public; organizer notified |
| 5.15 | Approve/reject as non-FA | Any other role | Same calls | 🚫 403 |
| 5.16 | Event date in the past | Officer | Officer creates an event dated earlier than now; edits an event to a past date; edits other fields of an already-past event leaving its date unchanged | 🚫 400 "The event date must be in the future" for the first two; ✅ the unchanged-date edit is allowed |
| 5.17 | Event for an inactive club | Officer | Officer of a `PENDING`, `REJECTED` or archived club creates an event | 🚫 400 "Events can only be created for an active, approved club" |
| 5.18 | Fee and capacity validation | Officer | Negative fee, fee above 1,000,000, capacity 0 or negative | 🚫 400 "Fee must be between 0 and 1000000" / "Capacity must be at least 1" |
| 5.19 | Venue capacity | Officer | Venue seats 50: create with capacity 80; create with capacity left blank | 🚫 400 "Capacity 80 exceeds "<venue>" (50 seats)"; blank capacity → the event inherits 50 |
| 5.20 | Faculty Advisors are told | Officer / Faculty Advisor | Create an event with a fee above 5000 | ✅ Every Faculty Advisor gets "… needs your approval"; a daily 09:00 reminder ("N event(s) are waiting for your approval") repeats while any are pending |
| 5.21 | Rejection reason | `advisor` | `advisor`: `POST /events/{id}/reject` with `{"reason":"Budget too high"}` (the Pending approvals page now prompts for it) | ✅ Stored as `rejectionReason`; the organiser's notification ends "Reason: Budget too high" and the event page shows "Rejected by the Faculty Advisor: Budget too high. Edit the event to resubmit it."; rejecting with no body still works |
| 5.22 | Editing an approved event | Officer | Event approved at fee 8000: (a) rename it / change date; (b) lower fee to 6000; (c) raise fee to 9000 | (a)(b) ✅ stays `APPROVED` and live; (c) goes back to `PENDING` and is hidden until re-approved. **Fixed**: any edit used to un-publish an approved event, even under RSVPs. Note (c) is only possible while nobody has signed up (see 5.24) |
| 5.23 | Resubmitting a rejected event | Officer | Officer edits a `REJECTED` event | ✅ Becomes `PENDING` again with `rejectionReason` cleared and Faculty Advisors notified; lowering the fee to 5000 or less makes it `NOT_REQUIRED` (live) |
| 5.24 | Fee is locked once people sign up | Officer | With at least one GOING/WAITLISTED RSVP or live payment, change the fee | 🚫 400 "The fee can't be changed once people have RSVP'd or paid"; re-sending the same fee is fine |
| 5.25 | Capacity guard and waitlist release | Officer | Lower capacity below the number of GOING RSVPs; then raise it (or clear it) while people are waitlisted | 🚫 400 "Capacity can't be lower than the N confirmed RSVPs"; raising it auto-promotes waitlisted people in order, notifies them, and the rest move up (live over WebSocket) — **fixed**: raising capacity used to leave the waitlist stuck |
| 5.26 | Change notifications | Officer | With RSVPs and waitlist entries present, change the date/time, venue or location; then change only the title/description | ✅ Everyone GOING/WAITLISTED gets "Details changed for "<title>": now <date> at <where>"; title/description-only edits send nothing |
| 5.27 | Cancel an event | Officer | Any officer: event page → "Cancel event" (prompts for a reason) or `POST /events/{id}/cancel` `{"reason":"…"}` | ✅ `cancelled=true`; banner on the page and a "Cancelled" badge in the list; everyone GOING/WAITLISTED notified with the reason; **every paid fee refunded** (payers with no RSVP too); the venue slot is freed for other bookings; audit `CANCEL_EVENT`; ICS gets `STATUS:CANCELLED` |
| 5.28 | Cancellation guards | Plain member / Officer | Plain member cancels; cancel twice; cancel an event that already started; then edit / RSVP / pay / check in / fetch QR for the cancelled event | 🚫 403; 400 "already cancelled"; 400 "already started"; 400 "A cancelled event can't be edited"; 400 "This event has been cancelled" for the rest |
| 5.29 | Calendar file correctness | Anyone | Event with a venue end time and a title like `Talks, demos; more`; a pending event | ✅ `DTEND` uses the event's real end (not a fixed +1 h); `,` `;` and newlines are escaped so the title survives import; a pending event's `/ics` is 404 |
| 5.30 | Search, filters, pagination | Anyone | `GET /events?q=hack`, `?category=Tech` (club category), `?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z`, `?clubId=`, `?size=10&page=0`, and `?from=abc` | ✅ Only published events of active clubs, soonest first; `X-Total-Count` header with `size`; full list without it; a malformed date is 400 not 500 |
| 5.31 | Event budget | Officer | Create/edit an event with a budget (Create event dialog has an optional Budget field); then log expenses linked to it (9.7) | ✅ `budget` saved and returned; negative or above 1,000,000 → 400 "Budget must be between…"; editing without a budget clears it; the club page ledger shows a per-event table (Budget / Spent / Left / Fees in), with "Left" in red when overspent |
| 5.32 | Search is literal and safe | Anyone | `GET /events?q=100%25` and `?q=e_c` (percent and underscore) and text that matches only an event's description | ✅ `%` and `_` are matched literally, not as wildcards; description text is searched too; matching ignores letter case — **fixed**: the first version of DB-side search crashed with a 500 on descriptions |

---

## 6. RSVPs & Waitlist

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 6.1 | RSVP to event | Approved club member | `POST /events/{id}/rsvp` | ✅ Status `GOING` (or `WAITLISTED` if at capacity) |
| 6.2 | RSVP twice | Same user, same event | Repeat call | 🚫 Conflict — "already RSVP'd" (per `RsvpService`) |
| 6.3 | RSVP at capacity | Fill an event to its `capacity`, then have one more user RSVP | ✅ Placed on waitlist with a `waitlist_order` |
| 6.4 | Cancel RSVP freeing a spot | A `GOING` attendee cancels | `DELETE /events/{id}/rsvp` | ✅ Next waitlisted user auto-promotes to `GOING` — confirm this via the live waitlist WebSocket broadcast (per commit "Broadcast live waitlist updates over WebSocket") — open two browser sessions and watch it update in real time |
| 6.5 | Cancel RSVP not previously made | User with no RSVP | `DELETE /events/{id}/rsvp` | 🚫 Not found |
| 6.6 | List RSVPs for event | Officer/anyone (check access) | `GET /events/{id}/rsvps` | ✅ Full list |
| 6.7 | List waitlist | Officer/anyone | `GET /events/{id}/waitlist` | ✅ Ordered by `waitlist_order` |
| 6.8 | My RSVPs | Any user | `GET /rsvps/me` | ✅ All events the user RSVP'd to, across clubs |
| 6.9 | RSVP to a club you're not a member of | Non-member (verified) | `POST /events/{id}/rsvp` | ✅ Allowed — membership isn't required to attend events. (Capacity-limited events still require a confirmed RSVP to check in — see 7.12) |
| 6.10 | RSVP to a not-yet-approved event | Any student, hitting a `PENDING`-FA-approval event directly by id | `POST /events/{id}/rsvp` | 🚫 400 "not open for RSVPs yet" — fixed: previously this bypassed the FA approval gate entirely |
| 6.11 | RSVP to a rejected event | Any student, hitting a `REJECTED` event by id | `POST /events/{id}/rsvp` | 🚫 400, same as 6.10 |
| 6.12 | Re-RSVP after cancelling | A user who cancelled | `POST /events/{id}/rsvp` again | ✅ Reuses the cancelled row and becomes `GOING` (or `WAITLISTED` at capacity) — **fixed**: used to be 409 "already RSVP'd" forever |
| 6.13 | Paid events require payment first | Student | Fee event: RSVP without paying; then `POST /payments` (`EVENT`) and RSVP | 🚫 400 "Pay the event fee before RSVPing"; then ✅. The UI already pays first, then RSVPs |
| 6.14 | Refund on RSVP cancel | Student | Cancel a paid RSVP before the event starts; repeat after it starts | ✅ Before start: payment refunded + notification, ledger income drops, a new RSVP needs a new payment. After start: no refund |
| 6.15 | Waitlist stays contiguous | Students | Waitlist of 3: the middle person cancels; then a newcomer joins the waitlist | ✅ The remaining two show positions 1 and 2 (no gaps); the newcomer is 3 — **fixed**: orders used to be `size+1`, which produced duplicates after cancellations |
| 6.16 | RSVP guards | Student | RSVP to an event that already started, is cancelled, is unapproved, or belongs to a `PENDING`/archived club | 🚫 400 "already started" / "has been cancelled" / "not open for RSVPs yet" / "This club is not currently active" |
| 6.17 | Concurrent RSVPs for the last seat | Scripted (4 students) | Script 4 simultaneous RSVPs to a capacity-1 event | ✅ Exactly one `GOING` and three `WAITLISTED` with orders 1, 2, 3 — **fixed** with a row lock inside a transaction; before, two people could both take the last seat |
| 6.18 | Unverified email | Unverified student | With enforcement on, RSVP as an unverified user | 🚫 403 "Please verify your email address first" |

---

## 7. Attendance

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 7.1 | Mark attendance manually | Officer, on a past/current event | `POST /events/{id}/attendance/manual` with a userId | ✅ Attendance recorded with `method=MANUAL`; triggers a certificate check for that user+club |
| 7.2 | Mark attendance as plain member | `carol` | Same call | 🚫 Forbidden (`AttendanceService.ATTENDANCE_MARKER_POSITIONS`) |
| 7.3 | QR check-in | Attendee scanning the officer's on-screen QR | `POST /events/{id}/attendance/qr-check-in?token=…` (the app link is `/checkin/{id}?t=…`) | ✅ Self check-in recorded with `method=QR`. The old student-facing "QR check-in" button on the event page was removed (it cannot work without a scanned token) |
| 7.4 | QR check-in twice | Same user, same event | Repeat | 🚫 Conflict — "Attendance already recorded for this user" |
| 7.5 | Mark attendance for someone not RSVP'd | Officer marks a user who never RSVP'd | Same call | ✅ Allowed — walk-ins are intentionally not blocked |
| 7.6 | List attendance | Officer / Faculty Advisor / Super Admin vs an ordinary student | `GET /events/{id}/attendance` | ✅ Officers and staff see everyone; an ordinary student sees only their own record (empty list if not checked in) — **fixed**: everyone could list every attendee |
| 7.7 | Mark attendance before the event starts | Officer tries to mark/QR-check-in on a future-dated event | Same calls | 🚫 400 "Attendance can't be recorded before the event starts" — fixed: previously an officer could mark the whole roster present before the event even happened |
| 7.8 | Mark attendance on a not-yet-approved event | Officer tries on a `PENDING` FA-approval event | Same calls | 🚫 400 "Attendance can't be recorded for an event that isn't published" |
| 7.9 | Token is mandatory | Attendee | `POST …/qr-check-in` with no token, with the bare event id, and with a random string | 🚫 403 "This QR code is invalid or has expired — ask an organiser to show a fresh one" — **fixed**: the QR used to encode just the event id, so anyone could check in remotely |
| 7.10 | Tokens rotate | Attendee / Officer | Copy the link from a QR, wait more than 10 minutes (or take two codes 11+ minutes apart) and use the old one | 🚫 403; the QR window on the event page refreshes its image every 2 minutes, so the on-screen code is always valid |
| 7.11 | Check-in window | Attendee | QR check-in after the event's end time (or 6 hours after start when there is no end time); before the start | 🚫 400 "Check-in has closed for this event" / "before the event starts" |
| 7.12 | RSVP-only events | Attendee | Capacity-limited event: check in with no RSVP and with only a waitlisted RSVP; then with a `GOING` RSVP; then a walk-in on an unlimited event | 🚫 403 "This event is RSVP-only — you need a confirmed RSVP to check in" for the first two; ✅ for the last two |
| 7.13 | Cancelled event | Officer / attendee | Any check-in method on a cancelled event | 🚫 400 "Attendance can't be recorded for a cancelled event" |

---

## 8. Payments

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 8.1 | Pay for a ticketed event | Student RSVP'd to a paid event | `POST /payments` with `type=EVENT`, `referenceId=eventId` | ✅ Payment recorded `SUCCESS`, amount = the event's actual fee — the request body's `amount` is ignored for EVENT payments |
| 8.1b | Try to underpay | Same as 8.1 but with `amount` set far below the real fee (e.g. 0.01) | Same call | ✅ Still charges the real event fee — client-supplied amount is not trusted (fixed: this used to be a real underpayment exploit) |
| 8.2 | Pay membership fee | Student, on an `APPROVED`, non-archived club that has a `membershipFee` | `POST /payments` with `type=MEMBERSHIP`, `referenceId=clubId` | ✅ Recorded `SUCCESS` at the **club's fee** — the client `amount` is ignored (**fixed**: it used to be trusted, so any amount could be "paid" and land in the ledger). Joining requires it (3.21) |
| 8.2b | Membership payment edge cases | Student | Club with fee 0; a second payment; an archived or unapproved club | 🚫 400 "This club has no membership fee to pay"; 🚫 409 "You have already paid the membership fee for this club"; 🚫 404 "Club not found" |
| 8.3 | Duplicate event payment | Pay for the same event twice | Repeat call | 🚫 409 "You have already paid for this event" |
| 8.4 | Pay for nonexistent event/club | Bad `referenceId` | Same call | 🚫 404 |
| 8.4b | Pay for a not-yet-approved event | `type=EVENT` on a `PENDING` FA-approval event | Same call | 🚫 400 "not open for payment yet" |
| 8.4c | Pay for a free event | `type=EVENT` on an event with `fee=0` | Same call | 🚫 400 "no fee to pay" |
| 8.5 | My payment history | Any user | `GET /payments/me` | ✅ Shows all past payments |
| 8.6 | Payment reflected in ledger | After 8.1, as President/Treasurer | `GET /clubs/{id}/expenses/ledger` | ✅ `totalIncome` now includes the event fee — fixed: the ledger used to ignore all payment income entirely |
| 8.7 | Confirmation text | Student | Pay for an event | ✅ Notification reads `Payment of 100 confirmed for "Hack Night".` — **fixed**: it used to say "Payment of null" because it read the (absent) client amount |
| 8.8 | Refund lifecycle | Student / Officer | After any refund (RSVP cancel, event cancel, membership rejected/withdrawn) check `GET /payments/me`, the ledger, `/analytics/clubs/{id}` and university "Payments collected" | ✅ `refundedAt` is set; refunded payments no longer count as income anywhere; the user gets a refund notification; they can pay again afterwards |
| 8.9 | Payment guards | Student | Pay for an event that already started, is cancelled, or as an unverified user (enforcement on) | 🚫 400 "already started"; 400 "cancelled"; 403 "verify your email" |

---

## 9. Club Expenses & Ledger

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 9.1 | Log expense | President or Treasurer | `POST /clubs/{id}/expenses` | ✅ Created |
| 9.2 | Log expense as VP/Secretary/Member | `bob` (VP) or `carol` (member) | Same call | 🚫 Forbidden (`ClubExpenseService.EXPENSE_LOGGER_POSITIONS` = President + Treasurer only) |
| 9.3 | View ledger as an officer | Any of PRESIDENT/VP/SECRETARY/TREASURER | `GET /clubs/{id}/expenses/ledger` | ✅ Returns `totalIncome` (sum of successful EVENT payments for this club's events + successful MEMBERSHIP payments for this club), `totalExpenses`, and `balance = totalIncome - totalExpenses` |
| 9.3b | View ledger as a regular member or outsider | `carol` (plain MEMBER) or a non-member | Same call | 🚫 403 "Only club officers can view club finances" — **fixed**: this endpoint previously had zero access control; any authenticated user could view any club's full financial ledger regardless of membership (the frontend only *hid* the button, it never enforced anything) |
| 9.3c | View ledger as university staff | `superadmin` or `advisor`, not a member of the club at all | Same call | ✅ Allowed — Super Admin and Faculty Advisor can view any club's finances for oversight |
| 9.3d | Ledger income across two clubs | Pay an event fee for Club A's event | Check Club B's ledger (as an officer of Club B) | ✅ Club B's `totalIncome` is unaffected — income is scoped strictly to the paying club's own events/membership |
| 9.4 | Delete expense | President/Treasurer | `DELETE /clubs/{id}/expenses/{id}` | ✅ Removed and the ledger recalculates, **and a `DELETE_EXPENSE` audit entry records who deleted what (description, amount, date)** — deletions are no longer silent |
| 9.5 | Delete expense as unauthorized role | Member/VP | Same call | 🚫 Forbidden |
| 9.6 | Edit an expense | President/Treasurer | `PUT /clubs/{id}/expenses/{id}` with new description/amount/category/date/event | ✅ Updated; audit `UPDATE_EXPENSE` shows "before → after"; VP/member 403; an expense id from another club 404 |
| 9.7 | Category, date and event link | President / Treasurer | Log an expense with category "Food", a past `expenseDate`, and the `eventId` of one of the club's events (the Log expense dialog has Category and Date fields) | ✅ Returned with `category`, `expenseDate`, `eventTitle`; an event from another club → 400 "That event doesn't belong to this club" |
| 9.8 | Expense validation | President / Treasurer | Amount above 10,000,000; description over 255 characters; a date more than a day in the future | 🚫 400 with a clear message for each |
| 9.9 | Ledger by period | Officer / university staff | `GET /clubs/{id}/expenses/ledger?from=2026-01-01&to=2026-06-30` (officer access rules unchanged) | ✅ Expenses filtered by expense date and income by payment date; omit both for all-time |
| 9.10 | Logging is audited | President / Treasurer | Log an expense | ✅ A `LOG_EXPENSE` audit entry exists |
| 9.11 | Per-event budget vs spend | President / Treasurer | Event with budget 1000; expenses 300 + 450 linked to it; two paid registrations of 200 | ✅ `GET …/expenses/ledger` has `eventBudgets`: budget 1000, spent 750, income 400, remaining 250; events with no budget and no money are omitted; an event with spend but no budget shows `budget` and `remaining` as null; refunds lower "income"; the date range (9.9) applies to spend and income |

---

## 10. Event Feedback

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 10.1 | Submit feedback | Attendee (has an `Attendance` record for that event) | `POST /events/{id}/feedback` with rating + comment | ✅ Created |
| 10.2 | Submit feedback without attending | User who was never marked/checked in | Same call | 🚫 403 "Only attendees can leave feedback" — confirmed: `EventFeedbackService` requires an `Attendance` row to exist first, and since attendance itself now requires the event to be approved and already started (see attendance fixes), this transitively blocks feedback on future/unpublished events too |
| 10.3 | Submit duplicate feedback | Same user, same event, twice | Repeat | 🚫 409 "You have already left feedback for this event" — confirmed |
| 10.4 | List feedback | Officer/anyone | `GET /events/{id}/feedback` | ✅ Shows all entries |
| 10.5 | Average rating | Anyone | `GET /events/{id}/feedback/average` | ✅ Correct average computed |
| 10.6 | Rating out of range | Submit `rating=0` or `rating=6` | Same call | 🚫 400 "Rating must be between 1 and 5" |

---

## 11. Certificates

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 11.1 | View my certificates | Any user | `GET /certificates/me` | ✅ Lists issued certificates (seed data: `carol` has one for Tech Innovators) |
| 11.2 | Download certificate PDF | Owner of the certificate | `GET /certificates/{id}/download` | ✅ Valid PDF downloads |
| 11.3 | Download someone else's certificate | Different user, guessing/reusing an id | Same call | 🚫 Should be forbidden — verify ownership check exists |
| 11.4 | Certificate issuance trigger | Attendee / officer | Mark attendance (7.1/7.3) until the user's count reaches the club's threshold | ✅ Every successful check-in re-runs the eligibility check. The threshold is now **per club** (President sets "Events for certificate"; default 3; clubs created before this change fall back to 3). Only **approved members** qualify — a non-member or pending applicant with enough attendances gets nothing (**fixed**) |
| 11.5 | Per-club threshold | President / member | Set a club's threshold to 2, then to 5 | ✅ A member gets the certificate on their 2nd attended event with 2, and not before the 5th with 5 |
| 11.6 | Issuance notification | Member | Trigger 11.4 | ✅ The member is notified "You earned a certificate from <club>! Download it from your certificates page." |
| 11.7 | Verification code and public check | Member / anyone | Download a certificate PDF; open the "Verify at" link while **logged out**; try a made-up code | ✅ PDF shows a verification code and link; the public page (`/verify-certificate/{code}`, API `GET /certificates/verify/{code}`, no token needed) shows "Genuine certificate" with holder, club and date only; a bogus code shows "Certificate not found". Certificates issued before this change get a code on first download |
| 11.8 | Non-Latin names | Member | Download the certificate of a user whose name has non-Latin characters | ✅ PDF is produced (unsupported characters print as `?`) instead of a 500 |

---

## 12. Notifications

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 12.1 | Receive notification on club approval | `alice` after 2.10 | Check `GET /notifications/me` | ✅ New unread notification |
| 12.2 | Receive notification on membership approval | Student after 3.5 | Check notifications | ✅ New notification |
| 12.3 | Receive notification on event approval | Officer after 5.13 | Check notifications | ✅ New notification |
| 12.4 | Mark one notification read | Any user | `POST /notifications/{id}/read` | ✅ `is_read=true` |
| 12.5 | Mark all read | Any user | `POST /notifications/read-all` | ✅ All become read |
| 12.6 | Mark someone else's notification read | Wrong user tries another's notification id | Same call | 🚫 Should be blocked/no-op — verify |
| 12.7 | Live/WebSocket notifications | Two browser sessions open | Trigger an action that notifies a user (e.g. waitlist promotion) | ✅ Notification appears live without refresh |
| 12.8 | Announcement fan-out is off the request thread | Officer / member | Post an announcement in a club with many members | ✅ The request returns immediately; each approved member still gets an in-app notification (and an email unless opted out — 1.30) |
| 12.9 | Reminder rules | System (scheduler) | Wait for / invoke the 08:00 reminder job | ✅ Only `GOING` attendees of **published, non-cancelled** events of active clubs starting in 24–48 h are reminded |
| 12.10 | Daily digest job | System (scheduler) | Invoke `sendDailyDigests` (or wait for 18:00) with digest subscribers who did / didn't get notifications | ✅ One email per subscriber who had notifications in the last 24 h listing them oldest-first; none for quiet subscribers; users who opted out of email entirely never get one |
| 12.11 | Approver reminders | System (scheduler) | Have a pending event and a pending club proposal; invoke `sendPendingApprovalReminders` | ✅ Faculty Advisors are told how many events wait; Super Admins how many proposals wait; nothing is sent when nothing is pending |

---

## 13. Search

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 13.1 | Search clubs by name | Anyone | `GET /search?q=Tech` | ✅ Returns Tech Innovators |
| 13.2 | Search events | Anyone | `GET /search?q=Hack` | ✅ Returns Hack Night |
| 13.3 | Search with no results | `GET /search?q=zzzznotfound` | ✅ Empty result, no error |
| 13.4 | Search with empty query | `GET /search?q=` | Verify graceful handling (400 or empty list) |

---

## 14. Analytics & Reporting

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 14.1 | Club stats — public fields | Any logged-in user | `GET /analytics/clubs/{id}` | ✅ Returns member count, event count, RSVP/attendance stats — these remain visible to anyone (no `@PreAuthorize`), matching the frontend's public-ish stats display |
| 14.1b | Club stats — financial fields, officer | Any of PRESIDENT/VP/SECRETARY/TREASURER, or `superadmin`/`advisor` | Same call | ✅ `totalIncome`/`totalExpenses`/`balance` now included in the response with real figures, reusing the ledger computation — **new**: this data didn't exist in the response at all before |
| 14.1c | Club stats — financial fields, non-officer | `carol` (plain MEMBER) or a non-member student | Same call | ✅ Response still succeeds (counts are public) but `totalIncome`/`totalExpenses`/`balance` all come back as `0` — financial figures are gated the same way as the ledger endpoint (9.3b), just degrading gracefully instead of erroring |
| 14.2 | Club stats CSV | Same access rules as 14.1b/14.1c apply to the Income/Expenses/Balance rows in the CSV | `GET /analytics/clubs/{id}/csv` | ✅ Downloads valid CSV including the new financial rows |
| 14.3 | Club stats PDF | Same access rules apply | `GET /analytics/clubs/{id}/pdf` | ✅ Downloads valid PDF including the new financial rows |
| 14.4 | University-wide stats | `superadmin`/`advisor` | `GET /analytics/university` | ✅ Aggregate stats across all clubs |
| 14.5 | University stats as student | `alice` | Same call | 🚫 403 |
| 14.6 | University CSV/PDF export | `superadmin`/`advisor` | `GET /analytics/university/csv` and `/pdf` | ✅ Valid downloads |
| 14.7 | Engagement analytics | Officer | Officer: `GET /analytics/clubs/{id}` after an event has run | ✅ Response also has `attendanceRatePercent`, `averageEventRating` and `events[]` (per started, live event: `going`, `attended`, `noShows`, `averageRating`); the club CSV/PDF include attendance rate and average rating rows |
| 14.8 | University totals exclude dead data | `superadmin` / `advisor` | Cancel an event, archive a club, refund a payment | ✅ "Published events", "Approved clubs" and "Payments collected" drop accordingly (computed with database aggregate queries instead of loading every row) |

---

## 15. Audit Logs

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 15.1 | View audit log | `superadmin` | `GET /audit-logs` | ✅ Shows history of sensitive actions (approvals, deletions, etc.) |
| 15.2 | View audit log as non-superadmin | `advisor` or any student | Same call | 🚫 403 |
| 15.3 | Audit entries created correctly | After doing club/event approvals, deletions | Check log content | ✅ Actor, action, timestamp recorded accurately |
| 15.4 | New audit actions | Any actor | Perform: assign position, remove member, import members, cancel event, archive/unarchive club, log/edit/delete expense | ✅ `ASSIGN_POSITION`, `REMOVE_MEMBER`, `IMPORT_MEMBERS`, `CANCEL_EVENT`, `ARCHIVE_CLUB`, `UNARCHIVE_CLUB`, `LOG_EXPENSE`, `UPDATE_EXPENSE`, `DELETE_EXPENSE` appear with the right actor |
| 15.5 | Audit log pagination | `superadmin` | `GET /audit-logs?size=50&page=0` | ✅ 50 rows, `X-Total-Count` header |

---

## 16. Cross-Role End-to-End Scenarios

These string together multiple roles/steps — the most valuable tests since they mirror real usage.

**E2E-1: New club lifecycle**
1. Register a new student, verify email, log in.
2. Create a club → auto-becomes PRESIDENT, club is `PENDING`.
3. Confirm club is invisible in public club list.
4. Log in as `superadmin` → see it in `/clubs/pending` → approve.
5. Confirm it now appears in public club list and the creator got a notification.

**E2E-2: Join → approve → participate**
1. Log in as `dave`, join "Tech Innovators" (`alice`'s club).
2. Log in as `alice`, see the pending request, approve it.
3. `dave` gets notified, is now an approved member.
4. `dave` RSVPs to "Hack Night", checks in via QR at the event, leaves feedback afterward.

**E2E-3: Paid, FA-approved event, full lifecycle**
1. As `alice` (PRESIDENT), create a new ticketed event requiring FA approval.
2. Confirm it does NOT show in public events list yet.
3. As `advisor`, find it in `/events/pending`, approve it.
4. Confirm it's now public.
5. As `carol`, pay for it via `/payments` first, then RSVP (a fee event now requires payment before the RSVP is accepted — see 6.13).
6. Once the event's date/time has passed, as `alice`/`bob` (officer) mark `carol`'s attendance manually, or have `carol` self check-in via QR (both are now blocked until the event actually starts — see 7.7).
7. As `carol`, submit feedback after the event.
8. Check `/analytics/clubs/{id}` reflects the new RSVP/attendance numbers, and `/clubs/{id}/expenses/ledger` reflects the payment as income.

**E2E-4: Waitlist promotion (real-time)**
1. Create an event with `capacity=1`.
2. `bob` RSVPs → `GOING`.
3. `carol` RSVPs → `WAITLISTED`.
4. Open `carol`'s session live, then have `bob` cancel his RSVP.
5. Confirm `carol` is promoted to `GOING` in real time via WebSocket, and receives a notification.

**E2E-5: Officer handoff mid-flow**
1. As `alice` (PRESIDENT of Tech Innovators), reassign PRESIDENT to `bob`.
2. Confirm `alice` is demoted to MEMBER and immediately loses access to approve join requests / assign positions / log expenses.
3. Confirm `bob` (new PRESIDENT) can now do those actions, and that VP is now vacant/reassigned as expected.

**E2E-6: Club finances**
1. As `alice`, log a club expense (e.g. 4500 for snacks).
2. As `carol`, pay an approved event's fee tied to the same club (e.g. 7500 for the Art Show).
3. As `alice`/treasurer, view `/clubs/{id}/expenses/ledger` → confirm `totalIncome=7500`, `totalExpenses=4500`, `balance=3000`.
4. As `dave` (a different club's president), view *his* club's ledger → confirm `carol`'s payment does NOT appear there (income is scoped per-club, per fix in 9.3b).
5. `/analytics/clubs/{id}` shows the same income/expenses/balance to officers (and now attendance rate and ratings — 14.7); the ledger endpoint additionally lists individual expenses and supports a date range (9.9).

**E2E-7: Moderation**
1. `carol` posts a comment on an announcement.
2. `bob` (VP, not the author, not president) tries to delete it → blocked.
3. `alice` (PRESIDENT) deletes it → succeeds.

**E2E-8: Rejection paths**
1. Create a second club as a new user → `superadmin` rejects it → confirm it never appears publicly and creator is notified of rejection (not approval).
2. Create a second FA-approval-required event → `advisor` rejects it → confirm same.

**E2E-9: Cross-club moderation boundary (regression, fixed)**
1. As `carol` (member of Tech Innovators), post a comment on a Tech Innovators announcement — note the comment's id.
2. As `dave` (PRESIDENT of Creative Arts Society, has no role in Tech Innovators at all), call `DELETE /clubs/{creativeArtsId}/announcements/{anyAnnouncementId}/comments/{carolsCommentId}` — using *his own* club's id in the path, but Carol's real comment id.
3. Confirm this now fails with 404 — `dave` cannot delete a comment outside his own club just because he's a president somewhere. (Before the fix, this succeeded: any president could delete any comment system-wide.)
4. As `alice` (PRESIDENT of Tech Innovators, the comment's actual club), delete the same comment → succeeds.

**E2E-10: Venue conflict across two clubs, seen on the calendar**
1. As `superadmin`, create a venue "Main Auditorium" at `/admin/venues`.
2. As `alice` (Tech Innovators), create an event booking that venue, 2pm–4pm.
3. As `dave` (Creative Arts Society), try to create a different event at the same venue, 3pm–5pm → 🚫 409 conflict toast naming Alice's event.
4. `dave` adjusts to 4pm–6pm instead → ✅ succeeds (back-to-back, no overlap).
5. Any user opens `/calendar`, filters by "all clubs" → both bookings appear on the correct day with distinct club-colored chips; clicking the day shows both events linking to their detail pages.

---

## 17. Authorization / Negative Testing Sweep

For every write endpoint above, also explicitly re-test as:
- **Unauthenticated** (no token) → expect 401 everywhere except register/login/forgot-password/reset-password/verify-email and the deliberately public `GET /certificates/verify/{code}`.
- **Wrong role** (e.g. a student hitting `/audit-logs`, `/clubs/pending`, `/analytics/university`) → expect 403.
- **Right role, wrong club** (e.g. `alice` — president of Tech Innovators — trying to approve a join request or log an expense for Creative Arts Society, where she's just a MEMBER) → expect 403. This is the most important category to hammer, since most permission logic is scoped per-club, not just per global role.

---

## 18. Cross-Cutting / Non-Functional Checks

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 18.1 | CORS regression | Use the frontend at `localhost:5173` against the backend at `localhost:5000` | ✅ No CORS errors on any endpoint, including ones needing auth headers (and `X-Total-Count` is readable) |
| 18.2 | File upload size limits and long text | Profile picture / club logo / event banner above ~2 MB (base64 over 3,000,000 characters); a resource file above ~10 MB; an announcement over 5,000 characters; a comment over 2,000 | ✅ 400 with a clear message ("…is too large — please use an image under 2 MB", "A comment must be 2000 characters or fewer"), nothing stored, no crash. **And** a realistic ~200 KB image and a ~4 KB announcement save and read back intact — **fixed**: Hibernate had created these columns as `tinytext` (255 bytes), so real images/announcements could not be stored at all |
| 18.3 | Input validation | Submit empty/invalid fields (blank club name, negative fee, past event date for a new event, invalid email format) | 400 with a clear message, not a 500 |
| 18.4 | Pagination and large lists | `?size=&page=` on `GET /events`, `/clubs`, `/clubs/{id}/members`, `/notifications/me`, `/payments/me`, `/audit-logs` | ✅ Optional paging **performed by the database** (filtering, sorting and counting happen in SQL) with an `X-Total-Count` header (readable by browser JS via CORS); `size` is clamped to 1–200 and a negative page means the first; omitting `size` returns the full list so the UI keeps working; a page past the end is an empty list |
| 18.5 | Concurrent RSVP at capacity | Two users RSVP to the last spot simultaneously | Only one gets `GOING`, the other `WAITLISTED` — **fixed** (event row lock + `@Transactional`); see 6.17 for the scripted 4-way check |
| 18.6 | Session expiry mid-session in UI | Let JWT expire while the frontend tab is open, then perform an action | UI handles 401 gracefully (redirect to login), not a silent failure |
| 18.7 | Browser refresh persistence | Log in, refresh the page | Session persists (token stored appropriately) |
| 18.8 | Logout | Use the logout action | Token cleared, protected pages redirect to login |
| 18.9 | Constraint races return 409 | Trigger a database uniqueness violation by racing two writes (e.g. 3.27 without the lock) | ✅ Client sees 409 "That change conflicted with another update — please try again." (never a 500 with SQL text) |
| 18.10 | Multi-step operations are atomic | Force a failure mid-way through a multi-step action (e.g. make the mail/notification insert fail during club creation or a waitlist promotion) | ✅ Nothing is half-applied — the whole action rolls back (all write services are now `@Transactional`; before, there were none) |

---

## 19. Venue Booking (`/api/venues/**`)

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 19.1 | List venues | Anyone logged in | `GET /venues` | ✅ Returns only `active=true` venues |
| 19.2 | Create venue | `superadmin` | `POST /venues` with `name`, `building`, `capacity` | ✅ Created, `active=true` by default |
| 19.3 | Create venue as non-superadmin | `advisor` or any student | Same call | 🚫 403 |
| 19.4 | Create venue with blank name | `superadmin`, `name=""` | Same call | 🚫 400 "Venue name is required" |
| 19.5 | Update venue | `superadmin` | `PUT /venues/{id}` | ✅ Fields updated |
| 19.6 | Update nonexistent venue | `superadmin`, bad id | Same call | 🚫 404 |
| 19.7 | Deactivate venue | `superadmin` | `DELETE /venues/{id}` | ✅ `active=false`; no longer appears in `GET /venues` (19.1), but past events referencing it are untouched |
| 19.8 | Book an event at a venue | Officer, creating/updating an event | `POST /clubs/{id}/events` with `venueId` + `endDate` after `eventDate` | ✅ Event created with the venue attached; `EventResponse` includes `venueId`/`venueName`/`venueBuilding`/`endDate` |
| 19.9 | Book a venue with no end time | Officer, `venueId` set but `endDate=null` | Same call | 🚫 400 "A venue booking needs an end time after the start time" |
| 19.10 | Book a venue with end before start | Officer, `endDate` earlier than `eventDate` | Same call | 🚫 400, same message as 19.9 |
| 19.11 | Book an inactive/nonexistent venue | Officer, `venueId` from 19.7 or a random UUID | Same call | 🚫 404 "Venue not found" |
| 19.12 | Overlapping booking, same venue | Two different clubs' officers each book the same venue with overlapping time windows | Second `POST`/`PUT` | 🚫 409 naming the conflicting event and venue — "\"{venue}\" is already booked for \"{other event title}\" at that time" |
| 19.13 | Back-to-back (non-overlapping) bookings | Book Event A ending at 3:00pm, then Event B starting at 3:00pm, same venue | Second `POST` | ✅ Succeeds — the boundary is exclusive, no false conflict |
| 19.14 | Conflict check excludes itself on update | Officer edits Event A's own booking (e.g. changes description only, same venue/time) | `PUT /events/{id}` | ✅ Succeeds — doesn't conflict with its own existing row |
| 19.15 | Rejected event doesn't block the venue | Book Event A at a venue, have `advisor` reject it (if FA-approval-required), then book Event B at the same venue/time | Second `POST` | ✅ Succeeds — `REJECTED` events no longer occupy the slot |
| 19.16 | Pending event still blocks the venue | Book a fee-triggering (FA-approval-`PENDING`) Event A at a venue, then try to book Event B overlapping it before `advisor` reviews A | Second `POST` | 🚫 409 — a still-pending booking counts as occupying the slot (deliberate: prevents two clubs planning around the same unconfirmed slot) |
| 19.17 | Venue bookings in a range | `GET /venues/{id}/bookings?from=...&to=...` | ✅ Returns events booked at that venue within the window, for previewing availability before submitting |
| 19.18 | Venue bookings, unknown venue | Same call, bad venue id | 🚫 404 |
| 19.19 | Free-text `location` still works standalone | Officer creates an event with only `location` filled in, no `venueId` | `POST /clubs/{id}/events` | ✅ Succeeds exactly as before — venue booking is fully optional and doesn't require touching `location` |

---

## 20. New Frontend Pages (Calendar, Notifications Center, Certificates, Member Directory, Manage Venues)

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 20.1 | Calendar — month view | Any logged-in user | Navigate to `/calendar` | ✅ Shows a month grid; days with events show colored title chips ("+N more" beyond 2); today is highlighted |
| 20.2 | Calendar — day click-through | Any user, a day with events | Click that day | ✅ Modal opens listing that day's events, each links to `/events/{id}` |
| 20.3 | Calendar — club filter | Any user | Pick a club from the filter dropdown | ✅ Grid/agenda only shows that club's events |
| 20.4 | Calendar — agenda view | Any user | Toggle to agenda/list view | ✅ Chronological upcoming-events list, respecting the club filter |
| 20.5 | Calendar — month navigation | Any user | Click prev/next/Today | ✅ Grid updates; "Today" jumps back to the current month |
| 20.6 | Calendar — cross-club visibility | Any user | Check that events from multiple different clubs appear | ✅ Confirms it reuses the cross-club `GET /events` endpoint, not a per-club one |
| 20.7 | Notifications Center — full list | Any user with notifications | Navigate to `/notifications` | ✅ Shows all notifications (not just the bell's 5-item preview) |
| 20.8 | Notifications Center — filter | Any user | Toggle All/Unread | ✅ List filters correctly |
| 20.9 | Notifications Center — mark one / mark all read | Any user | Click a notification; click "Mark all as read" | ✅ Read state updates immediately and matches the bell's unread count |
| 20.10 | Notifications — live push still works | Two sessions | Trigger a notification-worthy action for a logged-in user | ✅ Toast + bell badge update live via WebSocket, same as before the bell was rewired onto the new slice |
| 20.11 | My Certificates page | Student with at least one certificate | Navigate to `/certificates` | ✅ Shows club name + issued date per certificate |
| 20.12 | My Certificates — download | Same user | Click "Download" on a certificate | ✅ A real PDF downloads (blob request to `GET /certificates/{id}/download`) |
| 20.13 | My Certificates — empty state | Student with zero certificates | Navigate to `/certificates` | ✅ Empty-state message, no error |
| 20.14 | Member Directory | Any user | From a club page, click "View directory" → `/clubs/{id}/members` | ✅ Searchable/sortable table: name, position badge, status, joined date |
| 20.15 | Member Directory — search & sort | Any user | Type in the search box; change the sort dropdown | ✅ Table filters/reorders client-side without a page reload |
| 20.16 | Manage Venues — visible only to Super Admin | `superadmin` | Dashboard → Super Admin section → "Manage venues" → `/admin/venues` | ✅ Link only shown on the Super Admin's dashboard, page lists/creates/edits/deactivates venues |
| 20.17 | Manage Venues — mutation blocked for other roles | `advisor`/student, navigating directly to `/admin/venues` | Try to create/edit/deactivate a venue from the UI | 🚫 Backend returns 403 even though the page itself renders (matches the existing app-wide pattern of hiding nav links rather than route-gating; verify no client-side crash on the 403) |
| 20.18 | Event create/edit — venue picker | Officer | Open "Create event", pick a venue from the dropdown | ✅ End-time field appears only once a venue is selected; submitting without it shows the 19.9 validation message inline |
| 20.19 | Event create/edit — conflict surfaces in UI | Officer | Trigger 19.12 through the UI (two overlapping bookings at the same venue) | ✅ Toast shows the backend's 409 conflict message verbatim, not a generic error |
| 20.20 | Event detail — venue display | Any user | View an event booked against a venue | ✅ Shows "Booked: {venue} ({building}) · {start} – {end}" alongside the existing free-text location line (if both are set, both show) |

---

## 21. Venue Utilization Report & Auto-Suggest Slots

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 21.1 | Utilization summary | Any logged-in user | `GET /venues/utilization` | ✅ One entry per active venue: `totalBookings`, `upcomingBookingCount`, `nextBooking` (or null), sorted busiest-first by `upcomingBookingCount` |
| 21.2 | Utilization excludes rejected bookings | Book an event at a venue, have it rejected (FA-approval path) | Re-check utilization | ✅ `totalBookings`/`upcomingBookingCount` no longer include the rejected event |
| 21.3 | Utilization excludes past events from "upcoming" | Book a venue for a past date (test data) and a future date | Check utilization | ✅ `totalBookings` counts both, `upcomingBookingCount` only the future one, `nextBooking` is the future one |
| 21.4 | "Busiest venues" UI | `superadmin` | `/admin/venues` | ✅ Section above the venue list shows each venue's upcoming-booking badge and next-booking summary; empty venues show "No upcoming bookings" |
| 21.5 | Next-available-slot, no conflicts | Any user | `GET /venues/{id}/next-available-slot?desiredStart=...&durationMinutes=60` on a free venue/time | ✅ `found=true`, `start` equals `desiredStart` |
| 21.6 | Next-available-slot, one conflict | Same venue already booked 2–3pm | Request `desiredStart=2:30pm&durationMinutes=60` | ✅ `found=true`, `start` = 3:00pm (the conflicting booking's end) |
| 21.7 | Next-available-slot, fully booked venue | Book the venue solid for 14+ days from `desiredStart` (test data) | Same call | 🚫 `found=false` (search gives up after the 14-day horizon) |
| 21.8 | Next-available-slot, unknown venue | Bad venue id | Same call | 🚫 404 |
| 21.9 | "Check availability" in Create Event modal | Officer | Pick a venue + start time, click "Check availability" | ✅ Shows "That time is free ✓" or "Busy — next available {time} [Use this time]"; clicking "Use this time" fills in the start/end fields |

## 22. Bulk Certificate Issuance

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 22.1 | Bulk-issue as officer | Officer of the event's club | `POST /certificates/clubs/{clubId}/events/{eventId}/bulk-issue` | ✅ Returns `{consideredCount, issuedCount, alreadyIssuedCount, notYetEligibleCount}`; tally sums to `consideredCount` (= number of attendance rows for that event) |
| 22.2 | Bulk-issue as non-officer | Plain member or non-member | Same call | 🚫 403 "Only club officers can issue certificates" |
| 22.3 | Bulk-issue with mismatched club/event | Officer of club A, targeting an event that belongs to club B | `POST /certificates/clubs/{clubAId}/events/{clubBEventId}/bulk-issue` | 🚫 404 "Event not found" |
| 22.4 | Bulk-issue idempotent | Run 22.1 twice in a row | Second call | ✅ Same attendees now come back as `alreadyIssuedCount`, `issuedCount=0` — reuses the existing DB unique-constraint dedup, no duplicate certificates created |
| 22.5 | Bulk-issue respects the existing threshold | An attendee with fewer than 3 total attendances in that club | Included in the sweep | ✅ Counted in `notYetEligibleCount`, no certificate created — unchanged eligibility rule from automatic issuance |
| 22.6 | "Bulk-issue certificates" button | Officer, on `EventDetailPage` | Click the button | ✅ Toast shows the tally in plain language; button is not visible to non-officers |

## 23. Alumni Directory

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 23.1 | Set graduation year | Any user | `PUT /auth/me/profile` with `graduationYear` set | ✅ Saved; round-trips in the response and in `GET /auth/me` |
| 23.2 | Alumni list, past year | A user with `graduationYear` earlier than the current year | `GET /users/alumni` | ✅ Appears in the list, sorted most-recently-graduated first |
| 23.3 | Alumni list excludes current/future years | A user with `graduationYear` this year or later, or unset | Same call | ✅ Not included |
| 23.4 | Alumni status doesn't affect permissions | An "alumni" user (past graduation year) | Try any normal STUDENT action (join a club, RSVP, etc.) | ✅ Works exactly as before — graduation year is informational only, not a new Role/status, confirmed no permission check anywhere references it |
| 23.5 | Alumni Directory page | Any user | Navigate to `/alumni` | ✅ Lists name + "Class of {year}" per alumnus; search filters by name; empty state if none |
| 23.6 | Profile page graduation year field | Any user | `/profile` → edit form | ✅ New "Graduation year (optional)" input, persists across reload |

## 24. Discussion Threads on Events

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 24.1 | Post a comment | Approved member of the event's club | `POST /events/{id}/comments` | ✅ Created, returned with `authorName` |
| 24.2 | Post as non-member | Non-member of that club | Same call | 🚫 403 "Only club members can comment" |
| 24.3 | Post on nonexistent event | Bad event id | Same call | 🚫 404 |
| 24.4 | List comments | Anyone, including logged-out-of-that-club users | `GET /events/{id}/comments` | ✅ Public read, chronological order |
| 24.5 | Delete own comment | Comment author | `DELETE /events/{id}/comments/{commentId}` | ✅ Removed |
| 24.6 | Delete as the club's president | President, not the author | Same call | ✅ Allowed (moderation power, same rule as announcement comments) |
| 24.7 | Delete as unrelated member | Different member, not author, not president | Same call | 🚫 403 |
| 24.8 | Delete with mismatched event in path | Comment's real event vs. a different event id in the path | Same call | 🚫 404 "Comment not found" |
| 24.9 | Discussion section on Event Detail | Any user | View an event, scroll to "Discussion" | ✅ Separate from the star-rating Feedback section; post box, list, delete-when-allowed all work |

## 25. Club Resource Library

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 25.1 | Upload resource | Club officer | `POST /clubs/{id}/resources` with `title`, `fileName`, `contentType`, base64 `fileB64` | ✅ Created, listed with `uploadedByName`/`uploadedById` |
| 25.2 | Upload as non-officer | Plain member or non-member | Same call | 🚫 403 "Only club officers can upload resources" |
| 25.3 | Upload with blank title or missing file | Officer, omit `title` or `fileB64` | Same call | 🚫 400 |
| 25.4 | List resources | Anyone | `GET /clubs/{id}/resources` | ✅ Public read, metadata only (no `fileB64` in the list payload) |
| 25.5 | Download resource | Anyone | `GET /clubs/{id}/resources/{resourceId}/download` | ✅ Correct bytes, `Content-Type` matches what was uploaded, `Content-Disposition` filename matches |
| 25.6 | Download with mismatched club in path | Resource's real club vs. a different club id in the path | Same call | 🚫 404 |
| 25.7 | Delete own upload | Uploader | `DELETE /clubs/{id}/resources/{resourceId}` | ✅ Removed |
| 25.8 | Delete as club president (not uploader) | President | Same call | ✅ Allowed |
| 25.9 | Delete as unrelated member | Different member | Same call | 🚫 403 "Only the uploader or the Club Admin can delete this resource" |
| 25.10 | Resources section on Club Detail | Any user | View a club, scroll to "Resources" | ✅ Officer-only upload form (title + file picker); anyone can download; delete button only shown to uploader/president |
| 25.11 | Round-trip integrity | Officer | Upload a small text/PDF file, then download it | ✅ Downloaded bytes are byte-for-byte identical to the original upload |

---

**E2E-11: Bulk certificate issuance after a well-attended event**
1. As `alice` (PRESIDENT), create an event and mark 3 attendees present across enough of the club's events to cross the 3-attendance threshold for at least one of them (or use seeded data with existing attendance history).
2. Click "Bulk-issue certificates" on the event's detail page.
3. Confirm the toast tally matches expectations, and the newly-issued attendee's certificate now appears on their `/certificates` page.
4. Repeat step 2 → confirm the same attendee now shows up under "already had one," not issued again.

**E2E-12: Resource library + discussion thread on the same event**
1. As `alice` (PRESIDENT), upload the club's constitution PDF via the Resources section on the club page.
2. As `bob` (VP), download it and confirm it opens correctly.
3. As `carol` (MEMBER), post a discussion comment on an upcoming Tech Innovators event asking about the venue.
4. As `alice`, reply isn't needed — just delete Carol's comment as club president to confirm the moderation power works on event comments the same way it does on announcement comments.

---

## 26. Deployment & Configuration Safety

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 26.1 | No demo accounts in production | Start the `prod` profile against an empty database with `SEED_DEMO_DATA` unset | ✅ No users or clubs are created — in particular no `superadmin@example.com` / `password123`. (Before, the seeder ran on any empty DB.) The local `docker-compose.yml` sets `SEED_DEMO_DATA=true` so the demo stack still loads demo data |
| 26.2 | Bootstrap the first admin | Empty DB, seeding off, set `BOOTSTRAP_ADMIN_EMAIL` and a 12+ character `BOOTSTRAP_ADMIN_PASSWORD`; start twice | ✅ One verified Super Admin is created on the first start; the second start creates nothing. A shorter password logs an error and creates nothing; an email that already belongs to a non-admin is refused |
| 26.3 | Schema management (Flyway) | Start the backend against (a) an empty database, (b) a database created by the old `ddl-auto=update` builds (no Flyway history), (c) a database Hibernate already upgraded to the newest entities | ✅ (a) V1→V2→V3→V4 applied in order; (b) baselined at V1 (its existing data is kept) then V2→V3→V4 applied — including the venue/resource/comment tables and columns an older DB lacks; (c) baselined then V2/V3 run as harmless no-ops and V4 adds the `active` column; in every case Hibernate `validate` passes. Verified against a clone of the real dev database (rows and Presidents preserved) |
| 26.4 | Email verification switch | Toggle `REQUIRE_EMAIL_VERIFICATION` | ✅ `false` (dev, compose) = no gate; `true` (prod default) = 1.33 behaviour |
| 26.5 | Forwarded headers | Toggle `TRUST_FORWARDED_HEADERS` | ✅ `false` = rate limiting uses the socket IP (1.31); `true` = first `X-Forwarded-For` entry (only behind a proxy that overwrites it) |
| 26.6 | Upgrading an existing database | Start this build against a database created by the previous version (`ddl-auto=update`) | ✅ App starts; existing clubs get membership fee 0, no certificate threshold (falls back to 3) and `archived=false`; events `cancelled=false`; users `emailNotificationsEnabled=true`. Existing presidents get their `president_club_id` marker the next time their membership row is written (the unique index protects hand-offs from then on) |
| 26.7 | CORS exposes pagination header | From the frontend, read `X-Total-Count` on a paged request | ✅ Header is readable in the browser |
| 26.8 | Migration rules | Edit an already-applied migration file and restart; add an entity column without a migration | 🚫 Flyway refuses the changed checksum; startup fails loudly with a schema-validation error naming the missing column/table — nothing is altered silently. Fix by adding a new `V<n>` migration |
| 26.9 | Health endpoint | `GET /api/health` with no token; then stop MySQL and call it again | ✅ 200 `{"status":"UP","database":"UP","version":"<commit>"}` (public, reveals nothing else); 🚫 503 with `"DOWN"` when the database is unreachable. `version` is the deployed commit (`APP_VERSION` / `RENDER_GIT_COMMIT`), `unknown` locally |
| 26.10 | Dedicated test database | Run `./mvnw verify` with only `DB_USERNAME`/`DB_PASSWORD` set | ✅ Integration tests use `club_management_test` (created on demand), never `club_management`; pointing `TEST_DATASOURCE_URL` at a database whose name lacks "test" aborts before anything is wiped |
| 26.11 | Container | `docker build ./backend` then run with the env vars; `docker inspect` health | ✅ Runs as a non-root user, honours `PORT`, container health turns healthy via `/api/health`, `/api/health` reports the `GIT_SHA` build argument. *(Not built during authoring — first real test of the Dockerfile)* |

---

## 27. Frontend Wiring for Changed Workflows

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 27.1 | Event page — officer tools | Open an event as an officer | ✅ "Cancel event" button (prompt for a reason); banners for cancelled, pending-approval and rejected (with reason) states; RSVP button hidden on a cancelled event |
| 27.2 | Event page — student | Open an event as a student | ✅ No "QR check-in" button; helper text "scan the QR code the organisers are showing"; "You are checked in." after attending; cancelling a paid RSVP says the fee was refunded |
| 27.3 | QR window refreshes | Officer opens "Show check-in QR code" and waits 2+ minutes | ✅ The image swaps to a fresh code without closing the dialog; a scan of an old screenshot after ~10 minutes fails |
| 27.4 | Check-in link | Open `/checkin/{eventId}?t=<token>`; then the same URL without `t` | ✅ "You are checked in!" with a valid token; a clear "invalid or has expired" error without |
| 27.5 | Club page | As a student / President | ✅ Join button shows the fee and asks to confirm payment; President sees "Archive club" and a remove icon per non-President member; archived clubs show a banner and no Join button; Edit club has "Membership fee" and "Events for certificate" fields |
| 27.6 | Profile | Change password; toggle the email-notification checkbox | ✅ Session survives the password change; the checkbox persists after Save |
| 27.7 | Pending event approvals | Faculty Advisor clicks Reject | ✅ Prompts for an optional reason (Cancel aborts the rejection) |
| 27.8 | Events list | View the list with a cancelled event | ✅ Red "Cancelled" badge next to the club badge |
| 27.9 | Log expense dialog | Open as President/Treasurer | ✅ Optional Category and Date fields; date picker can't go into the future |
| 27.10 | Public certificate page | Open `/verify-certificate/{code}` logged out | ✅ Renders without login (valid / not found / temporary error states) |
| 27.11 | Registration screen (verification required) | Register while the API returns 202 | ✅ "Check your email" screen that never says whether the address was new; no session is stored; "Back to log in" link |
| 27.12 | Comment reporting UI | Member: "Report" next to another member's comment on an announcement and on an event; President: club page | ✅ Report prompts for a reason and confirms; no Report link on your own comments; the President sees a "Reported comments" queue with Dismiss / Remove comment; a removed comment disappears from the thread |
| 27.13 | Claim presidency button | Officer (not President) on the club page | ✅ "Claim presidency" is shown to officers only; a refusal shows the server's reason in a toast; success updates the members list and the buttons |
| 27.14 | Event budget field and ledger table | Create event dialog; club page as President/Treasurer | ✅ Optional Budget field (pre-filled when editing); the ledger shows the per-event budget table |
| 27.15 | Digest checkbox | Profile | ✅ "Send one daily digest…" is disabled while email notifications are off and persists after Save |

---

**E2E-13: Paid event, cancelled RSVP refunded, then cancelled event refunds everyone**
1. As `alice` (PRESIDENT), create an event with fee 100 for next week.
2. As `carol`: try RSVP without paying → blocked (6.13); pay; RSVP → `GOING`. Log in as `bob`, pay and RSVP too.
3. As `alice`, open the ledger → income 200. As `carol`, cancel the RSVP → refund notification; ledger income 100.
4. As `alice`, try to change the fee → blocked (5.24). Cancel the event with a reason.
5. Confirm: `bob` is notified of the cancellation and refunded; ledger income back to 0; the event shows "Cancelled"; nobody can RSVP or pay any more.

**E2E-14: Fee-gated club with rejection refund**
1. As `dave` (PRESIDENT of Creative Arts) set join policy "Approval required", membership fee 50, certificate threshold 2.
2. As `bob`: join → blocked; pay; join → `PENDING`. `dave` receives a notification.
3. `dave` rejects → `bob` is refunded (payments page + notification) and can re-apply, but must pay again.
4. `bob` pays and re-applies; `dave` approves; the ledger shows income 50.

**E2E-15: Closing a club**
1. As `alice`, create two upcoming Tech Innovators events, one paid; have `carol` RSVP to both.
2. As `alice`, archive the club.
3. Confirm: both events cancelled, `carol` notified and refunded for the paid one, all members notified, the club and events vanish from browse pages, joining is refused, the ledger/history remain visible to officers and Super Admin, and `superadmin` can unarchive.

**E2E-16: QR check-in cannot be faked**
1. As `alice`, create a capacity-limited event starting in the past hour (or wait until it starts) and RSVP `carol` only.
2. Officer opens the QR; copy its link. `carol` opens it → checked in. `dave` (no RSVP) opens it → "RSVP-only".
3. `bob` tries `POST …/qr-check-in` with no token and with just the event id → 403.
4. After 10+ minutes, re-use the copied link → 403; a fresh QR works.

---

## 28. Comment Moderation (reporting)

| # | Scenario | Actor | Steps | Expected |
|---|---|---|---|---|
| 28.1 | Report a comment | Club member | `POST /clubs/{id}/announcements/{aid}/comments/{cid}/report` or `POST /events/{eid}/comments/{cid}/report` with `{"reason":"…"}` | ✅ An OPEN report is stored with a snapshot of the comment text and author name; the President is notified "A comment in <club> was reported and needs your review." |
| 28.2 | Report rules | Author / non-member / pending member / repeat reporter | Same call | 🚫 400 "You can't report your own comment"; 403 "Only club members can report comments" (a pending applicant counts as a non-member); 409 "You have already reported this comment"; blank reason 400, reason over 500 characters 400 |
| 28.3 | Wrong club / announcement | Member | Report a comment through another club's or another announcement's URL | 🚫 404 "Comment not found" |
| 28.4 | Review queue | President vs anyone else | `GET /clubs/{id}/comment-reports` | ✅ President sees open reports oldest first (comment text, author, reporter, reason); everyone else 🚫 403 "Only the Club Admin can review reported comments" |
| 28.5 | Dismiss | President | `POST /clubs/{id}/comment-reports/{rid}/resolve` `{"action":"DISMISS"}` | ✅ Report → `DISMISSED`; the comment stays; the reporter is told it was reviewed; audit `DISMISS_COMMENT_REPORT` |
| 28.6 | Remove the comment | President | Same call with `{"action":"DELETE_COMMENT"}` | ✅ The comment is deleted; this report and **every other open report about the same comment** become `ACTION_TAKEN`; each reporter is thanked; audit `REMOVE_REPORTED_COMMENT` records author and text (the snapshot survives the deletion) |
| 28.7 | Resolve rules | President | Unknown action, an already-handled report, a report id from another club | 🚫 400 "Action must be DISMISS or DELETE_COMMENT"; 400 "already been handled"; 404 "Report not found"; non-President 403 |
| 28.8 | Existing moderation still works | Author / President | Delete comments directly (4.9–4.12) | ✅ Unchanged: author or President may delete; cross-club deletes are 404 |

---

## 29. CI/CD Pipelines (backend and frontend are separate)

These checks are done on GitHub after the first push; see `docs/DEPLOYMENT.md` for setup.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 29.1 | Path isolation | Open a PR that changes only `frontend/…`; another that changes only `backend/…`; a third that only edits `README.md` | ✅ Frontend PR runs only **Frontend CI/CD**; backend PR runs only **Backend CI/CD**; the README-only PR runs neither |
| 29.2 | Backend tests gate everything | Break a backend test on a PR branch | 🚫 **Test** fails; the image and deploy jobs never start; the PR is blocked once branch protection requires the check |
| 29.3 | Real database in CI | Look at the backend Test job | ✅ A MySQL 8.4 service starts, Flyway applies V1–V4 from scratch, ~315 tests (unit + integration) run, a summary table appears on the run page and the surefire reports are downloadable |
| 29.4 | Frontend gates | Introduce a lint error, then a failing Vitest test, then a high-severity dependency | 🚫 Each fails the **Lint, test and build** job (audit fails on high or worse); `frontend-dist` is uploaded on success |
| 29.5 | PR preview | Open a PR from a branch in this repo with the Vercel secrets set | ✅ A preview deployment is created and a single PR comment with the URL is created/updated on each push; forked PRs skip the preview without failing |
| 29.6 | Unconfigured deploys skip visibly | Merge to `main` with the deploy secrets/variables absent | ✅ Tests and image build run; the deploy job shows a **warning annotation** ("Deployment skipped…") and does not fail; nothing is deployed |
| 29.7 | Backend deploy | Merge a backend change to `main` with everything configured | ✅ Test → image (pushed to GHCR tagged with the commit and `latest`, Trivy scan) → deploy: Render hook called → job waits until `/api/health` shows **this commit** and `UP` → smoke tests pass (anonymous `/api/clubs` is 401; public verify endpoint 200) → summary written |
| 29.8 | Bad release never goes live | Deploy a build that cannot start (e.g. wrong `DATABASE_URL`) | 🚫 The deploy job fails after the 15-minute wait with "never became healthy"; the **previous version keeps serving** (Render health check); the site is never down |
| 29.9 | Frontend deploy | Merge a frontend change to `main` | ✅ Build with `VITE_API_BASE_URL` → production deploy → smoke test: `/` returns 200 with the app root, and a deep link such as `/clubs/does-not-exist` also returns 200 (SPA rewrite) |
| 29.10 | Manual deploy | Actions → run either workflow on `main` with *deploy* ticked / on another branch | ✅ Deploy jobs run only on `main`; on other branches they are skipped |
| 29.11 | Concurrency | Push two commits quickly to a PR; merge two PRs back-to-back | ✅ The older PR run is cancelled; on `main` runs queue and a production deploy is never cancelled mid-way; two production deploys never overlap |
| 29.12 | Approval gate (optional) | Add required reviewers to the `production` environment | ✅ The deploy job waits for approval and shows the environment URL afterwards |
| 29.13 | Image scanning | Introduce a base image with a fixable CRITICAL CVE | 🚫 The Trivy step fails the image job (HIGH and below are informational) |
| 29.14 | Dependabot | Wait for the weekly run | ✅ Grouped PRs for Maven (Spring), npm, both Dockerfiles and GitHub Actions; each PR runs only its own pipeline |
| 29.15 | Rollback | Follow *Rollback* in `docs/DEPLOYMENT.md` on a live deploy | ✅ Render rollback (or a revert commit) restores the previous version; `/api/health` shows its commit; the frontend can be promoted back from Vercel |

---

## 30. Upgrading an Existing Installation

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 30.1 | Upgrade the real dev database | Back it up (`mysqldump club_management > backup.sql`), start the new backend once | ✅ Flyway baselines at V1, applies V2, V3 and V4 (a few seconds); the app starts; every user, club, event and membership is still there; existing Presidents are marked so the one-President constraint protects them; nothing asks you to change `.env` |
| 30.2 | Old data is usable | Log in with an existing account; open a club with an existing logo/banner/announcement; upload a new large logo | ✅ Existing content displays; new uploads of realistic size work (columns are now `longtext`); the club shows fee 0 and default certificate threshold |
| 30.3 | Schema drift is caught | Manually `ALTER TABLE clubs DROP COLUMN archived` on a scratch DB and start | 🚫 Startup fails with a schema-validation error naming the column (instead of failing later on a user's request) |
| 30.4 | Re-running is harmless | Start the backend repeatedly | ✅ Flyway reports "Schema is up to date. No migration necessary" |

---

## 31. Proposal Gap Closure: User Management, Reports, Participation History, Backups, Accessibility

### User management (`/api/admin/users`, page `/admin/users`, Super Admin only)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 31.1 | Entry points | `superadmin` → sidebar "Administration → Users" and Dashboard "Manage users & roles" | ✅ Both open `/admin/users`; the list shows every account with role badge, "Deactivated"/"You" tags, verified state and join date |
| 31.2 | Access control | `alice`/`advisor` call `GET /api/admin/users` (and POST/PUT/activate/deactivate); anonymous call | 🚫 403 for every non-Super-Admin role, 401 anonymous; the page itself shows the 403 message rather than crashing |
| 31.3 | Search, filter, paging | Type part of a name or email and Search; pick a role; with more than 20 users use Next/Previous | ✅ Results narrow (name or email, case-insensitive) and combine with the role filter; "Page x of y · N users" updates; searching returns to page 1 |
| 31.4 | Create a user | New user → name, email, temporary password (8+), role Faculty Advisor → Create | ✅ 201; appears in the list; the new user can sign in immediately (email pre-verified) and has the chosen role; audit `CREATE_USER`. Omitting the role creates a Student |
| 31.5 | Create validation | Duplicate email; email without `@`; password under 8 characters; blank name | 🚫 409 "already exists"; 400 "A valid email is required"; 400 "Password must be at least 8 characters"; 400 "Name is required"; the dialog stays open with the message in a toast |
| 31.6 | Assign a role | Edit `carol` → role Faculty Advisor → Save | ✅ The server applies it on her very next request (no new token needed); after she reloads the page she sees Advisor tools in the sidebar; audit `UPDATE_USER` records `role STUDENT -> FACULTY_ADVISOR` |
| 31.7 | Edit name/email | Change a user's email to one already in use / to a new one | 🚫 409 for a taken address; ✅ otherwise saved (lower-cased) and audited |
| 31.8 | Cannot change or remove yourself | As `superadmin`: open Edit on your own row; try `PUT` with another role for your own id; try to deactivate yourself | ✅ Role selector is disabled and the Deactivate button is disabled; 🚫 API returns 400 "You cannot change your own role" / "You cannot deactivate your own account" |
| 31.9 | Last Super Admin is protected | With a single active Super Admin, demote or deactivate them via the API (from another Super Admin session first, then reduce to one) | 🚫 400 "Cannot demote/deactivate the last active Super Admin"; with two active Super Admins one can be demoted |
| 31.10 | Deactivate | Deactivate `carol` (confirm the prompt; cancelling does nothing) | ✅ She is marked Deactivated; her existing session's next request is rejected (401) and she cannot sign in ("This account has been deactivated…", only after entering the correct password); her memberships, RSVPs and history stay; audit `DEACTIVATE_USER` |
| 31.11 | Reactivate | Reactivate `carol` | ✅ She can sign in again with her old password; audit `ACTIVATE_USER` |

### Cancel membership confirmation (UC12)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 31.12 | Confirm before leaving | `carol` on Tech Innovators → Leave club → Cancel in the browser prompt; then Leave club → OK | ✅ Cancel keeps the membership active and changes nothing; OK removes her from the active list (status `LEFT`) with a "You left the club" toast |

### Reports and export (UC11 / UC13)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 31.13 | Club CSV as an officer | `alice` → Tech Innovators → export CSV | ✅ Starts with the `Metric,Value` summary, then labelled sections: **Club information**, **Activities and participation** (event, date, status Upcoming/Held/Cancelled/…, going, attended, no-shows, average rating; no-shows/attended are blank for events not yet held) and **Members** (name, position, joined) |
| 31.14 | Club CSV as a regular member | `carol` exports the same club | ✅ Summary, club information and activities are present; **no Members section**; financial figures are 0 as before |
| 31.15 | Club PDF | Export PDF as `alice` for a club with many members/events | ✅ Same content as the CSV as readable table rows; long lists continue on extra pages; club names or member names with non-Latin characters show `?` instead of failing the export |
| 31.16 | University report | `superadmin` / `advisor` → Analytics → CSV and PDF | ✅ Headline metrics plus a **Clubs** table (club, category, members, events) for approved, non-archived clubs; students get 403 |
| 31.17 | Unknown club | `GET /api/analytics/clubs/{random-uuid}/csv` | 🚫 404 "Club not found" |
| 31.18 | Formula safety | A member named `=HYPERLINK(...)` in the Members section, opened in a spreadsheet | ✅ The cell is prefixed with `'` and not evaluated |

### Participation history

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 31.19 | My participation | Check `carol` in to two events in different clubs (QR and manual), then sidebar → "My participation" (`/participation`) | ✅ "2 events attended" plus a per-club count; each row shows the event (linked), club (linked), date and how she was checked in; newest event first |
| 31.20 | Only my own | `GET /api/attendance/me` as `bob` | ✅ Contains only `bob`'s check-ins, never another user's; a user with none sees the "No participation yet" empty state |

### Backups (NFR11)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 31.21 | Scheduled backups | `docker compose up`; wait or set `BACKUP_INTERVAL_SECONDS=30`; look in `./backups/` | ✅ A `club_management-<UTC timestamp>.sql.gz` appears immediately and then every interval; only the newest `BACKUP_KEEP` files remain; `./backups/` is git-ignored |
| 31.22 | On-demand backup | `docker compose exec backup sh /backup.sh` | ✅ One more dump is written; exit status 0 |
| 31.23 | Failed backup is not kept | Stop the `mysql` container mid-run / give a wrong `MYSQL_PWD`, run the backup | 🚫 "mysqldump failed", non-zero exit, no partial `.part`/`.sql.gz` left behind; the loop retries at the next interval |
| 31.24 | Restore | Add a club, take a backup, delete the club, then `scripts/restore.sh backups/<file>` (answer `yes`) | ✅ Backend stops, data is replaced, backend restarts; the club is back; answering anything but `yes` (or a missing/invalid file) restores nothing |

### Accessibility (NFR10)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 31.25 | Skip link | Load any signed-in page, press Tab once | ✅ A "Skip to main content" link appears; Enter moves focus to the page content, past the sidebar |
| 31.26 | Dialog focus | Open any dialog (e.g. New user, Create club) with the keyboard | ✅ Focus moves into the dialog (first field); Tab/Shift+Tab cycle inside it and never reach the page behind; Esc closes it and focus returns to the button that opened it |
| 31.27 | Announcements | Trigger an error (e.g. wrong password change) and a success (save profile) with a screen reader on | ✅ Errors are announced immediately (alert); successes politely (status) |
| 31.28 | Form labels | Inspect the user-management search box, role filter, and dialogs | ✅ Every control has a visible or screen-reader label; the password field explains its rule; pagination is a labelled navigation region |

---

**E2E-17: Comment moderation**
1. `carol` posts an off-topic comment on a Tech Innovators event; `bob` (member) reports it with a reason; `dave` (not a member) tries to report it and is refused.
2. `alice` (President) sees the report in "Reported comments" on the club page, removes the comment; `bob` is thanked; a second reporter's report on the same comment closes automatically.
3. Check the audit log shows who removed what, including the original text.

**E2E-18: Succession after graduation**
1. As `alice` (President) set the graduation year to last year in the profile → `bob` (VP) gets the notification.
2. `bob` clicks "Claim presidency" → he is President, `alice` is a member; both are notified; `alice` immediately loses Club Admin powers.
3. Repeat with a second officer claiming at the same moment (script two requests) → exactly one succeeds.

**E2E-19: First production release**
1. Configure Render + Vercel + GitHub as in `docs/DEPLOYMENT.md`; merge to `main`.
2. Watch both pipelines; confirm `/api/health` reports the commit; sign in with the bootstrap admin; create a club, an event, RSVP as a second (verified) account; remove `BOOTSTRAP_ADMIN_*` from Render.
3. Push a deliberately broken backend change → the deploy job fails, the site stays up on the previous version.

---

### How to use this file
Work top to bottom, checking off each row as pass/fail. For any row marked "verify" or "investigate," the expected behavior wasn't confirmed by reading the code — note what you actually observe so it can be compared against intended design.
