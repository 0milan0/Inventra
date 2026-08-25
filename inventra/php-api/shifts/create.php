<?php
// Nieuwe dienst inroosteren — teamleider (eigen afdeling) / (assistent-)
// filiaalmanager (heel het filiaal), zelfde rechten als personeelsbeheer.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

const GELDIGE_AFDELINGEN = ['AGF', 'Kassa & Boetiek', 'KW', 'Vers', 'Brood'];
const GELDIGE_TOESLAGEN = ['Overuren', 'Weekend', 'Nacht', 'Ziekte'];

$userId = require_auth();
$body = read_json_body();

$accountId = isset($body['accountId']) ? (int) $body['accountId'] : 0;
$department = (string) ($body['afdeling'] ?? '');
$date = trim((string) ($body['datum'] ?? ''));
$start = trim((string) ($body['start'] ?? ''));
$eind = trim((string) ($body['eind'] ?? ''));
$toeslagen = array_values(array_intersect((array) ($body['toeslagen'] ?? []), GELDIGE_TOESLAGEN));
$notities = isset($body['notities']) && trim((string) $body['notities']) !== '' ? trim((string) $body['notities']) : null;

if ($accountId <= 0 || $date === '' || $start === '' || $eind === '') {
    respond_error(400, 'Medewerker, datum en tijden zijn verplicht.');
}
if (!in_array($department, GELDIGE_AFDELINGEN, true)) {
    respond_error(400, 'Ongeldige afdeling.');
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    respond_error(400, 'Ongeldige datum, gebruik JJJJ-MM-DD.');
}
if (!preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $eind)) {
    respond_error(400, 'Ongeldige tijd, gebruik UU:MM.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();
if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$targetStmt = $pdo->prepare('SELECT `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$targetStmt->execute([$accountId]);
$target = $targetStmt->fetch();
if (!$target) {
    respond_error(404, 'Medewerker niet gevonden.');
}
if (!mag_beheren($me, $target)) {
    respond_error(403, 'Je hebt geen rechten om voor deze medewerker in te roosteren.');
}
// De ingeplande afdeling moet ook binnen het eigen beheer vallen (een
// teamleider kan niet stiekem in een andere afdeling inroosteren).
if (rank_niveau($me['rank']) === 'teamleider' && $department !== $me['department']) {
    respond_error(403, 'Je kunt alleen inroosteren voor je eigen afdeling.');
}

// Niet inroosteren tijdens goedgekeurd verlof.
$verlofStmt = $pdo->prepare(
    'SELECT `id` FROM `leave_requests` WHERE `account_id` = ? AND `status` = \'goedgekeurd\' ' .
    'AND `start_date` <= ? AND `end_date` >= ? LIMIT 1'
);
$verlofStmt->execute([$accountId, "$date $eind:00", "$date $start:00"]);
if ($verlofStmt->fetch()) {
    respond_error(409, 'Deze medewerker heeft goedgekeurd verlof op dit tijdstip.');
}

$insert = $pdo->prepare(
    'INSERT INTO `shifts` (`account_id`, `branch_id`, `department`, `date`, `start_time`, `end_time`, ' .
    '`surcharges`, `worked`, `notes`, `created_by_id`) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)'
);
$insert->execute([
    $accountId,
    $target['branch_id'],
    $department,
    $date,
    $start,
    $eind,
    count($toeslagen) > 0 ? implode(',', $toeslagen) : null,
    $notities,
    $userId,
]);

echo json_encode(['id' => (int) $pdo->lastInsertId()]);
