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

namespace local_courseprogressnotify\privacy;

use core_privacy\local\metadata\collection;

/**
 * Privacy provider for local_courseprogressnotify.
 *
 * @package   local_courseprogressnotify
 * @copyright Copyright (c) 2025
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class provider implements \core_privacy\local\metadata\provider {

    /**
     * Returns metadata about this plugin's data storage.
     *
     * @param collection $items
     * @return collection
     */
    public static function get_metadata(collection $items): collection {
        $items->add_database_table('local_courseprogressnotify_log', [
            'userid' => 'privacy:metadata:local_courseprogressnotify_log:userid',
            'courseid' => 'privacy:metadata:local_courseprogressnotify_log:courseid',
            'notification_type' => 'privacy:metadata:local_courseprogressnotify_log:notification_type',
            'entityid' => 'privacy:metadata:local_courseprogressnotify_log:entityid',
            'time_sent' => 'privacy:metadata:local_courseprogressnotify_log:time_sent',
        ], 'privacy:metadata:local_courseprogressnotify_log');
        return $items;
    }
}
