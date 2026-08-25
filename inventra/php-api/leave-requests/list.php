<?php
// Openstaande verlofaanvragen — teamleider ziet zijn eigen afdeling (binnen
// zijn filiaal), filiaalmanager ziet zijn hele filiaal, een medewerker krijgt
// een lege lijst (geen inzagerecht in andermans aanvragen).
//
// `leave_requests` heeft zelf geen branch_id/department — die komen via een
// join met Accounts (de tabel zoals die al op de server staat).
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
    echo json_encode([]);
    exit;
}

$base =
    'SELECT `lr`.`id`, `lr`.`type`, `lr`.`start_date`, `lr`.`end_date`, `lr`.`reason`, `lr`.`status`, `lr`.`created_at`, ' .
    '`a`.`firstname`, `a`.`lastname`, `a`.`department`, `a`.`id` AS `account_id` ' .
    'FROM `leave_requests` `lr` ' .
    'JOIN `Accounts` `a` ON `a`.`id` = `lr`.`account_id` ' .
    'WHERE `a`.`branch_id` = ? AND `lr`.`status` = \'aangevraagd\'';

if ($niveau === 'filiaalmanager') {
    $stmt = $pdo->prepare($base . ' ORDER BY `lr`.`created_at`');
    $stmt->execute([$me['branch_id']]);
} else {
    $stmt = $pdo->prepare($base . ' AND `a`.`department` = ? ORDER BY `lr`.`created_at`');
    $stmt->execute([$me['branch_id'], $me['department']]);
}

$rows = $stmt->fetchAll();

$typeLabels = [
    'vakantie' => 'Vakantie',
    'ziekte' => 'Ziekte',
    'verlof' => 'Verlof',
    'onbetaald_verlof' => 'Onbetaald verlof',
    'bijzonder_verlof' => 'Bijzonder verlof',
];
$statusMap = ['aangevraagd' => 'open', 'goedgekeurd' => 'goedgekeurd', 'afgewezen' => 'afgewezen', 'geannuleerd' => 'geannuleerd'];

$response = array_map(function ($row) use ($typeLabels, $statusMap) {
    return [
        'id' => (int) $row['id'],
        'medewerkerId' => (int) $row['account_id'],
        'medewerkerNaam' => trim($row['firstname'] . ' ' . $row['lastname']),
        'afdelingId' => $row['department'],
        'type' => $row['type'],
        'typeLabel' => $typeLabels[$row['type']] ?? $row['type'],
        'van' => $row['start_date'],
        'tot' => $row['end_date'],
        'reden' => $row['reason'],
        'status' => $statusMap[$row['status']] ?? $row['status'],
        'aangevraagdOp' => substr($row['created_at'], 0, 10),
    ];
}, $rows);

echo json_encode($response);
