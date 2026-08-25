<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

// Zonder dit wordt een onverwachte fout (bv. een SQL-fout) door PHP als kale
// HTML/lege 500-pagina uitgestuurd — de app kan dat niet als JSON parsen en
// valt dan altijd terug op de generieke "Er ging iets mis". Met deze handler
// komt de échte foutmelding netjes als JSON terug, en staat 'ie ook in de
// server-error-log voor later opzoeken.
set_exception_handler(function (Throwable $e): void {
    error_log('Onafgevangen fout: ' . $e->getMessage());
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

function read_json_body(): array
{
    $body = json_decode((string) file_get_contents('php://input'), true);
    return is_array($body) ? $body : [];
}
