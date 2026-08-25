<?php
// Catalogus-brede productzoekopdracht (op naam/barcode/sku, niet gebonden
// aan één filiaal) — voor het kiezen van een product bij het aanmaken van
// een recall. Bewust los van products/get.php, dat altijd product_branch van
// het eigen filiaal vereist en dus niet bruikbaar is voor centrale rollen
// die producten voor andere filialen moeten kunnen opzoeken.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../permissions_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me || !heeft_permissie($pdo, $me, 'recalls_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om de productcatalogus te doorzoeken.');
}

$q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
if (mb_strlen($q) < 2) {
    echo json_encode([]);
    exit;
}

$like = '%' . $q . '%';
$stmt = $pdo->prepare(
    'SELECT `p`.`id`, `p`.`barcode`, `p`.`name`, `p`.`shortname`, `b`.`name` AS `merk` ' .
    'FROM `products` `p` ' .
    'JOIN `brands` `b` ON `b`.`id` = `p`.`brand_id` ' .
    'WHERE `p`.`name` LIKE ? OR `p`.`barcode` LIKE ? OR `p`.`sku` LIKE ? ' .
    'ORDER BY `p`.`name` LIMIT 20'
);
$stmt->execute([$like, $like, $like]);
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($row) {
    return [
        'id' => (int) $row['id'],
        'barcode' => $row['barcode'],
        'naam' => $row['name'],
        'shortName' => $row['shortname'],
        'merk' => $row['merk'],
    ];
}, $rows));
