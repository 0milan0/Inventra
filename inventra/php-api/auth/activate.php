<?php
// Activeert een uitgenodigd account (status 'invited') met de 6-cijferige
// code die de beheerder handmatig in Accounts.invitation_token heeft gezet.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../jwt.php';
require_once __DIR__ . '/../user_response.php';

$body = read_json_body();
$email = $body['email'] ?? null;
$code = $body['code'] ?? null;
$password = $body['password'] ?? null;

if (!is_string($email) || !is_string($code) || !is_string($password) || $email === '' || $code === '' || $password === '') {
    respond_error(400, 'E-mail, code en wachtwoord zijn verplicht.');
}

if (strlen($password) < 8) {
    respond_error(400, 'Wachtwoord moet minstens 8 tekens zijn.');
}

$pdo = get_db();

$stmt = $pdo->prepare(
    'SELECT `id`, `firstname`, `middlename`, `lastname`, `dateofbirth`, `email`, `phonenumber`, ' .
    '`profile_picture`, `rank`, `department`, `status`, `badges`, `company`, `branch_id`, ' .
    '`invitation_token`, `invitation_token_expired_at` ' .
    'FROM `Accounts` WHERE LOWER(`email`) = LOWER(?) LIMIT 1'
);
$stmt->execute([$email]);
$account = $stmt->fetch();

if (!$account || $account['status'] !== 'invited') {
    respond_error(401, 'Ongeldige code of dit account is al actief.');
}

if (!hash_equals((string) $account['invitation_token'], $code)) {
    respond_error(401, 'Ongeldige code of dit account is al actief.');
}

if (!$account['invitation_token_expired_at'] || strtotime($account['invitation_token_expired_at']) < time()) {
    respond_error(401, 'Deze code is verlopen, vraag een nieuwe aan.');
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$update = $pdo->prepare(
    'UPDATE `Accounts` SET `password` = ?, `status` = \'actief\', `verified_at` = NOW(), ' .
    '`invitation_token` = NULL, `invitation_token_expired_at` = NULL WHERE `id` = ?'
);
$update->execute([$passwordHash, $account['id']]);

$token = jwt_encode(['sub' => (int) $account['id']], JWT_SECRET, 60 * 60 * 24 * 30);

echo json_encode([
    'token' => $token,
    'user' => account_to_user_response($account),
]);
