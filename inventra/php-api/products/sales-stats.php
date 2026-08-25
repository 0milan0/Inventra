<?php
// Weekverkoop van één product op het eigen filiaal: huidige week (tot en met
// vandaag), vorige (volledige) week, en een prognose als gemiddelde van de
// laatste 4 volledige weken vóór deze week. Weken lopen maandag t/m zondag.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$productId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($productId <= 0) {
    respond_error(400, 'Ongeldig product.');
}

$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();
if (!$account || $account['branch_id'] === null) {
    respond_error(404, 'Geen filiaal ingesteld op dit account.');
}
$branchId = (int) $account['branch_id'];

function periodeVerkoop(PDO $pdo, int $productId, int $branchId, DateTime $van, DateTime $totExclusief): array
{
    $stmt = $pdo->prepare(
        'SELECT COALESCE(SUM(`si`.`quantity`), 0) AS `aantal`, COALESCE(SUM(`si`.`subtotal`), 0) AS `omzet` ' .
        'FROM `sale_items` `si` JOIN `sales` `s` ON `s`.`id` = `si`.`sale_id` ' .
        'WHERE `si`.`product_id` = ? AND `s`.`branch_id` = ? AND `s`.`status` = \'voltooid\' ' .
        'AND `s`.`created_at` >= ? AND `s`.`created_at` < ?'
    );
    $stmt->execute([$productId, $branchId, $van->format('Y-m-d H:i:s'), $totExclusief->format('Y-m-d H:i:s')]);
    $row = $stmt->fetch();
    return ['aantal' => (int) $row['aantal'], 'omzet' => round((float) $row['omzet'], 2)];
}

$vandaag = new DateTime('today');
$morgen = (clone $vandaag)->modify('+1 day');
$dow = (int) $vandaag->format('N'); // 1 = maandag ... 7 = zondag
$huidigeWeekMaandag = (clone $vandaag)->modify('-' . ($dow - 1) . ' days');
$vorigeWeekMaandag = (clone $huidigeWeekMaandag)->modify('-7 days');
$vierWekenTerug = (clone $huidigeWeekMaandag)->modify('-28 days');

$huidigeWeek = periodeVerkoop($pdo, $productId, $branchId, $huidigeWeekMaandag, $morgen);
$vorigeWeek = periodeVerkoop($pdo, $productId, $branchId, $vorigeWeekMaandag, $huidigeWeekMaandag);
$laatste4Weken = periodeVerkoop($pdo, $productId, $branchId, $vierWekenTerug, $huidigeWeekMaandag);

echo json_encode([
    'huidigeWeek' => $huidigeWeek,
    'vorigeWeek' => $vorigeWeek,
    'prognose' => [
        'aantal' => round($laatste4Weken['aantal'] / 4, 1),
        'omzet' => round($laatste4Weken['omzet'] / 4, 2),
    ],
]);
