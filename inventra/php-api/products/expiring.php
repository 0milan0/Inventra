<?php
// Producten van het eigen filiaal waarvan de THT binnen X dagen valt
// (standaard 5) — voor de THT-controle-carrousel in app/(tabs)/tht.tsx.
// Sortering: eerst wat het langst geleden al verlopen is.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$dagen = isset($_GET['dagen']) ? max(0, min(90, (int) $_GET['dagen'])) : 5;

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `p`.`barcode`, `p`.`name`, `p`.`sku`, `p`.`plu_code`, `pb`.`shortest_tht` ' .
    'FROM `product_branch` `pb` ' .
    'JOIN `products` `p` ON `p`.`id` = `pb`.`product_id` ' .
    'WHERE `pb`.`branch_id` = ? AND `pb`.`shortest_tht` <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ' .
    'ORDER BY `pb`.`shortest_tht` ASC'
);
$stmt->execute([$account['branch_id'], $dagen]);
$rows = $stmt->fetchAll();

$producten = array_map(function ($row) {
    return [
        'barcode' => $row['barcode'],
        'naam' => $row['name'],
        'sku' => $row['sku'],
        'pluCode' => $row['plu_code'],
        'kortsteTht' => $row['shortest_tht'],
    ];
}, $rows);

echo json_encode($producten);
