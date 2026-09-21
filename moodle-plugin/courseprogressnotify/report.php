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
 * Activity report page: shows all enabled courses, their notification history,
 * configuration warnings, and presential calendar-event analysis.
 *
 * @package   local_courseprogressnotify
 */

require_once(__DIR__ . '/../../config.php');

use local_courseprogressnotify\course_diagnostics;

require_login();
$context = context_system::instance();
require_capability('local/courseprogressnotify:run', $context);

$url = new moodle_url('/local/courseprogressnotify/report.php');
$PAGE->set_url($url);
$PAGE->set_context($context);
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('report:title', 'local_courseprogressnotify'));
$PAGE->set_heading(get_string('report:title', 'local_courseprogressnotify'));

// Optional filter: 'all' (default) or 'warnings' (only courses with config issues).
$filter = optional_param('filter', 'all', PARAM_ALPHA);

echo $OUTPUT->header();

// ── Guard: custom field must be configured ────────────────────────────────────
$customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');
if (empty($customfieldshortname)) {
    echo $OUTPUT->notification(
        get_string('runpage:nocategory', 'local_courseprogressnotify'),
        \core\output\notification::NOTIFY_WARNING
    );
    echo html_writer::div(
        html_writer::link(
            new moodle_url('/admin/settings.php', ['section' => 'local_courseprogressnotify']),
            get_string('backtosettings', 'local_courseprogressnotify'),
            ['class' => 'btn btn-secondary']
        )
    );
    echo $OUTPUT->footer();
    exit;
}

// ── Load all data (bulk queries) ──────────────────────────────────────────────
$allcourses    = course_diagnostics::get_enabled_courses($customfieldshortname);
$courseids     = array_keys($allcourses);
$alllogs       = course_diagnostics::get_all_logs($courseids);
$enrolledcounts = course_diagnostics::get_all_enrolled_counts($courseids);

if (empty($allcourses)) {
    echo $OUTPUT->notification(
        get_string('report:nocourses', 'local_courseprogressnotify'),
        \core\output\notification::NOTIFY_INFO
    );
    echo html_writer::div(
        html_writer::link(
            new moodle_url('/admin/settings.php', ['section' => 'local_courseprogressnotify']),
            get_string('backtosettings', 'local_courseprogressnotify'),
            ['class' => 'btn btn-secondary']
        )
    );
    echo $OUTPUT->footer();
    exit;
}

// Pre-compute warnings for every course so we can build the summary counts.
$coursewarnings = [];
foreach ($allcourses as $cid => $course) {
    $coursewarnings[$cid] = course_diagnostics::get_date_warnings($course);
}

$totalcourses   = count($allcourses);
$warningcourses = count(array_filter($coursewarnings, fn($w) => !empty($w)));
$totalsent      = count($alllogs) > 0 ? array_sum(array_map('count', $alllogs)) : 0;

// Apply filter.
$displaycourses = $allcourses;
if ($filter === 'warnings') {
    $displaycourses = array_filter($allcourses, fn($c) => !empty($coursewarnings[$c->id]));
}

// ── Inline CSS ────────────────────────────────────────────────────────────────
echo html_writer::tag('style', '
    .cpn-status-sent        { color: #155724; font-weight: 600; }
    .cpn-status-warning     { color: #856404; font-weight: 600; }
    .cpn-status-pending     { color: #004085; }
    .cpn-status-pending_today { color: #0c5460; font-weight: 600; }
    .cpn-status-missed      { color: #721c24; font-weight: 600; }
    .cpn-status-neutral     { color: #6c757d; }
    .cpn-row-sent           { background-color: #d4edda !important; }
    .cpn-row-warning        { background-color: #fff3cd !important; }
    .cpn-row-pending_today  { background-color: #d1ecf1 !important; }
    .cpn-row-missed         { background-color: #f8d7da !important; }
    .cpn-course-card-warning .card-header { background-color: #fff3cd; border-bottom: 2px solid #ffc107; }
    .cpn-course-card-ok     .card-header { background-color: #d4edda; border-bottom: 2px solid #28a745; }
    .cpn-badge-sent         { background-color: #28a745 !important; }
    .cpn-event-ok           { background-color: #d4edda !important; }
    .cpn-event-warning      { background-color: #fff3cd !important; }
    .cpn-event-danger       { background-color: #f8d7da !important; }
    .cpn-keywords           { font-size: 0.85em; color: #6c757d; font-family: monospace; }
    .cpn-section-title      { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; border-bottom: 1px solid #dee2e6; padding-bottom: 0.25rem; }
    .cpn-nav-bar            { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; align-items: center; }
    .cpn-filter-bar         { margin-bottom: 2rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .cpn-card-toggle        { cursor: pointer; user-select: none; }
    .cpn-card-toggle:hover  { opacity: 0.85; }
    .cpn-collapse-arrow     { font-size: 0.8em; transition: transform 0.2s; display: inline-block; margin-left: 0.5rem; color: #6c757d; }
    .cpn-card-toggle.open .cpn-collapse-arrow { transform: rotate(180deg); }
    .cpn-card-body-wrap     { display: none; }
    .cpn-info-table th      { white-space: nowrap; padding-right: 0.75rem; font-weight: 600; border: 0 !important; color: #495057; }
    .cpn-info-table td      { border: 0 !important; padding-right: 2rem; }
');

// ── Summary bar ───────────────────────────────────────────────────────────────
echo html_writer::start_div('cpn-nav-bar');

echo html_writer::link(
    new moodle_url('/admin/settings.php', ['section' => 'local_courseprogressnotify']),
    get_string('backtosettings', 'local_courseprogressnotify'),
    ['class' => 'btn btn-secondary btn-sm']
);
echo html_writer::link(
    new moodle_url('/local/courseprogressnotify/run.php'),
    get_string('runpage:heading', 'local_courseprogressnotify'),
    ['class' => 'btn btn-outline-primary btn-sm']
);

echo html_writer::end_div(); // cpn-nav-bar

// Filter links.
echo html_writer::start_div('cpn-filter-bar');
echo html_writer::tag('strong', get_string('report:filter_label', 'local_courseprogressnotify'));
echo html_writer::link(
    new moodle_url('/local/courseprogressnotify/report.php', ['filter' => 'all']),
    get_string('report:filter_all', 'local_courseprogressnotify', $totalcourses),
    ['class' => 'btn btn-sm ' . ($filter === 'all' ? 'btn-dark' : 'btn-outline-secondary')]
);
echo html_writer::link(
    new moodle_url('/local/courseprogressnotify/report.php', ['filter' => 'warnings']),
    get_string('report:filter_warnings', 'local_courseprogressnotify', $warningcourses),
    ['class' => 'btn btn-sm ' . ($filter === 'warnings' ? 'btn-warning' : 'btn-outline-warning')]
);
echo html_writer::end_div();

if (empty($displaycourses)) {
    echo $OUTPUT->notification(
        get_string('report:no_courses_in_filter', 'local_courseprogressnotify'),
        \core\output\notification::NOTIFY_SUCCESS
    );
    echo $OUTPUT->footer();
    exit;
}

// ── Per-course cards ──────────────────────────────────────────────────────────
foreach ($displaycourses as $course) {
    $cid          = (int)$course->id;
    $warnings     = $coursewarnings[$cid];
    $logs         = $alllogs[$cid] ?? [];
    $studentcount = $enrolledcounts[$cid] ?? 0;
    $haswarnings  = !empty($warnings);

    $cardclass    = $haswarnings ? 'cpn-course-card-warning' : 'cpn-course-card-ok';
    $courseurl    = new moodle_url('/course/view.php', ['id' => $cid]);

    $collapseid = 'cpn-course-' . $cid;
    echo html_writer::start_div('card mb-4 ' . $cardclass);

    // ── Card header (collapse toggle) ────────────────────────────────────
    $warningicon = $haswarnings
        ? ' ' . html_writer::tag('span', '⚠', [
            'class' => 'text-warning ms-1',
            'title' => get_string('report:haswarnings', 'local_courseprogressnotify'),
          ])
        : '';
    $arrowspan = html_writer::tag('span', '▼', ['class' => 'cpn-collapse-arrow']);
    $headertitle = html_writer::tag('h3',
        format_string($course->fullname) . $warningicon . $arrowspan,
        ['class' => 'h5 mb-0']
    );
    echo html_writer::start_div('card-header d-flex justify-content-between align-items-center cpn-card-toggle', [
        'data-cpn-target' => $collapseid,
    ]);
    echo $headertitle;
    echo html_writer::link(
        $courseurl,
        get_string('report:open_course', 'local_courseprogressnotify'),
        ['class' => 'btn btn-sm btn-outline-secondary', 'target' => '_blank', 'onclick' => 'event.stopPropagation();']
    );
    echo html_writer::end_div(); // card-header

    echo html_writer::start_div('cpn-card-body-wrap', ['id' => $collapseid]);
    echo html_writer::start_div('card-body');

    // ── Course info table ─────────────────────────────────────────────────
    $startdatestr = !empty($course->startdate)
        ? userdate($course->startdate, get_string('strftimedate', 'langconfig'))
        : get_string('report:notset', 'local_courseprogressnotify');
    $enddatestr   = (!empty($course->enddate) && $course->enddate > 0)
        ? userdate($course->enddate, get_string('strftimedate', 'langconfig'))
        : get_string('report:notset', 'local_courseprogressnotify');

    $completionbadge = $course->enablecompletion
        ? html_writer::tag('span', get_string('yes'), ['class' => 'badge bg-success'])
        : html_writer::tag('span', get_string('no'),  ['class' => 'badge bg-danger']);

    echo html_writer::start_tag('table', ['class' => 'table table-sm cpn-info-table mb-3']);
    echo html_writer::tag('tr',
        html_writer::tag('th', get_string('report:startdate', 'local_courseprogressnotify')) .
        html_writer::tag('td', $startdatestr) .
        html_writer::tag('th', get_string('report:enddate', 'local_courseprogressnotify')) .
        html_writer::tag('td', $enddatestr) .
        html_writer::tag('th', get_string('report:students', 'local_courseprogressnotify')) .
        html_writer::tag('td', $studentcount) .
        html_writer::tag('th', get_string('report:completion', 'local_courseprogressnotify')) .
        html_writer::tag('td', $completionbadge)
    );
    echo html_writer::end_tag('table');

    // ── Configuration warnings ────────────────────────────────────────────
    if ($haswarnings) {
        echo html_writer::start_div('alert alert-warning mt-3 mb-2');
        echo html_writer::tag('strong', '⚠ ' . get_string('report:warnings', 'local_courseprogressnotify'));
        echo html_writer::start_tag('ul', ['class' => 'mb-0 mt-1']);
        foreach ($warnings as $w) {
            echo html_writer::tag('li', $w);
        }
        echo html_writer::end_tag('ul');
        echo html_writer::end_div();
    }

    // ── Notification history ──────────────────────────────────────────────
    echo html_writer::tag('div', get_string('report:notificationsent', 'local_courseprogressnotify'), ['class' => 'cpn-section-title']);

    $notifdata = course_diagnostics::get_notification_summary($course, $logs, $studentcount);

    echo html_writer::start_tag('table', ['class' => 'table table-sm table-bordered mb-0']);
    echo html_writer::start_tag('thead');
    echo html_writer::tag('tr',
        html_writer::tag('th', get_string('report:notiftype', 'local_courseprogressnotify'))       .
        html_writer::tag('th', get_string('report:sentcount', 'local_courseprogressnotify'), ['class' => 'text-center']) .
        html_writer::tag('th', get_string('report:lastsent', 'local_courseprogressnotify'))        .
        html_writer::tag('th', get_string('report:statusreason', 'local_courseprogressnotify'))
    );
    echo html_writer::end_tag('thead');
    echo html_writer::start_tag('tbody');

    static $statusrowmap = [
        'sent'         => 'cpn-row-sent',
        'warning'      => 'cpn-row-warning',
        'pending'      => '',
        'pending_today'=> 'cpn-row-pending_today',
        'missed'       => 'cpn-row-missed',
        'neutral'      => '',
    ];
    static $statusiconmap = [
        'sent'         => ['icon' => '✓', 'class' => 'cpn-status-sent'],
        'warning'      => ['icon' => '⚠', 'class' => 'cpn-status-warning'],
        'pending'      => ['icon' => '⏳', 'class' => 'cpn-status-pending'],
        'pending_today'=> ['icon' => '▶', 'class' => 'cpn-status-pending_today'],
        'missed'       => ['icon' => '✗', 'class' => 'cpn-status-missed'],
        'neutral'      => ['icon' => '—', 'class' => 'cpn-status-neutral'],
    ];

    foreach ($notifdata as $ntype => $ndata) {
        $status    = $ndata['status'];
        $rowclass  = $statusrowmap[$status]  ?? '';
        $iconinfo  = $statusiconmap[$status] ?? $statusiconmap['neutral'];

        $countbadge = $ndata['sent_count'] > 0
            ? html_writer::tag('span', $ndata['sent_count'], ['class' => 'badge cpn-badge-sent text-white'])
            : '0';

        $lastsent = $ndata['last_sent'] > 0
            ? userdate($ndata['last_sent'], get_string('strftimedatetime', 'langconfig'))
            : '—';

        $statushtml = html_writer::tag('span',
            $iconinfo['icon'] . ' ' . s($ndata['reason']),
            ['class' => $iconinfo['class']]
        );

    echo html_writer::tag('tr',
        html_writer::tag('td', s($ndata['label']))      .
        html_writer::tag('td', $countbadge, ['class' => 'text-center']) .
        html_writer::tag('td', $lastsent)               .
        html_writer::tag('td', $statushtml),
        ['class' => $rowclass]
    );
}

    echo html_writer::end_tag('tbody');
    echo html_writer::end_tag('table');

    // ── First-day diagnostic panel ────────────────────────────────────────
    $diagid    = 'cpn-firstday-diag-' . $cid;
    $diagtime  = time();
    $wstart    = usergetmidnight($diagtime) - DAYSECS;
    $wend      = usergetmidnight($diagtime) + DAYSECS;
    $fdstartdate = (int)$course->startdate;
    $inwindow  = $fdstartdate > 0 && $fdstartdate >= $wstart && $fdstartdate < $wend;

    $diagcontent  = html_writer::start_tag('table', ['class' => 'table table-sm mb-2', 'style' => 'font-size:0.9em;max-width:600px']);
    $diagcontent .= html_writer::tag('tr',
        html_writer::tag('th', get_string('report:firstday_diag_window', 'local_courseprogressnotify'),
            ['style' => 'white-space:nowrap;padding-right:1.5em;border:0;font-weight:600;width:40%']) .
        html_writer::tag('td', userdate($wstart, '%Y-%m-%d') . ' → ' . userdate($wend - 1, '%Y-%m-%d'), ['style' => 'border:0'])
    );
    $diagcontent .= html_writer::tag('tr',
        html_writer::tag('th', get_string('report:firstday_diag_startdate', 'local_courseprogressnotify'),
            ['style' => 'white-space:nowrap;padding-right:1.5em;border:0;font-weight:600']) .
        html_writer::tag('td',
            $fdstartdate > 0
                ? userdate($fdstartdate, '%Y-%m-%d %H:%M:%S') .
                  html_writer::tag('span', ' (' . $fdstartdate . ')', ['class' => 'text-muted ms-2', 'style' => 'font-size:0.85em'])
                : '—',
            ['style' => 'border:0']
        )
    );
    $diagcontent .= html_writer::tag('tr',
        html_writer::tag('th', get_string('report:firstday_diag_inwindow', 'local_courseprogressnotify'),
            ['style' => 'white-space:nowrap;padding-right:1.5em;border:0;font-weight:600']) .
        html_writer::tag('td',
            $inwindow
                ? html_writer::tag('span', '✓ ' . get_string('report:firstday_diag_inwindow_yes', 'local_courseprogressnotify'), ['class' => 'text-success fw-bold'])
                : html_writer::tag('span', '✗ ' . get_string('report:firstday_diag_inwindow_no', 'local_courseprogressnotify'), ['class' => 'text-danger fw-bold']),
            ['style' => 'border:0']
        )
    );
    $diagcontent .= html_writer::end_tag('table');
    $diagcontent .= html_writer::link(
        new moodle_url('/admin/tasklogs.php'),
        get_string('report:firstday_diag_viewlogs', 'local_courseprogressnotify'),
        ['class' => 'btn btn-sm btn-outline-secondary mb-1', 'target' => '_blank']
    );

    $diagpanel = html_writer::tag('div', $diagcontent,
        ['id' => $diagid, 'class' => 'mt-2 p-2', 'style' => 'display:none;background:#f8f9fa;border-radius:4px;border:1px solid #dee2e6']
    );
    $diagtoggle = html_writer::tag('button',
        'ⓘ ' . get_string('report:firstday_diag_toggle', 'local_courseprogressnotify'),
        [
            'type'    => 'button',
            'class'   => 'btn btn-sm btn-outline-info mt-2',
            'data-cpn-diag-target' => $diagid,
        ]
    );
    echo html_writer::tag('div', $diagtoggle . $diagpanel, ['class' => 'mt-1 mb-3']);

    // ── Presential events analysis ────────────────────────────────────────
    $presential = course_diagnostics::analyze_presential_events($cid, $logs);

    echo html_writer::tag('div',
        get_string('report:presentialevents', 'local_courseprogressnotify'),
        ['class' => 'cpn-section-title']
    );

    if (empty($presential['events'])) {
        echo html_writer::tag('p',
            get_string('report:presentialevents_none', 'local_courseprogressnotify'),
            ['class' => 'text-muted mb-0']
        );
    } else {
        echo html_writer::start_tag('table', ['class' => 'table table-sm table-bordered mb-0']);
        echo html_writer::start_tag('thead');
        echo html_writer::tag('tr',
            html_writer::tag('th', get_string('report:eventname', 'local_courseprogressnotify'))     .
            html_writer::tag('th', get_string('report:eventdate', 'local_courseprogressnotify'))     .
            html_writer::tag('th', get_string('report:eventlocation', 'local_courseprogressnotify')) .
            html_writer::tag('th', get_string('report:eventdetected', 'local_courseprogressnotify')) .
            html_writer::tag('th', get_string('report:eventreason', 'local_courseprogressnotify'))
        );
        echo html_writer::end_tag('thead');
        echo html_writer::start_tag('tbody');

        foreach ($presential['events'] as $ev) {
            // Row color.
            if ($ev['detected']) {
                $evrowclass = 'cpn-event-ok';
            } elseif ($ev['detection_reason'] === 'no_keyword_match') {
                $evrowclass = 'cpn-event-warning';
            } else {
                $evrowclass = 'cpn-event-danger';
            }

            // Location cell.
            $locationhtml = !empty(trim($ev['location']))
                ? html_writer::tag('span', s($ev['location']), ['class' => 'text-success'])
                : html_writer::tag('span',
                    '✗ ' . get_string('report:nolocation', 'local_courseprogressnotify'),
                    ['class' => 'text-danger fw-bold']
                  );

            // Detected cell.
            if ($ev['detected']) {
                $detectedhtml = html_writer::tag('span', '✓ ' . s($ev['type']),
                    ['class' => 'badge bg-success text-white']
                );
                if ($ev['notifications_sent'] > 0) {
                    $detectedhtml .= ' ' . html_writer::tag('span',
                        get_string('report:notified_n', 'local_courseprogressnotify', $ev['notifications_sent']),
                        ['class' => 'badge bg-primary text-white']
                    );
                }
            } else {
                $detectedhtml = html_writer::tag('span', '✗ ' . get_string('report:detected_no', 'local_courseprogressnotify'),
                    ['class' => 'text-danger fw-bold']
                );
            }

            // Reason cell.
            $reasonhtml = '—';
            if ($ev['detection_reason'] === 'no_keyword_match') {
                $reasonhtml = html_writer::tag('div',
                    get_string('report:reason_event_nokeyword', 'local_courseprogressnotify'),
                    ['class' => 'cpn-status-warning']
                );
                $reasonhtml .= html_writer::tag('div',
                    get_string('report:current_exam_kw', 'local_courseprogressnotify') . ' ' .
                    html_writer::tag('span', s($ev['exam_keywords']), ['class' => 'cpn-keywords']),
                    ['class' => 'mt-1']
                );
                $reasonhtml .= html_writer::tag('div',
                    get_string('report:current_tutoring_kw', 'local_courseprogressnotify') . ' ' .
                    html_writer::tag('span', s($ev['tutoring_keywords']), ['class' => 'cpn-keywords']),
                    ['class' => 'mt-1']
                );
            } elseif ($ev['detection_reason'] === 'keywords_no_location') {
                $reasonhtml = html_writer::tag('div',
                    get_string('report:reason_event_keywords_no_location', 'local_courseprogressnotify'),
                    ['class' => 'cpn-status-missed']
                );
            } elseif ($ev['detected']) {
                $reasonhtml = html_writer::tag('span',
                    get_string('report:event_will_notify', 'local_courseprogressnotify'),
                    ['class' => 'text-success']
                );
            }

            echo html_writer::tag('tr',
                html_writer::tag('td', s($ev['name']))                        .
                html_writer::tag('td', userdate($ev['timestart'], get_string('strftimedatetime', 'langconfig'))) .
                html_writer::tag('td', $locationhtml)                         .
                html_writer::tag('td', $detectedhtml)                         .
                html_writer::tag('td', $reasonhtml),
                ['class' => $evrowclass]
            );
        }

        echo html_writer::end_tag('tbody');
        echo html_writer::end_tag('table');
    }

    echo html_writer::end_div(); // card-body
    echo html_writer::end_div(); // cpn-card-body-wrap
    echo html_writer::end_div(); // card
}

echo html_writer::tag('script', '
(function() {
    document.querySelectorAll("[data-cpn-diag-target]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var panel = document.getElementById(btn.getAttribute("data-cpn-diag-target"));
            if (!panel) return;
            panel.style.display = panel.style.display === "none" ? "block" : "none";
        });
    });
    document.querySelectorAll(".cpn-card-toggle").forEach(function(header) {
        header.addEventListener("click", function() {
            var targetId = header.getAttribute("data-cpn-target");
            var body = document.getElementById(targetId);
            if (!body) return;
            var isOpen = header.classList.contains("open");
            if (isOpen) {
                body.style.display = "none";
                header.classList.remove("open");
            } else {
                body.style.display = "block";
                header.classList.add("open");
            }
        });
    });
})();
');

echo $OUTPUT->footer();
