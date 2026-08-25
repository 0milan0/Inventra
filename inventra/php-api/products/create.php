<?php
// Nieuw product aanmaken in de centrale catalogus (`products`), en meteen
// voor élk filiaal van hetzelfde bedrijf een product_branch-rij aanmaken
// (voorraad op 0, nog geen schap — shelf_id NULL). Opslagwijze/biologisch/
// uitgelicht worden hier ook maar één keer ingevuld en gelden voor alle
// filialen tegelijk (staan feitelijk per filiaal in de database, maar hier
// bewust overal hetzelfde gezet).
//
// Een filiaal ziet zo'n rij zonder schap terug in het "Nieuwe producten"-
// lijstje op het dashboard (needs-branch-info.php) totdat ze zelf een schap
// + voorraad + THT invullen (product/activeren, activate-branch.php).
//
// Toegang: permissie "producten_aanmaken" (standaard bij rang Logistiek
// Coördinator, of los toegekend via personeel/[id]/permissies).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../permissions_helper.php';

const GELDIGE_OPSLAG = ['ambient', 'koel', 'vries'];

$userId = require_auth();
$body = read_json_body();

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `company` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}
if (!heeft_permissie($pdo, $me, 'producten_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om producten aan te maken.');
}
if ($me['company'] === null) {
    respond_error(404, 'Geen bedrijf ingesteld op dit account.');
}

$barcode = trim((string) ($body['barcode'] ?? ''));
$sku = trim((string) ($body['sku'] ?? ''));
$pluCode = trim((string) ($body['pluCode'] ?? ''));
$naam = trim((string) ($body['naam'] ?? ''));
$shortName = trim((string) ($body['shortName'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$eenheidType = trim((string) ($body['eenheidType'] ?? ''));
$subcategorieId = isset($body['subcategorieId']) ? (int) $body['subcategorieId'] : 0;
$merkId = isset($body['merkId']) ? (int) $body['merkId'] : 0;
$leverancierId = isset($body['leverancierId']) ? (int) $body['leverancierId'] : 0;

if ($barcode === '' || $sku === '' || $pluCode === '' || $naam === '' || $shortName === '' || $description === '' || $eenheidType === '') {
    respond_error(400, 'Barcode, sku, artikelnummer, naam, korte naam, omschrijving en eenheid zijn verplicht.');
}
if ($subcategorieId <= 0 || $merkId <= 0 || $leverancierId <= 0) {
    respond_error(400, 'Subcategorie, merk en leverancier zijn verplicht.');
}

$eenheidGrootte = isset($body['eenheidGrootte']) ? (float) $body['eenheidGrootte'] : 0;
$colloGrootte = isset($body['colloGrootte']) ? (int) $body['colloGrootte'] : 1;
$verkoopprijs = isset($body['verkoopprijs']) ? (float) $body['verkoopprijs'] : 0;
$opslag = isset($body['opslag']) && in_array($body['opslag'], GELDIGE_OPSLAG, true) ? $body['opslag'] : null;
$biologisch = !empty($body['biologisch']) ? 1 : 0;
$uitgelicht = !empty($body['uitgelicht']) ? 1 : 0;

if ($eenheidGrootte < 0 || $colloGrootte < 0 || $verkoopprijs < 0) {
    respond_error(400, 'Waarden kunnen niet negatief zijn.');
}

$dupStmt = $pdo->prepare('SELECT `id` FROM `products` WHERE `barcode` = ? LIMIT 1');
$dupStmt->execute([$barcode]);
if ($dupStmt->fetch()) {
    respond_error(409, 'Er bestaat al een product met deze barcode.');
}

$subStmt = $pdo->prepare('SELECT `id` FROM `subcategories` WHERE `id` = ? LIMIT 1');
$subStmt->execute([$subcategorieId]);
if (!$subStmt->fetch()) {
    respond_error(400, 'Ongeldige subcategorie.');
}
$merkStmt = $pdo->prepare('SELECT `id` FROM `brands` WHERE `id` = ? LIMIT 1');
$merkStmt->execute([$merkId]);
if (!$merkStmt->fetch()) {
    respond_error(400, 'Ongeldig merk.');
}
$levStmt = $pdo->prepare('SELECT `id` FROM `suppliers` WHERE `id` = ? LIMIT 1');
$levStmt->execute([$leverancierId]);
if (!$levStmt->fetch()) {
    respond_error(400, 'Ongeldige leverancier.');
}

$branchStmt = $pdo->prepare('SELECT `id` FROM `Branches` WHERE `company_id` = ?');
$branchStmt->execute([$me['company']]);
$filialen = array_map(fn ($r) => (int) $r['id'], $branchStmt->fetchAll());

$pdo->beginTransaction();
try {
    $insertProduct = $pdo->prepare(
        'INSERT INTO `products` (`barcode`, `sku`, `plu_code`, `name`, `shortname`, `description`, `unit_type`, ' .
        '`unit_size`, `collo_size`, `sales_price`, `subcategorie_id`, `brand_id`, `supplier_id`) ' .
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertProduct->execute([
        $barcode,
        $sku,
        $pluCode,
        $naam,
        $shortName,
        $description,
        $eenheidType,
        $eenheidGrootte,
        $colloGrootte,
        $verkoopprijs,
        $subcategorieId,
        $merkId,
        $leverancierId,
    ]);
    $productId = (int) $pdo->lastInsertId();

    $insertBranchRow = $pdo->prepare(
        'INSERT INTO `product_branch` (`product_id`, `branch_id`, `shelf_id`, `shelf_stock`, `stockroom_stock`, ' .
        '`reserved_stock`, `minimum_stock`, `shelf_size`, `shortest_tht`, `last_delivery`, `storage`, `is_organic`, ' .
        '`is_featured`, `notes`) ' .
        'VALUES (?, ?, NULL, 0, 0, 0, 0, 0, NULL, NULL, ?, ?, ?, NULL)'
    );
    foreach ($filialen as $branchId) {
        $insertBranchRow->execute([$productId, $branchId, $opslag, $biologisch, $uitgelicht]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

echo json_encode(['id' => $productId, 'barcode' => $barcode, 'filialen' => count($filialen)]);
