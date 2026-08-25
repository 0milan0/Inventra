<?php
// Rolniveau op basis van Accounts.rank — zelfde matchlogica als
// data/session.ts (getRolNiveau) aan de app-kant. Pas de matchwoorden op
// beide plekken tegelijk aan zodra de echte rank-waarden afwijken.

function rank_niveau(string $rank): string
{
    $r = strtolower($rank);
    if (strpos($r, 'filiaalmanager') !== false) {
        return 'filiaalmanager';
    }
    if (strpos($r, 'teamleider') !== false) {
        return 'teamleider';
    }
    return 'medewerker';
}

/**
 * Mag $me (met rank/department/branch_id) personeelsbeheer-acties uitvoeren
 * op $target (met department/branch_id)? Zelfde tweedeling overal in de
 * personeelsbeheer-endpoints: teamleider = alleen eigen afdeling binnen eigen
 * filiaal, (assistent-)filiaalmanager = heel het eigen filiaal.
 *
 * @param array{rank: string, department: ?string, branch_id: ?int} $me
 * @param array{department: ?string, branch_id: ?int} $target
 */
function mag_beheren(array $me, array $target): bool
{
    if ($me['branch_id'] === null || $target['branch_id'] === null) {
        return false;
    }
    if ((int) $me['branch_id'] !== (int) $target['branch_id']) {
        return false;
    }

    $niveau = rank_niveau($me['rank']);
    if ($niveau === 'filiaalmanager') {
        return true;
    }
    if ($niveau === 'teamleider') {
        return $me['department'] !== null && $me['department'] === $target['department'];
    }
    return false;
}
