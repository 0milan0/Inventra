<?php
// Eén verkoopbon in detail (regels + kassamedewerker + klant), alleen als
// de bon bij het eigen filiaal hoort.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$saleId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($saleId <= 0) {
    respond_error(400, 'Ongeldige bon.');
}

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();

if (!$account) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}

$saleStmt = $pdo->prepare(
    'SELECT s.`id`, s.`branch_id`, s.`total_amount`, s.`payment_method`, s.`status`, s.`created_at`, ' .
    'CONCAT_WS(\' \', a.`firstname`, a.`lastname`) AS `kassamedewerker`, ' .
    's.`customer_id`, CONCAT_WS(\' \', c.`firstname`, c.`lastname`) AS `klant_naam`, ' .
    'c.`loyalty_card_number`, c.`email` AS `klant_email`, c.`phonenumber` AS `klant_telefoon` ' .
    'FROM `sales` s ' .
    'JOIN `Accounts` a ON a.`id` = s.`cashier_id` ' .
    'LEFT JOIN `customers` c ON c.`id` = s.`customer_id` ' .
    'WHERE s.`id` = ? LIMIT 1'
);
$saleStmt->execute([$saleId]);
$sale = $saleStmt->fetch();

if (!$sale) {
    respond_error(404, 'Bon niet gevonden.');
}

if ((int) $sale['branch_id'] !== (int) $account['branch_id']) {
    respond_error(403, 'Geen toegang tot deze bon.');
}

$itemsStmt = $pdo->prepare(
    'SELECT si.`id`, si.`product_id`, si.`quantity`, si.`unit_price`, si.`vat_percentage`, ' .
    'si.`discount_amount`, si.`subtotal`, p.`name` AS `product_naam`, p.`sku`, p.`barcode`, p.`unit_type` ' .
    'FROM `sale_items` si ' .
    'JOIN `products` p ON p.`id` = si.`product_id` ' .
    'WHERE si.`sale_id` = ? ORDER BY si.`id`'
);
$itemsStmt->execute([$saleId]);
$itemRows = $itemsStmt->fetchAll();

$artikelen = array_map(function ($row) {
    return [
        'id' => (int) $row['id'],
        'productId' => (int) $row['product_id'],
        'naam' => $row['product_naam'],
        'sku' => $row['sku'],
        'barcode' => $row['barcode'],
        'eenheid' => $row['unit_type'],
        'aantal' => (int) $row['quantity'],
        'stukprijs' => (float) $row['unit_price'],
        'btwPercentage' => (float) $row['vat_percentage'],
        'korting' => (float) $row['discount_amount'],
        'subtotaal' => (float) $row['subtotal'],
    ];
}, $itemRows);

echo json_encode([
    'bon' => [
        'id' => (int) $sale['id'],
        'totaal' => (float) $sale['total_amount'],
        'betaalmethode' => $sale['payment_method'],
        'status' => $sale['status'],
        'datum' => $sale['created_at'],
        'kassamedewerker' => $sale['kassamedewerker'],
        'klantId' => $sale['customer_id'] !== null ? (int) $sale['customer_id'] : null,
        'klantNaam' => $sale['klant_naam'] !== '' ? $sale['klant_naam'] : null,
        'loyaltyKaart' => $sale['loyalty_card_number'],
        'klantEmail' => $sale['klant_email'],
        'klantTelefoon' => $sale['klant_telefoon'],
    ],
    'artikelen' => $artikelen,
]);
