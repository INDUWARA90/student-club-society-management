-- V2: venues (with booking columns on events), the club resource library, event discussion threads, and the
-- graduation year used for alumni. Idempotent: databases that already have some of this are left as they are.

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

-- New tables ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `club_resources` (
  `created_at` datetime(6) NOT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `uploaded_by` binary(16) NOT NULL,
  `content_type` varchar(100) NOT NULL,
  `title` varchar(150) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_b64` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKq4fa0uhf03f76ujsra5iqmae0` (`club_id`),
  KEY `FKocaufpoxijpukaq8260nocr2y` (`uploaded_by`),
  CONSTRAINT `FKocaufpoxijpukaq8260nocr2y` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `FKq4fa0uhf03f76ujsra5iqmae0` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `event_comments` (
  `created_at` datetime(6) NOT NULL,
  `author_id` binary(16) NOT NULL,
  `event_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `content` longtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKessg0ri9d7c5kwsvf1vyuu4i2` (`author_id`),
  KEY `FKmc6b51f0imw3rw442hqwk3wwh` (`event_id`),
  CONSTRAINT `FKessg0ri9d7c5kwsvf1vyuu4i2` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKmc6b51f0imw3rw442hqwk3wwh` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `venues` (
  `active` bit(1) NOT NULL,
  `capacity` int DEFAULT NULL,
  `id` binary(16) NOT NULL,
  `building` varchar(150) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- New columns, keys and foreign keys ----------------------------------------------------------------------------
CALL flyway_add_column('events', 'end_date', 'datetime(6) DEFAULT NULL');
CALL flyway_add_column('events', 'venue_id', 'binary(16) DEFAULT NULL');
CALL flyway_add_column('users', 'graduation_year', 'int DEFAULT NULL');
CALL flyway_add_fk('events', 'FKqdxygdernwwt74hdvix9u5nr3', 'CONSTRAINT `FKqdxygdernwwt74hdvix9u5nr3` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`)');

DROP PROCEDURE IF EXISTS flyway_add_column;
DROP PROCEDURE IF EXISTS flyway_add_index;
DROP PROCEDURE IF EXISTS flyway_add_fk;
