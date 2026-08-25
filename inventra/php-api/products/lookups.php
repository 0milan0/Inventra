<?php
// Referentielijsten (categorie/subcategorie, merk, leverancier, schap) voor
// het "Product toevoegen"-formulier. Puur leesbaar, geen rangcontrole nodig
// — het aanmaak-endpoint (create.php) bewaakt zelf wie mag toevoegen.
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth_middleware.php';

require_auth();
$pdo = get_db();

$categorieRows = $pdo->query('SELECT `id`, `name` FROM `categories` ORDER BY `name`')->fetchAll();
$subcategorieRows = $pdo->query('SELECT `id`, `name`, `category_id` FROM `subcategories` ORDER BY `name`')->fetchAll();
$merkRows = $pdo->query('SELECT `id`, `name` FROM `brands` ORDER BY `name`')->fetchAll();
$leverancierRows = $pdo->query('SELECT `id`, `name` FROM `suppliers` ORDER BY `name`')->fetchAll();
$schapRows = $pdo->query('SELECT `id`, `name`, `department` FROM `shelves` ORDER BY `name`')->fetchAll();

$categorieen = array_map(function ($c) use ($subcategorieRows) {
    $subs = array_values(array_filter($subcategorieRows, function ($sc) use ($c) {
        return (int) $sc['category_id'] === (int) $c['id'];
    }));
    return [
        'id' => (int) $c['id'],
        'naam' => $c['name'],
        'subcategorieen' => array_map(function ($sc) {
            return ['id' => (int) $sc['id'], 'naam' => $sc['name']];
        }, $subs),
    ];
}, $categorieRows);

echo json_encode([
    'categorieen' => $categorieen,
    'merken' => array_map(function ($m) {
        return ['id' => (int) $m['id'], 'naam' => $m['name']];
    }, $merkRows),
    'leveranciers' => array_map(function ($s) {
        return ['id' => (int) $s['id'], 'naam' => $s['name']];
    }, $leverancierRows),
    'schappen' => array_map(function ($sh) {
        return ['id' => (int) $sh['id'], 'naam' => $sh['name'], 'afdeling' => $sh['department']];
    }, $schapRows),
]);
