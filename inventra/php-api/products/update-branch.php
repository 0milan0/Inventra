<?php
// Voorraad/THT/vlaggen van één product bijwerken, voor het eigen filiaal van
// de ingelogde gebruiker. Dit is de enige write-flow op productniveau (was
// voorheen updateProduct() op de mock-data) — elke medewerker met een
// filiaal mag dit, geen extra rangcontrole (net als THT-controle nu ook
// voor iedereen toegankelijk is).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$body = read_json_body();

$barcode = trim((string) ($body['barcode'] ?? ''));
if ($barcode === '') {
    respond_error(400, 'Barcode ontbreekt.');
}

if (!isset($body['opSchap'], $body['magazijn'])) {
    respond_error(400, 'Voorraad is verplicht.');
}

$kortsteTht = isset($body['kortsteTht']) ? trim((string) $body['kortsteTht']) : '';
if ($kortsteTht !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $kortsteTht)) {
    respond_error(400, 'Ongeldige THT-datum, gebruik JJJJ-MM-DD.');
}

$opSchap = (int) $body['opSchap'];
$magazijn = (int) $body['magazijn'];
$uitgelicht = !empty($body['uitgelicht']) ? 1 : 0;
$biologisch = !empty($body['biologisch']) ? 1 : 0;
$notities = isset($body['notities']) && trim((string) $body['notities']) !== '' ? trim((string) $body['notities']) : null;

$GELDIGE_OPSLAG = ['ambient', 'koel', 'vries'];
$opslag = isset($body['opslag']) && in_array($body['opslag'], $GELDIGE_OPSLAG, true) ? $body['opslag'] : null;

if ($opSchap < 0 || $magazijn < 0) {
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

$branchRowStmt = $pdo->prepare(
    'SELECT `id` FROM `product_branch` WHERE `product_id` = ? AND `branch_id` = ? LIMIT 1'
);
$branchRowStmt->execute([$product['id'], $account['branch_id']]);

if (!$branchRowStmt->fetch()) {
    respond_error(404, 'Product niet gevonden op dit filiaal.');
}

// Voorraad/THT/opslagwijze/biologisch/uitgelicht/notities horen allemaal bij
// dit ene filiaal (product_branch) — geen van deze velden bestaat op
// `products` in de echte database.
$branchUpdateStmt = $pdo->prepare(
    'UPDATE `product_branch` SET `shelf_stock` = ?, `stockroom_stock` = ?, `shortest_tht` = ?, ' .
    '`storage` = ?, `is_organic` = ?, `is_featured` = ?, `notes` = ? WHERE `product_id` = ? AND `branch_id` = ?'
);
$branchUpdateStmt->execute([
    $opSchap,
    $magazijn,
    $kortsteTht !== '' ? $kortsteTht : null,
    $opslag,
    $biologisch,
    $uitgelicht,
    $notities,
    $product['id'],
    $account['branch_id'],
]);

echo json_encode(['success' => true]);
