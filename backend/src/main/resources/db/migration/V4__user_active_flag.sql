-- V4: lets a Super Admin deactivate an account without deleting it (its memberships, RSVPs and audit trail stay intact).
ALTER TABLE `users` ADD COLUMN `active` bit(1) NOT NULL DEFAULT b'1';
