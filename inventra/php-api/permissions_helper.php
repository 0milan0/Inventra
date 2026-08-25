<?php
// Effectieve permissies van één account: rang- en afdelingsdefaults, met
// eventuele account-specifieke override (grant/revoke) — zelfde drieslag als
// accounts/permissions.php, maar hier plat naar een lijst van permissie-
// namen voor het account zelf (i.p.v. per-permissie met bron, voor
// personeelsbeheer op een ander account). Bewust niet via de
// `account_effective_permissions`-view (die houdt geen rekening met
// `type = 'revoke'`, zie accounts/permissions.php).

function effectieve_permissienamen(PDO $pdo, array $account): array
{
    $permissies = $pdo->query('SELECT `id`, `name` FROM `permissions`')->fetchAll();

    $rankIds = [];
    if (!empty($account['rank'])) {
        $stmt = $pdo->prepare('SELECT `permission_id` FROM `rank_permissions` WHERE `rank` = ?');
        $stmt->execute([$account['rank']]);
        foreach ($stmt->fetchAll() as $row) {
            $rankIds[(int) $row['permission_id']] = true;
        }
    }

    $deptIds = [];
    if (!empty($account['department'])) {
        $stmt = $pdo->prepare('SELECT `permission_id` FROM `department_permissions` WHERE `department` = ?');
        $stmt->execute([$account['department']]);
        foreach ($stmt->fetchAll() as $row) {
            $deptIds[(int) $row['permission_id']] = true;
        }
    }

    $overrides = [];
    $stmt = $pdo->prepare('SELECT `permission_id`, `type` FROM `account_permissions` WHERE `account_id` = ?');
    $stmt->execute([(int) $account['id']]);
    foreach ($stmt->fetchAll() as $row) {
        $overrides[(int) $row['permission_id']] = $row['type'];
    }

    $namen = [];
    foreach ($permissies as $row) {
        $id = (int) $row['id'];
        $override = $overrides[$id] ?? null;
        $basisAan = isset($rankIds[$id]) || isset($deptIds[$id]);
        $effectief = $override === 'revoke' ? false : ($override === 'grant' ? true : $basisAan);
        if ($effectief) {
            $namen[] = $row['name'];
        }
    }

    return $namen;
}

/** Heeft dit account (via rang, afdeling, of losse override) een specifieke permissie? */
function heeft_permissie(PDO $pdo, array $account, string $permissieNaam): bool
{
    return in_array($permissieNaam, effectieve_permissienamen($pdo, $account), true);
}
