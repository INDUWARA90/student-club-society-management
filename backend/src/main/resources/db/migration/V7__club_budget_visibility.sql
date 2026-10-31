-- V7: Allow club presidents to toggle budget section visibility for club members / students
ALTER TABLE `clubs` ADD COLUMN `show_budget_to_members` BOOLEAN NOT NULL DEFAULT FALSE;
