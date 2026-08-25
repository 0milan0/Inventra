<?php
// Dienst verwijderen — zelfde rechten als create/update.php.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

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

$shiftStmt = $pdo->prepare('SELECT `branch_id`, `department` FROM `shifts` WHERE `id` = ? LIMIT 1');
$shiftStmt->execute([$shiftId]);
$shift = $shiftStmt->fetch();
if (!$shift) {
    respond_error(404, 'Dienst niet gevonden.');
}
if (!mag_beheren($me, ['department' => $shift['department'], 'branch_id' => $shift['branch_id']])) {
    respond_error(403, 'Je hebt geen rechten om deze dienst te verwijderen.');
}

$pdo->prepare('DELETE FROM `shifts` WHERE `id` = ?')->execute([$shiftId]);

echo json_encode(['ok' => true]);
