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
 * Deduplicación de envíos de encuesta — misma idea que notification_log de
 * local_courseprogressnotify, en una tabla propia de este plugin.
 *
 * @package local_insightssurveys
 */
class survey_log {

    public static function has_sent(int $userid, int $courseid, string $type): bool {
        global $DB;
        return $DB->record_exists('local_insightssurveys_log', [
            'userid' => $userid,
            'courseid' => $courseid,
            'notification_type' => $type,
        ]);
    }

    public static function log_sent(int $userid, int $courseid, string $type): void {
        global $DB;
        $record = (object) [
            'userid' => $userid,
            'courseid' => $courseid,
            'notification_type' => $type,
            'time_sent' => time(),
        ];
        try {
            $DB->insert_record('local_insightssurveys_log', $record, false);
        } catch (\dml_write_exception $e) {
            // El índice único ya evita duplicados; se ignora si ya existía.
        }
    }
}
