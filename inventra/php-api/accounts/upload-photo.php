<?php
// Ontvangt een profielfoto (multipart/form-data, veld "photo"), slaat 'm op
// in php-api/uploads/profile-photos/ en zet de publieke URL in Accounts.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();

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
$bestandsnaam = 'profiel_' . $userId . '_' . time() . '.' . $ext;
$doelMap = __DIR__ . '/../uploads/profile-photos/';

if (!is_dir($doelMap) && !mkdir($doelMap, 0755, true) && !is_dir($doelMap)) {
    respond_error(500, 'Kon uploadmap niet aanmaken.');
}

if (!move_uploaded_file($file['tmp_name'], $doelMap . $bestandsnaam)) {
    respond_error(500, 'Opslaan van de foto is mislukt.');
}

$url = rtrim(APP_URL, '/') . '/api/uploads/profile-photos/' . $bestandsnaam;

$pdo = get_db();
$stmt = $pdo->prepare('UPDATE `Accounts` SET `profile_picture` = ? WHERE `id` = ?');
$stmt->execute([$url, $userId]);

echo json_encode(['profielfoto' => $url]);
