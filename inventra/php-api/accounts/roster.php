<?php
// Lichte personeelslijst specifiek voor het dienstrooster — in tegenstelling
// tot staff-list.php (personeelsbeheer, rang-gated) mag hier IEDEREEN bij:
// je moet altijd kunnen zien wie er in je team staat ingeroosterd, ook als
// medewerker. Zelfde scoping als shifts/list.php: (assistent-)filiaalmanager
// ziet het hele filiaal, iedereen anders alleen de eigen afdeling.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me || $me['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$filiaalbreed = rank_niveau($me['rank']) === 'filiaalmanager';

if ($filiaalbreed) {
    $stmt = $pdo->prepare(
        'SELECT `id`, `firstname`, `lastname`, `profile_picture`, `department` ' .
        'FROM `Accounts` WHERE `branch_id` = ? AND `status` = \'actief\' ORDER BY `department`, `lastname`, `firstname`'
    );
    $stmt->execute([$me['branch_id']]);
} else {
    $stmt = $pdo->prepare(
        'SELECT `id`, `firstname`, `lastname`, `profile_picture`, `department` ' .
        'FROM `Accounts` WHERE `branch_id` = ? AND `department` = ? AND `status` = \'actief\' ORDER BY `lastname`, `firstname`'
    );
    $stmt->execute([$me['branch_id'], $me['department']]);
}

$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($row) {
    $naam = trim(($row['firstname'] ?? '') . ' ' . ($row['lastname'] ?? ''));
    $initialen = strtoupper(substr($row['firstname'] ?? '', 0, 1) . substr($row['lastname'] ?? '', 0, 1));
    return [
        'id' => (int) $row['id'],
        'voornaam' => $row['firstname'],
        'achternaam' => $row['lastname'],
        'naam' => $naam,
        'initialen' => $initialen,
        'profielfoto' => $row['profile_picture'],
        'afdeling' => $row['department'],
    ];
}, $rows));
