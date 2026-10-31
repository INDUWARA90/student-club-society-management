-- Campus Venues Data Seed File
-- Provides 8 primary university facilities for student club event reservations and conflict detection.

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
VALUES
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000001', '-', '')), 'Grand Auditorium', 'Main Academic Complex', 500, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000002', '-', '')), 'Innovation & Robotics Lab', 'Engineering Block B', 80, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000003', '-', '')), 'Conference Hall A', 'Student Center Level 2', 150, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000004', '-', '')), 'Conference Hall B', 'Student Center Level 2', 100, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000005', '-', '')), 'Multimedia & Podcast Studio', 'Creative Arts Pavilion', 35, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000006', '-', '')), 'University Sports Arena', 'Athletics Complex', 1200, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000007', '-', '')), 'STEM Seminar Room 101', 'Science & Research Tower', 60, 1),
  (UNHEX(REPLACE('a0000000-0000-0000-0000-000000000008', '-', '')), 'Outdoor Amphitheater', 'Campus Central Plaza', 300, 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `building` = VALUES(`building`),
  `capacity` = VALUES(`capacity`),
  `active` = VALUES(`active`);
