<?php
// Genereert een nieuwe 6-cijferige kassacode voor een medewerker. Het
// wachtwoord van dat account blijft zoals het is (meestal leeg totdat de
// medewerker voor het eerst inlogt op het kassasysteem) — deze code is enkel
// bedoeld om aan de medewerker door te geven; het kassasysteem zelf valt
// buiten deze app.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$body = read_json_body();

$targetId = isset($body['accountId']) ? (int) $body['accountId'] : 0;
if ($targetId <= 0) {
    respond_error(400, 'Ongeldig account.');
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

$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

$updateStmt = $pdo->prepare(
    'UPDATE `Accounts` SET `register_code` = ?, `register_code_generated_at` = NOW() WHERE `id` = ?'
);
$updateStmt->execute([$code, $targetId]);

echo json_encode(['code' => $code]);
