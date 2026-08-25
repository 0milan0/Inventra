-- Bij het centraal aanmaken van een product (producten-toevoegen.tsx) krijgt
-- elk filiaal van hetzelfde bedrijf meteen een product_branch-rij (voorraad
-- op 0, nog geen schap gekozen) — zie products/create.php. Zo'n rij zonder
-- schap is daarna zichtbaar in het "Nieuwe producten"-lijstje op het
-- dashboard totdat het filiaal zelf een schap kiest (product/activeren).
-- shelf_id moet daarvoor NULL kunnen zijn — was NOT NULL.

ALTER TABLE `product_branch`
  MODIFY COLUMN `shelf_id` INT NULL;
