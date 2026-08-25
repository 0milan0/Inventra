<?php
// Taak bijwerken (status/titel/beschrijving/deadline/prioriteit) — gated
// door mag_taak_bewerken (toegewezen persoon, eigen afdeling, of hoge rang).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/task_helper.php';

const GELDIGE_STATUSSEN = ['Todo', 'active', 'finish'];
const GELDIGE_PRIORITEITEN = ['hoog', 'midden', 'laag'];

$userId = require_auth();
$body = read_json_body();

$taskId = isset($body['taskId']) ? (int) $body['taskId'] : 0;
if ($taskId <= 0) {
    respond_error(400, 'Ongeldige taak.');
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
    respond_error(403, 'Je hebt geen rechten om deze taak te bewerken.');
}

$velden = [];
$waarden = [];

if (array_key_exists('titel', $body)) {
    $titel = trim((string) $body['titel']);
    if ($titel === '') {
        respond_error(400, 'Titel mag niet leeg zijn.');
    }
    $velden[] = '`title` = ?';
    $waarden[] = $titel;
}
if (array_key_exists('beschrijving', $body)) {
    $velden[] = '`description` = ?';
    $waarden[] = trim((string) $body['beschrijving']);
}
if (array_key_exists('deadline', $body)) {
    $deadline = trim((string) ($body['deadline'] ?? ''));
    $velden[] = '`deadline` = ?';
    $waarden[] = $deadline !== '' ? $deadline : null;
}
if (array_key_exists('prioriteit', $body)) {
    $prioriteit = $body['prioriteit'];
    if ($prioriteit !== null && !in_array($prioriteit, GELDIGE_PRIORITEITEN, true)) {
        respond_error(400, 'Ongeldige prioriteit.');
    }
    $velden[] = '`priority` = ?';
    $waarden[] = $prioriteit;
}

$statusGewijzigd = false;
if (array_key_exists('status', $body)) {
    if (!in_array($body['status'], GELDIGE_STATUSSEN, true)) {
        respond_error(400, 'Ongeldige status.');
    }
    $statusGewijzigd = $body['status'] !== $task['status'];
    $velden[] = '`status` = ?';
    $waarden[] = $body['status'];
}

if (count($velden) === 0) {
    respond_error(400, 'Niets om bij te werken.');
}

$pdo->beginTransaction();
try {
    $waarden[] = $taskId;
    $updateStmt = $pdo->prepare('UPDATE `tasks` SET ' . implode(', ', $velden) . ' WHERE `id` = ?');
    $updateStmt->execute($waarden);

    if ($statusGewijzigd) {
        // `detail` bevat bewust alleen de rauwe status-waarde (niet een kant-
        // en-klare zin) — de client vertaalt 'm naar het Dutch label, zelfde
        // STATUS_LABEL-mapping die overal anders in de taken-UI gebruikt wordt.
        $activityInsert = $pdo->prepare(
            'INSERT INTO `task_activity` (`task_id`, `account_id`, `type`, `detail`) VALUES (?, ?, \'status_changed\', ?)'
        );
        $activityInsert->execute([$taskId, $userId, $body['status']]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

echo json_encode(['success' => true]);
