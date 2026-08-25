<?php
// Geeft de filialen (Branches) terug van hetzelfde bedrijf (company) als de
// ingelogde gebruiker — geen filialen van een ander bedrijf in de database.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `company` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['company'] === null) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT `id`, `name`, `email`, `phonenumber`, `street`, `house_number`, `postal_code`, `city`, ' .
    '`province`, `country`, `latitude`, `longitude`, `store_type`, `bakkery`, `butcher`, `selfscan`, ' .
    '`flower`, `status` ' .
    'FROM `Branches` WHERE `company_id` = ? ORDER BY `id`'
);
$stmt->execute([$account['company']]);
$rows = $stmt->fetchAll();

$statusMap = [
    'active' => 'actief',
    'closed' => 'gesloten',
    'verbouwing' => 'verbouwing',
];

$branches = array_map(function ($row) use ($statusMap) {
    return [
        'id' => (int) $row['id'],
        'naam' => $row['name'],
        'email' => $row['email'],
        'telefoonnummer' => $row['phonenumber'],
        'straat' => $row['street'],
        'huisnummer' => $row['house_number'],
        'postcode' => $row['postal_code'],
        'stad' => $row['city'],
        'provincie' => $row['province'],
        'land' => $row['country'],
        'latitude' => $row['latitude'],
        'longitude' => $row['longitude'],
        'storeType' => $row['store_type'],
        'status' => $statusMap[$row['status']] ?? 'actief',
        'bakkerij' => (bool) $row['bakkery'],
        'slagerij' => (bool) $row['butcher'],
        'selfscan' => (bool) $row['selfscan'],
        'bloemen' => (bool) $row['flower'],
    ];
}, $rows);

echo json_encode($branches);
