<?php
// Voorraad-KPI's voor het dashboard: totaal aantal producten, verlopen,
// bijna verlopen (binnen 7 dagen) en lage voorraad — allemaal voor het
// eigen filiaal van de ingelogde gebruiker. Vervangt de client-side loop
// over de volledige mock-productenlijst in app/(tabs)/index.tsx.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null) {
    echo json_encode(['totaal' => 0, 'verlopen' => 0, 'bijnaVerlopen' => 0, 'lageVoorraad' => 0]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT COUNT(*) AS `totaal`, ' .
    'SUM(CASE WHEN `shortest_tht` < CURDATE() THEN 1 ELSE 0 END) AS `verlopen`, ' .
    'SUM(CASE WHEN `shortest_tht` >= CURDATE() AND `shortest_tht` <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS `bijna_verlopen`, ' .
    'SUM(CASE WHEN (`shelf_stock` + `stockroom_stock`) <= `minimum_stock` THEN 1 ELSE 0 END) AS `lage_voorraad` ' .
    // shelf_id IS NULL = nog niet ingericht door dit filiaal (net centraal
    // aangemaakt, zie products/create.php) — telt nergens in mee totdat het
    // filiaal 'm activeert (product/activeren, activate-branch.php).
    'FROM `product_branch` WHERE `branch_id` = ? AND `shelf_id` IS NOT NULL'
);
$stmt->execute([$account['branch_id']]);
$row = $stmt->fetch();

echo json_encode([
    'totaal' => (int) $row['totaal'],
    'verlopen' => (int) $row['verlopen'],
    'bijnaVerlopen' => (int) $row['bijna_verlopen'],
    'lageVoorraad' => (int) $row['lage_voorraad'],
]);
