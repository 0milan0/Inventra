<?php
// Taken zichtbaar voor de ingelogde gebruiker: teamleider/medewerker zien
// alleen taken van hun eigen afdeling (binnen hun filiaal), (assistent-)
// filiaalmanager ziet alle afdelingen binnen het filiaal. Verdere filtering
// (status/zoekterm/"voor mij") gebeurt client-side, zelfde patroon als de
// personeelslijst.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/task_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me || $me['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$niveau = rank_niveau($me['rank']);
$filiaalbreed = $niveau === 'filiaalmanager';

$sql =
    'SELECT `t`.`id`, `t`.`title`, `t`.`description`, `t`.`department`, `t`.`status`, `t`.`priority`, `t`.`deadline`, ' .
    '`t`.`assigned_to_id`, CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `toegewezen_naam`, ' .
    '`t`.`created_by_id`, `t`.`created_at`, ' .
    '(SELECT COUNT(*) FROM `task_checklist_items` `ci` WHERE `ci`.`task_id` = `t`.`id`) AS `checklist_totaal`, ' .
    '(SELECT COUNT(*) FROM `task_checklist_items` `ci` WHERE `ci`.`task_id` = `t`.`id` AND `ci`.`done` = 1) AS `checklist_afgerond` ' .
    'FROM `tasks` `t` ' .
    'LEFT JOIN `Accounts` `a` ON `a`.`id` = `t`.`assigned_to_id` ' .
    'WHERE `t`.`branch_id` = ?' .
    ($filiaalbreed ? '' : ' AND `t`.`department` = ?') .
    ' ORDER BY (`t`.`deadline` IS NULL), `t`.`deadline` ASC, `t`.`created_at` DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($filiaalbreed ? [$me['branch_id']] : [$me['branch_id'], $me['department']]);
$rows = $stmt->fetchAll();

$taakIds = array_map(fn ($r) => (int) $r['id'], $rows);
$extraByTask = [];
if (count($taakIds) > 0) {
    $placeholders = implode(',', array_fill(0, count($taakIds), '?'));
    $extraStmt = $pdo->prepare(
        "SELECT `ta`.`task_id`, `ta`.`account_id`, CONCAT_WS(' ', `a`.`firstname`, `a`.`lastname`) AS `naam` " .
        'FROM `task_assignees` `ta` JOIN `Accounts` `a` ON `a`.`id` = `ta`.`account_id` ' .
        "WHERE `ta`.`task_id` IN ($placeholders)"
    );
    $extraStmt->execute($taakIds);
    foreach ($extraStmt->fetchAll() as $row) {
        $extraByTask[(int) $row['task_id']][] = ['id' => (int) $row['account_id'], 'naam' => $row['naam']];
    }
}

$taken = array_map(function ($row) use ($extraByTask, $me) {
    $extra = $extraByTask[(int) $row['id']] ?? [];
    $extraIds = array_map(fn ($e) => $e['id'], $extra);
    return [
        'id' => (int) $row['id'],
        'titel' => $row['title'],
        'beschrijving' => $row['description'],
        'afdeling' => $row['department'],
        'status' => $row['status'],
        'prioriteit' => $row['priority'],
        'deadline' => $row['deadline'],
        'toegewezenAan' => $row['assigned_to_id'] !== null
            ? ['id' => (int) $row['assigned_to_id'], 'naam' => $row['toegewezen_naam']]
            : null,
        'extraToegewezenen' => $extra,
        'aangemaaktDoorId' => (int) $row['created_by_id'],
        'aangemaaktOp' => $row['created_at'],
        'checklistTotaal' => (int) $row['checklist_totaal'],
        'checklistAfgerond' => (int) $row['checklist_afgerond'],
        'magBewerken' => mag_taak_bewerken($me, $row, $extraIds),
    ];
}, $rows);

echo json_encode($taken);
