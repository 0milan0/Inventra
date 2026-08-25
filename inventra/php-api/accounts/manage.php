<?php
// Rang, afdeling en/of status van een medewerker wijzigen — personeelsbeheer-
// actie voor teamleider (eigen afdeling) / (assistent-)filiaalmanager (heel
// het filiaal). Alle drie velden zijn optioneel: alleen meegestuurde velden
// worden bijgewerkt.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

const GELDIGE_RANGEN = [
    'Vakkenvuller', 'Kassamedewerker', 'Medewerker', 'Medewerker AGF', 'Medewerker Vers',
    'Medewerker Brood', 'Medewerker KW', 'Medewerker Bakkerij', 'Medewerker Slagerij',
    'Nachtploeg Medewerker', 'Senior Medewerker', 'Teamleider', 'Teamleider AGF',
    'Teamleider Vers', 'Teamleider Brood', 'Teamleider KW', 'Teamleider Kassa & Boetiek',
    'Assistent Filiaalmanager', 'Filiaalmanager', 'Regiomanager', 'Inkoper',
    'Logistiek Coördinator', 'HR Medewerker', 'ICT Beheerder', 'Financieel Medewerker',
    'Directielid', 'Beheerder',
];

const GELDIGE_AFDELINGEN = ['AGF', 'Kassa & Boetiek', 'KW', 'Vers', 'Brood'];

// 'invited' zit bewust niet in deze lijst — dat hoort bij de uitnodigings-
// flow (activate.php), niet bij een handmatige statuswijziging hier.
const GELDIGE_STATUSSEN = ['actief', 'inactief', 'geblokkeerd'];

$userId = require_auth();
$body = read_json_body();

$targetId = isset($body['accountId']) ? (int) $body['accountId'] : 0;
if ($targetId <= 0) {
    respond_error(400, 'Ongeldig account.');
}

$rang = $body['rank'] ?? null;
$afdeling = $body['department'] ?? null;
$status = $body['status'] ?? null;

if ($rang === null && $afdeling === null && $status === null) {
    respond_error(400, 'Niets om bij te werken.');
}
if ($rang !== null && !in_array($rang, GELDIGE_RANGEN, true)) {
    respond_error(400, 'Ongeldige rang.');
}
if ($afdeling !== null && !in_array($afdeling, GELDIGE_AFDELINGEN, true)) {
    respond_error(400, 'Ongeldige afdeling.');
}
if ($status !== null && !in_array($status, GELDIGE_STATUSSEN, true)) {
    respond_error(400, 'Ongeldige status.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$targetStmt = $pdo->prepare('SELECT `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$targetStmt->execute([$targetId]);
$target = $targetStmt->fetch();

if (!$target) {
    respond_error(404, 'Account niet gevonden.');
}

if (!mag_beheren($me, $target)) {
    respond_error(403, 'Je hebt geen rechten om dit account te beheren.');
}

$velden = [];
$waarden = [];
if ($rang !== null) {
    $velden[] = '`rank` = ?';
    $waarden[] = $rang;
}
if ($afdeling !== null) {
    $velden[] = '`department` = ?';
    $waarden[] = $afdeling;
}
if ($status !== null) {
    $velden[] = '`status` = ?';
    $waarden[] = $status;
}
$waarden[] = $targetId;

$updateStmt = $pdo->prepare('UPDATE `Accounts` SET ' . implode(', ', $velden) . ' WHERE `id` = ?');
$updateStmt->execute($waarden);

echo json_encode(['ok' => true]);
