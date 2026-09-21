<?php
namespace local_courseprogressnotify\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_courseprogressnotify\email_builder;
use local_courseprogressnotify\notification_log;
use local_courseprogressnotify\zoom_provider;

/**
 * Task to notify users X days before Zoom sessions.
 */
class check_zoom_sessions extends scheduled_task {

    /** @var int When > 0, only process this specific course ID. */
    protected $targetcourseid = 0;

    public function set_target_course_id(int $id): void {
        $this->targetcourseid = $id;
    }

    public function get_name() {
        return get_string('task_check_zoom_sessions', 'local_courseprogressnotify');
    }

    public function execute() {
        global $CFG;
        mtrace('Running task: zoom sessions');

        $days = (int)get_config('local_courseprogressnotify', 'zoomdaysbefore');
        if ($days <= 0) { $days = 2; }
        mtrace("Days before setting: {$days}");

        $customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');
        
        if (empty($customfieldshortname)) {
            mtrace('No custom field configured; skipping.');
            return;
        }
        
        mtrace("Using custom field: {$customfieldshortname}");

        $now = time();
        // Window covers exactly the day that is $days ahead.
        $from = usergetmidnight($now + ($days * DAYSECS));
        $to   = $from + DAYSECS;
        mtrace("Looking for Zoom sessions between " . userdate($from, '%Y-%m-%d %H:%M') . " and " . userdate($to, '%Y-%m-%d %H:%M'));

        $sessions = zoom_provider::get_upcoming_between($from, $to);
        mtrace("Found " . count($sessions) . " Zoom sessions in the time window");
        
        if (empty($sessions)) {
            mtrace('No Zoom sessions found in the time window.');
            return;
        }

        $totalnotifs = 0;
        foreach ($sessions as $session) {
            mtrace("\nProcessing Zoom session: {$session->name} (ID: {$session->id})");
            
            $course = get_course($session->course);
            mtrace("  Course: {$course->fullname}");
            
            if ($this->targetcourseid > 0 && (int)$course->id !== $this->targetcourseid) {
                mtrace("  ✗ Skipping (not the target course)");
                continue;
            }

            if (!$this->is_course_enabled($course->id, $customfieldshortname)) {
                mtrace("  ✗ Skipping (not enabled for notifications)");
                continue;
            }

            // Skip diploma-only courses (they should only receive the diploma email).
            $diplomaonlyids = notification_log::get_diploma_only_course_ids();
            if (!empty($diplomaonlyids) && in_array((int)$course->id, $diplomaonlyids, true)) {
                mtrace("  [DIPLOMA-ONLY] Skipping {$course->fullname} — configured to only receive diploma email.");
                continue;
            }
            
            $students = $this->get_course_students($course->id);
            mtrace("  Found " . count($students) . " enrolled students");
            
            if (empty($students)) {
                continue;
            }

            $notified = 0;
            foreach ($students as $user) {
                if (notification_log::has_sent($user->id, $course->id, 'zoom_reminder', $session->id)) {
                    mtrace("    ✓ Already sent to {$user->firstname} {$user->lastname} ({$user->email}) - skipping");
                    continue;
                }
                $datefmt = get_string('strftimedate', 'langconfig');
                $timefmt = get_string('strftimetime', 'langconfig');
                $start = $session->start_time;
                $end = $session->start_time + (int)$session->duration;
                $placeholders = [
                    'zoom_name' => format_string($session->name, true, ['context' => \context_module::instance($session->cmid)]),
                    'zoom_date' => userdate($start, $datefmt, \core_date::get_user_timezone($user)),
                    'zoom_start' => userdate($start, $timefmt, \core_date::get_user_timezone($user)),
                    'zoom_end' => userdate($end, $timefmt, \core_date::get_user_timezone($user)),
                    'zoom_time' => userdate($start, $timefmt, \core_date::get_user_timezone($user)) . ' - ' . userdate($end, $timefmt, \core_date::get_user_timezone($user)),
                    'zoom_link' => (new \moodle_url('/mod/zoom/view.php', ['id' => $session->cmid]))->out(false),
                    'image_zoom_link_es' => (new \moodle_url('/local/courseprogressnotify/pix/updated_es_email_zoom_link_location.png'))->out(false),
                    'image_zoom_link_ca' => (new \moodle_url('/local/courseprogressnotify/pix/updated_ca_email_zoom_link_location.png'))->out(false),
                ];
                email_builder::send($user, $course, 'zoom', $placeholders, 'zoom_reminder', $session->id);
                $notified++;
                $totalnotifs++;
            }
            mtrace("  → Sent {$notified} notifications for this session");
        }
        mtrace("\n✓ Total Zoom notifications sent: {$totalnotifs}");
    }

    protected function get_course_students(int $courseid): array {
        global $DB;
        $sql = "SELECT DISTINCT u.*
                  FROM {user} u
                  JOIN {user_enrolments} ue ON ue.userid = u.id AND ue.status = 0
                  JOIN {enrol} e ON e.id = ue.enrolid AND e.courseid = :courseid AND e.status = 0
                  JOIN {role_assignments} ra ON ra.userid = u.id
                  JOIN {role} r ON r.id = ra.roleid AND r.archetype = 'student'
                  JOIN {context} ctx ON ctx.id = ra.contextid AND ctx.contextlevel = :ctxlevel AND ctx.instanceid = :courseid2
                 WHERE u.deleted = 0 AND u.suspended = 0";
        $params = ['courseid' => $courseid, 'courseid2' => $courseid, 'ctxlevel' => CONTEXT_COURSE];
        return $DB->get_records_sql($sql, $params);
    }

    /**
     * Check if notifications are enabled for a course via custom field.
     * @param int $courseid Course ID
     * @param string $customfieldshortname Custom field shortname from settings
     * @return bool True if notifications should be sent for this course
     */
    private function is_course_enabled($courseid, $customfieldshortname) {
        global $DB;
        
        $field = $DB->get_record('customfield_field', ['shortname' => $customfieldshortname]);
        if (!$field) {
            return false;
        }
        
        $data = $DB->get_record('customfield_data', [
            'fieldid' => $field->id,
            'instanceid' => $courseid
        ]);
        
        return $data && $data->value == 1;
    }
}
