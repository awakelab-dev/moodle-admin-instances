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

namespace report_accessaudit;

defined('MOODLE_INTERNAL') || die();

/**
 * Cliente HTTP hacia Moodle Insights (moodle-admin-instances), pestaña
 * "Seguridad" — centraliza los patrones de acceso sospechoso detectados
 * por analyzer::run() para poder verlos juntos entre todas las
 * plataformas. Mismo patrón que local_courseprogressnotify\insights_client,
 * pero con su propia conexión (URL + API key independientes, aunque
 * puedan apuntar al mismo Moodle Insights).
 *
 * Si la conexión no está configurada o la llamada falla, simplemente no
 * reporta nada — el análisis local (tabla report_accessaudit_patterns de
 * esta misma Moodle) sigue funcionando igual, esto es un espejo opcional.
 *
 * @package report_accessaudit
 */
class insights_client {

    /**
     * Manda el snapshot COMPLETO de patrones recién detectados — Moodle
     * Insights reemplaza enteros los que tenía guardados para esta
     * plataforma, igual que esta tabla local se borra y recrea cada vez
     * que corre el análisis (ver analyzer::run()).
     *
     * @param array $patterns Filas de report_accessaudit_patterns (objetos stdClass de la BD).
     */
    public static function report_patterns(array $patterns): void {
        [$url, $apikey] = self::get_connection();
        if (!$url || !$apikey) {
            return;
        }

        $payload = array_map(function($p) {
            return [
                'ip'          => $p->ip,
                'courseId'    => (int)$p->courseid,
                'courseName'  => (string)$p->coursename,
                'patternType' => $p->pattern_type,
                'userIds'     => json_decode($p->userids, true) ?? [],
                'usernames'   => json_decode($p->usernames, true) ?? new \stdClass(),
                'detailJson'  => json_decode($p->detail_json, true) ?? new \stdClass(),
                'riskLevel'   => $p->risk_level,
                'detectedAt'  => gmdate('c', (int)$p->timecreated),
            ];
        }, $patterns);

        self::call('POST', $url . '/api/security/plugin/patterns', $apikey, ['patterns' => $payload]);
    }

    /**
     * @return array{0:?string,1:?string} [url sin barra final, apikey] — ambos null si falta alguno.
     */
    private static function get_connection(): array {
        $url = trim((string)get_config('report_accessaudit', 'insights_url'));
        $apikey = trim((string)get_config('report_accessaudit', 'insights_api_key'));
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
