<?php
// Verkoop van vandaag, per uur, voor het filiaal van de ingelogde gebruiker.
// Alleen 'voltooid' verkopen tellen mee — geannuleerd/geretourneerd niet.
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
    'SELECT HOUR(`created_at`) AS `uur`, COUNT(*) AS `transacties`, SUM(`total_amount`) AS `omzet` ' .
    'FROM `sales` ' .
    'WHERE `branch_id` = ? AND `status` = ? AND DATE(`created_at`) = CURDATE() ' .
    'GROUP BY HOUR(`created_at`) ' .
    'ORDER BY `uur`'
);
$stmt->execute([$account['branch_id'], 'voltooid']);
$rows = $stmt->fetchAll();

$verkoop = array_map(function ($row) {
    return [
        'uur' => (int) $row['uur'],
        'transacties' => (int) $row['transacties'],
        'omzet' => (float) $row['omzet'],
    ];
}, $rows);

echo json_encode($verkoop);
