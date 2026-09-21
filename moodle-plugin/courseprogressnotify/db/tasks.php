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

defined('MOODLE_INTERNAL') || die();

$tasks = [
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_progress_25',
        'blocking'  => 0,
        'minute'    => 'R',
        'hour'      => '3',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_progress_50',
        'blocking'  => 0,
        'minute'    => 'R',
        'hour'      => '3',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_course_end_soon',
        'blocking'  => 0,
        'minute'    => '15',
        'hour'      => '4',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_course_last_day',
        'blocking'  => 0,
        'minute'    => '45',
        'hour'      => '4',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_zoom_sessions',
        'blocking'  => 0,
        'minute'    => '*/30',
        'hour'      => '*',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_presential_sessions',
        'blocking'  => 0,
        'minute'    => '0',
        'hour'      => '6',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_diploma_available',
        'blocking'  => 0,
        'minute'    => '30',
        'hour'      => '5',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_first_day_tasks',
        'blocking'  => 0,
        'minute'    => '0',
        'hour'      => '9',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
    [
        'classname' => '\\local_courseprogressnotify\\task\\check_second_day_tasks',
        'blocking'  => 0,
        'minute'    => '30',
        'hour'      => '9',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
    ],
];
