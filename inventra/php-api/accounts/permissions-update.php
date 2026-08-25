<?php
// Eén permissie voor één medewerker expliciet toekennen, intrekken, of terug
// naar de standaard (rang/afdeling) zetten — voor teamleider (eigen
// afdeling) / (assistent-)filiaalmanager (heel het filiaal).
//
// Een klein aantal gevoelige permissies (zie MANAGER_ONLY_PERMISSIES) mag
// alleen door een (assistent-)filiaalmanager worden toegekend/ingetrokken —
// ook als de aanroeper via mag_beheren() normaal gesproken permissies mag
// beheren binnen zijn afdeling (teamleider). Dit voorkomt dat een teamleider
// bv. "personeel aanmaken" aan een ondergeschikte kan doorgeven.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

// Permissienamen die alleen een (assistent-)filiaalmanager mag toekennen/
// intrekken, ongeacht wat mag_beheren() verder toestaat.
const MANAGER_ONLY_PERMISSIES = ['personeel_aanmaken'];

$userId = require_auth();
$body = read_json_body();

$targetId = isset($body['accountId']) ? (int) $body['accountId'] : 0;
$permissionId = isset($body['permissionId']) ? (int) $body['permissionId'] : 0;
$actie = $body['action'] ?? '';

if ($targetId <= 0 || $permissionId <= 0 || !in_array($actie, ['grant', 'revoke', 'reset'], true)) {
    respond_error(400, 'Ongeldige aanvraag.');
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

$permStmt = $pdo->prepare('SELECT `name` FROM `permissions` WHERE `id` = ? LIMIT 1');
$permStmt->execute([$permissionId]);
$permissie = $permStmt->fetch();
if (!$permissie) {
    respond_error(404, 'Permissie niet gevonden.');
}

if (in_array($permissie['name'], MANAGER_ONLY_PERMISSIES, true) && rank_niveau($me['rank']) !== 'filiaalmanager') {
    respond_error(403, 'Alleen een filiaalmanager kan deze permissie toekennen.');
}

if ($actie === 'reset') {
    $del = $pdo->prepare('DELETE FROM `account_permissions` WHERE `account_id` = ? AND `permission_id` = ?');
    $del->execute([$targetId, $permissionId]);
} else {
    $upsert = $pdo->prepare(
        'INSERT INTO `account_permissions` (`account_id`, `permission_id`, `type`) VALUES (?, ?, ?) ' .
        'ON DUPLICATE KEY UPDATE `type` = VALUES(`type`)'
    );
    $upsert->execute([$targetId, $permissionId, $actie]);
}

echo json_encode(['ok' => true]);
