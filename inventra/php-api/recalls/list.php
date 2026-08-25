<?php
// Alle recalls van hetzelfde bedrijf als de ingelogde gebruiker, nieuwste
// eerst — zichtbaar voor iedereen met de permissie "recalls_aanmaken"
// (niet alleen de eigen recalls, zodat bv. Inkoper en Logistiek Coördinator
// elkaars recalls kunnen zien).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../permissions_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `company` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}
if (!heeft_permissie($pdo, $me, 'recalls_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om recalls te bekijken.');
}
if ($me['company'] === null) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `r`.`id`, `r`.`title`, `r`.`all_branches`, `r`.`created_at`, ' .
    '`p`.`name` AS `product_naam`, `p`.`barcode` AS `product_barcode`, ' .
    'CONCAT(`a`.`firstname`, \' \', `a`.`lastname`) AS `aangemaakt_door`, ' .
    '(SELECT COUNT(*) FROM `recall_branches` `rb` WHERE `rb`.`recall_id` = `r`.`id`) AS `totaal_filialen`, ' .
    '(SELECT COUNT(*) FROM `recall_branches` `rb` WHERE `rb`.`recall_id` = `r`.`id` AND `rb`.`status` = \'aangemaakt\') AS `aangemaakt_filialen` ' .
    'FROM `recalls` `r` ' .
    'JOIN `products` `p` ON `p`.`id` = `r`.`product_id` ' .
    'JOIN `Accounts` `a` ON `a`.`id` = `r`.`created_by_id` ' .
    'WHERE `r`.`company_id` = ? ' .
    'ORDER BY `r`.`created_at` DESC'
);
$stmt->execute([$me['company']]);
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($row) {
    return [
        'id' => (int) $row['id'],
        'titel' => $row['title'],
        'productNaam' => $row['product_naam'],
        'productBarcode' => $row['product_barcode'],
        'alleFilialen' => (bool) $row['all_branches'],
        'aangemaaktDoor' => $row['aangemaakt_door'],
        'aangemaaktOp' => $row['created_at'],
        'totaalFilialen' => (int) $row['totaal_filialen'],
        'aangemaaktFilialen' => (int) $row['aangemaakt_filialen'],
    ];
}, $rows));
