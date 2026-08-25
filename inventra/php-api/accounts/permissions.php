<?php
// Volledige permissie-catalogus voor één medewerker, per categorie, met per
// permissie of 'ie effectief aanstaat en waar dat vandaan komt (rang,
// afdeling, of een losse override op dit account) — voor teamleider (eigen
// afdeling) / (assistent-)filiaalmanager (heel het filiaal).
//
// Let op: de `account_effective_permissions`-view in de database houdt geen
// rekening met `account_permissions.type = 'revoke'` (die telt daar simpelweg
// niet mee als bron, maar sluit een rang/afdeling-toekenning niet uit) — de
// revoke-logica wordt daarom hier zelf toegepast in plaats van via de view.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../rank_helper.php';

$userId = require_auth();
$targetId = isset($_GET['accountId']) ? (int) $_GET['accountId'] : 0;
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

$targetStmt = $pdo->prepare('SELECT `rank`, `department`, `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$targetStmt->execute([$targetId]);
$target = $targetStmt->fetch();

if (!$target) {
    respond_error(404, 'Account niet gevonden.');
}

if (!mag_beheren($me, $target)) {
    respond_error(403, 'Je hebt geen rechten om dit account te beheren.');
}

$permStmt = $pdo->query(
    'SELECT `id`, `name`, `label`, `category`, `description` FROM `permissions` ORDER BY `category`, `label`'
);
$permissies = $permStmt->fetchAll();

$rankIds = [];
if ($target['rank'] !== null) {
    $stmt = $pdo->prepare('SELECT `permission_id` FROM `rank_permissions` WHERE `rank` = ?');
    $stmt->execute([$target['rank']]);
    foreach ($stmt->fetchAll() as $row) {
        $rankIds[(int) $row['permission_id']] = true;
    }
}

$deptIds = [];
if ($target['department'] !== null) {
    $stmt = $pdo->prepare('SELECT `permission_id` FROM `department_permissions` WHERE `department` = ?');
    $stmt->execute([$target['department']]);
    foreach ($stmt->fetchAll() as $row) {
        $deptIds[(int) $row['permission_id']] = true;
    }
}

$overrides = [];
$stmt = $pdo->prepare('SELECT `permission_id`, `type` FROM `account_permissions` WHERE `account_id` = ?');
$stmt->execute([$targetId]);
foreach ($stmt->fetchAll() as $row) {
    $overrides[(int) $row['permission_id']] = $row['type'];
}

$perCategorie = [];
foreach ($permissies as $row) {
    $id = (int) $row['id'];
    $override = $overrides[$id] ?? null;
    $basisAan = isset($rankIds[$id]) || isset($deptIds[$id]);
    $effectief = $override === 'revoke' ? false : ($override === 'grant' ? true : $basisAan);

    $bron = null;
    if ($override !== null) {
        $bron = 'account';
    } elseif (isset($rankIds[$id])) {
        $bron = 'rank';
    } elseif (isset($deptIds[$id])) {
        $bron = 'department';
    }

    $categorie = $row['category'] ?? 'Overig';
    if (!isset($perCategorie[$categorie])) {
        $perCategorie[$categorie] = [];
    }
    $perCategorie[$categorie][] = [
        'id' => $id,
        'naam' => $row['name'],
        'label' => $row['label'],
        'omschrijving' => $row['description'],
        'effectief' => $effectief,
        'bron' => $bron,
        'override' => $override,
    ];
}

$response = [];
foreach ($perCategorie as $categorie => $lijst) {
    $response[] = ['categorie' => $categorie, 'permissies' => $lijst];
}

echo json_encode($response);
