-- ============================================================================
-- Seed.sql — demo/sample data for the club_management MySQL database.
--
-- Mirrors the data produced by DataSeeder.java (src/main/java/com/club/backend/
-- config/DataSeeder.java) plus a few extra rows so every table has sample data.
-- Run this manually (e.g. `mysql -u root -p club_management < Seed.sql`) after
-- Hibernate has created the schema (spring.jpa.hibernate.ddl-auto=update).
--
-- All UUID primary keys are stored as BINARY(16) (Hibernate's default MySQL
-- mapping for java.util.UUID), so ids are generated with UUID_TO_BIN(UUID())
-- and kept in session variables so foreign keys line up.
--
-- Demo login password for every seeded user: password123
-- (BCrypt hash below was generated with strength 10, compatible with
-- Spring Security's BCryptPasswordEncoder.)
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE announcement_comments;
TRUNCATE TABLE club_announcements;
TRUNCATE TABLE event_feedback;
TRUNCATE TABLE attendance;
TRUNCATE TABLE rsvps;
TRUNCATE TABLE certificates;
TRUNCATE TABLE club_expenses;
TRUNCATE TABLE payments;
TRUNCATE TABLE notifications;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE events;
TRUNCATE TABLE memberships;
TRUNCATE TABLE clubs;
TRUNCATE TABLE email_verification_tokens;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
SET @pw_hash = '$2b$10$LsGuei1ZYXNJNP/qcqQ6BettPEE3qiF3jhPm8Sw4GVqaNg0ea9x8i'; -- password123

SET @u_superadmin = UUID_TO_BIN(UUID());
SET @u_advisor    = UUID_TO_BIN(UUID());
SET @u_alice      = UUID_TO_BIN(UUID());
SET @u_bob        = UUID_TO_BIN(UUID());
SET @u_carol      = UUID_TO_BIN(UUID());
SET @u_dave       = UUID_TO_BIN(UUID());

INSERT INTO users (id, name, email, password_hash, role, profile_image_b64, email_verified, created_at) VALUES
(@u_superadmin, 'Super Admin',     'superadmin@example.com', @pw_hash, 'SUPER_ADMIN',     NULL, 1, NOW(6)),
(@u_advisor,    'Faculty Advisor', 'advisor@example.com',    @pw_hash, 'FACULTY_ADVISOR', NULL, 1, NOW(6)),
(@u_alice,      'Alice Johnson',   'alice@example.com',      @pw_hash, 'STUDENT',         NULL, 1, NOW(6)),
(@u_bob,        'Bob Smith',       'bob@example.com',        @pw_hash, 'STUDENT',         NULL, 1, NOW(6)),
(@u_carol,      'Carol Lee',       'carol@example.com',      @pw_hash, 'STUDENT',         NULL, 1, NOW(6)),
(@u_dave,       'Dave Kim',        'dave@example.com',       @pw_hash, 'STUDENT',         NULL, 1, NOW(6));

-- ----------------------------------------------------------------------------
-- Clubs
-- ----------------------------------------------------------------------------
SET @c_tech = UUID_TO_BIN(UUID());
SET @c_art  = UUID_TO_BIN(UUID());

INSERT INTO clubs (id, name, description, category, status, join_policy, logo_b64, created_by, created_at) VALUES
(@c_tech, 'Tech Innovators',         'Building cool things with code.',   'Tech',     'APPROVED', 'OPEN', NULL, @u_superadmin, NOW(6)),
(@c_art,  'Creative Arts Society',   'Painting, sculpture, and more.',    'Cultural', 'APPROVED', 'OPEN', NULL, @u_superadmin, NOW(6));

-- ----------------------------------------------------------------------------
-- Memberships
-- ----------------------------------------------------------------------------
INSERT INTO memberships (id, user_id, club_id, position, status, joined_at) VALUES
(UUID_TO_BIN(UUID()), @u_alice, @c_tech, 'PRESIDENT', 'APPROVED', NOW(6)),
(UUID_TO_BIN(UUID()), @u_bob,   @c_tech, 'VP',        'APPROVED', NOW(6)),
(UUID_TO_BIN(UUID()), @u_carol, @c_tech, 'MEMBER',    'APPROVED', NOW(6)),
(UUID_TO_BIN(UUID()), @u_dave,  @c_art,  'PRESIDENT', 'APPROVED', NOW(6)),
(UUID_TO_BIN(UUID()), @u_alice, @c_art,  'MEMBER',    'APPROVED', NOW(6));

-- ----------------------------------------------------------------------------
-- Club announcements (+ one comment)
-- ----------------------------------------------------------------------------
SET @ann_welcome = UUID_TO_BIN(UUID());

INSERT INTO club_announcements (id, club_id, author_id, content, created_at) VALUES
(@ann_welcome, @c_tech, @u_alice, 'Welcome to Tech Innovators! Our first meetup is next week.', NOW(6));

INSERT INTO announcement_comments (id, announcement_id, author_id, content, created_at) VALUES
(UUID_TO_BIN(UUID()), @ann_welcome, @u_bob, 'Looking forward to it!', NOW(6));

-- ----------------------------------------------------------------------------
-- Events
-- ----------------------------------------------------------------------------
SET @e_hacknight = UUID_TO_BIN(UUID());
SET @e_workshop  = UUID_TO_BIN(UUID());
SET @e_artshow   = UUID_TO_BIN(UUID());

INSERT INTO events (id, club_id, title, description, location, banner_b64, event_date, fee, capacity, requires_fa_approval, approval_status, created_at) VALUES
(@e_hacknight, @c_tech, 'Hack Night',             'An evening of building side projects.', 'Engineering Building, Room 204', NULL, DATE_ADD(NOW(6), INTERVAL 7 DAY),  0.00,    20,   0, 'NOT_REQUIRED', NOW(6)),
(@e_workshop,  @c_tech, 'Intro to Git Workshop',  'Beginner-friendly Git workshop.',        'Library, Study Room 3',          NULL, DATE_SUB(NOW(6), INTERVAL 14 DAY), 0.00,    NULL, 0, 'NOT_REQUIRED', NOW(6)),
(@e_artshow,   @c_art,  'Annual Art Show',        'Showcasing student artwork, ticketed entry.', 'Main Gallery Hall',         NULL, DATE_ADD(NOW(6), INTERVAL 21 DAY), 7500.00, 50,   1, 'PENDING',      NOW(6));

-- ----------------------------------------------------------------------------
-- RSVPs
-- ----------------------------------------------------------------------------
INSERT INTO rsvps (id, event_id, user_id, status, waitlist_order, rsvp_at) VALUES
(UUID_TO_BIN(UUID()), @e_hacknight, @u_bob,   'GOING', NULL, NOW(6)),
(UUID_TO_BIN(UUID()), @e_hacknight, @u_carol, 'GOING', NULL, NOW(6)),
(UUID_TO_BIN(UUID()), @e_artshow,   @u_carol, 'GOING', NULL, NOW(6));

-- ----------------------------------------------------------------------------
-- Attendance
-- ----------------------------------------------------------------------------
INSERT INTO attendance (id, event_id, user_id, method, marked_at) VALUES
(UUID_TO_BIN(UUID()), @e_workshop, @u_bob,   'MANUAL', NOW(6)),
(UUID_TO_BIN(UUID()), @e_workshop, @u_carol, 'QR',     NOW(6));

-- ----------------------------------------------------------------------------
-- Payments (simulated gateway; reference_id = club_id for MEMBERSHIP, event_id for EVENT)
-- ----------------------------------------------------------------------------
INSERT INTO payments (id, user_id, type, reference_id, amount, status, paid_at) VALUES
(UUID_TO_BIN(UUID()), @u_carol, 'EVENT', @e_artshow, 7500.00, 'SUCCESS', NOW(6));

-- ----------------------------------------------------------------------------
-- Club expenses
-- ----------------------------------------------------------------------------
INSERT INTO club_expenses (id, club_id, logged_by, description, amount, expense_date, created_at) VALUES
(UUID_TO_BIN(UUID()), @c_tech, @u_alice, 'Pizza and snacks for Hack Night', 4500.00, CURDATE(), NOW(6));

-- ----------------------------------------------------------------------------
-- Event feedback
-- ----------------------------------------------------------------------------
INSERT INTO event_feedback (id, event_id, user_id, rating, comment, created_at) VALUES
(UUID_TO_BIN(UUID()), @e_workshop, @u_bob, 5, 'Really well explained, learned a lot!', NOW(6));

-- ----------------------------------------------------------------------------
-- Certificates
-- ----------------------------------------------------------------------------
INSERT INTO certificates (id, user_id, club_id, issued_at) VALUES
(UUID_TO_BIN(UUID()), @u_carol, @c_tech, NOW(6));

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------
INSERT INTO notifications (id, user_id, channel, message, is_read, created_at) VALUES
(UUID_TO_BIN(UUID()), @u_alice, 'IN_APP', 'Your club Tech Innovators was approved.', 0, NOW(6)),
(UUID_TO_BIN(UUID()), @u_carol, 'EMAIL',  'Your certificate for Tech Innovators is ready.', 0, NOW(6));

-- ============================================================================
-- Demo accounts (password: password123)
--   Super Admin:      superadmin@example.com
--   Faculty Advisor:  advisor@example.com
--   Student (Pres.):  alice@example.com   (President, Tech Innovators)
--   Student:          bob@example.com     (VP, Tech Innovators)
--   Student:          carol@example.com   (Member, Tech Innovators)
--   Student (Pres.):  dave@example.com    (President, Creative Arts Society)
-- ============================================================================
