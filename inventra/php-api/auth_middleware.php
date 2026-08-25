<?php
require_once __DIR__ . '/jwt.php';

function get_authorization_header(): ?string
{
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        // Sommige (gedeelde) hosting-configuraties laten de Authorization-header
        // alleen via deze REDIRECT_-variant door.
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                return $value;
            }
        }
    }
    return null;
}

/** Geeft de ingelogde user_id terug, of stuurt een 401 en stopt het script. */
function require_auth(): int
{
    $header = get_authorization_header() ?? '';

    if (!preg_match('/^Bearer\s+(.+)$/', $header, $matches)) {
        respond_error(401, 'Niet ingelogd.');
    }

    $payload = jwt_decode($matches[1], JWT_SECRET);
    if (!$payload || !isset($payload['sub'])) {
        respond_error(401, 'Sessie is verlopen, log opnieuw in.');
    }

    return (int) $payload['sub'];
}
