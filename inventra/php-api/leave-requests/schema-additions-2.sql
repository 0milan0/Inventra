-- Verlofaanvragen moeten ook een tijdstip kunnen hebben (niet alleen hele
-- dagen) — zelfde aanpak als eerder bij recalls/tasks: DATE -> DATETIME.
-- Bestaande rijen (datum zonder tijd) worden door MySQL automatisch naar
-- middernacht (00:00:00) omgezet, wat voor hen nog steeds "hele dag" betekent.

ALTER TABLE `leave_requests`
  MODIFY COLUMN `start_date` DATETIME NOT NULL,
  MODIFY COLUMN `end_date` DATETIME NOT NULL;
