<?php
// Nieuwe medewerker uitnodigen: maakt een Account-rij aan met status
// 'invited' + een 6-cijferige activatiecode (invitation_token). De nieuwe
// medewerker gebruikt die code samen met dit e-mailadres op app/activeren.tsx
// om zelf een wachtwoord in te stellen (zelfde flow als een reeds bestaand
// uitgenodigd account, alleen wordt de uitnodiging hier voor het eerst
// aangemaakt in plaats van handmatig in de database gezet).
//
// Toegang: permissie "personeel_aanmaken" (standaard bij rang Filiaalmanager/
// Assistent Filiaalmanager, en alleen door een filiaalmanager aan iemand
// anders toe te kennen — zie accounts/permissions-update.php).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/../permissions_helper.php';

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

$userId = require_auth();
$body = read_json_body();

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `branch_id`, `company` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}
if (!heeft_permissie($pdo, $me, 'personeel_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om nieuwe medewerkers aan te maken.');
}
if ($me['branch_id'] === null) {
    respond_error(404, 'Geen filiaal ingesteld op dit account.');
}

$voornaam = trim((string) ($body['voornaam'] ?? ''));
$tussenvoegsel = trim((string) ($body['tussenvoegsel'] ?? ''));
$achternaam = trim((string) ($body['achternaam'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));
$telefoonnummer = trim((string) ($body['telefoonnummer'] ?? ''));
$geboortedatum = trim((string) ($body['geboortedatum'] ?? ''));
$rang = (string) ($body['rank'] ?? '');
$afdeling = (string) ($body['department'] ?? '');

if ($voornaam === '' || $achternaam === '' || $email === '' || $telefoonnummer === '') {
    respond_error(400, 'Voornaam, achternaam, e-mailadres en telefoonnummer zijn verplicht.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond_error(400, 'Ongeldig e-mailadres.');
}
if ($geboortedatum !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $geboortedatum)) {
    respond_error(400, 'Ongeldige geboortedatum, gebruik JJJJ-MM-DD.');
}
if (!in_array($rang, GELDIGE_RANGEN, true)) {
    respond_error(400, 'Ongeldige rang.');
}
if (!in_array($afdeling, GELDIGE_AFDELINGEN, true)) {
    respond_error(400, 'Ongeldige afdeling.');
}

$mijnNiveau = rank_niveau($me['rank']);

// Een niet-filiaalmanager met deze permissie (bv. een teamleider die 'm los
// toegekend heeft gekregen) mag alleen medewerker-niveau accounts aanmaken —
// voorkomt dat zo iemand zelf een (assistent-)filiaalmanager aanmaakt.
if ($mijnNiveau !== 'filiaalmanager' && rank_niveau($rang) !== 'medewerker') {
    respond_error(403, 'Je kunt alleen medewerkers aanmaken, geen teamleiders of managers.');
}
// Teamleider (met de permissie toegekend) blijft, net als bij ander
// personeelsbeheer, beperkt tot de eigen afdeling.
if ($mijnNiveau === 'teamleider' && $afdeling !== $me['department']) {
    respond_error(403, 'Je kunt alleen medewerkers aanmaken voor je eigen afdeling.');
}

$dupStmt = $pdo->prepare('SELECT `id` FROM `Accounts` WHERE LOWER(`email`) = LOWER(?) LIMIT 1');
$dupStmt->execute([$email]);
if ($dupStmt->fetch()) {
    respond_error(409, 'Er bestaat al een account met dit e-mailadres.');
}

$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

$insert = $pdo->prepare(
    'INSERT INTO `Accounts` (`firstname`, `middlename`, `lastname`, `email`, `phonenumber`, `dateofbirth`, ' .
    '`rank`, `department`, `branch_id`, `company`, `status`, `invitation_token`, `invitation_token_expired_at`) ' .
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'invited\', ?, DATE_ADD(NOW(), INTERVAL 14 DAY))'
);
$insert->execute([
    $voornaam,
    $tussenvoegsel !== '' ? $tussenvoegsel : null,
    $achternaam,
    $email,
    $telefoonnummer,
    $geboortedatum !== '' ? $geboortedatum : null,
    $rang,
    $afdeling,
    $me['branch_id'],
    $me['company'],
    $code,
]);

echo json_encode(['id' => (int) $pdo->lastInsertId(), 'activatieCode' => $code]);
