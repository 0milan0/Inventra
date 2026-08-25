<?php
// Eigen verlofaanvragen, alle statussen — voor het "Mijn verlofaanvragen"-
// overzicht (list.php toont alleen openstaande aanvragen van je team, niet
// je eigen historie).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$pdo = get_db();

$stmt = $pdo->prepare(
    'SELECT `lr`.`id`, `lr`.`type`, `lr`.`start_date`, `lr`.`end_date`, `lr`.`status`, `lr`.`reason`, ' .
    '`lr`.`decision_note`, `lr`.`created_at`, `a`.`department`, ' .
    'CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `medewerker_naam` ' .
    'FROM `leave_requests` `lr` JOIN `Accounts` `a` ON `a`.`id` = `lr`.`account_id` ' .
    'WHERE `lr`.`account_id` = ? ORDER BY `lr`.`created_at` DESC'
);
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

$typeLabels = [
    'vakantie' => 'Vakantie', 'ziekte' => 'Ziekte', 'verlof' => 'Verlof',
    'onbetaald_verlof' => 'Onbetaald verlof', 'bijzonder_verlof' => 'Bijzonder verlof',
];
$statusMap = [
    'aangevraagd' => 'open', 'goedgekeurd' => 'goedgekeurd',
    'afgewezen' => 'afgewezen', 'geannuleerd' => 'geannuleerd',
];

echo json_encode(array_map(function ($row) use ($typeLabels, $statusMap, $userId) {
    return [
        'id' => (int) $row['id'],
        'medewerkerId' => $userId,
        'medewerkerNaam' => $row['medewerker_naam'],
        'afdelingId' => $row['department'],
        'type' => $row['type'],
        'typeLabel' => $typeLabels[$row['type']] ?? $row['type'],
        'van' => $row['start_date'],
        'tot' => $row['end_date'],
        'reden' => $row['reason'],
        'status' => $statusMap[$row['status']] ?? $row['status'],
        'notitie' => $row['decision_note'],
        'aangevraagdOp' => $row['created_at'],
    ];
}, $rows));
