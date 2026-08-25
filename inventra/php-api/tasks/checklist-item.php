<?php
// Checklist-item toevoegen/afvinken/verwijderen — gated door mag_taak_bewerken.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/task_helper.php';

const GELDIGE_ACTIES = ['add', 'toggle', 'remove'];

$userId = require_auth();
$body = read_json_body();

$taskId = isset($body['taskId']) ? (int) $body['taskId'] : 0;
$actie = $body['action'] ?? '';

if ($taskId <= 0 || !in_array($actie, GELDIGE_ACTIES, true)) {
    respond_error(400, 'Ongeldige aanvraag.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$taskStmt = $pdo->prepare('SELECT * FROM `tasks` WHERE `id` = ? LIMIT 1');
$taskStmt->execute([$taskId]);
$task = $taskStmt->fetch();

if (!$task || (int) $task['branch_id'] !== (int) $me['branch_id']) {
    respond_error(404, 'Taak niet gevonden.');
}

$extraStmt = $pdo->prepare('SELECT `account_id` FROM `task_assignees` WHERE `task_id` = ?');
$extraStmt->execute([$taskId]);
$extraIds = array_map(fn ($r) => (int) $r['account_id'], $extraStmt->fetchAll());

if (!mag_taak_bewerken($me, $task, $extraIds)) {
    respond_error(403, 'Je hebt geen rechten om deze checklist te bewerken.');
}

if ($actie === 'add') {
    $label = trim((string) ($body['label'] ?? ''));
    if ($label === '') {
        respond_error(400, 'Label is verplicht.');
    }
    $volgordeStmt = $pdo->prepare('SELECT COALESCE(MAX(`sort_order`), -1) + 1 AS `volgende` FROM `task_checklist_items` WHERE `task_id` = ?');
    $volgordeStmt->execute([$taskId]);
    $volgende = (int) $volgordeStmt->fetch()['volgende'];

    $insert = $pdo->prepare(
        'INSERT INTO `task_checklist_items` (`task_id`, `label`, `sort_order`) VALUES (?, ?, ?)'
    );
    $insert->execute([$taskId, $label, $volgende]);
    echo json_encode(['id' => (int) $pdo->lastInsertId()]);
    exit;
}

$itemId = isset($body['itemId']) ? (int) $body['itemId'] : 0;
if ($itemId <= 0) {
    respond_error(400, 'Ongeldig checklist-item.');
}

$itemStmt = $pdo->prepare('SELECT `id` FROM `task_checklist_items` WHERE `id` = ? AND `task_id` = ? LIMIT 1');
$itemStmt->execute([$itemId, $taskId]);
if (!$itemStmt->fetch()) {
    respond_error(404, 'Checklist-item niet gevonden.');
}

if ($actie === 'toggle') {
    $pdo->prepare('UPDATE `task_checklist_items` SET `done` = NOT `done` WHERE `id` = ?')->execute([$itemId]);
} else {
    $pdo->prepare('DELETE FROM `task_checklist_items` WHERE `id` = ?')->execute([$itemId]);
}

echo json_encode(['success' => true]);
