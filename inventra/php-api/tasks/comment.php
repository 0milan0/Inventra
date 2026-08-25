<?php
// Reactie plaatsen op een taak — optioneel als reply op een bestaande
// reactie (parentCommentId, 1 niveau diep). Elke medewerker die de taak mag
// zien mag reageren (geen extra rechten-check), net als bij het mock-gedrag.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$body = read_json_body();

$taskId = isset($body['taskId']) ? (int) $body['taskId'] : 0;
$tekst = trim((string) ($body['tekst'] ?? ''));
$parentCommentId = isset($body['parentCommentId']) && $body['parentCommentId'] !== null
    ? (int) $body['parentCommentId']
    : null;

if ($taskId <= 0 || $tekst === '') {
    respond_error(400, 'Ongeldige aanvraag.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$taskStmt = $pdo->prepare('SELECT `id`, `branch_id`, `department`, `assigned_to_id` FROM `tasks` WHERE `id` = ? LIMIT 1');
$taskStmt->execute([$taskId]);
$task = $taskStmt->fetch();

if (!$task || (int) $task['branch_id'] !== (int) $me['branch_id']) {
    respond_error(404, 'Taak niet gevonden.');
}

if ($parentCommentId !== null) {
    $parentStmt = $pdo->prepare(
        'SELECT `id` FROM `task_comments` WHERE `id` = ? AND `task_id` = ? AND `parent_comment_id` IS NULL LIMIT 1'
    );
    $parentStmt->execute([$parentCommentId, $taskId]);
    if (!$parentStmt->fetch()) {
        respond_error(400, 'Kan alleen reageren op een bestaande, niet-geneste reactie.');
    }
}

$pdo->beginTransaction();
try {
    $insert = $pdo->prepare(
        'INSERT INTO `task_comments` (`task_id`, `parent_comment_id`, `user_id`, `comment`) VALUES (?, ?, ?, ?)'
    );
    $insert->execute([$taskId, $parentCommentId, $userId, $tekst]);
    $commentId = (int) $pdo->lastInsertId();

    $activityInsert = $pdo->prepare(
        'INSERT INTO `task_activity` (`task_id`, `account_id`, `type`, `detail`) VALUES (?, ?, \'comment\', NULL)'
    );
    $activityInsert->execute([$taskId, $userId]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

echo json_encode(['id' => $commentId]);
