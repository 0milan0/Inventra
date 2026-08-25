-- Vervolg op schema-additions.sql: producten worden nu centraal aangemaakt
-- (logistiek coördinator / iedereen met de permissie "producten_aanmaken"),
-- zonder filiaalgegevens — filialen vullen voorraad/schap/THT later zelf aan
-- via product/activeren/[barcode].

ALTER TABLE `products`
  ADD COLUMN `short_name` VARCHAR(60) NOT NULL DEFAULT '' AFTER `name`,
  ADD COLUMN `description` TEXT NULL AFTER `short_name`;

CREATE TABLE IF NOT EXISTS `product_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `image_url` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_product` (`product_id`),
  CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nieuwe permissie + standaard-toekenning aan rang 'Logistiek Coördinator'.
-- Iemand anders kan de permissie alsnog los krijgen via
-- personeel/[id]/permissies (account_permissions, type 'grant').
INSERT INTO `permissions` (`name`, `label`, `category`, `description`)
VALUES (
  'producten_aanmaken',
  'Producten aanmaken',
  'Producten',
  'Mag nieuwe producten aan de centrale catalogus toevoegen.'
);

INSERT INTO `rank_permissions` (`rank`, `permission_id`)
SELECT 'Logistiek Coördinator', `id` FROM `permissions` WHERE `name` = 'producten_aanmaken';
