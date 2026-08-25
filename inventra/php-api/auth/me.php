<?php
// Ververst de profielgegevens van de al ingelogde gebruiker (bestaand token),
// zonder opnieuw in te hoeven loggen — voor als er bv. rank/department/
// branch_id server-side is aangepast terwijl de app open staat.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../user_response.php';

$userId = require_auth();

$stmt = get_db()->prepare(
    'SELECT `id`, `firstname`, `middlename`, `lastname`, `dateofbirth`, `email`, `phonenumber`, ' .
    '`profile_picture`, `rank`, `department`, `status`, `badges`, `company`, `branch_id` ' .
    'FROM `Accounts` WHERE `id` = ? LIMIT 1'
);
$stmt->execute([$userId]);
$account = $stmt->fetch();

if (!$account || $account['status'] !== 'actief') {
    respond_error(401, 'Sessie is niet meer geldig, log opnieuw in.');
}

echo json_encode(['user' => account_to_user_response($account)]);
