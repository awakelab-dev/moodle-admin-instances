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

namespace local_courseprogressnotify;

defined('MOODLE_INTERNAL') || die();

/**
 * Cliente HTTP hacia Moodle Insights (moodle-admin-instances / "Gestión de
 * Notificaciones"). Desde ahí se controla qué disparadores están activos y
 * qué plantilla usa cada uno — este plugin ya no guarda esa configuración
 * localmente, solo la conexión (ver settings.php: URL + API key, esta
 * última con formato "<platformId>.<secreto>", generada desde
 * Configuración > Plataformas > Gestión de Notificaciones allá).
 *
 * Si la conexión no está configurada o la llamada falla, los métodos
 * devuelven un resultado "vacío" en vez de lanzar una excepción — una
 * tarea cron debe comportarse como si no hubiera ningún disparador activo
 * en ese caso, no romperse a media ejecución.
 *
 * @package   local_courseprogressnotify
 */
class insights_client {

    /**
     * Respuesta cruda de /api/notifications/plugin/config, cacheada por
     * proceso PHP (una tarea cron = un proceso = como mucho una llamada
     * HTTP, aunque el código llame a get_config() y get_settings() por
     * separado varias veces durante la misma ejecución).
     *
     * @var array{triggers:array<string,array>,settings:array}|null
     */
    private static ?array $cache = null;

    /**
     * Disparadores activos y su plantilla, indexados por clave de
     * disparador (p. ej. 'progress_25').
     *
     * @return array<string,array> ej. ['progress_25' => ['trigger'=>'progress_25','params'=>[],'template'=>['language'=>'es','subject'=>'...','bodyHtml'=>'...']]]
     */
    public static function get_config(): array {
        return self::fetch()['triggers'];
    }

    /**
     * Ajustes propios de esta plataforma que no son de un disparador en
     * concreto: campo personalizado que activa notificaciones por curso,
     * cursos "solo diploma", etc. (ver NotificationsService.getPlatformSettings
     * en el backend — el plugin no guarda ningún default localmente,
     * siempre recibe el objeto completo).
     *
     * @return array{courseCustomFieldShortname?:string,diplomaOnlyCourseIds?:int[]}
     */
    public static function get_settings(): array {
        return self::fetch()['settings'];
    }

    /**
     * @return array{triggers:array<string,array>,settings:array}
     */
    private static function fetch(): array {
        if (self::$cache !== null) {
            return self::$cache;
        }

        [$url, $apikey] = self::get_connection();
        if (!$url || !$apikey) {
            mtrace('  ✗ Moodle Insights no está configurado (URL/API key vacíos) — no se enviará ningún email.');
            self::$cache = ['triggers' => [], 'settings' => []];
            return self::$cache;
        }

        $response = self::call('GET', $url . '/api/notifications/plugin/config', $apikey);
        if ($response === null) {
            self::$cache = ['triggers' => [], 'settings' => []];
            return self::$cache;
        }

        $data = json_decode($response, true);
        $triggers = is_array($data['triggers'] ?? null) ? $data['triggers'] : [];

        $bytrigger = [];
        foreach ($triggers as $trigger) {
            if (!empty($trigger['trigger'])) {
                $bytrigger[$trigger['trigger']] = $trigger;
            }
        }

        $settings = is_array($data['settings'] ?? null) ? $data['settings'] : [];

        self::$cache = ['triggers' => $bytrigger, 'settings' => $settings];
        return self::$cache;
    }

    /**
     * Reporta en un solo lote los envíos intentados (éxito o fallo) en
     * esta ejecución. Un fallo aquí solo se registra en el log de
     * depuración — la deduplicación real ya la garantiza la tabla local
     * (notification_log), así que no reportar un envío no provoca
     * duplicados, solo deja el seguimiento centralizado incompleto para
     * esa ejecución.
     *
     * @param array $results Cada elemento: ['trigger'=>string,'courseId'=>int,'userId'=>int,'entityId'=>?string,'success'=>bool,'errorMessage'=>?string]
     */
    public static function report_log(array $results): void {
        if (empty($results)) {
            return;
        }
        [$url, $apikey] = self::get_connection();
        if (!$url || !$apikey) {
            return;
        }
        self::call('POST', $url . '/api/notifications/plugin/log', $apikey, ['results' => array_values($results)]);
    }

    /**
     * @return array{0:?string,1:?string} [url sin barra final, apikey] — ambos null si falta alguno.
     */
    private static function get_connection(): array {
        $url = trim((string)get_config('local_courseprogressnotify', 'insights_url'));
        $apikey = trim((string)get_config('local_courseprogressnotify', 'insights_api_key'));
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
