-- Recall-planning (starttijd/deadline) heeft nu ook een tijdstip nodig, niet
-- alleen een datum — DATE verbreden naar DATETIME (bestaande datumwaarden
-- blijven geldig, krijgen impliciet 00:00:00).

ALTER TABLE `tasks`
  MODIFY COLUMN `start_time` DATETIME NULL,
  MODIFY COLUMN `deadline` DATETIME NULL;
