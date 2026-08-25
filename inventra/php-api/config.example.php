<?php
// Kopieer dit bestand naar config.php en vul de echte waarden in.
// config.php wordt nooit gecommit (zie .gitignore) en is via .htaccess
// geblokkeerd voor directe HTTP-toegang.

define('DB_HOST', '');
define('DB_PORT', '3306');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_NAME', '');

// Willekeurige lange random string, zelf te verzinnen
define('JWT_SECRET', '');

// Domein waarop php-api/ als /api-map draait, zonder trailing slash
// (zelfde waarde als EXPO_PUBLIC_API_URL in .env). Nodig om een publieke
// URL terug te geven na een profielfoto-upload.
define('APP_URL', '');
