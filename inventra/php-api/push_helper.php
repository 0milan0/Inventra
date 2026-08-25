<?php
// Server-side Expo-pushmeldingen versturen (bv. na het aanmaken van een
// recall — de ontvangers zijn dan andermans devices, dus dit moet vanaf de
// server gebeuren, niet vanaf het device van de aanmaker zoals
// lib/push-notifications.ts's sendExpoPushNotification doet voor de
// handmatige testknop).
//
// Best-effort: een falende push mag de rest van de aanroep (bv. het
// aanmaken van de recall/taken) nooit laten mislukken — fouten gaan alleen
// naar de error-log.

/**
 * @param string[] $tokens Expo push-tokens (duplicaten/lege waarden worden genegeerd).
 */
function stuur_pushmeldingen(array $tokens, string $titel, string $body): void
{
    $tokens = array_values(array_unique(array_filter($tokens, fn ($t) => is_string($t) && $t !== '')));
    if (count($tokens) === 0) {
        return;
    }

    // Expo accepteert maximaal 100 berichten per verzoek.
    foreach (array_chunk($tokens, 100) as $batch) {
        $berichten = array_map(function (string $token) use ($titel, $body) {
            return ['to' => $token, 'sound' => 'default', 'title' => $titel, 'body' => $body];
        }, $batch);

        $ch = curl_init('https://exp.host/--/api/v2/push/send');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_POSTFIELDS => json_encode($berichten),
            CURLOPT_TIMEOUT => 8,
        ]);
        curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Pushmelding versturen mislukt: ' . curl_error($ch));
        }
        curl_close($ch);
    }
}
