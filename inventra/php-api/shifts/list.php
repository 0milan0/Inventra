<?php
// Dienstrooster in een periode: zichtbaar voor iedereen in dezelfde afdeling
// (binnen het eigen filiaal) — ook medewerker-niveau, want iedereen moet
// kunnen zien wie wanneer werkt. (Assistent-)filiaalmanager ziet alle
// afdelingen. Bewerken is wel rang-gated, zie create/update/delete.php.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me || $me['branch_id'] === null) {
    echo json_encode([]);
    exit;
}

$van = isset($_GET['van']) ? trim((string) $_GET['van']) : '';
$tot = isset($_GET['tot']) ? trim((string) $_GET['tot']) : '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $van) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $tot)) {
    respond_error(400, 'Ongeldige periode, gebruik van/tot als JJJJ-MM-DD.');
}

$niveau = rank_niveau($me['rank']);
$filiaalbreed = $niveau === 'filiaalmanager';

$sql =
    'SELECT `s`.`id`, `s`.`account_id`, `s`.`department`, `s`.`date`, `s`.`start_time`, `s`.`end_time`, ' .
    '`s`.`surcharges`, `s`.`worked`, `s`.`notes`, `s`.`created_by_id`, ' .
    'CONCAT_WS(\' \', `a`.`firstname`, `a`.`lastname`) AS `medewerker_naam` ' .
    'FROM `shifts` `s` ' .
    'JOIN `Accounts` `a` ON `a`.`id` = `s`.`account_id` ' .
    'WHERE `s`.`branch_id` = ? AND `s`.`date` >= ? AND `s`.`date` <= ?' .
    ($filiaalbreed ? '' : ' AND `s`.`department` = ?') .
    ' ORDER BY `s`.`date`, `s`.`start_time`';

$stmt = $pdo->prepare($sql);
$stmt->execute($filiaalbreed ? [$me['branch_id'], $van, $tot] : [$me['branch_id'], $van, $tot, $me['department']]);
$rows = $stmt->fetchAll();

echo json_encode(array_map(function ($row) {
    return [
        'id' => (int) $row['id'],
        'accountId' => (int) $row['account_id'],
        'medewerkerNaam' => $row['medewerker_naam'],
        'afdeling' => $row['department'],
        'datum' => $row['date'],
        'start' => substr($row['start_time'], 0, 5),
        'eind' => substr($row['end_time'], 0, 5),
        'toeslagen' => $row['surcharges'] ? explode(',', $row['surcharges']) : [],
        'gewerkt' => (bool) $row['worked'],
        'notities' => $row['notes'],
        'aangemaaktDoorId' => (int) $row['created_by_id'],
    ];
}, $rows));
