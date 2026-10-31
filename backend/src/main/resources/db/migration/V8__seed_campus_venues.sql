-- V8: Seed campus venues for venue reservations and conflict resolution
INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000001', '-', '')), 'Grand Auditorium', 'Main Academic Complex', 500, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'Grand Auditorium');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000002', '-', '')), 'Innovation & Robotics Lab', 'Engineering Block B', 80, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'Innovation & Robotics Lab');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000003', '-', '')), 'Conference Hall A', 'Student Center Level 2', 150, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'Conference Hall A');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000004', '-', '')), 'Conference Hall B', 'Student Center Level 2', 100, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'Conference Hall B');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000005', '-', '')), 'Multimedia & Podcast Studio', 'Creative Arts Pavilion', 35, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'Multimedia & Podcast Studio');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000006', '-', '')), 'University Sports Arena', 'Athletics Complex', 1200, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'University Sports Arena');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000007', '-', '')), 'STEM Seminar Room 101', 'Science & Research Tower', 60, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'STEM Seminar Room 101');

INSERT INTO `venues` (`id`, `name`, `building`, `capacity`, `active`)
SELECT UNHEX(REPLACE('a0000000-0000-0000-0000-000000000008', '-', '')), 'Outdoor Amphitheater', 'Campus Central Plaza', 300, b'1'
WHERE NOT EXISTS (SELECT 1 FROM `venues` WHERE `name` = 'Outdoor Amphitheater');
