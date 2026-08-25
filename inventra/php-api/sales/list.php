<?php
// Verkoopbonnen (kassabonnen van klanten) van het eigen filiaal, meest
// recente eerst. Zoeken/filteren gebeurt client-side op deze lijst — bij
// een groeiende dataset kan dit later een `zoek`/`status`-parameter krijgen,
// net als bijvoorbeeld personeel/staff-list.php.
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
    'SELECT s.`id`, s.`total_amount`, s.`payment_method`, s.`status`, s.`created_at`, ' .
    'CONCAT_WS(\' \', a.`firstname`, a.`lastname`) AS `kassamedewerker`, ' .
    's.`customer_id`, CONCAT_WS(\' \', c.`firstname`, c.`lastname`) AS `klant_naam`, ' .
    'c.`loyalty_card_number`, ' .
    '(SELECT COUNT(*) FROM `sale_items` si WHERE si.`sale_id` = s.`id`) AS `aantal_artikelen` ' .
    'FROM `sales` s ' .
    'JOIN `Accounts` a ON a.`id` = s.`cashier_id` ' .
    'LEFT JOIN `customers` c ON c.`id` = s.`customer_id` ' .
    'WHERE s.`branch_id` = ? ' .
    'ORDER BY s.`created_at` DESC ' .
    'LIMIT 500'
);
$stmt->execute([$account['branch_id']]);
$rows = $stmt->fetchAll();

$bonnen = array_map(function ($row) {
    return [
        'id' => (int) $row['id'],
        'totaal' => (float) $row['total_amount'],
        'betaalmethode' => $row['payment_method'],
        'status' => $row['status'],
        'datum' => $row['created_at'],
        'kassamedewerker' => $row['kassamedewerker'],
        'klantId' => $row['customer_id'] !== null ? (int) $row['customer_id'] : null,
        'klantNaam' => $row['klant_naam'] !== '' ? $row['klant_naam'] : null,
        'loyaltyKaart' => $row['loyalty_card_number'],
        'aantalArtikelen' => (int) $row['aantal_artikelen'],
    ];
}, $rows);

echo json_encode($bonnen);
