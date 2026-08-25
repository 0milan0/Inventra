<?php
// Statistieken-overzicht: verkoop óf derving, over een periode, met filters
// op afdeling/categorie en een groepering (afdeling/categorie/product/reden)
// voor de uitsplitsing. Alles gescoped op het eigen filiaal, net als
// sales/*.php en waste_logs hieronder.
//
// "Afdeling" van een product komt via product_branch -> shelves.department
// (een product zonder toegewezen schap heeft dus geen afdeling — telt mee
// onder "Niet ingedeeld").
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

$userId = require_auth();
$pdo = get_db();

$accountStmt = $pdo->prepare('SELECT `branch_id` FROM `Accounts` WHERE `id` = ? LIMIT 1');
$accountStmt->execute([$userId]);
$account = $accountStmt->fetch();
if (!$account || $account['branch_id'] === null) {
    respond_error(404, 'Geen filiaal ingesteld op dit account.');
}
$branchId = (int) $account['branch_id'];

$metric = isset($_GET['metric']) && $_GET['metric'] === 'derving' ? 'derving' : 'verkoop';
$groepering = in_array($_GET['groepering'] ?? '', ['afdeling', 'categorie', 'product', 'reden'], true) ? $_GET['groepering'] : 'afdeling';
if ($groepering === 'reden' && $metric !== 'derving') {
    $groepering = 'afdeling';
}
$afdelingFilter = isset($_GET['afdeling']) && trim((string) $_GET['afdeling']) !== '' ? trim((string) $_GET['afdeling']) : null;
$categorieFilter = isset($_GET['categorieId']) && (int) $_GET['categorieId'] > 0 ? (int) $_GET['categorieId'] : null;

$vanStr = isset($_GET['van']) ? trim((string) $_GET['van']) : '';
$totStr = isset($_GET['tot']) ? trim((string) $_GET['tot']) : '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $vanStr) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $totStr) || $totStr < $vanStr) {
    respond_error(400, 'Ongeldige periode, gebruik van/tot als JJJJ-MM-DD (van <= tot).');
}

$van = new DateTime($vanStr);
$tot = new DateTime($totStr);
$spanDagen = (int) $van->diff($tot)->days + 1;

$vorigeTot = (clone $van)->modify('-1 day');
$vorigeVan = (clone $vorigeTot)->modify('-' . ($spanDagen - 1) . ' days');

$rangeStart = $vorigeVan->format('Y-m-d') . ' 00:00:00';
$rangeEindExclusief = (clone $tot)->modify('+1 day')->format('Y-m-d') . ' 00:00:00';

// ── Ruwe regels ophalen (huidige + vorige periode ineens) ──────────────────

if ($metric === 'verkoop') {
    $sql =
        'SELECT `si`.`product_id`, `p`.`name` AS `product_naam`, `p`.`barcode`, ' .
        '`c`.`id` AS `categorie_id`, `c`.`name` AS `categorie_naam`, `sh`.`department` AS `afdeling`, ' .
        'DATE(`s`.`created_at`) AS `dag`, `si`.`quantity` AS `aantal`, `si`.`subtotal` AS `bedrag`, NULL AS `reden` ' .
        'FROM `sale_items` `si` ' .
        'JOIN `sales` `s` ON `s`.`id` = `si`.`sale_id` ' .
        'JOIN `products` `p` ON `p`.`id` = `si`.`product_id` ' .
        'LEFT JOIN `subcategories` `sc` ON `sc`.`id` = `p`.`subcategorie_id` ' .
        'LEFT JOIN `categories` `c` ON `c`.`id` = `sc`.`category_id` ' .
        'LEFT JOIN `product_branch` `pb` ON `pb`.`product_id` = `p`.`id` AND `pb`.`branch_id` = `s`.`branch_id` ' .
        'LEFT JOIN `shelves` `sh` ON `sh`.`id` = `pb`.`shelf_id` ' .
        'WHERE `s`.`branch_id` = ? AND `s`.`status` = \'voltooid\' AND `s`.`created_at` >= ? AND `s`.`created_at` < ?';
} else {
    $sql =
        'SELECT `wl`.`product_id`, `p`.`name` AS `product_naam`, `p`.`barcode`, ' .
        '`c`.`id` AS `categorie_id`, `c`.`name` AS `categorie_naam`, `sh`.`department` AS `afdeling`, ' .
        'DATE(`wl`.`created_at`) AS `dag`, `wl`.`quantity` AS `aantal`, COALESCE(`wl`.`estimated_cost`, 0) AS `bedrag`, `wl`.`reason` AS `reden` ' .
        'FROM `waste_logs` `wl` ' .
        'JOIN `products` `p` ON `p`.`id` = `wl`.`product_id` ' .
        'LEFT JOIN `subcategories` `sc` ON `sc`.`id` = `p`.`subcategorie_id` ' .
        'LEFT JOIN `categories` `c` ON `c`.`id` = `sc`.`category_id` ' .
        'LEFT JOIN `product_branch` `pb` ON `pb`.`product_id` = `p`.`id` AND `pb`.`branch_id` = `wl`.`branch_id` ' .
        'LEFT JOIN `shelves` `sh` ON `sh`.`id` = `pb`.`shelf_id` ' .
        'WHERE `wl`.`branch_id` = ? AND `wl`.`created_at` >= ? AND `wl`.`created_at` < ?';
}

$params = [$branchId, $rangeStart, $rangeEindExclusief];
if ($afdelingFilter !== null) {
    $sql .= ' AND `sh`.`department` = ?';
    $params[] = $afdelingFilter;
}
if ($categorieFilter !== null) {
    $sql .= ' AND `c`.`id` = ?';
    $params[] = $categorieFilter;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$alleRegels = $stmt->fetchAll();

$vanStr2 = $van->format('Y-m-d');
$totStr2 = $tot->format('Y-m-d');
$vorigeVanStr = $vorigeVan->format('Y-m-d');
$vorigeTotStr = $vorigeTot->format('Y-m-d');

$huidigeRegels = [];
$vorigeRegels = [];
foreach ($alleRegels as $r) {
    if ($r['dag'] >= $vanStr2 && $r['dag'] <= $totStr2) {
        $huidigeRegels[] = $r;
    } elseif ($r['dag'] >= $vorigeVanStr && $r['dag'] <= $vorigeTotStr) {
        $vorigeRegels[] = $r;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function statTotaal(array $regels): array
{
    $aantal = 0;
    $bedrag = 0.0;
    foreach ($regels as $r) {
        $aantal += (int) $r['aantal'];
        $bedrag += (float) $r['bedrag'];
    }
    return ['aantal' => $aantal, 'bedrag' => round($bedrag, 2)];
}

function statTrend(array $regels, DateTime $van, DateTime $tot, int $spanDagen): array
{
    $buckets = [];
    if ($spanDagen <= 14) {
        $granulariteit = 'dag';
        $cursor = clone $van;
        while ($cursor <= $tot) {
            $key = $cursor->format('Y-m-d');
            $buckets[$key] = ['key' => $key, 'label' => $cursor->format('D j') , 'aantal' => 0, 'bedrag' => 0.0];
            $cursor->modify('+1 day');
        }
    } elseif ($spanDagen <= 70) {
        $granulariteit = 'week';
        $cursor = clone $van;
        while ($cursor <= $tot) {
            $weekEind = min((clone $cursor)->modify('+6 days'), $tot);
            // Sleutel = startdatum van het weekblok (niet het ISO-weeknummer —
            // dat botst rond jaarwisselingen omdat weeknummer 1 in twee
            // verschillende kalenderjaren kan vallen).
            $key = $cursor->format('Y-m-d');
            $buckets[$key] = [
                'key' => $key,
                'label' => $cursor->format('j M') . '–' . $weekEind->format('j M'),
                'aantal' => 0, 'bedrag' => 0.0,
            ];
            $cursor->modify('+7 days');
        }
    } else {
        $granulariteit = 'maand';
        $cursor = (new DateTime($van->format('Y-m-01')));
        while ($cursor <= $tot) {
            $key = $cursor->format('Y-m');
            $buckets[$key] = ['key' => $key, 'label' => $cursor->format('M \'y'), 'aantal' => 0, 'bedrag' => 0.0];
            $cursor->modify('+1 month');
        }
    }

    foreach ($regels as $r) {
        $dagDt = new DateTime($r['dag']);
        if ($granulariteit === 'dag') {
            $key = $dagDt->format('Y-m-d');
        } elseif ($granulariteit === 'week') {
            $verschilDagen = (int) $van->diff($dagDt)->days;
            $weekIndex = intdiv($verschilDagen, 7);
            $weekStart = (clone $van)->modify("+{$weekIndex} weeks");
            $key = $weekStart->format('Y-m-d');
        } else {
            $key = $dagDt->format('Y-m');
        }
        if (!isset($buckets[$key])) {
            continue;
        }
        $buckets[$key]['aantal'] += (int) $r['aantal'];
        $buckets[$key]['bedrag'] += (float) $r['bedrag'];
    }

    return array_values(array_map(function ($b) {
        $b['bedrag'] = round($b['bedrag'], 2);
        unset($b['key']);
        return $b;
    }, $buckets));
}

const AFDELING_LABELS = ['AGF' => 'AGF', 'Kassa & Boetiek' => 'Kassa & Boetiek', 'KW' => 'KW', 'Vers' => 'Vers', 'Brood' => 'Brood'];
const REDEN_LABELS = [
    'tht_verlopen' => 'THT verlopen', 'beschadigd' => 'Beschadigd', 'te_veel_besteld' => 'Te veel besteld',
    'kwaliteit' => 'Kwaliteit', 'overig' => 'Overig',
];

function statBreakdown(array $regels, string $groepering, int $limiet = 50): array
{
    $groepen = [];
    foreach ($regels as $r) {
        if ($groepering === 'afdeling') {
            $id = $r['afdeling'] ?? '_geen';
            $naam = $r['afdeling'] !== null ? (AFDELING_LABELS[$r['afdeling']] ?? $r['afdeling']) : 'Niet ingedeeld';
        } elseif ($groepering === 'categorie') {
            $id = $r['categorie_id'] !== null ? (string) $r['categorie_id'] : '_geen';
            $naam = $r['categorie_naam'] ?? 'Niet ingedeeld';
        } elseif ($groepering === 'reden') {
            $id = $r['reden'] ?? '_geen';
            $naam = $r['reden'] !== null ? (REDEN_LABELS[$r['reden']] ?? $r['reden']) : 'Onbekend';
        } else { // product
            $id = (string) $r['product_id'];
            $naam = $r['product_naam'];
        }
        if (!isset($groepen[$id])) {
            $groepen[$id] = ['id' => (string) $id, 'naam' => $naam, 'aantal' => 0, 'bedrag' => 0.0, 'barcode' => $r['barcode'] ?? null];
        }
        $groepen[$id]['aantal'] += (int) $r['aantal'];
        $groepen[$id]['bedrag'] += (float) $r['bedrag'];
    }

    $totaalBedrag = array_sum(array_map(fn ($g) => $g['bedrag'], $groepen));

    $lijst = array_values(array_map(function ($g) use ($totaalBedrag) {
        $g['bedrag'] = round($g['bedrag'], 2);
        $g['percentage'] = $totaalBedrag > 0 ? round(($g['bedrag'] / $totaalBedrag) * 100) : 0;
        if ($g['barcode'] === null) {
            unset($g['barcode']);
        }
        return $g;
    }, $groepen));

    usort($lijst, fn ($a, $b) => $b['bedrag'] <=> $a['bedrag']);

    return array_slice($lijst, 0, $limiet);
}

// ── Response opbouwen ────────────────────────────────────────────────────

$totaal = statTotaal($huidigeRegels);
$vorige = statTotaal($vorigeRegels);
$trend = statTrend($huidigeRegels, $van, $tot, $spanDagen);
$breakdown = statBreakdown($huidigeRegels, $groepering, $groepering === 'product' ? 30 : 50);
$topProducten = $groepering === 'product' ? [] : statBreakdown($huidigeRegels, 'product', 8);

$response = [
    'metric' => $metric,
    'groepering' => $groepering,
    'periode' => ['van' => $vanStr2, 'tot' => $totStr2],
    'totaal' => $totaal,
    'vorige' => $vorige,
    'trend' => $trend,
    'breakdown' => $breakdown,
    'topProducten' => $topProducten,
];

if ($metric === 'derving') {
    $omzetStmt = $pdo->prepare(
        'SELECT COALESCE(SUM(`total_amount`), 0) FROM `sales` ' .
        'WHERE `branch_id` = ? AND `status` = \'voltooid\' AND `created_at` >= ? AND `created_at` < ?'
    );
    $omzetStmt->execute([$branchId, $vanStr2 . ' 00:00:00', (clone $tot)->modify('+1 day')->format('Y-m-d') . ' 00:00:00']);
    $omzetPeriode = (float) $omzetStmt->fetchColumn();
    $response['dervingPercentageVanOmzet'] = $omzetPeriode > 0 ? round(($totaal['bedrag'] / $omzetPeriode) * 100, 1) : null;
}

echo json_encode($response);
