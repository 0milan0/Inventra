<?php
// Goedgekeurd verlof binnen een periode — gebruikt door het dienstrooster
// (app/(tabs)/planning.tsx) om in te plannen medewerkers met goedgekeurd
// verlof te markeren/blokkeren. Zelfde scoping als shifts/list.php: iedereen
// mag dit zien binnen de eigen afdeling, (assistent-)filiaalmanager ziet heel
// het filiaal.
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
    'SELECT `lr`.`id`, `lr`.`account_id`, `lr`.`type`, `lr`.`start_date`, `lr`.`end_date` ' .
    'FROM `leave_requests` `lr` ' .
    'JOIN `Accounts` `a` ON `a`.`id` = `lr`.`account_id` ' .
    'WHERE `a`.`branch_id` = ? AND `lr`.`status` = \'goedgekeurd\' ' .
    'AND `lr`.`start_date` <= ? AND `lr`.`end_date` >= ?' .
    ($filiaalbreed ? '' : ' AND `a`.`department` = ?');

$totGrens = $tot . ' 23:59:59';
$vanGrens = $van . ' 00:00:00';

$stmt = $pdo->prepare($sql);
$stmt->execute($filiaalbreed ? [$me['branch_id'], $totGrens, $vanGrens] : [$me['branch_id'], $totGrens, $vanGrens, $me['department']]);
$rows = $stmt->fetchAll();

$typeLabels = [
    'vakantie' => 'Vakantie', 'ziekte' => 'Ziekte', 'verlof' => 'Verlof',
    'onbetaald_verlof' => 'Onbetaald verlof', 'bijzonder_verlof' => 'Bijzonder verlof',
];

echo json_encode(array_map(function ($row) use ($typeLabels) {
    return [
        'id' => (int) $row['id'],
        'accountId' => (int) $row['account_id'],
        'type' => $row['type'],
        'typeLabel' => $typeLabels[$row['type']] ?? $row['type'],
        'van' => $row['start_date'],
        'tot' => $row['end_date'],
    ];
}, $rows));
