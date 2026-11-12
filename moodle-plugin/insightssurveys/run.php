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

require_once(__DIR__ . '/../../config.php');

use core\output\notification;
use local_insightssurveys\task\check_survey_campaigns;

require_login();
$context = context_system::instance();
require_capability('local/insightssurveys:run', $context);

$url = new moodle_url('/local/insightssurveys/run.php');
$PAGE->set_url($url);
$PAGE->set_context($context);
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('runpage:title', 'local_insightssurveys'));
$PAGE->set_heading(get_string('runpage:title', 'local_insightssurveys'));

$confirm = optional_param('confirm', 0, PARAM_BOOL);
$courseid = optional_param('courseid', 0, PARAM_INT);

if ($confirm && confirm_sesskey()) {
    echo $OUTPUT->header();
    echo $OUTPUT->heading(get_string('runpage:heading', 'local_insightssurveys'));

    core_php_time_limit::raise(600);
    ignore_user_abort(true);

    $output = [];
    $errors = [];
    $output[] = '=== Starting Manual Check ===';
    $output[] = 'Time: ' . userdate(time());
    $output[] = '';

    ob_start();
    try {
        $task = new check_survey_campaigns();
        if ($courseid) {
            $task->set_target_course_id($courseid);
        }
        $task->execute();
        $output[] = ob_get_contents();
    } catch (Throwable $e) {
        $errors[] = 'Survey task: ' . $e->getMessage();
        $output[] = 'ERROR: ' . $e->getMessage();
    }
    ob_end_clean();

    $output[] = '';
    $output[] = '=== Manual Check Completed ===';
    $taskoutput = implode("\n", $output);

    if (empty($errors)) {
        echo $OUTPUT->notification(get_string('run_now_done', 'local_insightssurveys'), notification::NOTIFY_SUCCESS);
    } else {
        echo $OUTPUT->notification(get_string('run_now_error', 'local_insightssurveys') . ' ' . s(implode(' | ', $errors)), notification::NOTIFY_ERROR);
    }

    echo html_writer::tag('h4', 'Debug Output:');
    echo html_writer::tag('pre', s($taskoutput), ['style' => 'background: #f5f5f5; padding: 15px; border: 1px solid #ddd; max-height: 600px; overflow-y: auto;']);

    $backlink = html_writer::link(new moodle_url('/local/insightssurveys/run.php'), get_string('backtosettings', 'local_insightssurveys'));
    echo html_writer::div($backlink, 'mt-3');
    echo $OUTPUT->footer();
    exit;
}

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('runpage:heading', 'local_insightssurveys'));
echo html_writer::tag('p', get_string('runpage:desc', 'local_insightssurveys'));

$formurl = new moodle_url('/local/insightssurveys/run.php', ['confirm' => 1, 'sesskey' => sesskey()]);
echo html_writer::link($formurl, get_string('run_now_button', 'local_insightssurveys'), ['class' => 'btn btn-primary']);

$backlink = html_writer::link(new moodle_url('/admin/settings.php', ['section' => 'local_insightssurveys']),
    get_string('backtosettings', 'local_insightssurveys'));
echo html_writer::div($backlink, 'mt-3');

echo $OUTPUT->footer();
