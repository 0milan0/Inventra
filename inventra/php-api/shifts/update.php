<?php
// Bestaande dienst bijwerken (datum/tijd/toeslagen/notities/gewerkt-vlag) —
// de medewerker zelf wijzigen kan niet, verwijder + maak dan opnieuw aan.
// Zelfde rechten als create.php (teamleider eigen afdeling, filiaalmanager
// heel het filiaal).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

const GELDIGE_TOESLAGEN = ['Overuren', 'Weekend', 'Nacht', 'Ziekte'];

$userId = require_auth();
$body = read_json_body();

$shiftId = isset($body['id']) ? (int) $body['id'] : 0;
if ($shiftId <= 0) {
    respond_error(400, 'Ongeldige dienst.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();
if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$shiftStmt = $pdo->prepare('SELECT `account_id`, `branch_id`, `department`, `date`, `start_time`, `end_time` FROM `shifts` WHERE `id` = ? LIMIT 1');
$shiftStmt->execute([$shiftId]);
$shift = $shiftStmt->fetch();
if (!$shift) {
    respond_error(404, 'Dienst niet gevonden.');
}
if (!mag_beheren($me, ['department' => $shift['department'], 'branch_id' => $shift['branch_id']])) {
    respond_error(403, 'Je hebt geen rechten om deze dienst te bewerken.');
}

$velden = [];
$waarden = [];

if (array_key_exists('datum', $body)) {
    $datum = trim((string) $body['datum']);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $datum)) {
        respond_error(400, 'Ongeldige datum, gebruik JJJJ-MM-DD.');
    }
    $velden[] = '`date` = ?';
    $waarden[] = $datum;
}
if (array_key_exists('start', $body)) {
    $start = trim((string) $body['start']);
    if (!preg_match('/^\d{2}:\d{2}$/', $start)) {
        respond_error(400, 'Ongeldige starttijd, gebruik UU:MM.');
    }
    $velden[] = '`start_time` = ?';
    $waarden[] = $start;
}
if (array_key_exists('eind', $body)) {
    $eind = trim((string) $body['eind']);
    if (!preg_match('/^\d{2}:\d{2}$/', $eind)) {
        respond_error(400, 'Ongeldige eindtijd, gebruik UU:MM.');
    }
    $velden[] = '`end_time` = ?';
    $waarden[] = $eind;
}
if (array_key_exists('toeslagen', $body)) {
    $toeslagen = array_values(array_intersect((array) $body['toeslagen'], GELDIGE_TOESLAGEN));
    $velden[] = '`surcharges` = ?';
    $waarden[] = count($toeslagen) > 0 ? implode(',', $toeslagen) : null;
}
if (array_key_exists('notities', $body)) {
    $notities = trim((string) ($body['notities'] ?? ''));
    $velden[] = '`notes` = ?';
    $waarden[] = $notities !== '' ? $notities : null;
}
if (array_key_exists('gewerkt', $body)) {
    $velden[] = '`worked` = ?';
    $waarden[] = !empty($body['gewerkt']) ? 1 : 0;
}

if (count($velden) === 0) {
    respond_error(400, 'Niets om bij te werken.');
}

// Niet inroosteren tijdens goedgekeurd verlof — met de effectieve (evt.
// bijgewerkte) datum/tijd, anders met de bestaande waarden van de dienst.
$effDatum = $datum ?? $shift['date'];
$effStart = $start ?? substr($shift['start_time'], 0, 5);
$effEind = $eind ?? substr($shift['end_time'], 0, 5);
$verlofStmt = $pdo->prepare(
    'SELECT `id` FROM `leave_requests` WHERE `account_id` = ? AND `status` = \'goedgekeurd\' ' .
    'AND `start_date` <= ? AND `end_date` >= ? LIMIT 1'
);
$verlofStmt->execute([$shift['account_id'], "$effDatum $effEind:00", "$effDatum $effStart:00"]);
if ($verlofStmt->fetch()) {
    respond_error(409, 'Deze medewerker heeft goedgekeurd verlof op dit tijdstip.');
}

$waarden[] = $shiftId;
$pdo->prepare('UPDATE `shifts` SET ' . implode(', ', $velden) . ' WHERE `id` = ?')->execute($waarden);

echo json_encode(['ok' => true]);
