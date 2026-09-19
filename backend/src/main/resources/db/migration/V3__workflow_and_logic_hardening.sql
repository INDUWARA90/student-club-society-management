-- V3: workflow & logic hardening.
--  * new columns: club fee / certificate threshold / archive; event cancel, rejection reason and budget; payment
--    refunds; certificate verification codes; notification preferences; token revocation; the President marker;
--    expense category and event link
--  * comment_reports table (member-driven moderation)
--  * base64 image/file and long-text columns widened from tinytext (255 bytes!) to longtext
--  * one President per club, enforced by the database

-- Helper procedures make every step safe to re-run and safe on databases Hibernate's ddl-auto=update already upgraded.
DROP PROCEDURE IF EXISTS flyway_add_column;
DROP PROCEDURE IF EXISTS flyway_add_index;
DROP PROCEDURE IF EXISTS flyway_add_fk;

DELIMITER $$

CREATE PROCEDURE flyway_add_column(IN t VARCHAR(64), IN c VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = t AND column_name = c) THEN
    SET @flyway_sql = CONCAT('ALTER TABLE `', t, '` ADD COLUMN `', c, '` ', ddl);
    PREPARE flyway_stmt FROM @flyway_sql;
    EXECUTE flyway_stmt;
    DEALLOCATE PREPARE flyway_stmt;
  END IF;
END$$

CREATE PROCEDURE flyway_add_index(IN t VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = t AND index_name = idx) THEN
    SET @flyway_sql = CONCAT('ALTER TABLE `', t, '` ADD ', ddl);
    PREPARE flyway_stmt FROM @flyway_sql;
    EXECUTE flyway_stmt;
    DEALLOCATE PREPARE flyway_stmt;
  END IF;
END$$

CREATE PROCEDURE flyway_add_fk(IN t VARCHAR(64), IN fk VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema = DATABASE() AND table_name = t AND constraint_name = fk
                   AND constraint_type = 'FOREIGN KEY') THEN
    SET @flyway_sql = CONCAT('ALTER TABLE `', t, '` ADD ', ddl);
    PREPARE flyway_stmt FROM @flyway_sql;
    EXECUTE flyway_stmt;
    DEALLOCATE PREPARE flyway_stmt;
  END IF;
END$$

DELIMITER ;

-- Columns -------------------------------------------------------------------------------------------------------
CALL flyway_add_column('certificates', 'verification_code', 'varchar(36) DEFAULT NULL');
CALL flyway_add_column('club_expenses', 'event_id', 'binary(16) DEFAULT NULL');
CALL flyway_add_column('club_expenses', 'category', 'varchar(50) DEFAULT NULL');
CALL flyway_add_column('clubs', 'archived', 'bit(1) NOT NULL DEFAULT b''0''');
CALL flyway_add_column('clubs', 'certificate_threshold', 'int DEFAULT NULL');
CALL flyway_add_column('clubs', 'membership_fee', 'decimal(10,2) NOT NULL DEFAULT ''0.00''');
CALL flyway_add_column('events', 'budget', 'decimal(10,2) DEFAULT NULL');
CALL flyway_add_column('events', 'cancelled', 'bit(1) NOT NULL DEFAULT b''0''');
CALL flyway_add_column('events', 'cancel_reason', 'varchar(500) DEFAULT NULL');
CALL flyway_add_column('events', 'rejection_reason', 'varchar(500) DEFAULT NULL');
CALL flyway_add_column('memberships', 'president_club_id', 'binary(16) DEFAULT NULL');
CALL flyway_add_column('payments', 'refunded_at', 'datetime(6) DEFAULT NULL');
CALL flyway_add_column('users', 'email_digest_enabled', 'bit(1) NOT NULL DEFAULT b''0''');
CALL flyway_add_column('users', 'email_notifications_enabled', 'bit(1) NOT NULL DEFAULT b''1''');
CALL flyway_add_column('users', 'password_changed_at', 'datetime(6) DEFAULT NULL');

-- Widen text columns (Hibernate created these as tinytext) ------------------------------------------------------
ALTER TABLE `announcement_comments` MODIFY COLUMN `content` longtext NOT NULL;
ALTER TABLE `club_announcements` MODIFY COLUMN `content` longtext NOT NULL;
ALTER TABLE `club_resources` MODIFY COLUMN `file_b64` longtext NOT NULL;
ALTER TABLE `clubs` MODIFY COLUMN `logo_b64` longtext;
ALTER TABLE `event_comments` MODIFY COLUMN `content` longtext NOT NULL;
ALTER TABLE `events` MODIFY COLUMN `banner_b64` longtext;
ALTER TABLE `notifications` MODIFY COLUMN `message` longtext NOT NULL;
ALTER TABLE `users` MODIFY COLUMN `profile_image_b64` longtext;

-- One President per club: mark existing Presidents, then enforce it with a unique index -------------------------
UPDATE memberships m
JOIN (SELECT club_id, MIN(joined_at) AS first_joined
      FROM memberships WHERE position = 'PRESIDENT' AND status = 'APPROVED' GROUP BY club_id) f
  ON f.club_id = m.club_id AND f.first_joined = m.joined_at
SET m.president_club_id = m.club_id
WHERE m.position = 'PRESIDENT' AND m.status = 'APPROVED' AND m.president_club_id IS NULL;

-- Indexes and foreign keys --------------------------------------------------------------------------------------
CALL flyway_add_index('certificates', 'UKksm6qgavh6pvt85iph4b9r2ms', 'UNIQUE KEY `UKksm6qgavh6pvt85iph4b9r2ms` (`verification_code`)');
CALL flyway_add_index('memberships', 'UKsq8pqceygmf72yg4t70rum82a', 'UNIQUE KEY `UKsq8pqceygmf72yg4t70rum82a` (`president_club_id`)');
CALL flyway_add_fk('club_expenses', 'FKmx09hc79t7hwafeqkgg0bxpcy', 'CONSTRAINT `FKmx09hc79t7hwafeqkgg0bxpcy` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)');

-- New tables ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comment_reports` (
  `created_at` datetime(6) NOT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `parent_id` binary(16) NOT NULL,
  `reporter_id` binary(16) NOT NULL,
  `resolved_by` binary(16) DEFAULT NULL,
  `target_id` binary(16) NOT NULL,
  `author_name` varchar(150) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `content_snapshot` varchar(1000) NOT NULL,
  `status` enum('ACTION_TAKEN','DISMISSED','OPEN') NOT NULL,
  `target_type` enum('ANNOUNCEMENT_COMMENT','EVENT_COMMENT') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK2g44yuv6aqd60bxohr2b5a62p` (`reporter_id`,`target_type`,`target_id`),
  KEY `FKbg2umqhpjxxg271k7ddm2syjp` (`club_id`),
  KEY `FK2bdcuansqmpqbdmpgwa9357a1` (`resolved_by`),
  CONSTRAINT `FK2bdcuansqmpqbdmpgwa9357a1` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `FKbg2umqhpjxxg271k7ddm2syjp` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`),
  CONSTRAINT `FKhsc3sb5vj4ophfaps1tg2kwd0` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS flyway_add_column;
DROP PROCEDURE IF EXISTS flyway_add_index;
DROP PROCEDURE IF EXISTS flyway_add_fk;
