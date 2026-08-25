<?php
// "Aandachtsartikelen": producten die al lange tijd niet verkocht zijn,
// voor het eigen filiaal van de ingelogde gebruiker. Dagen-sinds-verkoop
// komt uit MAX(sales.created_at) via sale_items (alleen 'voltooid'
// verkopen); een product dat nog nooit verkocht is valt terug op het
// aantal dagen sinds het product is aangemaakt (products.created_at) —
// zo krijgt elk product een eerlijke waarde i.p.v. te worden overgeslagen.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$minDagen = isset($_GET['minDagen']) ? max(0, (int) $_GET['minDagen']) : 30;
$limiet = isset($_GET['limiet']) ? max(1, min(50, (int) $_GET['limiet'])) : 5;

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `p`.`barcode`, `p`.`name`, `p`.`created_at` AS `product_created_at`, ' .
    '`c`.`name` AS `categorie`, `sh`.`name` AS `locatie`, `pb`.`shelf_stock`, ' .
    'COALESCE(DATEDIFF(CURDATE(), MAX(`s`.`created_at`)), DATEDIFF(CURDATE(), `p`.`created_at`)) AS `dagen` ' .
    'FROM `product_branch` `pb` ' .
    'JOIN `products` `p` ON `p`.`id` = `pb`.`product_id` ' .
    'JOIN `subcategories` `sc` ON `sc`.`id` = `p`.`subcategorie_id` ' .
    'JOIN `categories` `c` ON `c`.`id` = `sc`.`category_id` ' .
    'JOIN `shelves` `sh` ON `sh`.`id` = `pb`.`shelf_id` ' .
    'LEFT JOIN `sale_items` `si` ON `si`.`product_id` = `pb`.`product_id` ' .
    'LEFT JOIN `sales` `s` ON `s`.`id` = `si`.`sale_id` AND `s`.`branch_id` = `pb`.`branch_id` AND `s`.`status` = \'voltooid\' ' .
    'WHERE `pb`.`branch_id` = ? ' .
    'GROUP BY `pb`.`id` ' .
    'HAVING `dagen` >= ? ' .
    'ORDER BY `dagen` DESC ' .
    'LIMIT ' . $limiet
);
$stmt->execute([$account['branch_id'], $minDagen]);
$rows = $stmt->fetchAll();

$artikelen = array_map(function ($row) {
    return [
        'barcode' => $row['barcode'],
        'naam' => $row['name'],
        'categorie' => $row['categorie'],
        'locatie' => $row['locatie'],
        'voorraadWinkel' => (int) $row['shelf_stock'],
        'dagen' => (int) $row['dagen'],
    ];
}, $rows);

echo json_encode($artikelen);
