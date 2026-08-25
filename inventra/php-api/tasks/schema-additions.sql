-- Eenmalig handmatig uitvoeren op de MySQL-database (bv. via phpMyAdmin) —
-- er is in dit project geen automatische migratietool.
--
-- Voegt toe wat nodig is om de taken-functionaliteit die nu op mock-data
-- draait (data/tasks.ts) 1-op-1 op echte data te laten draaien: prioriteit,
-- een productkoppeling (vervangt het vrije-tekst barcode-veld), een
-- checklist, meerdere toegewezenen tegelijk, reacties-met-1-niveau-replies,
-- en een echte activiteit-tijdlijn (i.p.v. de nu volledig verzonnen lijst).

-- `tasks` heeft geen `branch_id` — `department` alleen is geen filiaal-
-- scoping, want elk filiaal deelt dezelfde 5 afdelingen. Zonder een expliciete
-- kolom zou je de filiaal-context van een taak moeten afleiden via
-- created_by_id, wat breekt zodra die medewerker ooit van filiaal wisselt.
-- Vandaar een echte kolom, in plaats van dat impliciet te laten.
ALTER TABLE `tasks`
  ADD COLUMN `branch_id` INT(11) NULL AFTER `department`,
  ADD CONSTRAINT `tasks_branch_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `Branches` (`id`),
  ADD COLUMN `priority` ENUM('hoog', 'midden', 'laag') NULL AFTER `status`,
  ADD COLUMN `product_id` INT(11) NULL AFTER `assigned_to_id`,
  ADD CONSTRAINT `tasks_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;

-- Bestaande taken hadden nog geen branch_id — terugvullen vanuit het
-- filiaal van de aanmaker, zodat ze niet onzichtbaar worden zodra de
-- endpoints op branch_id gaan filteren.
UPDATE `tasks` t
JOIN `Accounts` a ON a.`id` = t.`created_by_id`
SET t.`branch_id` = a.`branch_id`
WHERE t.`branch_id` IS NULL;

CREATE TABLE IF NOT EXISTS `task_checklist_items` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `task_id` INT(11) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `done` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `task_checklist_items_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extra toegewezenen naast het bestaande `tasks.assigned_to_id` (hoofd-
-- toegewezene). "Toegewezen aan hele afdeling" blijft impliciet: geen rijen
-- hier + `assigned_to_id` leeg = open voor het hele `department`.
CREATE TABLE IF NOT EXISTS `task_assignees` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `task_id` INT(11) NOT NULL,
  `account_id` INT(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_assignee` (`task_id`, `account_id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `task_assignees_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_assignees_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `Accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `task_comments`
  ADD COLUMN `parent_comment_id` INT(11) NULL AFTER `task_id`,
  ADD CONSTRAINT `task_comments_parent_fk` FOREIGN KEY (`parent_comment_id`) REFERENCES `task_comments` (`id`) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS `task_activity` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `task_id` INT(11) NOT NULL,
  `account_id` INT(11) NOT NULL,
  `type` ENUM('created', 'status_changed', 'assigned', 'comment') NOT NULL,
  `detail` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `task_activity_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_activity_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `Accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
