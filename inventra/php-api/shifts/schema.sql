-- Dienstrooster (shifts) — vervangt de mock-data (USERS/INITIAL_SHIFTS) in
-- app/(tabs)/planning.tsx. `department` staat los van Accounts.department
-- (een medewerker kan incidenteel in een andere afdeling worden ingeroosterd),
-- `surcharges` is een simpele komma-gescheiden lijst van handmatige toeslagen
-- ('Overuren,Weekend,...') — automatische toeslagen (feestdag/avond) worden
-- nooit opgeslagen, altijd client-side herberekend uit datum/tijd.

CREATE TABLE IF NOT EXISTS `shifts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `account_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `department` ENUM('AGF', 'Kassa & Boetiek', 'KW', 'Vers', 'Brood') NOT NULL,
  `date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `surcharges` VARCHAR(120) NULL,
  `worked` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_by_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shifts_branch_date` (`branch_id`, `date`),
  KEY `idx_shifts_account_date` (`account_id`, `date`),
  CONSTRAINT `fk_shifts_account` FOREIGN KEY (`account_id`) REFERENCES `Accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shifts_created_by` FOREIGN KEY (`created_by_id`) REFERENCES `Accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
