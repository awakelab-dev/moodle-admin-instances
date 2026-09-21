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

require_once(__DIR__ . '/../../../lib/completionlib.php');

use completion_info;
use html_writer;

/**
 * Calculates user progress and builds an HTML table for progress.
 *
 * @package   local_courseprogressnotify
 */
class progress_calculator {

    /**
     * Get course progress percentage for a user (0-100).
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return float
     */
    public static function get_progress_percentage(\stdClass $course, \stdClass $user): float {
        $completion = new completion_info($course);
        if (!$completion->is_enabled()) {
            return 0.0;
        }

        $cms = $completion->get_activities();
        $trackable = 0;
        $completed = 0;
        foreach ($cms as $cm) {
            if (!$completion->is_enabled($cm)) {
                continue;
            }
            $trackable++;
            $data = $completion->get_data($cm, false, $user->id);
            if (!empty($data) && (int)$data->completionstate >= COMPLETION_COMPLETE) {
                $completed++;
            }
        }
        if ($trackable === 0) {
            return 0.0;
        }
        return round(($completed / $trackable) * 100, 1);
    }

    /**
     * Build an HTML table with the progress of the user per activity.
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return string HTML
     */
    public static function build_progress_table_html(\stdClass $course, \stdClass $user): string {
        $completion = new completion_info($course);
        if (!$completion->is_enabled()) {
            return '';
        }
        $cms = $completion->get_activities();
        if (empty($cms)) {
            return '';
        }
        $rows = [];
        foreach ($cms as $cm) {
            if (!$completion->is_enabled($cm)) {
                continue;
            }
            $data = $completion->get_data($cm, false, $user->id);
            $done = (!empty($data) && (int)$data->completionstate >= COMPLETION_COMPLETE);
            $status = $done ? get_string('progress:status:complete', 'local_courseprogressnotify') : get_string('progress:status:incomplete', 'local_courseprogressnotify');
            $name = format_string($cm->name, true, ['context' => \context_module::instance($cm->id)]);
            $rows[] = [s($name), s($status)];
        }

        if (empty($rows)) {
            return '';
        }

        $html = html_writer::start_tag('table', ['class' => 'generaltable local-courseprogressnotify-progress']);
        $html .= html_writer::start_tag('thead');
        $html .= html_writer::start_tag('tr');
        $html .= html_writer::tag('th', get_string('progress:header:activity', 'local_courseprogressnotify'));
        $html .= html_writer::tag('th', get_string('progress:header:status', 'local_courseprogressnotify'));
        $html .= html_writer::end_tag('tr');
        $html .= html_writer::end_tag('thead');
        $html .= html_writer::start_tag('tbody');
        foreach ($rows as [$n, $s]) {
            $html .= html_writer::start_tag('tr');
            $html .= html_writer::tag('td', $n);
            $html .= html_writer::tag('td', $s);
            $html .= html_writer::end_tag('tr');
        }
        $html .= html_writer::end_tag('tbody');
        $html .= html_writer::end_tag('table');
        return $html;
    }
}
