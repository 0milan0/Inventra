<?php
// Producten met een product_branch-rij voor dit filiaal die nog geen schap
// hebben (shelf_id IS NULL) — bij het centraal aanmaken van een product
// krijgt elk filiaal meteen zo'n "lege" rij (voorraad 0, geen schap); dit is
// het "Nieuwe producten"-lijstje op het dashboard dat daarop wijst.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `p`.`id`, `p`.`barcode`, `p`.`sku`, `p`.`plu_code`, `p`.`name`, `p`.`shortname`, ' .
    '`b`.`name` AS `merk`, `c`.`name` AS `categorie`, ' .
    '(SELECT `image_url` FROM `product_images` WHERE `product_id` = `p`.`id` ORDER BY `sort_order`, `id` LIMIT 1) AS `afbeelding` ' .
    'FROM `products` `p` ' .
    'JOIN `subcategories` `sc` ON `sc`.`id` = `p`.`subcategorie_id` ' .
    'JOIN `categories` `c` ON `c`.`id` = `sc`.`category_id` ' .
    'JOIN `brands` `b` ON `b`.`id` = `p`.`brand_id` ' .
    'WHERE EXISTS (' .
    '  SELECT 1 FROM `product_branch` `pb` ' .
    '  WHERE `pb`.`product_id` = `p`.`id` AND `pb`.`branch_id` = ? AND `pb`.`shelf_id` IS NULL' .
    ') ' .
    'ORDER BY `p`.`id` DESC'
);
$stmt->execute([$account['branch_id']]);
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($row) {
    return [
        'barcode' => $row['barcode'],
        'sku' => $row['sku'],
        'pluCode' => $row['plu_code'],
        'naam' => $row['name'],
        'shortName' => $row['shortname'],
        'merk' => $row['merk'],
        'categorie' => $row['categorie'],
        'afbeelding' => $row['afbeelding'],
    ];
}, $rows));
