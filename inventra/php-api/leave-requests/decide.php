<?php
// Teamleider/filiaalmanager keurt een verlofaanvraag goed of wijst 'm af. Een
// teamleider mag alleen aanvragen uit zijn eigen afdeling beslissen; een
// filiaalmanager mag alles binnen zijn eigen filiaal. De medewerker die de
// aanvraag indiende krijgt meteen een pushmelding met de beslissing (en de
// eventuele notitie erbij).
//
// `leave_requests` heeft zelf geen branch_id/department — die komen via een
// join met Accounts (de tabel zoals die al op de server staat).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';
require_once __DIR__ . '/../push_helper.php';

$userId = require_auth();
$body = read_json_body();

$id = isset($body['id']) ? (int) $body['id'] : 0;
$status = $body['status'] ?? '';
$statusMap = ['goedgekeurd' => 'goedgekeurd', 'afgewezen' => 'afgewezen'];
$notitie = isset($body['notitie']) && trim((string) $body['notitie']) !== '' ? trim((string) $body['notitie']) : null;

if ($id <= 0 || !isset($statusMap[$status])) {
    respond_error(400, 'Ongeldige aanvraag-id of status.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$niveau = rank_niveau($me['rank']);

if ($niveau === 'medewerker') {
    respond_error(403, 'Je hebt geen rechten om verlofaanvragen te beslissen.');
}

$aanvraagStmt = $pdo->prepare(
    'SELECT `lr`.`status`, `lr`.`account_id`, `lr`.`type`, `lr`.`start_date`, `lr`.`end_date`, ' .
    '`a`.`branch_id`, `a`.`department` ' .
    'FROM `leave_requests` `lr` JOIN `Accounts` `a` ON `a`.`id` = `lr`.`account_id` ' .
    'WHERE `lr`.`id` = ? LIMIT 1'
);
$aanvraagStmt->execute([$id]);
$aanvraag = $aanvraagStmt->fetch();

if (!$aanvraag) {
    respond_error(404, 'Aanvraag niet gevonden.');
}
if ((int) $aanvraag['branch_id'] !== (int) $me['branch_id']) {
    respond_error(403, 'Deze aanvraag hoort niet bij jouw filiaal.');
}
if ($niveau === 'teamleider' && $aanvraag['department'] !== $me['department']) {
    respond_error(403, 'Je mag alleen aanvragen van je eigen afdeling beslissen.');
}
if ($aanvraag['status'] !== 'aangevraagd') {
    respond_error(409, 'Deze aanvraag is al beslist.');
}

$updateStmt = $pdo->prepare(
    'UPDATE `leave_requests` SET `status` = ?, `approved_by` = ?, `decision_note` = ? WHERE `id` = ?'
);
$updateStmt->execute([$statusMap[$status], $userId, $notitie, $id]);

$tokenStmt = $pdo->prepare(
    'SELECT `device_token` FROM `Accounts_devices` WHERE `user_id` = ?'
);
$tokenStmt->execute([$aanvraag['account_id']]);
$tokens = array_map(fn ($r) => $r['device_token'], $tokenStmt->fetchAll());

$typeLabels = [
    'vakantie' => 'Vakantie', 'ziekte' => 'Ziekte', 'verlof' => 'Verlof',
    'onbetaald_verlof' => 'Onbetaald verlof', 'bijzonder_verlof' => 'Bijzonder verlof',
];
$titel = $statusMap[$status] === 'goedgekeurd' ? 'Verlofaanvraag goedgekeurd' : 'Verlofaanvraag afgewezen';
$label = $typeLabels[$aanvraag['type']] ?? $aanvraag['type'];
$periode = date('d-m-Y H:i', strtotime($aanvraag['start_date'])) . ' t/m ' . date('d-m-Y H:i', strtotime($aanvraag['end_date']));
$body_ = "{$label}: {$periode}" . ($notitie ? " — {$notitie}" : '');
stuur_pushmeldingen($tokens, $titel, $body_);

echo json_encode(['ok' => true]);
