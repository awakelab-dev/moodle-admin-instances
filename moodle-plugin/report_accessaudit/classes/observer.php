<?php
namespace report_accessaudit;

defined('MOODLE_INTERNAL') || die();

class observer {

    public static function user_loggedin(\core\event\user_loggedin $event) {
        global $DB;

        $userid = $event->userid;

        // Ignorar administradores del sitio
        if (is_siteadmin($userid)) {
            return;
        }

        $ip     = getremoteaddr();

        // Obtener geolocalización
        $location = self::get_location($ip);

        // Insertar registro
        $record              = new \stdClass();
        $record->userid      = $userid;
        $record->ip          = $ip;
        $record->city        = $location['city'];
        $record->region      = $location['region'];
        $record->country     = $location['country'];
        $record->countrycode = $location['countrycode'];
        $record->timecreated = time();
        $DB->insert_record('report_accessaudit', $record);

        // Mantener solo los últimos 3 registros por usuario
        $records = $DB->get_records(
            'report_accessaudit',
            ['userid' => $userid],
            'timecreated DESC'
        );

        if (count($records) > 3) {
            $to_delete = array_slice(array_values($records), 3);
            foreach ($to_delete as $r) {
                $DB->delete_records('report_accessaudit', ['id' => $r->id]);
            }
        }
    }

    private static function get_location(string $ip): array {
        $default = ['city' => 'Desconocido', 'region' => 'Desconocido', 'country' => 'Desconocido', 'countrycode' => '??'];

        // Ignorar IPs privadas/locales
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return ['city' => 'Red local', 'region' => 'Local', 'country' => 'Local', 'countrycode' => '--'];
        }

        try {
            $curl = new \curl();
            $curl->setopt(['CURLOPT_TIMEOUT' => 5]);
            $response = $curl->get("http://ip-api.com/json/{$ip}?fields=status,city,regionName,country,countryCode");
            $data     = json_decode($response, true);

            if (!empty($data) && ($data['status'] ?? '') === 'success') {
                return [
                    'city'        => $data['city']        ?? 'Desconocido',
                    'region'      => $data['regionName']  ?? 'Desconocido',
                    'country'     => $data['country']     ?? 'Desconocido',
                    'countrycode' => $data['countryCode'] ?? '??',
                ];
            }
        } catch (\Exception $e) {
            // Silencioso: no interrumpir el login si falla la geolocalización
        }

        return $default;
    }
}
