-- Productrecalls: een centraal aangemaakte recall (door Regiomanager/Inkoper/
-- Logistiek Coördinator, of iemand anders met de permissie "recalls_aanmaken")
-- richt zich op één product en een selectie filialen (of alle filialen van
-- hetzelfde bedrijf). Per filiaal wordt — als dat filiaal het product op een
-- schap heeft staan — automatisch een taak aangemaakt voor de afdeling van
-- dat schap (recall_branches.status = 'aangemaakt'); filialen die het
-- product niet voeren worden overgeslagen ('overgeslagen', geen taak).

CREATE TABLE IF NOT EXISTS `recalls` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `created_by_id` INT NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `criteria_note` TEXT NULL,
  `tht_from` DATE NULL,
  `tht_to` DATE NULL,
  `all_branches` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recalls_company` (`company_id`),
  KEY `idx_recalls_product` (`product_id`),
  CONSTRAINT `fk_recalls_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `recall_branches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recall_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `department` VARCHAR(40) NULL,
  `task_id` INT NULL,
  `status` ENUM('aangemaakt', 'overgeslagen') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recall_branches_recall` (`recall_id`),
  KEY `idx_recall_branches_branch` (`branch_id`),
  CONSTRAINT `fk_recall_branches_recall` FOREIGN KEY (`recall_id`) REFERENCES `recalls` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `tasks`
  ADD COLUMN `recall_id` INT NULL AFTER `product_id`;

INSERT INTO `permissions` (`name`, `label`, `category`, `description`)
VALUES (
  'recalls_aanmaken',
  'Recalls aanmaken',
  'Recalls',
  'Mag productrecalls aanmaken voor (een selectie van) filialen — maakt automatisch taken aan en stuurt pushmeldingen.'
);

INSERT INTO `rank_permissions` (`rank`, `permission_id`)
SELECT `rank`, `id`
FROM (
  SELECT 'Regiomanager' AS `rank`
  UNION ALL SELECT 'Inkoper'
  UNION ALL SELECT 'Logistiek Coördinator'
) AS `ranks`
CROSS JOIN `permissions`
WHERE `permissions`.`name` = 'recalls_aanmaken';
