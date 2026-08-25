<?php
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../jwt.php';
require_once __DIR__ . '/../user_response.php';

const STATUS_MESSAGES = [
    'invited' => 'Dit account is nog niet geactiveerd.',
    'inactief' => 'Dit account is gedeactiveerd.',
    'geblokkeerd' => 'Dit account is geblokkeerd.',
];

$body = read_json_body();
$email = $body['email'] ?? null;
$password = $body['password'] ?? null;

if (!is_string($email) || !is_string($password) || $email === '' || $password === '') {
    respond_error(400, 'E-mail en wachtwoord zijn verplicht.');
}

$stmt = get_db()->prepare(
    'SELECT `id`, `firstname`, `middlename`, `lastname`, `dateofbirth`, `email`, `phonenumber`, `password`, ' .
    '`profile_picture`, `rank`, `department`, `status`, `badges`, `company`, `branch_id` ' .
    'FROM `Accounts` WHERE `email` = ? LIMIT 1'
);
$stmt->execute([$email]);
$account = $stmt->fetch();

if (!$account || !$account['password']) {
    respond_error(401, 'Onbekend e-mailadres of wachtwoord.');
}

if ($account['status'] !== 'actief') {
    respond_error(401, STATUS_MESSAGES[$account['status']] ?? 'Dit account kan niet inloggen.');
}

if (!password_verify($password, $account['password'])) {
    respond_error(401, 'Onbekend e-mailadres of wachtwoord.');
}

$token = jwt_encode(['sub' => (int) $account['id']], JWT_SECRET, 60 * 60 * 24 * 30);

echo json_encode([
    'token' => $token,
    'user' => account_to_user_response($account),
]);
