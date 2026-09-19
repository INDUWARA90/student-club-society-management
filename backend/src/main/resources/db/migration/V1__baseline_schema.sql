-- V1: the baseline schema, as Hibernate created it before the venue, resource-library, event-discussion and alumni
-- features. Databases that already exist (built by ddl-auto=update) are baselined at version 1 and skip this file;
-- brand-new databases run V1, V2 and V3 in order.
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `announcement_comments` (
  `created_at` datetime(6) NOT NULL,
  `announcement_id` binary(16) NOT NULL,
  `author_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `content` tinytext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK3una9snwwxxn061qujbpxjxxg` (`announcement_id`),
  KEY `FK1u0574bib84rewpvecb9cx317` (`author_id`),
  CONSTRAINT `FK1u0574bib84rewpvecb9cx317` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK3una9snwwxxn061qujbpxjxxg` FOREIGN KEY (`announcement_id`) REFERENCES `club_announcements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attendance` (
  `marked_at` datetime(6) NOT NULL,
  `event_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `method` enum('MANUAL','QR') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK3roai68ssb54vy9hqy0d6njol` (`event_id`,`user_id`),
  KEY `FKjcaqd29v2qy723owsdah2t8vx` (`user_id`),
  CONSTRAINT `FKf0dyyx6xegjshtit0wq4dspsm` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
  CONSTRAINT `FKjcaqd29v2qy723owsdah2t8vx` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `audit_logs` (
  `created_at` datetime(6) NOT NULL,
  `actor_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `target_id` binary(16) NOT NULL,
  `target_type` varchar(50) NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKf2uqqjmo7gvd8fq7ac81fgc0m` (`actor_id`),
  CONSTRAINT `FKf2uqqjmo7gvd8fq7ac81fgc0m` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `certificates` (
  `issued_at` datetime(6) NOT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKb44at94llbb6oxjyp28jxm01s` (`user_id`,`club_id`),
  KEY `FKpqpc25xdbvjpj1gpk8il3b0s8` (`club_id`),
  CONSTRAINT `FKd3f6enpb3p3xovee9klklf05r` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKpqpc25xdbvjpj1gpk8il3b0s8` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `club_announcements` (
  `created_at` datetime(6) NOT NULL,
  `author_id` binary(16) NOT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `content` tinytext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKjiieekyape5sbta3k9231gxiv` (`author_id`),
  KEY `FKnmt917u81vdn4hf6vourl1vu8` (`club_id`),
  CONSTRAINT `FKjiieekyape5sbta3k9231gxiv` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKnmt917u81vdn4hf6vourl1vu8` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `club_expenses` (
  `amount` decimal(10,2) NOT NULL,
  `expense_date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `logged_by` binary(16) NOT NULL,
  `description` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKj8jftpnkav3w0imrp9sx0mrjy` (`club_id`),
  KEY `FK35ej2b7nib8v61lhliibx8eh7` (`logged_by`),
  CONSTRAINT `FK35ej2b7nib8v61lhliibx8eh7` FOREIGN KEY (`logged_by`) REFERENCES `users` (`id`),
  CONSTRAINT `FKj8jftpnkav3w0imrp9sx0mrjy` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `clubs` (
  `created_at` datetime(6) NOT NULL,
  `created_by` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `category` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` longtext,
  `join_policy` enum('APPROVAL_REQUIRED','OPEN') NOT NULL,
  `logo_b64` tinytext,
  `status` enum('APPROVED','PENDING','REJECTED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK1e0ic3ghh6e36j1c3mh1o07f3` (`created_by`),
  CONSTRAINT `FK1e0ic3ghh6e36j1c3mh1o07f3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_verification_tokens` (
  `used` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `token` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKewmvysc7e9y6uy7og2c21axa9` (`token`),
  KEY `FKi1c4mmamlb8keqt74k4lrtwhc` (`user_id`),
  CONSTRAINT `FKi1c4mmamlb8keqt74k4lrtwhc` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `event_feedback` (
  `rating` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `event_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `comment` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKjolgwebn0ilqjcytt6h04a66q` (`event_id`,`user_id`),
  KEY `FK4ij3ba7opsk5c8kikt3ueu7uh` (`user_id`),
  CONSTRAINT `FK4ij3ba7opsk5c8kikt3ueu7uh` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKfmct6rka09lnw02fd1ifn1rif` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `events` (
  `capacity` int DEFAULT NULL,
  `fee` decimal(10,2) NOT NULL,
  `requires_fa_approval` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `event_date` datetime(6) NOT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `title` varchar(150) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `approval_status` enum('APPROVED','NOT_REQUIRED','PENDING','REJECTED') NOT NULL,
  `banner_b64` tinytext,
  `description` longtext,
  PRIMARY KEY (`id`),
  KEY `FKmt9rjn9hbh6g8isda7c1g14bd` (`club_id`),
  CONSTRAINT `FKmt9rjn9hbh6g8isda7c1g14bd` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `memberships` (
  `joined_at` datetime(6) NOT NULL,
  `club_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `position` enum('MEMBER','PRESIDENT','SECRETARY','TREASURER','VP') NOT NULL,
  `status` enum('APPROVED','PENDING','REJECTED') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKb1p4x0j4ixo76sqc65kirdga9` (`user_id`,`club_id`),
  KEY `FK1ac6k7t9ewsvjfi44fe6h1jwl` (`club_id`),
  CONSTRAINT `FK1ac6k7t9ewsvjfi44fe6h1jwl` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`),
  CONSTRAINT `FKdjormybfoo7f4i4d4r803qohb` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notifications` (
  `is_read` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `channel` enum('EMAIL','IN_APP') NOT NULL,
  `message` tinytext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK9y21adhxn0ayjhfocscqox7bh` (`user_id`),
  CONSTRAINT `FK9y21adhxn0ayjhfocscqox7bh` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `password_reset_tokens` (
  `used` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `token` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK71lqwbwtklmljk3qlsugr1mig` (`token`),
  KEY `FKk3ndxg5xp6v7wd4gjyusp15gq` (`user_id`),
  CONSTRAINT `FKk3ndxg5xp6v7wd4gjyusp15gq` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payments` (
  `amount` decimal(10,2) NOT NULL,
  `paid_at` datetime(6) NOT NULL,
  `id` binary(16) NOT NULL,
  `reference_id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `status` enum('FAILED','PENDING','SUCCESS') NOT NULL,
  `type` enum('EVENT','MEMBERSHIP') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKj94hgy9v5fw1munb90tar2eje` (`user_id`),
  CONSTRAINT `FKj94hgy9v5fw1munb90tar2eje` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `rsvps` (
  `waitlist_order` int DEFAULT NULL,
  `rsvp_at` datetime(6) NOT NULL,
  `event_id` binary(16) NOT NULL,
  `id` binary(16) NOT NULL,
  `user_id` binary(16) NOT NULL,
  `status` enum('CANCELLED','GOING','WAITLISTED') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKsdbuisue61cfc32fpvrf0tbnd` (`event_id`,`user_id`),
  KEY `FKcqihl5v1d7d8r0odom7ejl20e` (`user_id`),
  CONSTRAINT `FKbmrcom1r0jy8rsg1w7o15pu81` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
  CONSTRAINT `FKcqihl5v1d7d8r0odom7ejl20e` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `email_verified` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` binary(16) NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `profile_image_b64` tinytext,
  `role` enum('FACULTY_ADVISOR','STUDENT','SUPER_ADMIN') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
