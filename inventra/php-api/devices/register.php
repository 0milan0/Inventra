<?php
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();

$body = read_json_body();
$deviceName = $body['deviceName'] ?? null;
$pushToken = $body['pushToken'] ?? null;

if (!is_string($deviceName) || !is_string($pushToken) || $deviceName === '' || $pushToken === '') {
    respond_error(400, 'deviceName en pushToken zijn verplicht.');
}

$pdo = get_db();

$stmt = $pdo->prepare(
    'SELECT `id` FROM `Accounts_devices` WHERE `user_id` = ? AND `device_token` = ? LIMIT 1'
);
$stmt->execute([$userId, $pushToken]);
$existing = $stmt->fetch();

if ($existing) {
    $update = $pdo->prepare(
        'UPDATE `Accounts_devices` SET `device_name` = ?, `last_used_at` = NOW() WHERE `id` = ?'
    );
    $update->execute([$deviceName, $existing['id']]);
    echo json_encode(['isNewDevice' => false]);
    exit;
}

$insert = $pdo->prepare(
    'INSERT INTO `Accounts_devices` (`user_id`, `device_name`, `device_token`, `last_used_at`) VALUES (?, ?, ?, NOW())'
);
$insert->execute([$userId, $deviceName, $pushToken]);
echo json_encode(['isNewDevice' => true]);
