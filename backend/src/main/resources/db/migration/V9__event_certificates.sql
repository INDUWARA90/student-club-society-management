-- Certificates are now awarded per attended event, not once per club.
-- The event reference is nullable so certificates issued under the former club-wide policy remain valid.
ALTER TABLE `certificates`
    DROP INDEX `UKb44at94llbb6oxjyp28jxm01s`,
    ADD COLUMN `event_id` binary(16) NULL AFTER `club_id`,
    ADD CONSTRAINT `FK_certificates_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
    ADD UNIQUE KEY `uk_certificates_user_event` (`user_id`, `event_id`),
    ADD KEY `idx_certificates_event` (`event_id`);
