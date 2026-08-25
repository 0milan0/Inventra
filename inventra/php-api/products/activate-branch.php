<?php
// Filiaal vult voor het eerst schap/voorraad/THT in voor een centraal
// aangemaakt product. Bij het aanmaken (products/create.php) heeft élk
// filiaal al een product_branch-rij gekregen (voorraad 0, shelf_id NULL) —
// dit endpoint werkt die rij dus bij (UPDATE), het maakt 'm niet aan.
// Tegenhanger van needs-branch-info.php (dat lijstje) — zodra shelf_id niet
// meer NULL is verdwijnt het product daaruit. Elke medewerker met een
// filiaal mag dit — zelfde toegang als update-branch.php.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$body = read_json_body();

$barcode = trim((string) ($body['barcode'] ?? ''));
if ($barcode === '') {
    respond_error(400, 'Barcode ontbreekt.');
}
if (!isset($body['schapId'], $body['opSchap'], $body['magazijn'])) {
    respond_error(400, 'Schap en voorraad zijn verplicht.');
}

$kortsteTht = isset($body['kortsteTht']) ? trim((string) $body['kortsteTht']) : '';
if ($kortsteTht !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $kortsteTht)) {
    respond_error(400, 'Ongeldige THT-datum, gebruik JJJJ-MM-DD.');
}

$schapId = (int) $body['schapId'];
$opSchap = (int) $body['opSchap'];
$magazijn = (int) $body['magazijn'];
$minimum = isset($body['minimum']) ? (int) $body['minimum'] : 0;
$schapGrootte = isset($body['schapGrootte']) ? (int) $body['schapGrootte'] : 0;

if ($schapId <= 0) {
    respond_error(400, 'Kies een schap.');
}
if ($opSchap < 0 || $magazijn < 0 || $minimum < 0 || $schapGrootte < 0) {
    respond_error(400, 'Voorraad kan niet negatief zijn.');
}

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null) {
    respond_error(404, 'Geen filiaal ingesteld op dit account.');
}

$productStmt = $pdo->prepare('SELECT `id` FROM `products` WHERE `barcode` = ? LIMIT 1');
$productStmt->execute([$barcode]);
$product = $productStmt->fetch();

if (!$product) {
    respond_error(404, 'Product niet gevonden.');
}

$schapStmt = $pdo->prepare('SELECT `id` FROM `shelves` WHERE `id` = ? LIMIT 1');
$schapStmt->execute([$schapId]);
if (!$schapStmt->fetch()) {
    respond_error(400, 'Ongeldig schap.');
}

$rowStmt = $pdo->prepare(
    'SELECT `id`, `shelf_id` FROM `product_branch` WHERE `product_id` = ? AND `branch_id` = ? LIMIT 1'
);
$rowStmt->execute([$product['id'], $account['branch_id']]);
$row = $rowStmt->fetch();

if (!$row) {
    respond_error(404, 'Product niet gevonden op dit filiaal.');
}
if ($row['shelf_id'] !== null) {
    respond_error(409, 'Dit product heeft al filiaalgegevens.');
}

$update = $pdo->prepare(
    'UPDATE `product_branch` SET `shelf_id` = ?, `shelf_stock` = ?, `stockroom_stock` = ?, ' .
    '`minimum_stock` = ?, `shelf_size` = ?, `shortest_tht` = ? WHERE `id` = ?'
);
$update->execute([
    $schapId,
    $opSchap,
    $magazijn,
    $minimum,
    $schapGrootte,
    $kortsteTht !== '' ? $kortsteTht : null,
    $row['id'],
]);

echo json_encode(['success' => true]);
