<?php
// Personeelslijst — teamleider (elke "Teamleider ..."-rank) ziet alleen zijn
// eigen afdeling binnen zijn filiaal; (assistent-)filiaalmanager ziet iedereen
// in het filiaal. Overige rollen hebben geen toegang tot personeelsbeheer.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}
if ($me['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$niveau = rank_niveau($me['rank']);

if ($niveau === 'medewerker') {
    respond_error(403, 'Je hebt geen toegang tot personeelsbeheer.');
}

if ($niveau === 'filiaalmanager') {
    $stmt = $pdo->prepare(
        'SELECT `id`, `firstname`, `lastname`, `email`, `phonenumber`, ' .
        '`profile_picture`, `rank`, `department`, `status` ' .
        'FROM `Accounts` WHERE `branch_id` = ? ORDER BY `department`, `lastname`, `firstname`'
    );
    $stmt->execute([$me['branch_id']]);
} else {
    $stmt = $pdo->prepare(
        'SELECT `id`, `firstname`, `lastname`, `email`, `phonenumber`, ' .
        '`profile_picture`, `rank`, `department`, `status` ' .
        'FROM `Accounts` WHERE `branch_id` = ? AND `department` = ? ORDER BY `lastname`, `firstname`'
    );
    $stmt->execute([$me['branch_id'], $me['department']]);
}

$rows = $stmt->fetchAll();

$statusMap = [
    'invited' => 'uitgenodigd',
    'actief' => 'actief',
    'inactief' => 'inactief',
    'geblokkeerd' => 'geblokkeerd',
];

$response = array_map(function ($row) use ($statusMap) {
    $naam = trim(($row['firstname'] ?? '') . ' ' . ($row['lastname'] ?? ''));
    $initialen = strtoupper(substr($row['firstname'] ?? '', 0, 1) . substr($row['lastname'] ?? '', 0, 1));
    return [
        'id' => (int) $row['id'],
        'naam' => $naam,
        'initialen' => $initialen,
        'email' => $row['email'],
        'telefoonnummer' => $row['phonenumber'],
        'profielfoto' => $row['profile_picture'],
        'rol' => $row['rank'],
        'afdeling' => $row['department'],
        'status' => $statusMap[$row['status']] ?? $row['status'],
    ];
}, $rows);

echo json_encode($response);
