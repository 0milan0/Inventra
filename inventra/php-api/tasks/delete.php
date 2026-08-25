<?php
// Taak verwijderen — alleen teamleider en hoger (mag_taak_verwijderen).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/task_helper.php';

$userId = require_auth();
$body = read_json_body();

$taskId = isset($body['taskId']) ? (int) $body['taskId'] : 0;
if ($taskId <= 0) {
    respond_error(400, 'Ongeldige taak.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$taskStmt = $pdo->prepare('SELECT `branch_id` FROM `tasks` WHERE `id` = ? LIMIT 1');
$taskStmt->execute([$taskId]);
$task = $taskStmt->fetch();

if (!$task || (int) $task['branch_id'] !== (int) $me['branch_id']) {
    respond_error(404, 'Taak niet gevonden.');
}

if (!mag_taak_verwijderen($me)) {
    respond_error(403, 'Je hebt geen rechten om taken te verwijderen.');
}

// task_checklist_items/task_assignees/task_comments/task_activity vallen
// via ON DELETE CASCADE automatisch mee.
$deleteStmt = $pdo->prepare('DELETE FROM `tasks` WHERE `id` = ?');
$deleteStmt->execute([$taskId]);

echo json_encode(['success' => true]);
