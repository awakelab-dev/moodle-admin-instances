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
 * Helper for logging notifications and preventing duplicates.
 *
 * @package   local_courseprogressnotify
 */
class notification_log {

    /**
     * Checks if a notification of the given type was already sent to the user for the course and optional entity.
     *
     * @param int $userid
     * @param int $courseid
     * @param string $type
     * @param int|null $entityid
     * @return bool
     */
    public static function has_sent(int $userid, int $courseid, string $type, ?int $entityid = null): bool {
        global $DB;
        $conditions = ['userid' => $userid, 'courseid' => $courseid, 'notification_type' => $type];
        if ($entityid === null) {
            $conditions['entityid'] = null;
        } else {
            $conditions['entityid'] = $entityid;
        }
        return $DB->record_exists('local_courseprogressnotify_log', $conditions);
    }

    /**
     * Returns the list of course IDs configured as "diploma-only".
     * Diploma-only courses only receive the diploma availability email;
     * all other notification types are suppressed for them.
     *
     * @return int[]
     */
    public static function get_diploma_only_course_ids(): array {
        $config = get_config('local_courseprogressnotify', 'diploma_only_courses');
        if (empty($config)) {
            return [];
        }
        return array_values(array_filter(array_map('intval', array_filter(explode(',', $config)))));
    }

    /**
     * Inserts a log entry after a successful email send.
     *
     * @param int $userid
     * @param int $courseid
     * @param string $type
     * @param int|null $entityid
     * @return void
     */
    public static function log_sent(int $userid, int $courseid, string $type, ?int $entityid = null): void {
        global $DB;
        $record = (object) [
            'userid' => $userid,
            'courseid' => $courseid,
            'notification_type' => $type,
            'entityid' => $entityid,
            'time_sent' => time(),
        ];
        try {
            $DB->insert_record('local_courseprogressnotify_log', $record, false);
        } catch (\dml_write_exception $e) {
            // Rely on DB unique index to prevent duplicates; ignore if already exists.
        }
    }
}
