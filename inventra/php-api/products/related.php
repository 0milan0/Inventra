<?php
// Gerelateerde producten: welke andere producten staan vaak op dezelfde
// kassabon als dit product (op het eigen filiaal)? Puur data-gedreven
// (market-basket) — geen handmatig onderhoud nodig. "sterkte" is het
// percentage van de bonnen mét dit product waar het andere product ook op
// stond (bv. 40% van de bonnen met kroepoek bevat ook nasi-groente).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$productId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($productId <= 0) {
    respond_error(400, 'Ongeldig product.');
}

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();
if (!$account || $account['branch_id'] === null) {
    respond_error(404, 'Geen filiaal ingesteld op dit account.');
}
$branchId = (int) $account['branch_id'];

// Totaal aantal bonnen met dit product — de noemer voor het percentage.
$totaalStmt = $pdo->prepare(
    'SELECT COUNT(DISTINCT `si`.`sale_id`) AS `totaal` FROM `sale_items` `si` ' .
    'JOIN `sales` `s` ON `s`.`id` = `si`.`sale_id` ' .
    'WHERE `si`.`product_id` = ? AND `s`.`branch_id` = ? AND `s`.`status` = \'voltooid\''
);
$totaalStmt->execute([$productId, $branchId]);
$totaalBonnen = (int) $totaalStmt->fetchColumn();

if ($totaalBonnen === 0) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `si2`.`product_id`, COUNT(DISTINCT `si1`.`sale_id`) AS `samen`, ' .
    '`p`.`name`, `p`.`barcode`, `p`.`image_url`, `p`.`sales_price` ' .
    'FROM `sale_items` `si1` ' .
    'JOIN `sale_items` `si2` ON `si2`.`sale_id` = `si1`.`sale_id` AND `si2`.`product_id` != `si1`.`product_id` ' .
    'JOIN `sales` `s` ON `s`.`id` = `si1`.`sale_id` ' .
    'JOIN `products` `p` ON `p`.`id` = `si2`.`product_id` ' .
    'WHERE `si1`.`product_id` = ? AND `s`.`branch_id` = ? AND `s`.`status` = \'voltooid\' ' .
    'GROUP BY `si2`.`product_id`, `p`.`name`, `p`.`barcode`, `p`.`image_url`, `p`.`sales_price` ' .
    'ORDER BY `samen` DESC ' .
    'LIMIT 8'
);
$stmt->execute([$productId, $branchId]);
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($row) use ($totaalBonnen) {
    return [
        'id' => (int) $row['product_id'],
        'naam' => $row['name'],
        'barcode' => $row['barcode'],
        'afbeelding' => $row['image_url'],
        'verkoopprijs' => (float) $row['sales_price'],
        'aantalSamen' => (int) $row['samen'],
        'percentage' => round(((int) $row['samen'] / $totaalBonnen) * 100),
    ];
}, $rows));
