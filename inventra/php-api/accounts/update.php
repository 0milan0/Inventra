<?php
// Werkt alléén het eigen profiel bij — de user-id komt uit het JWT, nooit
// uit de request body, zodat je nooit andermans account kunt bewerken.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../user_response.php';

$userId = require_auth();
$body = read_json_body();

$firstname = trim((string) ($body['voornaam'] ?? ''));
$lastname = trim((string) ($body['achternaam'] ?? ''));

if ($firstname === '' || $lastname === '') {
    respond_error(400, 'Voornaam en achternaam zijn verplicht.');
}

$middlename = trim((string) ($body['tussenvoegsel'] ?? ''));
$phonenumber = trim((string) ($body['telefoonnummer'] ?? ''));
$dateofbirth = trim((string) ($body['geboortedatum'] ?? ''));
$emergencyPhone = trim((string) ($body['emergencyTelefoon'] ?? ''));
$emergencyEmail = trim((string) ($body['emergencyEmail'] ?? ''));

$pdo = get_db();
$stmt = $pdo->prepare(
    'UPDATE `Accounts` SET `firstname` = ?, `middlename` = ?, `lastname` = ?, `phonenumber` = ?, ' .
    '`dateofbirth` = ?, `emergency_phone` = ?, `emergency_email` = ? WHERE `id` = ?'
);
$stmt->execute([
    $firstname,
    $middlename !== '' ? $middlename : null,
    $lastname,
    $phonenumber !== '' ? $phonenumber : null,
    $dateofbirth !== '' ? $dateofbirth : null,
    $emergencyPhone !== '' ? $emergencyPhone : null,
    $emergencyEmail !== '' ? $emergencyEmail : null,
    $userId,
]);

$getStmt = $pdo->prepare(
    'SELECT `id`, `firstname`, `middlename`, `lastname`, `dateofbirth`, `email`, `phonenumber`, ' .
    '`profile_picture`, `rank`, `department`, `status`, `badges`, `company`, `branch_id`, ' .
    '`emergency_phone`, `emergency_email` FROM `Accounts` WHERE `id` = ? LIMIT 1'
);
$getStmt->execute([$userId]);
$account = $getStmt->fetch();

$response = account_to_user_response($account);
$response['emergencyTelefoon'] = $account['emergency_phone'];
$response['emergencyEmail'] = $account['emergency_email'];

echo json_encode(['user' => $response]);
