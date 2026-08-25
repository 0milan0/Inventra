-- Starttijd naast de al bestaande deadline — beide handmatig invulbaar bij
-- het aanmaken van een taak (o.a. via recalls/create.php).

ALTER TABLE `tasks`
  ADD COLUMN `start_time` DATE NULL AFTER `deadline`;
