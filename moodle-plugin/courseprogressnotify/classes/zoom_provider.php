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
 * Helper to query upcoming Zoom sessions.
 *
 * @package   local_courseprogressnotify
 */
class zoom_provider {

    /**
     * Get Zoom module id.
     *
     * @return int
     */
    protected static function get_zoom_module_id(): int {
        global $DB;
        static $moduleid = null;
        if ($moduleid === null) {
            $moduleid = (int)$DB->get_field('modules', 'id', ['name' => 'zoom']);
            if (!$moduleid) {
                $moduleid = 0; // Not installed.
            }
        }
        return $moduleid;
    }

    /**
     * Returns upcoming Zoom sessions between from/to times (inclusive start, exclusive end).
     *
     * @param int $fromtime
     * @param int $totime
     * @return array of records {id, course, name, start_time, duration, join_url, cmid}
     */
    public static function get_upcoming_between(int $fromtime, int $totime): array {
        global $DB;
        $moduleid = self::get_zoom_module_id();
        if (empty($moduleid)) {
            return [];
        }
        // Note: mod_zoom stores timestamps in 'start_time' (int) and duration in seconds.
        $sql = "SELECT z.id, z.course, z.name, z.start_time, z.duration, z.join_url, cm.id AS cmid
                  FROM {zoom} z
                  JOIN {course_modules} cm ON cm.instance = z.id AND cm.module = :moduleid
                  JOIN {course} c ON c.id = z.course
                 WHERE z.start_time >= :fromtime AND z.start_time < :totime
                   AND c.visible = 1 AND cm.deletioninprogress = 0";
        $params = ['fromtime' => $fromtime, 'totime' => $totime, 'moduleid' => $moduleid];
        return $DB->get_records_sql($sql, $params);
    }
}
