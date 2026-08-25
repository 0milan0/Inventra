-- Referentie — deze tabel staat al op de server (via HeidiSQL aangemaakt),
-- dit bestand hoeft dus niet meer uitgevoerd te worden. Hij staat hier alleen
-- zodat de structuur ook in de repo terug te vinden is.
--
-- Let op: geen branch_id/department op deze tabel — de PHP-endpoints in
-- php-api/leave-requests/ halen die via een join met Accounts op.

CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `type` enum('vakantie', 'ziekte', 'verlof', 'onbetaald_verlof', 'bijzonder_verlof') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('aangevraagd', 'goedgekeurd', 'afgewezen', 'geannuleerd') NOT NULL DEFAULT 'aangevraagd',
  `reason` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `Accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `Accounts` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
