<?php
// Gedeelde autorisatielogica voor taken — hergebruikt door list/get/update/
// delete/checklist-item/comment.php. Spiegelt de permissieregels die eerder
// in de mock zaten (data/tasks.ts: kanTaakBewerken/kanTaakVerwijderen):
// toegewezen persoon, de afdeling van de taak, of een hoge rang mogen
// bewerken; verwijderen mag alleen teamleider en hoger.
require_once __DIR__ . '/../rank_helper.php';

/**
 * @param array{id: int, rank: string, department: ?string, branch_id: ?int} $me
 * @param array{department: string, assigned_to_id: ?int} $taak
 * @param int[] $toegewezenIds Extra toegewezenen uit task_assignees.
 */
function mag_taak_bewerken(array $me, array $taak, array $toegewezenIds): bool
{
    if (rank_niveau($me['rank']) === 'filiaalmanager') {
        return true;
    }
    if ($me['department'] !== null && $me['department'] === $taak['department']) {
        return true;
    }
    if ((int) ($taak['assigned_to_id'] ?? 0) === (int) $me['id']) {
        return true;
    }
    return in_array((int) $me['id'], $toegewezenIds, true);
}

/** Verwijderen mag alleen teamleider en hoger. */
function mag_taak_verwijderen(array $me): bool
{
    return rank_niveau($me['rank']) !== 'medewerker';
}
