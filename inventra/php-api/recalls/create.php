<?php
// Nieuwe productrecall aanmaken: registreert de recall, en maakt voor elk
// doelfiliaal — als dat filiaal het product op een schap heeft staan — een
// dringende taak aan voor de afdeling van dat schap (recall_branches.status
// 'aangemaakt'). Filialen die het product niet voeren worden overgeslagen
// ('overgeslagen', geen taak). Iedereen in de betrokken afdeling van elk
// 'aangemaakt'-filiaal krijgt meteen een pushmelding (niet alleen de
// afdeling van de taak).
//
// Toegang: permissie "recalls_aanmaken" (standaard bij rang Regiomanager/
// Inkoper/Logistiek Coördinator).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../permissions_helper.php';
require_once __DIR__ . '/../push_helper.php';

$userId = require_auth();
$body = read_json_body();

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `company` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}
if (!heeft_permissie($pdo, $me, 'recalls_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om recalls aan te maken.');
}
if ($me['company'] === null) {
    respond_error(404, 'Geen bedrijf ingesteld op dit account.');
}

$productId = isset($body['productId']) ? (int) $body['productId'] : 0;
$titel = trim((string) ($body['titel'] ?? ''));
$criteriaNotitie = trim((string) ($body['criteriaNotitie'] ?? ''));
$thtVan = trim((string) ($body['thtVan'] ?? ''));
$thtTot = trim((string) ($body['thtTot'] ?? ''));
$startTime = trim((string) ($body['startTime'] ?? ''));
$deadline = trim((string) ($body['deadline'] ?? ''));
$alleFilialen = !empty($body['alleFilialen']);
$branchIds = array_values(array_unique(array_map('intval', $body['branchIds'] ?? [])));

if ($productId <= 0 || $titel === '') {
    respond_error(400, 'Product en reden zijn verplicht.');
}
if ($thtVan !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $thtVan)) {
    respond_error(400, 'Ongeldige "THT vanaf"-datum, gebruik JJJJ-MM-DD.');
}
if ($thtTot !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $thtTot)) {
    respond_error(400, 'Ongeldige "THT tot"-datum, gebruik JJJJ-MM-DD.');
}
if ($thtVan !== '' && $thtTot !== '' && $thtVan > $thtTot) {
    respond_error(400, '"THT vanaf" kan niet na "THT tot" liggen.');
}
if ($startTime !== '' && !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $startTime)) {
    respond_error(400, 'Ongeldige starttijd, gebruik JJJJ-MM-DD UU:MM.');
}
if ($deadline !== '' && !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $deadline)) {
    respond_error(400, 'Ongeldige deadline, gebruik JJJJ-MM-DD UU:MM.');
}
if ($startTime !== '' && $deadline !== '' && $startTime > $deadline) {
    respond_error(400, 'Starttijd kan niet na de deadline liggen.');
}
if (!$alleFilialen && count($branchIds) === 0) {
    respond_error(400, 'Kies minstens één filiaal, of "alle filialen".');
}

$productStmt = $pdo->prepare('SELECT `id`, `name` FROM `products` WHERE `id` = ? LIMIT 1');
$productStmt->execute([$productId]);
$product = $productStmt->fetch();
if (!$product) {
    respond_error(404, 'Product niet gevonden.');
}

if ($alleFilialen) {
    $branchStmt = $pdo->prepare('SELECT `id` FROM `Branches` WHERE `company_id` = ?');
    $branchStmt->execute([$me['company']]);
    $doelFilialen = array_map(fn ($r) => (int) $r['id'], $branchStmt->fetchAll());
} else {
    $placeholders = implode(',', array_fill(0, count($branchIds), '?'));
    $branchStmt = $pdo->prepare(
        "SELECT `id` FROM `Branches` WHERE `id` IN ($placeholders) AND `company_id` = ?"
    );
    $branchStmt->execute([...$branchIds, $me['company']]);
    $doelFilialen = array_map(fn ($r) => (int) $r['id'], $branchStmt->fetchAll());
    if (count($doelFilialen) !== count($branchIds)) {
        respond_error(400, 'Eén of meer filialen bestaan niet of horen niet bij jouw bedrijf.');
    }
}

if (count($doelFilialen) === 0) {
    respond_error(400, 'Geen filialen om te recallen.');
}

$taakTitel = 'Recall: ' . $product['name'];
$taakBeschrijving = $titel;
if ($criteriaNotitie !== '') {
    $taakBeschrijving .= "\n\nCriteria: " . $criteriaNotitie;
}
if ($thtVan !== '' || $thtTot !== '') {
    $taakBeschrijving .= "\n\nTHT: " . ($thtVan !== '' ? $thtVan : '…') . ' t/m ' . ($thtTot !== '' ? $thtTot : '…');
}

$pdo->beginTransaction();
try {
    $insertRecall = $pdo->prepare(
        'INSERT INTO `recalls` (`company_id`, `product_id`, `created_by_id`, `title`, `criteria_note`, ' .
        '`tht_from`, `tht_to`, `all_branches`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertRecall->execute([
        $me['company'],
        $productId,
        $userId,
        $titel,
        $criteriaNotitie !== '' ? $criteriaNotitie : null,
        $thtVan !== '' ? $thtVan : null,
        $thtTot !== '' ? $thtTot : null,
        $alleFilialen ? 1 : 0,
    ]);
    $recallId = (int) $pdo->lastInsertId();

    $shelfStmt = $pdo->prepare(
        'SELECT `sh`.`department` FROM `product_branch` `pb` ' .
        'JOIN `shelves` `sh` ON `sh`.`id` = `pb`.`shelf_id` ' .
        'WHERE `pb`.`product_id` = ? AND `pb`.`branch_id` = ? LIMIT 1'
    );
    $insertTask = $pdo->prepare(
        'INSERT INTO `tasks` (`title`, `description`, `department`, `branch_id`, `status`, `priority`, ' .
        '`start_time`, `deadline`, `product_id`, `recall_id`, `created_by_id`) ' .
        'VALUES (?, ?, ?, ?, \'Todo\', \'hoog\', ?, ?, ?, ?, ?)'
    );
    $insertActivity = $pdo->prepare(
        'INSERT INTO `task_activity` (`task_id`, `account_id`, `type`, `detail`) VALUES (?, ?, \'created\', NULL)'
    );
    $insertBranchRow = $pdo->prepare(
        'INSERT INTO `recall_branches` (`recall_id`, `branch_id`, `department`, `task_id`, `status`) ' .
        'VALUES (?, ?, ?, ?, ?)'
    );

    $aangemaakt = 0;
    $overgeslagen = 0;
    $pushBranches = []; // branch_id's met een aangemaakte taak — na commit tokens ophalen en versturen.

    foreach ($doelFilialen as $branchId) {
        $shelfStmt->execute([$productId, $branchId]);
        $shelfRow = $shelfStmt->fetch();

        if (!$shelfRow) {
            $insertBranchRow->execute([$recallId, $branchId, null, null, 'overgeslagen']);
            $overgeslagen++;
            continue;
        }

        $department = $shelfRow['department'];

        $insertTask->execute([
            $taakTitel,
            $taakBeschrijving,
            $department,
            $branchId,
            $startTime !== '' ? $startTime : null,
            $deadline !== '' ? $deadline : null,
            $productId,
            $recallId,
            $userId,
        ]);
        $taskId = (int) $pdo->lastInsertId();
        $insertActivity->execute([$taskId, $userId]);

        $insertBranchRow->execute([$recallId, $branchId, $department, $taskId, 'aangemaakt']);
        $aangemaakt++;
        $pushBranches[] = $branchId;
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

// Pushmeldingen ná de commit versturen — een falende/trage Expo-aanroep mag
// de al opgeslagen recall/taken niet blokkeren of terugdraaien. Iedereen in
// het filiaal (elke afdeling), niet alleen de afdeling van de taak.
$pushBranches = array_values(array_unique($pushBranches));
if (count($pushBranches) > 0) {
    $tokenStmt = $pdo->prepare(
        'SELECT `ad`.`device_token` FROM `Accounts_devices` `ad` ' .
        'JOIN `Accounts` `a` ON `a`.`id` = `ad`.`user_id` ' .
        'WHERE `a`.`branch_id` = ? AND `a`.`status` = \'actief\''
    );
    $alleTokens = [];
    foreach ($pushBranches as $branchId) {
        $tokenStmt->execute([$branchId]);
        foreach ($tokenStmt->fetchAll() as $row) {
            $alleTokens[] = $row['device_token'];
        }
    }
    stuur_pushmeldingen($alleTokens, 'Productrecall', $taakTitel . ' — ' . $titel);
}

echo json_encode([
    'id' => $recallId,
    'aangemaakt' => $aangemaakt,
    'overgeslagen' => $overgeslagen,
]);
