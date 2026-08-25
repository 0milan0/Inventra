<?php
// Basisgegevens (naam, telefoonnummer, geboortedatum) van een medewerker
// wijzigen — voor teamleider (eigen afdeling) / (assistent-)filiaalmanager
// (heel het filiaal). Noodcontactgegevens gaan hier bewust nooit in mee —
// dat blijft alleen door de medewerker zelf in te stellen, via
// accounts/update.php (dat werkt alléén het eigen profiel bij).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/../user_response.php';

$userId = require_auth();
$body = read_json_body();

$targetId = isset($body['accountId']) ? (int) $body['accountId'] : 0;
if ($targetId <= 0) {
    respond_error(400, 'Ongeldig account.');
}

$firstname = trim((string) ($body['voornaam'] ?? ''));
$lastname = trim((string) ($body['achternaam'] ?? ''));

if ($firstname === '' || $lastname === '') {
    respond_error(400, 'Voornaam en achternaam zijn verplicht.');
}

$middlename = trim((string) ($body['tussenvoegsel'] ?? ''));
$phonenumber = trim((string) ($body['telefoonnummer'] ?? ''));
$dateofbirth = trim((string) ($body['geboortedatum'] ?? ''));

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

$updateStmt = $pdo->prepare(
    'UPDATE `Accounts` SET `firstname` = ?, `middlename` = ?, `lastname` = ?, `phonenumber` = ?, ' .
    '`dateofbirth` = ? WHERE `id` = ?'
);
$updateStmt->execute([
    $firstname,
    $middlename !== '' ? $middlename : null,
    $lastname,
    $phonenumber !== '' ? $phonenumber : null,
    $dateofbirth !== '' ? $dateofbirth : null,
    $targetId,
]);

$getStmt = $pdo->prepare(
    'SELECT `id`, `firstname`, `middlename`, `lastname`, `dateofbirth`, `email`, `phonenumber`, ' .
    '`profile_picture`, `rank`, `department`, `status`, `badges`, `company`, `branch_id` ' .
    'FROM `Accounts` WHERE `id` = ? LIMIT 1'
);
$getStmt->execute([$targetId]);
$account = $getStmt->fetch();

echo json_encode(['user' => account_to_user_response($account)]);
