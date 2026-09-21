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

require_login();
$context = context_system::instance();
require_capability('local/courseprogressnotify:managecourses', $context);

$url = new moodle_url('/local/courseprogressnotify/courses.php');
$PAGE->set_url($url);
$PAGE->set_context($context);
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('coursespage:title', 'local_courseprogressnotify'));
$PAGE->set_heading(get_string('coursespage:title', 'local_courseprogressnotify'));

// Handle POST - save diploma_only_courses config.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_sesskey();
    $rawids = optional_param('diploma_only_courses', '', PARAM_RAW);
    $ids = array_values(array_filter(array_map('intval', array_filter(explode(',', $rawids)))));
    set_config('diploma_only_courses', implode(',', $ids), 'local_courseprogressnotify');
    redirect($url, get_string('coursespage:saved', 'local_courseprogressnotify'), null, notification::NOTIFY_SUCCESS);
}

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('coursespage:title', 'local_courseprogressnotify'));
echo html_writer::tag('p', get_string('coursespage:desc', 'local_courseprogressnotify'));

$customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');

if (empty($customfieldshortname)) {
    echo $OUTPUT->notification(
        get_string('settings:diploma_only_configure_first', 'local_courseprogressnotify'),
        notification::NOTIFY_WARNING
    );
} else {
    $field = $DB->get_record('customfield_field', ['shortname' => $customfieldshortname]);

    if (!$field) {
        echo $OUTPUT->notification(
            get_string('settings:diploma_only_configure_first', 'local_courseprogressnotify'),
            notification::NOTIFY_WARNING
        );
    } else {
        $sql = "SELECT * FROM {customfield_data}
                WHERE fieldid = :fieldid
                AND " . $DB->sql_compare_text('value') . " = " . $DB->sql_compare_text(':value');
        $datas = $DB->get_records_sql($sql, ['fieldid' => $field->id, 'value' => '1']);
        $enabledcourseids = array_column((array)$datas, 'instanceid');

        if (empty($enabledcourseids)) {
            echo $OUTPUT->notification(
                get_string('settings:diploma_only_no_courses', 'local_courseprogressnotify'),
                notification::NOTIFY_INFO
            );
        } else {
            [$insql, $params] = $DB->get_in_or_equal($enabledcourseids);
            $courses = $DB->get_records_select('course', "id {$insql}", $params, 'fullname ASC');

            $currentconfig = get_config('local_courseprogressnotify', 'diploma_only_courses');
            $diplomaonlyids = array_values(array_filter(
                array_map('intval', array_filter(explode(',', $currentconfig ?? '')))
            ));

            $uid = 'cpncourses';
            $warnvisible = !empty($diplomaonlyids) ? ' cpn-donly-warning-visible' : '';

            echo html_writer::tag('style', '
                .cpn-donly-table-wrap {
                    max-height: 520px;
                    overflow-y: auto;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    margin: 0 0 0.75rem 0;
                }
                .cpn-donly-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .cpn-donly-table thead th {
                    background: #e9ecef;
                    padding: 0.55em 1em;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #dee2e6;
                    font-size: 0.85em;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #495057;
                    position: sticky;
                    top: 0;
                }
                .cpn-donly-row {
                    border-bottom: 1px solid #e9ecef;
                    background: #f8f9fa;
                    transition: background 0.15s;
                }
                .cpn-donly-row:last-child { border-bottom: none; }
                .cpn-donly-row.is-donly { background: #fff3cd; }
                .cpn-donly-row.is-donly td:first-child {
                    border-left: 5px solid #dc3545;
                    padding-left: calc(1em - 1px);
                }
                .cpn-donly-row td { padding: 0.6em 1em; vertical-align: middle; }
                .cpn-donly-name { font-weight: 600; }
                .cpn-donly-badge {
                    display: none;
                    margin-left: 0.5em;
                    padding: 0.15em 0.6em;
                    border-radius: 4px;
                    background: #dc3545;
                    color: #fff;
                    font-size: 0.78em;
                    font-weight: 700;
                    white-space: nowrap;
                    letter-spacing: 0.02em;
                }
                .cpn-donly-row.is-donly .cpn-donly-badge { display: inline; }
                .cpn-donly-warning-note {
                    display: none;
                    padding: 0.6em 1em;
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    border-radius: 5px;
                    color: #721c24;
                    font-size: 0.9em;
                    margin-bottom: 0.75rem;
                }
                .cpn-donly-warning-visible { display: block; }
            ');

            echo html_writer::start_tag('form', [
                'method' => 'post',
                'action' => $url->out(false),
            ]);
            echo html_writer::empty_tag('input', [
                'type'  => 'hidden',
                'name'  => 'sesskey',
                'value' => sesskey(),
            ]);
            echo html_writer::empty_tag('input', [
                'type'  => 'hidden',
                'id'    => $uid . '_val',
                'name'  => 'diploma_only_courses',
                'value' => implode(',', $diplomaonlyids),
            ]);

            echo html_writer::start_tag('div', ['class' => 'cpn-donly-table-wrap']);
            echo html_writer::start_tag('table', ['class' => 'cpn-donly-table', 'id' => $uid . '_list']);
            echo html_writer::start_tag('thead');
            echo html_writer::start_tag('tr');
            echo html_writer::tag('th', get_string('settings:col_course', 'local_courseprogressnotify'));
            echo html_writer::tag('th', get_string('settings:col_diploma_only', 'local_courseprogressnotify'));
            echo html_writer::tag('th', get_string('settings:col_manual_send', 'local_courseprogressnotify'));
            echo html_writer::end_tag('tr');
            echo html_writer::end_tag('thead');
            echo html_writer::start_tag('tbody');

            foreach ($courses as $course) {
                $isdonly = in_array((int)$course->id, $diplomaonlyids, true);
                $itemid  = $uid . '_item_' . $course->id;
                $checkid = $uid . '_cb_' . $course->id;

                $checkboxattrs = [
                    'type'          => 'checkbox',
                    'id'            => $checkid,
                    'class'         => 'form-check-input cpn-donly-toggle',
                    'data-courseid' => (string)$course->id,
                    'data-itemid'   => $itemid,
                    'data-valueid'  => $uid . '_val',
                    'data-warnid'   => $uid . '_warn',
                    'data-listid'   => $uid . '_list',
                ];
                if ($isdonly) {
                    $checkboxattrs['checked'] = 'checked';
                }

                $badge = html_writer::tag('span',
                    get_string('settings:diploma_only_active_badge', 'local_courseprogressnotify'),
                    ['class' => 'cpn-donly-badge']
                );

                $togglecell = html_writer::start_tag('div', ['class' => 'form-check form-switch mb-0'])
                    . html_writer::empty_tag('input', $checkboxattrs)
                    . html_writer::tag('label', '', ['for' => $checkid, 'class' => 'form-check-label'])
                    . html_writer::end_tag('div')
                    . $badge;

                $firstdayurl = new moodle_url('/local/courseprogressnotify/run.php', [
                    'type'               => 'firstday',
                    'confirm'            => 1,
                    'ignorerestrictions' => 1,
                    'courseid'           => $course->id,
                    'sesskey'            => sesskey(),
                ]);
                $diplomaurl = new moodle_url('/local/courseprogressnotify/run.php', [
                    'type'               => 'diploma',
                    'confirm'            => 1,
                    'ignorerestrictions' => 1,
                    'courseid'           => $course->id,
                    'sesskey'            => sesskey(),
                ]);
                $actioncell = html_writer::link($firstdayurl,
                        get_string('settings:send_course_firstday', 'local_courseprogressnotify'),
                        ['class' => 'btn btn-sm btn-outline-secondary']
                    )
                    . ' '
                    . html_writer::link($diplomaurl,
                        get_string('settings:send_course_diploma', 'local_courseprogressnotify'),
                        ['class' => 'btn btn-sm btn-outline-danger']
                    );

                echo html_writer::start_tag('tr', [
                    'class' => 'cpn-donly-row' . ($isdonly ? ' is-donly' : ''),
                    'id'    => $itemid,
                ]);
                echo html_writer::tag('td', s($course->fullname), ['class' => 'cpn-donly-name']);
                echo html_writer::tag('td', $togglecell);
                echo html_writer::tag('td', $actioncell);
                echo html_writer::end_tag('tr');
            }

            echo html_writer::end_tag('tbody');
            echo html_writer::end_tag('table');
            echo html_writer::end_tag('div');

            echo html_writer::tag('div',
                '⚠ ' . get_string('settings:diploma_only_warning_active', 'local_courseprogressnotify'),
                ['class' => 'cpn-donly-warning-note' . $warnvisible, 'id' => $uid . '_warn']
            );

            echo html_writer::tag('button',
                get_string('savechanges', 'core'),
                ['type' => 'submit', 'class' => 'btn btn-primary']
            );

            echo html_writer::end_tag('form');

            echo html_writer::tag('script', '
(function () {
    function refreshWarning(warnId, listId) {
        var warn = document.getElementById(warnId);
        if (!warn) return;
        var list = document.getElementById(listId);
        var anyChecked = list && list.querySelector(".cpn-donly-toggle:checked");
        if (anyChecked) {
            warn.classList.add("cpn-donly-warning-visible");
        } else {
            warn.classList.remove("cpn-donly-warning-visible");
        }
    }

    document.querySelectorAll(".cpn-donly-toggle").forEach(function (cb) {
        cb.addEventListener("change", function () {
            var itemEl  = document.getElementById(cb.getAttribute("data-itemid"));
            var valEl   = document.getElementById(cb.getAttribute("data-valueid"));
            var listEl  = document.getElementById(cb.getAttribute("data-listid"));
            var warnId  = cb.getAttribute("data-warnid");

            if (cb.checked) {
                itemEl && itemEl.classList.add("is-donly");
            } else {
                itemEl && itemEl.classList.remove("is-donly");
            }

            var checked = [];
            if (listEl) {
                listEl.querySelectorAll(".cpn-donly-toggle:checked").forEach(function (c) {
                    checked.push(c.getAttribute("data-courseid"));
                });
            }
            if (valEl) { valEl.value = checked.join(","); }

            refreshWarning(warnId, cb.getAttribute("data-listid"));
        });
    });
})();
');
        }
    }
}

echo $OUTPUT->footer();
