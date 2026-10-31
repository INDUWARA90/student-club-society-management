-- V6: Club income logging support alongside expenses
ALTER TABLE `club_expenses` ADD COLUMN `entry_type` varchar(20) NOT NULL DEFAULT 'EXPENSE';
