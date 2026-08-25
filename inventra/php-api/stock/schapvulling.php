<?php
// Percentage volle schappen — alleen van de eigen afdeling (department) van
// de ingelogde gebruiker, binnen zijn eigen filiaal, uitgesplitst per
// productcategorie (categories, via products.subcategorie_id -> subcategories
// -> categories). Een productregel (product_branch) telt als "op schap"
// wanneer shelf_stock > 0 — magazijnvoorraad (stockroom_stock) telt bewust
// niet mee. Het filiaalbrede overzicht (alle afdelingen) hoort bij de
// filiaalmanager-sectie, niet hier.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id`, `department` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null || $account['department'] === null) {
    echo json_encode(['perCategorie' => [], 'totaal' => ['totaal' => 0, 'opSchap' => 0, 'percentage' => 100]]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `c`.`name` AS `categorie`, COUNT(*) AS `totaal`, ' .
    'SUM(CASE WHEN `pb`.`shelf_stock` > 0 THEN 1 ELSE 0 END) AS `op_schap` ' .
    'FROM `product_branch` `pb` ' .
    'JOIN `shelves` `sh` ON `sh`.`id` = `pb`.`shelf_id` ' .
    'JOIN `products` `p` ON `p`.`id` = `pb`.`product_id` ' .
    'JOIN `subcategories` `sc` ON `sc`.`id` = `p`.`subcategorie_id` ' .
    'JOIN `categories` `c` ON `c`.`id` = `sc`.`category_id` ' .
    'WHERE `pb`.`branch_id` = ? AND `sh`.`department` = ? GROUP BY `c`.`id`, `c`.`name`'
);
$stmt->execute([$account['branch_id'], $account['department']]);
$rows = $stmt->fetchAll();

$perCategorie = [];
$totaalAlles = 0;
$opSchapAlles = 0;

foreach ($rows as $row) {
    $totaal = (int) $row['totaal'];
    $opSchap = (int) $row['op_schap'];
    $totaalAlles += $totaal;
    $opSchapAlles += $opSchap;
    $perCategorie[] = [
        'categorie' => $row['categorie'],
        'totaal' => $totaal,
        'opSchap' => $opSchap,
        'percentage' => $totaal === 0 ? 100 : (int) round(($opSchap / $totaal) * 100),
    ];
}

usort($perCategorie, function ($a, $b) {
    return $a['percentage'] <=> $b['percentage'];
});

echo json_encode([
    'perCategorie' => $perCategorie,
    'totaal' => [
        'totaal' => $totaalAlles,
        'opSchap' => $opSchapAlles,
        'percentage' => $totaalAlles === 0 ? 100 : (int) round(($opSchapAlles / $totaalAlles) * 100),
    ],
]);
