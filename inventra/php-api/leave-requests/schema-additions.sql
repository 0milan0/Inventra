-- Notitie van de manager bij het goed-/afkeuren van een verlofaanvraag —
-- naast `reason` (de eigen toelichting van de medewerker bij het indienen,
-- bestond al).

ALTER TABLE `leave_requests`
  ADD COLUMN `decision_note` TEXT NULL AFTER `approved_by`;
