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
