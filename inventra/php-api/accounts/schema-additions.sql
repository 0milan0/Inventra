-- Nieuwe permissie: personeel_aanmaken — een filiaalmanager (of assistent-
-- filiaalmanager) kan nieuwe medewerkers uitnodigen (accounts/create.php).
-- Deze permissie mag bewust alleen door een filiaalmanager worden toegekend
-- aan iemand anders (bv. een teamleider) — zie de extra check in
-- accounts/permissions-update.php, los van de gewone mag_beheren-regels.

INSERT INTO `permissions` (`name`, `label`, `category`, `description`)
VALUES (
  'personeel_aanmaken',
  'Personeel aanmaken',
  'Personeel',
  'Mag nieuwe medewerkers uitnodigen (nieuw account aanmaken).'
);

INSERT INTO `rank_permissions` (`rank`, `permission_id`)
SELECT `rank`, `id`
FROM (SELECT 'Filiaalmanager' AS `rank` UNION ALL SELECT 'Assistent Filiaalmanager') AS `ranks`
CROSS JOIN `permissions`
WHERE `permissions`.`name` = 'personeel_aanmaken';
