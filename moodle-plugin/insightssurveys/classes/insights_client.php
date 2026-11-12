<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

namespace local_insightssurveys;

defined('MOODLE_INTERNAL') || die();

/**
 * Cliente HTTP hacia Moodle Insights (moodle-admin-instances / "Encuestas"),
 * mismo patrón de conexión que local_courseprogressnotify: una URL y una API
 * key con formato "<platformId>.<secreto>" (se genera desde Configuración >
 * Plataformas > Gestión de Notificaciones en el dashboard — es la MISMA
 * API key que usa el plugin de notificaciones, el backend no distingue
 * quién llama, solo valida plataforma+key).
 *
 * @package local_insightssurveys
 */
class insights_client {

    /**
     * Campañas de encuesta con un envío pendiente HOY para esta plataforma.
     *
     * @return array<int,array> cada una: ['campaignId'=>string,'dayIndex'=>int,
     *   'recipientSource'=>'manual'|'course_enrollment','manualRecipients'=>string[],
     *   'courseId'=>?int,'surveyUrl'=>string,'messageTemplate'=>string]
     */
    public static function get_due_survey_campaigns(): array {
        [$url, $apikey] = self::get_connection();
        if (!$url || !$apikey) {
            mtrace('  ✗ Moodle Insights no está configurado (URL/API key vacíos) — no se enviará ninguna encuesta.');
            return [];
        }

        $response = self::call('GET', $url . '/api/surveys/plugin/campaigns', $apikey);
        if ($response === null) {
            return [];
        }
        $data = json_decode($response, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Reporta en un solo lote los envíos de encuesta intentados (éxito o
     * fallo) en esta ejecución. La deduplicación real ya la garantiza la
     * tabla local (survey_log), así que un fallo aquí solo deja el
     * seguimiento centralizado incompleto para esa ejecución.
     *
     * @param array $results Cada elemento: ['campaignId'=>string,'dayIndex'=>int,'recipientEmail'=>string,'moodleUserId'=>?int,'success'=>bool,'errorMessage'=>?string]
     */
    public static function report_survey_log(array $results): void {
        if (empty($results)) {
            return;
        }
        [$url, $apikey] = self::get_connection();
        if (!$url || !$apikey) {
            return;
        }
        self::call('POST', $url . '/api/surveys/plugin/log', $apikey, ['results' => array_values($results)]);
    }

    /**
     * @return array{0:?string,1:?string} [url sin barra final, apikey] — ambos null si falta alguno.
     */
    private static function get_connection(): array {
        $url = trim((string)get_config('local_insightssurveys', 'insights_url'));
        $apikey = trim((string)get_config('local_insightssurveys', 'insights_api_key'));
        if ($url === '' || $apikey === '') {
            return [null, null];
        }
        return [rtrim($url, '/'), $apikey];
    }

    private static function call(string $method, string $url, string $apikey, ?array $body = null): ?string {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');

        $curl = new \curl();
        $curl->setHeader(['Authorization: Bearer ' . $apikey, 'Content-Type: application/json']);
        $options = ['CURLOPT_TIMEOUT' => 15, 'CURLOPT_CONNECTTIMEOUT' => 10];

        if ($method === 'POST') {
            $response = $curl->post($url, json_encode($body ?? []), $options);
        } else {
            $response = $curl->get($url, [], $options);
        }

        $httpcode = (int)($curl->info['http_code'] ?? 0);
        if ($curl->get_errno() || $httpcode < 200 || $httpcode >= 300) {
            mtrace("  ✗ Moodle Insights ({$method} {$url}) falló: HTTP {$httpcode} " . ($curl->error ?? ''));
            return null;
        }
        return $response;
    }
}
