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
 * Custom admin setting that shows a per-course toggle for the "diploma-only" mode.
 *
 * When a course has this toggle enabled, all non-diploma notification tasks
 * will skip it; only the diploma-available email will be sent.
 *
 * The setting stores a comma-separated list of course IDs in:
 *   local_courseprogressnotify/diploma_only_courses
 *
 * @package local_courseprogressnotify
 */
class admin_setting_diploma_only_courses extends \admin_setting {

    public function __construct() {
        parent::__construct(
            'local_courseprogressnotify/diploma_only_courses',
            get_string('settings:diploma_only_courses', 'local_courseprogressnotify'),
            get_string('settings:diploma_only_courses_desc', 'local_courseprogressnotify'),
            ''
        );
    }

    /**
     * @return string current config value or empty string
     */
    public function get_setting() {
        $val = $this->config_read($this->name);
        return ($val === null) ? '' : $val;
    }

    /**
     * Sanitise and persist the comma-separated list of course IDs.
     *
     * @param string $data raw value from the form POST
     * @return string empty string on success, error string on failure
     */
    public function write_setting($data) {
        if (!is_string($data)) {
            $data = '';
        }
        // Keep only positive integer IDs.
        $ids = array_values(array_filter(array_map('intval', array_filter(explode(',', $data)))));
        $value = implode(',', $ids);
        return ($this->config_write($this->name, $value) ? '' : get_string('errorsetting', 'admin'));
    }

    /**
     * Render the setting as a course list with toggle switches.
     *
     * @param string $data current setting value (comma-separated course IDs)
     * @param string $query admin search query
     * @return string HTML
     */
    public function output_html($data, $query = '') {
        global $DB;

        $customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');

        if (empty($customfieldshortname)) {
            $msg = \html_writer::tag(
                'p',
                get_string('settings:diploma_only_configure_first', 'local_courseprogressnotify'),
                ['class' => 'text-muted font-italic']
            );
            return format_admin_setting($this, $this->visiblename, $msg, $this->description, false, '', null, $query);
        }

        // Load all courses that have the plugin custom field enabled.
        $field = $DB->get_record('customfield_field', ['shortname' => $customfieldshortname]);
        if (!$field) {
            $msg = \html_writer::tag(
                'p',
                get_string('settings:diploma_only_configure_first', 'local_courseprogressnotify'),
                ['class' => 'text-muted font-italic']
            );
            return format_admin_setting($this, $this->visiblename, $msg, $this->description, false, '', null, $query);
        }

        $sql = "SELECT * FROM {customfield_data}
                WHERE fieldid = :fieldid
                AND " . $DB->sql_compare_text('value') . " = " . $DB->sql_compare_text(':value');
        $datas = $DB->get_records_sql($sql, ['fieldid' => $field->id, 'value' => '1']);
        $enabledcourseids = array_column((array)$datas, 'instanceid');

        if (empty($enabledcourseids)) {
            $msg = \html_writer::tag(
                'p',
                get_string('settings:diploma_only_no_courses', 'local_courseprogressnotify'),
                ['class' => 'text-muted']
            );
            return format_admin_setting($this, $this->visiblename, $msg, $this->description, false, '', null, $query);
        }

        [$insql, $params] = $DB->get_in_or_equal($enabledcourseids);
        $courses = $DB->get_records_select('course', "id {$insql}", $params, 'fullname ASC');

        // Current diploma-only course IDs.
        $diplomaonlyids = array_values(array_filter(array_map('intval', array_filter(explode(',', $data ?? '')))));

        // Unique prefix for element IDs (prevents conflicts if setting appears multiple times).
        $uid = 'cpndonly_' . substr(md5($this->get_full_name()), 0, 8);

        $html = \html_writer::tag('style', '
            .cpn-donly-table-wrap {
                max-height: 420px;
                overflow-y: auto;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                margin: 0 0 0.5rem 0;
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
                margin-top: 0.5rem;
                padding: 0.6em 1em;
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 5px;
                color: #721c24;
                font-size: 0.9em;
            }
            .cpn-donly-warning-visible { display: block; }
        ');

        $html .= \html_writer::start_tag('div', ['class' => 'cpn-donly-table-wrap']);
        $html .= \html_writer::start_tag('table', ['class' => 'cpn-donly-table', 'id' => $uid . '_list']);
        $html .= \html_writer::start_tag('thead');
        $html .= \html_writer::start_tag('tr');
        $html .= \html_writer::tag('th', get_string('settings:col_course', 'local_courseprogressnotify'));
        $html .= \html_writer::tag('th', get_string('settings:col_diploma_only', 'local_courseprogressnotify'));
        $html .= \html_writer::tag('th', get_string('settings:col_manual_send', 'local_courseprogressnotify'));
        $html .= \html_writer::end_tag('tr');
        $html .= \html_writer::end_tag('thead');
        $html .= \html_writer::start_tag('tbody');

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

            $badge = \html_writer::tag(
                'span',
                get_string('settings:diploma_only_active_badge', 'local_courseprogressnotify'),
                ['class' => 'cpn-donly-badge']
            );

            $togglecell = \html_writer::start_tag('div', ['class' => 'form-check form-switch mb-0'])
                . \html_writer::empty_tag('input', $checkboxattrs)
                . \html_writer::tag('label', '', ['for' => $checkid, 'class' => 'form-check-label'])
                . \html_writer::end_tag('div')
                . $badge;

            $firstdayurl = new \moodle_url('/local/courseprogressnotify/run.php', [
                'type'               => 'firstday',
                'confirm'            => 1,
                'ignorerestrictions' => 1,
                'courseid'           => $course->id,
                'sesskey'            => sesskey(),
            ]);
            $diplomaurl = new \moodle_url('/local/courseprogressnotify/run.php', [
                'type'               => 'diploma',
                'confirm'            => 1,
                'ignorerestrictions' => 1,
                'courseid'           => $course->id,
                'sesskey'            => sesskey(),
            ]);
            $actioncell = \html_writer::link($firstdayurl,
                    get_string('settings:send_course_firstday', 'local_courseprogressnotify'),
                    ['class' => 'btn btn-sm btn-outline-secondary']
                )
                . ' '
                . \html_writer::link($diplomaurl,
                    get_string('settings:send_course_diploma', 'local_courseprogressnotify'),
                    ['class' => 'btn btn-sm btn-outline-danger']
                );

            $html .= \html_writer::start_tag('tr', [
                'class' => 'cpn-donly-row' . ($isdonly ? ' is-donly' : ''),
                'id'    => $itemid,
            ]);
            $html .= \html_writer::tag('td', s($course->fullname), ['class' => 'cpn-donly-name']);
            $html .= \html_writer::tag('td', $togglecell);
            $html .= \html_writer::tag('td', $actioncell);
            $html .= \html_writer::end_tag('tr');
        }

        $html .= \html_writer::end_tag('tbody');
        $html .= \html_writer::end_tag('table');
        $html .= \html_writer::end_tag('div');

        // Warning note shown when any toggle is on.
        $warnvisible = !empty($diplomaonlyids) ? ' cpn-donly-warning-visible' : '';
        $html .= \html_writer::tag(
            'div',
            '⚠ ' . get_string('settings:diploma_only_warning_active', 'local_courseprogressnotify'),
            ['class' => 'cpn-donly-warning-note' . $warnvisible, 'id' => $uid . '_warn']
        );

        // Hidden field that carries the actual saved value.
        $html .= \html_writer::empty_tag('input', [
            'type'  => 'hidden',
            'id'    => $uid . '_val',
            'name'  => $this->get_full_name(),
            'value' => s(implode(',', $diplomaonlyids)),
        ]);

        // JavaScript: keep hidden value and visual state in sync with toggles.
        $html .= \html_writer::tag('script', '
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

            // Toggle visual class.
            if (cb.checked) {
                itemEl && itemEl.classList.add("is-donly");
            } else {
                itemEl && itemEl.classList.remove("is-donly");
            }

            // Recompute the comma-separated value from all checked boxes in this list.
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

        return format_admin_setting($this, $this->visiblename, $html, $this->description, false, '', null, $query);
    }
}
