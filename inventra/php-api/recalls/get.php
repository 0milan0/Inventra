<?php
// Eén recall in detail: de recall-gegevens plus de status per doelfiliaal
// (aangemaakt met bijbehorende taakstatus, of overgeslagen omdat dat
// filiaal het product niet voert).
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';
require_once __DIR__ . '/../permissions_helper.php';

$userId = require_auth();
$recallId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($recallId <= 0) {
    respond_error(400, 'Ongeldige recall.');
}

$pdo = get_db();

$meStmt = $pdo->prepare('SELECT `id`, `rank`, `department`, `company` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$meStmt->execute([$userId]);
$me = $meStmt->fetch();

if (!$me) {
    respond_error(401, 'Sessie is verlopen, log opnieuw in.');
}
if (!heeft_permissie($pdo, $me, 'recalls_aanmaken')) {
    respond_error(403, 'Je hebt geen rechten om recalls te bekijken.');
}

$recallStmt = $pdo->prepare(
    'SELECT `r`.`id`, `r`.`title`, `r`.`criteria_note`, `r`.`tht_from`, `r`.`tht_to`, `r`.`all_branches`, ' .
    '`r`.`created_at`, `r`.`company_id`, ' .
    '`p`.`id` AS `product_id`, `p`.`name` AS `product_naam`, `p`.`barcode` AS `product_barcode`, ' .
    'CONCAT(`a`.`firstname`, \' \', `a`.`lastname`) AS `aangemaakt_door` ' .
    'FROM `recalls` `r` ' .
    'JOIN `products` `p` ON `p`.`id` = `r`.`product_id` ' .
    'JOIN `Accounts` `a` ON `a`.`id` = `r`.`created_by_id` ' .
    'WHERE `r`.`id` = ? LIMIT 1'
);
$recallStmt->execute([$recallId]);
$recall = $recallStmt->fetch();

if (!$recall || (int) $recall['company_id'] !== (int) $me['company']) {
    respond_error(404, 'Recall niet gevonden.');
}

$filialenStmt = $pdo->prepare(
    'SELECT `rb`.`branch_id`, `br`.`name` AS `branch_naam`, `br`.`city` AS `branch_stad`, ' .
    '`rb`.`department`, `rb`.`status`, `rb`.`task_id`, `t`.`status` AS `taak_status` ' .
    'FROM `recall_branches` `rb` ' .
    'JOIN `Branches` `br` ON `br`.`id` = `rb`.`branch_id` ' .
    'LEFT JOIN `tasks` `t` ON `t`.`id` = `rb`.`task_id` ' .
    'WHERE `rb`.`recall_id` = ? ' .
    'ORDER BY `br`.`name`'
);
$filialenStmt->execute([$recallId]);
$filialenRows = $filialenStmt->fetchAll();

echo json_encode([
    'id' => (int) $recall['id'],
    'titel' => $recall['title'],
    'criteriaNotitie' => $recall['criteria_note'],
    'thtVan' => $recall['tht_from'],
    'thtTot' => $recall['tht_to'],
    'alleFilialen' => (bool) $recall['all_branches'],
    'productId' => (int) $recall['product_id'],
    'productNaam' => $recall['product_naam'],
    'productBarcode' => $recall['product_barcode'],
    'aangemaaktDoor' => $recall['aangemaakt_door'],
    'aangemaaktOp' => $recall['created_at'],
    'filialen' => array_map(function ($row) {
        return [
            'branchId' => (int) $row['branch_id'],
            'naam' => $row['branch_naam'],
            'stad' => $row['branch_stad'],
            'afdeling' => $row['department'],
            'status' => $row['status'],
            'taakId' => $row['task_id'] !== null ? (int) $row['task_id'] : null,
            'taakStatus' => $row['taak_status'],
        ];
    }, $filialenRows),
]);
