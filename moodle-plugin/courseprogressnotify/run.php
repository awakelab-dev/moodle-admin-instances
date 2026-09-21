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
use local_courseprogressnotify\task\check_progress_25;
use local_courseprogressnotify\task\check_progress_50;
use local_courseprogressnotify\task\check_course_end_soon;
use local_courseprogressnotify\task\check_course_last_day;
use local_courseprogressnotify\task\check_zoom_sessions;
use local_courseprogressnotify\task\check_presential_sessions;
use local_courseprogressnotify\task\check_diploma_available;
use local_courseprogressnotify\task\check_first_day_tasks;
use local_courseprogressnotify\task\check_second_day_tasks;

require_login();
$context = context_system::instance();
require_capability('local/courseprogressnotify:run', $context);

$url = new moodle_url('/local/courseprogressnotify/run.php');
$PAGE->set_url($url);
$PAGE->set_context($context);
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('runpage:title', 'local_courseprogressnotify'));
$PAGE->set_heading(get_string('runpage:title', 'local_courseprogressnotify'));

$type = optional_param('type', '', PARAM_ALPHA);
$confirm = optional_param('confirm', 0, PARAM_BOOL);
$clearlogs = optional_param('clearlogs', 0, PARAM_BOOL);
$ignorerestrictions = optional_param('ignorerestrictions', 0, PARAM_BOOL);
$courseid = optional_param('courseid', 0, PARAM_INT);

if ($confirm && !empty($type) && confirm_sesskey()) {
    echo $OUTPUT->header();
    echo $OUTPUT->heading(get_string('runpage:heading', 'local_courseprogressnotify'));
    
    core_php_time_limit::raise(600);
    ignore_user_abort(true);

    // Execute the selected tasks based on type.
    // Capture both mtrace and direct output.
    $output = [];
    $errors = [];
    
    $output[] = '=== Starting Manual Check ===';
    $output[] = 'Type: ' . $type;
    $output[] = 'Time: ' . userdate(time());
    $output[] = 'Category ID: ' . get_config('local_courseprogressnotify', 'categoryid');
    
    // Clear logs if requested
    if ($clearlogs) {
        global $DB;
        $notificationtypes = [];
        
        switch ($type) {
            case 'progress':
                $notificationtypes = ['progress_25', 'progress_50'];
                break;
            case 'courseend':
                $notificationtypes = ['course_end_soon', 'course_last_day'];
                break;
            case 'zoom':
                $notificationtypes = ['zoom_reminder'];
                break;
            case 'presential':
                $notificationtypes = ['presential_exam', 'presential_tutoring'];
                break;
            case 'diploma':
                $notificationtypes = ['diploma_available'];
                break;
            case 'firstday':
                $notificationtypes = ['first_day_tasks'];
                break;
            case 'secondday':
                $notificationtypes = ['second_day_tasks'];
                break;
        }
        
        foreach ($notificationtypes as $notiftype) {
            list($insql, $params) = $DB->get_in_or_equal($notiftype);
            $count = $DB->count_records_select('local_courseprogressnotify_log', "notification_type $insql", $params);
            if ($count > 0) {
                $DB->delete_records_select('local_courseprogressnotify_log', "notification_type $insql", $params);
                $output[] = "✓ Cleared {$count} log entries for notification type: {$notiftype}";
            }
        }
        $output[] = '';
    }
    
    $output[] = '';
    
    ob_start();
    
    $courselabel = $courseid ? ' [curso ID: ' . $courseid . ']' : '';

    if ($type === 'progress') {
        try {
            $output[] = '--- Executing 25% Progress Check' . $courselabel . ' ---';
            $t25 = new check_progress_25();
            if ($courseid) {
                $t25->set_target_course_id($courseid);
            }
            $t25->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = '25% task: ' . $e->getMessage();
            $output[] = 'ERROR in 25% task: ' . $e->getMessage();
        }
        ob_clean();

        try {
            $output[] = '\n--- Executing 50% Progress Check' . $courselabel . ' ---';
            $t50 = new check_progress_50();
            if ($courseid) {
                $t50->set_target_course_id($courseid);
            }
            $t50->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = '50% task: ' . $e->getMessage();
            $output[] = 'ERROR in 50% task: ' . $e->getMessage();
        }
    } else if ($type === 'courseend') {
        try {
            $output[] = '--- Executing Course End Soon Check (7 days before)' . $courselabel . ' ---';
            $tendSoon = new check_course_end_soon();
            if ($courseid) {
                $tendSoon->set_target_course_id($courseid);
            }
            $tendSoon->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'End soon task: ' . $e->getMessage();
            $output[] = 'ERROR in end soon task: ' . $e->getMessage();
        }
        ob_clean();

        try {
            $output[] = '\n--- Executing Course Last Day Check' . $courselabel . ' ---';
            $tlastDay = new check_course_last_day();
            if ($courseid) {
                $tlastDay->set_target_course_id($courseid);
            }
            $tlastDay->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'Last day task: ' . $e->getMessage();
            $output[] = 'ERROR in last day task: ' . $e->getMessage();
        }
    } else if ($type === 'zoom') {
        try {
            $output[] = '--- Executing Zoom Sessions Check' . $courselabel . ' ---';
            $tzoom = new check_zoom_sessions();
            if ($courseid) {
                $tzoom->set_target_course_id($courseid);
            }
            $tzoom->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'Zoom task: ' . $e->getMessage();
            $output[] = 'ERROR in Zoom task: ' . $e->getMessage();
        }
    } else if ($type === 'presential') {
        try {
            $output[] = '--- Executing Presential Sessions Check' . $courselabel . ' ---';
            $tpresential = new check_presential_sessions();
            if ($courseid) {
                $tpresential->set_target_course_id($courseid);
            }
            $tpresential->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'Presential task: ' . $e->getMessage();
            $output[] = 'ERROR in Presential task: ' . $e->getMessage();
        }
    } else if ($type === 'diploma') {
        try {
            $ignorelabel = $ignorerestrictions ? ' (IGNORANDO RESTRICCIONES DE FECHA)' : '';
            $courselabel = $courseid ? ' [curso ID: ' . $courseid . ']' : '';
            $output[] = '--- Executing Diploma Available Check (30 days)' . $ignorelabel . $courselabel . ' ---';
            $tdiploma = new check_diploma_available();
            if ($ignorerestrictions) {
                $tdiploma->set_ignore_date_restrictions(true);
            }
            if ($courseid) {
                $tdiploma->set_target_course_id($courseid);
            }
            $tdiploma->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'Diploma task: ' . $e->getMessage();
            $output[] = 'ERROR in Diploma task: ' . $e->getMessage();
        }
    } else if ($type === 'firstday') {
        try {
            $ignorelabel = $ignorerestrictions ? ' (IGNORANDO RESTRICCIONES DE FECHA)' : '';
            $courselabel = $courseid ? ' [curso ID: ' . $courseid . ']' : '';
            $output[] = '--- Executing First Day Tasks Check' . $ignorelabel . $courselabel . ' ---';
            $tfirstday = new check_first_day_tasks();
            if ($ignorerestrictions) {
                $tfirstday->set_ignore_date_restrictions(true);
            }
            if ($courseid) {
                $tfirstday->set_target_course_id($courseid);
            }
            $tfirstday->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'First day task: ' . $e->getMessage();
            $output[] = 'ERROR in First day task: ' . $e->getMessage();
        }
    } else if ($type === 'secondday') {
        try {
            $output[] = '--- Executing Second Day Tasks Check' . $courselabel . ' ---';
            $tsecondday = new check_second_day_tasks();
            if ($courseid) {
                $tsecondday->set_target_course_id($courseid);
            }
            $tsecondday->execute();
            $output[] = ob_get_contents();
        } catch (Throwable $e) {
            $errors[] = 'Second day task: ' . $e->getMessage();
            $output[] = 'ERROR in Second day task: ' . $e->getMessage();
        }
    }
    
    ob_end_clean();
    
    $output[] = '';
    $output[] = '=== Manual Check Completed ===';
    
    $taskoutput = implode("\n", $output);

    if (empty($errors)) {
        echo $OUTPUT->notification(get_string('run_now_done', 'local_courseprogressnotify'), notification::NOTIFY_SUCCESS);
    } else {
        echo $OUTPUT->notification(get_string('run_now_error', 'local_courseprogressnotify') . ' ' . s(implode(' | ', $errors)), notification::NOTIFY_ERROR);
    }

    // Always show output for debugging
    echo html_writer::tag('h4', 'Debug Output:');
    echo html_writer::tag('pre', s($taskoutput), ['class' => 'local-courseprogressnotify-output', 'style' => 'background: #f5f5f5; padding: 15px; border: 1px solid #ddd; max-height: 600px; overflow-y: auto;']);

    $backlink = html_writer::link(new moodle_url('/local/courseprogressnotify/run.php'),
        get_string('backtosettings', 'local_courseprogressnotify'));
    echo html_writer::div($backlink, 'mt-3');
    echo $OUTPUT->footer();
    exit;
}

// Show the page with the action buttons for different types.
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('runpage:heading', 'local_courseprogressnotify'));

$customfield = get_config('local_courseprogressnotify', 'customfield_shortname');
if (empty($customfield)) {
    echo $OUTPUT->notification(get_string('runpage:nocategory', 'local_courseprogressnotify'), notification::NOTIFY_WARNING);
} else {
    echo html_writer::tag('p', get_string('runpage:desc', 'local_courseprogressnotify'));

    if (has_capability('local/courseprogressnotify:managecourses', $context)) {
        $coursesurl = new moodle_url('/local/courseprogressnotify/courses.php');
        echo html_writer::link($coursesurl, get_string('coursespage:title', 'local_courseprogressnotify'), ['class' => 'btn btn-outline-info btn-sm mb-3']);
    }

    // Course selector.
    $enabledcourses = \local_courseprogressnotify\course_diagnostics::get_enabled_courses($customfield);
    echo $OUTPUT->box_start('generalbox mb-4');
    echo html_writer::tag('h4', get_string('runpage:course_selector_heading', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:course_selector_desc', 'local_courseprogressnotify'));

    $selectoptions = [0 => get_string('runpage:all_courses', 'local_courseprogressnotify')];
    foreach ($enabledcourses as $ec) {
        $selectoptions[$ec->id] = $ec->fullname;
    }
    echo html_writer::select($selectoptions, 'cpn_course_selector', 0, false, [
        'id' => 'cpn-course-selector',
        'class' => 'form-control mb-2',
        'style' => 'max-width: 600px;',
    ]);
    echo $OUTPUT->box_end();

    $baseparams = ['confirm' => 1, 'sesskey' => sesskey()];

    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_progress', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_progress', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'progress']);
    echo html_writer::link($formurl, get_string('run_progress_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'progress', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();
    
    // Course end checks (7 days before and last day)
    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_courseend', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_courseend', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'courseend']);
    echo html_writer::link($formurl, get_string('run_courseend_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'courseend', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();

    // Zoom session checks
    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_zoom', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_zoom', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'zoom']);
    echo html_writer::link($formurl, get_string('run_zoom_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'zoom', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();

    // Presential sessions checks
    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_presential', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_presential', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'presential']);
    echo html_writer::link($formurl, get_string('run_presential_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'presential', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();

    // Diploma checks
    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_diploma', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_diploma', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'diploma']);
    echo html_writer::link($formurl, get_string('run_diploma_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'diploma', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();

    // First day tasks
    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_firstday', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_firstday', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'firstday']);
    echo html_writer::link($formurl, get_string('run_firstday_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'firstday', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();

    // Second day tasks
    echo $OUTPUT->box_start('generalbox mb-3');
    echo html_writer::tag('h4', get_string('runpage:type_secondday', 'local_courseprogressnotify'));
    echo html_writer::tag('p', get_string('runpage:confirm_secondday', 'local_courseprogressnotify'));

    $formurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'secondday']);
    echo html_writer::link($formurl, get_string('run_secondday_button', 'local_courseprogressnotify'), ['class' => 'btn btn-primary cpn-run-btn', 'data-basehref' => $formurl->out(false)]);
    echo ' ';
    $clearurl = new moodle_url('/local/courseprogressnotify/run.php', $baseparams + ['type' => 'secondday', 'clearlogs' => 1]);
    echo html_writer::link($clearurl, get_string('run_clear_button', 'local_courseprogressnotify'), ['class' => 'btn btn-warning cpn-run-btn', 'data-basehref' => $clearurl->out(false)]);
    echo $OUTPUT->box_end();

    // JS: update all button hrefs when the course selector changes.
    echo html_writer::script("
(function() {
    var selector = document.getElementById('cpn-course-selector');
    if (!selector) return;
    function updateButtons() {
        var courseId = selector.value;
        document.querySelectorAll('.cpn-run-btn').forEach(function(btn) {
            var base = btn.getAttribute('data-basehref');
            if (!base) return;
            if (courseId && courseId !== '0') {
                btn.href = base + '&courseid=' + encodeURIComponent(courseId);
            } else {
                btn.href = base;
            }
        });
    }
    selector.addEventListener('change', updateButtons);
    updateButtons();
})();
");
}

$backlink = html_writer::link(new moodle_url('/admin/settings.php', ['section' => 'local_courseprogressnotify']),
    get_string('backtosettings', 'local_courseprogressnotify'));
echo html_writer::div($backlink, 'mt-3');

echo $OUTPUT->footer();