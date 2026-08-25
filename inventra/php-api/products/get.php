<?php
// Eén product opzoeken op barcode óf PLU-code, mét de voorraadgegevens van
// het eigen filiaal van de ingelogde gebruiker (product_branch). Een
// product dat wel bestaat maar niet aan dit filiaal gekoppeld is (geen
// product_branch-rij) telt als "niet gevonden" — dat is precies wat de
// scanner/THT-schermen verwachten (ze zoeken altijd binnen het eigen
// filiaal). Sinds elk filiaal bij het aanmaken van een product meteen een
// (nog niet ingerichte) product_branch-rij krijgt, kan `shelf_id` best NULL
// zijn — daarom LEFT JOIN i.p.v. JOIN op shelves.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$barcode = isset($_GET['barcode']) ? trim((string) $_GET['barcode']) : '';
$pluCode = isset($_GET['plu']) ? trim((string) $_GET['plu']) : '';

if ($barcode === '' && $pluCode === '') {
    respond_error(400, 'Barcode of PLU-code ontbreekt.');
}

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account || $account['branch_id'] === null) {
    respond_error(404, 'Geen filiaal ingesteld op dit account.');
}

$zoekVeld = $barcode !== '' ? 'barcode' : 'plu_code';
$zoekWaarde = $barcode !== '' ? $barcode : $pluCode;

$stmt = $pdo->prepare(
    'SELECT `p`.`id`, `p`.`barcode`, `p`.`sku`, `p`.`plu_code`, `p`.`name`, `p`.`unit_type`, `p`.`unit_size`, ' .
    '`p`.`collo_size`, `p`.`sales_price`, `p`.`image_url`, ' .
    '`c`.`name` AS `categorie`, `sc`.`name` AS `subcategorie`, `b`.`name` AS `merk`, `s`.`name` AS `leverancier`, ' .
    '`pb`.`shelf_stock`, `pb`.`stockroom_stock`, `pb`.`reserved_stock`, `pb`.`minimum_stock`, `pb`.`shelf_size`, ' .
    '`pb`.`shortest_tht`, `pb`.`last_delivery`, `pb`.`storage`, `pb`.`is_organic`, `pb`.`is_featured`, `pb`.`notes`, ' .
    '`sh`.`id` AS `shelf_id`, `sh`.`name` AS `shelf_naam` ' .
    'FROM `products` `p` ' .
    'JOIN `subcategories` `sc` ON `sc`.`id` = `p`.`subcategorie_id` ' .
    'JOIN `categories` `c` ON `c`.`id` = `sc`.`category_id` ' .
    'JOIN `brands` `b` ON `b`.`id` = `p`.`brand_id` ' .
    'JOIN `suppliers` `s` ON `s`.`id` = `p`.`supplier_id` ' .
    'JOIN `product_branch` `pb` ON `pb`.`product_id` = `p`.`id` AND `pb`.`branch_id` = ? ' .
    "LEFT JOIN `shelves` `sh` ON `sh`.`id` = `pb`.`shelf_id` " .
    "WHERE `p`.`$zoekVeld` = ? LIMIT 1"
);
$stmt->execute([$account['branch_id'], $zoekWaarde]);
$row = $stmt->fetch();

if (!$row) {
    respond_error(404, 'Product niet gevonden op dit filiaal.');
}

echo json_encode([
    'id' => (int) $row['id'],
    'barcode' => $row['barcode'],
    'sku' => $row['sku'],
    'pluCode' => $row['plu_code'],
    'naam' => $row['name'],
    'categorie' => $row['categorie'],
    'subcategorie' => $row['subcategorie'],
    'merk' => $row['merk'],
    'leverancier' => $row['leverancier'],
    'eenheidType' => $row['unit_type'],
    'eenheidGrootte' => (int) $row['unit_size'],
    'colloGrootte' => (int) $row['collo_size'],
    'verkoopprijs' => (float) $row['sales_price'],
    'afbeelding' => $row['image_url'],
    'filiaal' => [
        'opSchap' => (int) $row['shelf_stock'],
        'magazijn' => (int) $row['stockroom_stock'],
        'gereserveerd' => (int) $row['reserved_stock'],
        'minimum' => (int) $row['minimum_stock'],
        'schapGrootte' => (int) $row['shelf_size'],
        'kortsteTht' => $row['shortest_tht'],
        'laatsteLevering' => $row['last_delivery'],
        'opslag' => $row['storage'],
        'biologisch' => (bool) $row['is_organic'],
        'uitgelicht' => (bool) $row['is_featured'],
        'notities' => $row['notes'],
        'schapId' => $row['shelf_id'] !== null ? (int) $row['shelf_id'] : null,
        'schapNaam' => $row['shelf_naam'],
    ],
]);
