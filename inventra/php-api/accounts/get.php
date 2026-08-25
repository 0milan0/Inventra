<?php
// Profiel opvragen — van jezelf (geen ?id) of van een collega (?id=X).
// Een collega mag je alleen inzien (en straks bewerken) als je diegene ook
// mag beheren — dezelfde autorisatie als personeelsbeheer: teamleider
// binnen de eigen afdeling, (assistent-)filiaalmanager binnen heel het
// filiaal. Noodcontactgegevens gaan alleen mee als je je eigen profiel
// opvraagt.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/../user_response.php';

$userId = require_auth();
$targetId = isset($_GET['id']) && $_GET['id'] !== '' ? (int) $_GET['id'] : $userId;

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$stmt = $pdo->prepare(
    'SELECT `id`, `firstname`, `middlename`, `lastname`, `dateofbirth`, `email`, `phonenumber`, ' .
    '`profile_picture`, `rank`, `department`, `status`, `badges`, `company`, `branch_id`, ' .
    '`emergency_phone`, `emergency_email` ' .
    'FROM `Accounts` WHERE `id` = ? LIMIT 1'
);
$stmt->execute([$targetId]);
$account = $stmt->fetch();

if (!$account) {
    respond_error(404, 'Gebruiker niet gevonden.');
}

$isEigen = $targetId === $userId;

if (!$isEigen && !mag_beheren($me, $account)) {
    respond_error(403, 'Geen toegang tot dit profiel.');
}

$response = account_to_user_response($account);

if ($isEigen) {
    $response['emergencyTelefoon'] = $account['emergency_phone'];
    $response['emergencyEmail'] = $account['emergency_email'];
}

echo json_encode(['user' => $response, 'isEigen' => $isEigen]);
