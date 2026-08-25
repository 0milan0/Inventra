<?php
// Nieuwe taak aanmaken en (optioneel) toewijzen aan medewerker(s) — voor
// teamleider (alleen zijn eigen afdeling) / (assistent-)filiaalmanager (elke
// afdeling binnen zijn filiaal).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

const GELDIGE_AFDELINGEN = ['AGF', 'Kassa & Boetiek', 'KW', 'Vers', 'Brood'];
const GELDIGE_HERHALING = ['Yearly', 'quarterly', 'monthly', 'weekly', 'daily', 'specific_day'];
const GELDIGE_DAGEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const GELDIGE_PRIORITEITEN = ['hoog', 'midden', 'laag'];

$userId = require_auth();
$body = read_json_body();

$title = trim((string) ($body['title'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$department = $body['department'] ?? '';
$assignedToId = isset($body['assignedToId']) && $body['assignedToId'] !== null ? (int) $body['assignedToId'] : null;
$deadline = trim((string) ($body['deadline'] ?? ''));
$repeatInterval = $body['repeatInterval'] ?? null;
$repeatDay = $body['repeatDay'] ?? null;
$priority = isset($body['priority']) && in_array($body['priority'], GELDIGE_PRIORITEITEN, true) ? $body['priority'] : null;
$barcode = trim((string) ($body['barcode'] ?? ''));
$extraAssigneeIds = array_values(array_unique(array_map('intval', $body['assigneeIds'] ?? [])));

if ($title === '') {
    respond_error(400, 'Titel is verplicht.');
}
if (!in_array($department, GELDIGE_AFDELINGEN, true)) {
    respond_error(400, 'Ongeldige afdeling.');
}
if ($repeatInterval !== null && !in_array($repeatInterval, GELDIGE_HERHALING, true)) {
    respond_error(400, 'Ongeldige herhaling.');
}
if ($repeatDay !== null && !in_array($repeatDay, GELDIGE_DAGEN, true)) {
    respond_error(400, 'Ongeldige herhalingsdag.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$niveau = rank_niveau($me['rank']);
if ($niveau === 'medewerker') {
    respond_error(403, 'Je hebt geen rechten om taken aan te maken.');
}
if ($niveau === 'teamleider' && $department !== $me['department']) {
    respond_error(403, 'Je kunt alleen taken aanmaken voor je eigen afdeling.');
}

$alleToegewezenIds = $assignedToId !== null ? array_merge([$assignedToId], $extraAssigneeIds) : $extraAssigneeIds;
if (count($alleToegewezenIds) > 0) {
    $placeholders = implode(',', array_fill(0, count($alleToegewezenIds), '?'));
    $assigneeStmt = $pdo->prepare("SELECT `id`, `branch_id` FROM `Accounts` WHERE `id` IN ($placeholders)");
    $assigneeStmt->execute($alleToegewezenIds);
    $gevonden = $assigneeStmt->fetchAll();
    if (count($gevonden) !== count(array_unique($alleToegewezenIds))) {
        respond_error(400, 'Eén of meer toegewezen medewerkers bestaan niet.');
    }
    foreach ($gevonden as $row) {
        if ((int) $row['branch_id'] !== (int) $me['branch_id']) {
            respond_error(400, 'Toegewezen medewerker hoort niet bij jouw filiaal.');
        }
    }
}

$productId = null;
if ($barcode !== '') {
    $productStmt = $pdo->prepare('SELECT `id` FROM `products` WHERE `barcode` = ? LIMIT 1');
    $productStmt->execute([$barcode]);
    $product = $productStmt->fetch();
    if (!$product) {
        respond_error(400, 'Product met deze barcode bestaat niet.');
    }
    $productId = (int) $product['id'];
}

$pdo->beginTransaction();
try {
    $insert = $pdo->prepare(
        'INSERT INTO `tasks` (`title`, `description`, `department`, `branch_id`, `status`, `priority`, ' .
        '`assigned_to_id`, `product_id`, `created_by_id`, `deadline`, `repeat_interval`, `repeat_day`) ' .
        'VALUES (?, ?, ?, ?, \'Todo\', ?, ?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([
        $title,
        $description !== '' ? $description : '',
        $department,
        $me['branch_id'],
        $priority,
        $assignedToId,
        $productId,
        $userId,
        $deadline !== '' ? $deadline : null,
        $repeatInterval,
        $repeatDay,
    ]);
    $taskId = (int) $pdo->lastInsertId();

    if (count($extraAssigneeIds) > 0) {
        $assigneeInsert = $pdo->prepare('INSERT INTO `task_assignees` (`task_id`, `account_id`) VALUES (?, ?)');
        foreach ($extraAssigneeIds as $extraId) {
            $assigneeInsert->execute([$taskId, $extraId]);
        }
    }

    $activityInsert = $pdo->prepare(
        'INSERT INTO `task_activity` (`task_id`, `account_id`, `type`, `detail`) VALUES (?, ?, \'created\', NULL)'
    );
    $activityInsert->execute([$taskId, $userId]);

    if (count($alleToegewezenIds) > 0) {
        $assignActivity = $pdo->prepare(
            'INSERT INTO `task_activity` (`task_id`, `account_id`, `type`, `detail`) VALUES (?, ?, \'assigned\', NULL)'
        );
        $assignActivity->execute([$taskId, $userId]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

echo json_encode(['id' => $taskId]);
