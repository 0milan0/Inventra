<?php
// Een medewerker dient zelf een verlofaanvraag in voor zijn eigen account.
// Teamleider(s) van dezelfde afdeling en (assistent-)filiaalmanager(s) van
// hetzelfde filiaal — degenen die 'm mogen beslissen — krijgen meteen een
// pushmelding.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../push_helper.php';

$userId = require_auth();
$body = read_json_body();

$geldigeTypes = ['vakantie', 'ziekte', 'verlof', 'onbetaald_verlof', 'bijzonder_verlof'];

$type = $body['type'] ?? '';
$startDate = trim((string) ($body['startDate'] ?? ''));
$endDate = trim((string) ($body['endDate'] ?? ''));
$reason = trim((string) ($body['reason'] ?? ''));

if (!in_array($type, $geldigeTypes, true)) {
    respond_error(400, 'Ongeldig verloftype.');
}
if ($startDate === '' || $endDate === '') {
    respond_error(400, 'Startdatum en einddatum zijn verplicht.');
}
if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $endDate)) {
    respond_error(400, 'Ongeldige datum/tijd, gebruik JJJJ-MM-DD UU:MM.');
}
if ($endDate < $startDate) {
    respond_error(400, 'Einddatum/tijd kan niet voor de startdatum/tijd liggen.');
}

$pdo = get_db();

$meStmt = $pdo->prepare(
    'SELECT `department`, `branch_id`, CONCAT_WS(\' \', `firstname`, `lastname`) AS `naam` ' .
    'FROM `Accounts` WHERE `id` = ? LIMIT 1'
);
$meStmt->execute([$userId]);
$me = $meStmt->fetch();
if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$insert = $pdo->prepare(
    'INSERT INTO `leave_requests` (`account_id`, `type`, `start_date`, `end_date`, `reason`, `status`) ' .
    'VALUES (?, ?, ?, ?, ?, \'aangevraagd\')'
);
$insert->execute([$userId, $type, $startDate, $endDate, $reason !== '' ? $reason : null]);
$id = (int) $pdo->lastInsertId();

if ($me['branch_id'] !== null) {
    // Zelfde substring-matchlogica als rank_niveau() in rank_helper.php, hier
    // direct in SQL zodat we in één query de juiste ontvangers te pakken hebben.
    $ontvangerStmt = $pdo->prepare(
        'SELECT `ad`.`device_token` FROM `Accounts_devices` `ad` ' .
        'JOIN `Accounts` `a` ON `a`.`id` = `ad`.`user_id` ' .
        'WHERE `a`.`branch_id` = ? AND `a`.`status` = \'actief\' AND (' .
        '  LOWER(`a`.`rank`) LIKE \'%filiaalmanager%\' OR ' .
        '  (LOWER(`a`.`rank`) LIKE \'%teamleider%\' AND `a`.`department` = ?)' .
        ')'
    );
    $ontvangerStmt->execute([$me['branch_id'], $me['department']]);
    $tokens = array_map(fn ($r) => $r['device_token'], $ontvangerStmt->fetchAll());

    $typeLabels = [
        'vakantie' => 'Vakantie', 'ziekte' => 'Ziekte', 'verlof' => 'Verlof',
        'onbetaald_verlof' => 'Onbetaald verlof', 'bijzonder_verlof' => 'Bijzonder verlof',
    ];
    $label = $typeLabels[$type] ?? $type;
    $periode = date('d-m-Y H:i', strtotime($startDate)) . ' t/m ' . date('d-m-Y H:i', strtotime($endDate));
    stuur_pushmeldingen(
        $tokens,
        'Nieuwe verlofaanvraag',
        "{$me['naam']} — {$label}: {$periode}"
    );
}

echo json_encode(['id' => $id]);
