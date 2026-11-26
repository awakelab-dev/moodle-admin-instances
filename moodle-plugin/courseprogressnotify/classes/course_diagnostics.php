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
 * Helper used by the manual run page (run.php) to list which courses have
 * notifications enabled via the custom field.
 *
 * @package   local_courseprogressnotify
 */
class course_diagnostics {

    /** Campo opcional de texto con los triggers permitidos para el curso,
     * separados por coma (p. ej. "quality_survey" o "first_day,second_day").
     * Si no existe o está vacío, se permiten todos (comportamiento previo a
     * esta restricción, para no romper cursos ya configurados). */
    const TRIGGER_ALLOWLIST_FIELD_SHORTNAME = 'courseemailnotifications_triggers';

    /**
     * Comprueba si un disparador concreto debe enviarse para un curso: el
     * campo maestro debe estar activado Y (si existe la lista de triggers
     * permitidos) el trigger debe estar en esa lista.
     *
     * @param int $courseid
     * @param string $masterfieldshortname Shortname del campo maestro on/off.
     * @param string $triggerkey Uno de NOTIFICATION_TRIGGER_KEYS (dashboard).
     * @return bool
     */
    public static function is_trigger_enabled_for_course(
        int $courseid,
        string $masterfieldshortname,
        string $triggerkey
    ): bool {
        global $DB;

        $masterfield = $DB->get_record('customfield_field', ['shortname' => $masterfieldshortname]);
        if (!$masterfield) {
            return false;
        }
        $masterdata = $DB->get_record('customfield_data', [
            'fieldid' => $masterfield->id,
            'instanceid' => $courseid,
        ]);
        if (!$masterdata || $masterdata->value != 1) {
            return false;
        }

        $allowfield = $DB->get_record('customfield_field', ['shortname' => self::TRIGGER_ALLOWLIST_FIELD_SHORTNAME]);
        if (!$allowfield) {
            return true;
        }
        $allowdata = $DB->get_record('customfield_data', [
            'fieldid' => $allowfield->id,
            'instanceid' => $courseid,
        ]);
        $raw = trim((string)($allowdata->value ?? ''));
        if ($raw === '') {
            return true;
        }
        $allowed = array_map('trim', explode(',', $raw));
        return in_array($triggerkey, $allowed, true);
    }

    /**
     * Return all courses that have the notification custom field set to 1 (enabled).
     *
     * @param string $customfieldshortname
     * @return \stdClass[] Keyed by course id, sorted by fullname.
     */
    public static function get_enabled_courses(string $customfieldshortname): array {
        global $DB;

        $field = $DB->get_record('customfield_field', ['shortname' => $customfieldshortname]);
        if (!$field) {
            return [];
        }

        $sql = "SELECT * FROM {customfield_data}
                WHERE fieldid = :fieldid
                AND " . $DB->sql_compare_text('value') . " = " . $DB->sql_compare_text(':value');
        $datas = $DB->get_records_sql($sql, ['fieldid' => $field->id, 'value' => '1']);
        if (empty($datas)) {
            return [];
        }

        $courseids = array_column((array)$datas, 'instanceid');
        [$insql, $params] = $DB->get_in_or_equal($courseids);
        return $DB->get_records_select('course', "id {$insql}", $params, 'fullname ASC');
    }
}
