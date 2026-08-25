<?php
// Eén verlofaanvraag in detail — zichtbaar voor de indiener zelf, of voor wie
// 'm mag beslissen (teamleider eigen afdeling / filiaalmanager heel het
// filiaal). Gebruikt door het beslis-scherm (app/verlof/[id].tsx).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    respond_error(400, 'Ongeldige aanvraag.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();
if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$stmt = $pdo->prepare(
    'SELECT `lr`.`id`, `lr`.`account_id`, `lr`.`type`, `lr`.`start_date`, `lr`.`end_date`, `lr`.`status`, ' .
    '`lr`.`reason`, `lr`.`decision_note`, `lr`.`created_at`, ' .
    '`a`.`department`, `a`.`branch_id`, CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `medewerker_naam`, ' .
    'CONCAT_WS(\' \', `b`.`firstname`, `b`.`lastname`) AS `beslist_door_naam` ' .
    'FROM `leave_requests` `lr` ' .
    'JOIN `Accounts` `a` ON `a`.`id` = `lr`.`account_id` ' .
    'LEFT JOIN `Accounts` `b` ON `b`.`id` = `lr`.`approved_by` ' .
    'WHERE `lr`.`id` = ? LIMIT 1'
);
$stmt->execute([$id]);
$row = $stmt->fetch();

if (!$row) {
    respond_error(404, 'Aanvraag niet gevonden.');
}

$isEigen = (int) $row['account_id'] === $userId;
$magBeslissen = mag_beheren($me, ['department' => $row['department'], 'branch_id' => $row['branch_id']]);

if (!$isEigen && !$magBeslissen) {
    respond_error(403, 'Geen toegang tot deze aanvraag.');
}

$typeLabels = [
    'vakantie' => 'Vakantie', 'ziekte' => 'Ziekte', 'verlof' => 'Verlof',
    'onbetaald_verlof' => 'Onbetaald verlof', 'bijzonder_verlof' => 'Bijzonder verlof',
];
$statusMap = [
    'aangevraagd' => 'open', 'goedgekeurd' => 'goedgekeurd',
    'afgewezen' => 'afgewezen', 'geannuleerd' => 'geannuleerd',
];

echo json_encode([
    'id' => (int) $row['id'],
    'medewerkerId' => (int) $row['account_id'],
    'medewerkerNaam' => $row['medewerker_naam'],
    'afdelingId' => $row['department'],
    'type' => $row['type'],
    'typeLabel' => $typeLabels[$row['type']] ?? $row['type'],
    'van' => $row['start_date'],
    'tot' => $row['end_date'],
    'reden' => $row['reason'],
    'status' => $statusMap[$row['status']] ?? $row['status'],
    'notitie' => $row['decision_note'],
    'beslistDoorNaam' => $row['beslist_door_naam'],
    'aangevraagdOp' => $row['created_at'],
    'magBeslissen' => $magBeslissen && $row['status'] === 'aangevraagd',
    'isEigen' => $isEigen,
]);
