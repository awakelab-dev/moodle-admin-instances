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

/**
 * Plugin library functions.
 *
 * @package    local_courseprogressnotify
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Adds a link to the per-course settings page in Moodle's navigation for
 * users who have the managecourses capability.
 *
 * @param global_navigation $nav
 */
function local_courseprogressnotify_extend_navigation(global_navigation $nav) {
    if (!isloggedin() || isguestuser()) {
        return;
    }

    $context = context_system::instance();
    if (!has_capability('local/courseprogressnotify:managecourses', $context)) {
        return;
    }

    $url = new moodle_url('/local/courseprogressnotify/courses.php');
    $node = $nav->add(
        get_string('coursespage:title', 'local_courseprogressnotify'),
        $url,
        navigation_node::TYPE_CUSTOM,
        null,
        'local_courseprogressnotify_courses',
        new pix_icon('i/settings', '')
    );
    $node->showinflatnavigation = true;
}
