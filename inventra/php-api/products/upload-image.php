<?php
// Eén productfoto uploaden (multipart/form-data, velden "photo" + "productId").
// Wordt meerdere keren achter elkaar aangeroepen vanuit de app om meerdere
// foto's aan hetzelfde product te hangen (elke foto een losse rij in
// product_images). Zelfde permissie als het aanmaken van het product zelf.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../permissions_helper.php';

$userId = require_auth();
$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me || !heeft_permissie($pdo, $me, 'producten_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om productfoto\'s toe te voegen.');
}

$productId = isset($_POST['productId']) ? (int) $_POST['productId'] : 0;
if ($productId <= 0) {
    respond_error(400, 'Ongeldig product.');
}

$productStmt = $pdo->prepare('SELECT `id` FROM `products` WHERE `id` = ? LIMIT 1');
$productStmt->execute([$productId]);
if (!$productStmt->fetch()) {
    respond_error(404, 'Product niet gevonden.');
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    respond_error(400, 'Geen geldige foto ontvangen.');
}

$file = $_FILES['photo'];

if ($file['size'] > 5 * 1024 * 1024) {
    respond_error(400, 'Foto mag maximaal 5MB zijn.');
}

$toegestaan = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$mime = mime_content_type($file['tmp_name']);

if (!isset($toegestaan[$mime])) {
    respond_error(400, 'Alleen JPEG, PNG of WebP toegestaan.');
}

$ext = $toegestaan[$mime];
$bestandsnaam = 'product_' . $productId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$doelMap = __DIR__ . '/../uploads/product-photos/';

if (!is_dir($doelMap) && !mkdir($doelMap, 0755, true) && !is_dir($doelMap)) {
    respond_error(500, 'Kon uploadmap niet aanmaken.');
}

if (!move_uploaded_file($file['tmp_name'], $doelMap . $bestandsnaam)) {
    respond_error(500, 'Opslaan van de foto is mislukt.');
}

$url = rtrim(APP_URL, '/') . '/api/uploads/product-photos/' . $bestandsnaam;

$volgordeStmt = $pdo->prepare('SELECT COUNT(*) AS `aantal` FROM `product_images` WHERE `product_id` = ?');
$volgordeStmt->execute([$productId]);
$volgorde = (int) $volgordeStmt->fetch()['aantal'];

$insert = $pdo->prepare(
    'INSERT INTO `product_images` (`product_id`, `image_url`, `sort_order`) VALUES (?, ?, ?)'
);
$insert->execute([$productId, $url, $volgorde]);

echo json_encode(['id' => (int) $pdo->lastInsertId(), 'url' => $url]);
