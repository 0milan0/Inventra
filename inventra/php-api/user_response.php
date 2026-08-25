<?php
// Zet een rij uit `Accounts` om naar de user-vorm die de app krijgt na
// login/activatie. Op één plek gedeeld zodat login.php en activate.php niet
// los van elkaar bijgehouden hoeven te worden.
//
// Wachtwoord, invitation_token(_expired_at) en verified_at gaan hier bewust
// nooit in mee — dat zijn interne/beveiligingsvelden, geen profieldata.

require_once __DIR__ . '/permissions_helper.php';

const STATUS_VERTALING = [
    'invited' => 'uitgenodigd',
    'actief' => 'actief',
    'inactief' => 'inactief',
    'geblokkeerd' => 'geblokkeerd',
];

function account_to_user_response(array $account): array
{
    $naam = trim(($account['firstname'] ?? '') . ' ' . ($account['lastname'] ?? ''));
    $initialen = strtoupper(substr($account['firstname'] ?? '', 0, 1) . substr($account['lastname'] ?? '', 0, 1));

    return [
        'id' => (int) $account['id'],
        'naam' => $naam,
        'initialen' => $initialen,
        'voornaam' => $account['firstname'],
        'tussenvoegsel' => $account['middlename'],
        'achternaam' => $account['lastname'],
        'email' => $account['email'],
        'telefoonnummer' => $account['phonenumber'],
        'geboortedatum' => $account['dateofbirth'],
        'profielfoto' => $account['profile_picture'],
        'rol' => $account['rank'],
        'afdeling' => $account['department'],
        'status' => isset($account['status']) ? (STATUS_VERTALING[$account['status']] ?? $account['status']) : null,
        'badges' => $account['badges'],
        'company' => $account['company'] !== null ? (int) $account['company'] : null,
        'branchId' => isset($account['branch_id']) && $account['branch_id'] !== null ? (int) $account['branch_id'] : null,
        'permissies' => effectieve_permissienamen(get_db(), $account),
    ];
}
