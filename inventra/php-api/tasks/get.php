<?php
// Eén taak in detail: checklist, reacties (met 1-niveau replies) en
// activiteit. Zichtbaar binnen dezelfde scope als list.php (eigen afdeling,
// of filiaalbreed voor een (assistent-)filiaalmanager) — plus altijd
// zichtbaar voor wie er zelf (mede-)toegewezen aan is, ook buiten die scope.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/task_helper.php';

$userId = require_auth();
$taskId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

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

$taskStmt = $pdo->prepare(
    'SELECT `t`.*, CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `toegewezen_naam`, ' .
    'CONCAT_WS(\' \', `c`.`firstname`, `c`.`lastname`) AS `aangemaakt_door_naam`, ' .
    '`p`.`id` AS `product_id_fk`, `p`.`name` AS `product_naam`, `p`.`barcode` AS `product_barcode` ' .
    'FROM `tasks` `t` ' .
    'LEFT JOIN `Accounts` `a` ON `a`.`id` = `t`.`assigned_to_id` ' .
    'JOIN `Accounts` `c` ON `c`.`id` = `t`.`created_by_id` ' .
    'LEFT JOIN `products` `p` ON `p`.`id` = `t`.`product_id` ' .
    'WHERE `t`.`id` = ? LIMIT 1'
);
$taskStmt->execute([$taskId]);
$task = $taskStmt->fetch();

if (!$task) {
    respond_error(404, 'Taak niet gevonden.');
}

$extraStmt = $pdo->prepare(
    "SELECT `ta`.`account_id`, CONCAT_WS(' ', `a`.`firstname`, `a`.`lastname`) AS `naam` " .
    'FROM `task_assignees` `ta` JOIN `Accounts` `a` ON `a`.`id` = `ta`.`account_id` WHERE `ta`.`task_id` = ?'
);
$extraStmt->execute([$taskId]);
$extraToegewezenen = array_map(
    fn ($r) => ['id' => (int) $r['account_id'], 'naam' => $r['naam']],
    $extraStmt->fetchAll()
);
$extraIds = array_map(fn ($r) => $r['id'], $extraToegewezenen);

$niveau = rank_niveau($me['rank']);
$zichtbaar = (int) $task['branch_id'] === (int) $me['branch_id'] && (
    $niveau === 'filiaalmanager' ||
    $task['department'] === $me['department'] ||
    (int) ($task['assigned_to_id'] ?? 0) === (int) $me['id'] ||
    in_array((int) $me['id'], $extraIds, true)
);

if (!$zichtbaar) {
    respond_error(403, 'Geen toegang tot deze taak.');
}

$checklistStmt = $pdo->prepare(
    'SELECT `id`, `label`, `done` FROM `task_checklist_items` WHERE `task_id` = ? ORDER BY `sort_order`, `id`'
);
$checklistStmt->execute([$taskId]);
$checklist = array_map(
    fn ($r) => ['id' => (int) $r['id'], 'label' => $r['label'], 'gedaan' => (bool) $r['done']],
    $checklistStmt->fetchAll()
);

$commentStmt = $pdo->prepare(
    'SELECT `tc`.`id`, `tc`.`parent_comment_id`, `tc`.`comment`, `tc`.`created_at`, `tc`.`user_id`, ' .
    'CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `auteur_naam`, `a`.`profile_picture` AS `auteur_foto` ' .
    'FROM `task_comments` `tc` JOIN `Accounts` `a` ON `a`.`id` = `tc`.`user_id` ' .
    'WHERE `tc`.`task_id` = ? ORDER BY `tc`.`created_at` ASC'
);
$commentStmt->execute([$taskId]);
$reacties = array_map(function ($r) {
    return [
        'id' => (int) $r['id'],
        'parentId' => $r['parent_comment_id'] !== null ? (int) $r['parent_comment_id'] : null,
        'tekst' => $r['comment'],
        'auteurId' => (int) $r['user_id'],
        'auteurNaam' => $r['auteur_naam'],
        'auteurFoto' => $r['auteur_foto'],
        'tijd' => $r['created_at'],
    ];
}, $commentStmt->fetchAll());

$activityStmt = $pdo->prepare(
    'SELECT `ta`.`id`, `ta`.`type`, `ta`.`detail`, `ta`.`created_at`, ' .
    'CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `account_naam` ' .
    'FROM `task_activity` `ta` JOIN `Accounts` `a` ON `a`.`id` = `ta`.`account_id` ' .
    'WHERE `ta`.`task_id` = ? ORDER BY `ta`.`created_at` DESC'
);
$activityStmt->execute([$taskId]);
$activiteit = array_map(function ($r) {
    return [
        'id' => (int) $r['id'],
        'type' => $r['type'],
        'detail' => $r['detail'],
        'accountNaam' => $r['account_naam'],
        'tijd' => $r['created_at'],
    ];
}, $activityStmt->fetchAll());

echo json_encode([
    'id' => (int) $task['id'],
    'titel' => $task['title'],
    'beschrijving' => $task['description'],
    'afdeling' => $task['department'],
    'status' => $task['status'],
    'prioriteit' => $task['priority'],
    'startTime' => $task['start_time'],
    'deadline' => $task['deadline'],
    'herhaalInterval' => $task['repeat_interval'],
    'herhaalDag' => $task['repeat_day'],
    'toegewezenAan' => $task['assigned_to_id'] !== null
        ? ['id' => (int) $task['assigned_to_id'], 'naam' => $task['toegewezen_naam']]
        : null,
    'extraToegewezenen' => $extraToegewezenen,
    'product' => $task['product_id_fk'] !== null
        ? ['id' => (int) $task['product_id_fk'], 'naam' => $task['product_naam'], 'barcode' => $task['product_barcode']]
        : null,
    'aangemaaktDoor' => ['id' => (int) $task['created_by_id'], 'naam' => $task['aangemaakt_door_naam']],
    'aangemaaktOp' => $task['created_at'],
    'bijgewerktOp' => $task['updated_at'],
    'magBewerken' => mag_taak_bewerken($me, $task, $extraIds),
    'magVerwijderen' => mag_taak_verwijderen($me),
    'checklist' => $checklist,
    'reacties' => $reacties,
    'activiteit' => $activiteit,
]);
