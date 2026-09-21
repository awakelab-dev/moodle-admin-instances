<?php
namespace local_courseprogressnotify\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_courseprogressnotify\email_builder;
use local_courseprogressnotify\notification_log;
use local_courseprogressnotify\presential_provider;

/**
 * Task to notify users before presential sessions (exam/tutoring).
 * 
 * This task scans calendar events to detect presential sessions based on:
 * - Location field being populated
 * - "Presencial" keyword in title/description
 * Then classifies them as exam or tutoring based on keywords.
 */
class check_presential_sessions extends scheduled_task {

    /** @var int When > 0, only process this specific course ID. */
    protected $targetcourseid = 0;

    public function set_target_course_id(int $id): void {
        $this->targetcourseid = $id;
    }

    public function get_name() {
        return get_string('task_check_presential_sessions', 'local_courseprogressnotify');
    }

    public function execute() {
        global $DB;
        mtrace('Running task: presential sessions (calendar-based detection)');

        $days = (int)get_config('local_courseprogressnotify', 'presentialdaysbefore');
        if ($days <= 0) { $days = 2; }

        $customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');
        
        if (empty($customfieldshortname)) {
            mtrace('No custom field configured; skipping.');
            return;
        }
        
        mtrace("Using custom field: {$customfieldshortname}");

        // Time window: N days from now (midnight to midnight)
        $now = time();
        $from = usergetmidnight($now + ($days * DAYSECS));
        $to   = $from + DAYSECS;

        mtrace("Checking presential events {$days} days ahead: " . userdate($from, '%Y-%m-%d') . " to " . userdate($to, '%Y-%m-%d'));

        // Get all visible courses
        $courses = $DB->get_records('course', ['visible' => 1]);
        
        // Filter courses based on custom field
        $courses = array_filter($courses, function($course) use ($customfieldshortname) {
            return $this->is_course_enabled($course->id, $customfieldshortname);
        });
        
        // Filter to a single target course if executing per-course from the run page.
        if ($this->targetcourseid > 0) {
            $courses = array_filter($courses, fn($c) => (int)$c->id === $this->targetcourseid);
            if (empty($courses)) {
                mtrace("  Target course ID {$this->targetcourseid} not found among enabled courses.");
                return;
            }
            mtrace("  Targeting single course ID: {$this->targetcourseid}");
        }

        $totalevents = 0;
        $totalnotifs = 0;

        // Filter out diploma-only courses (they should only receive the diploma email).
        $diplomaonlyids = notification_log::get_diploma_only_course_ids();

        foreach ($courses as $course) {
            // Skip diploma-only courses.
            if (!empty($diplomaonlyids) && in_array((int)$course->id, $diplomaonlyids, true)) {
                mtrace("  [DIPLOMA-ONLY] Skipping {$course->fullname} — configured to only receive diploma email.");
                continue;
            }

            // Get presential events for this course using smart detection
            $presentialevents = presential_provider::get_presential_events($course->id, $from, $to);
            
            if (empty($presentialevents)) {
                continue;
            }

            mtrace("  Course: {$course->fullname} - Found " . count($presentialevents) . " presential event(s)");
            $totalevents += count($presentialevents);

            // Get enrolled students
            $students = $this->get_course_students($course->id);
            if (empty($students)) {
                mtrace("    No students enrolled, skipping.");
                continue;
            }

            foreach ($presentialevents as $event) {
                $typekey = $event['type']; // 'exam' or 'tutoring'
                $notiftype = 'presential_' . $typekey;
                
                mtrace("    Event: {$event['name']} (Type: {$typekey}, Location: {$event['location']})");

                foreach ($students as $user) {
                    // Check if already notified (use event ID as entity)
                    if (notification_log::has_sent($user->id, $course->id, $notiftype, $event['id'])) {
                        continue;
                    }

                    // Prepare placeholders for email
                    $datefmt = get_string('strftimedate', 'langconfig');
                    $timefmt = get_string('strftimetime', 'langconfig');
                    $usertz = \core_date::get_user_timezone($user);

                    $placeholders = [
                        $typekey . '_location' => s($event['location']),
                        $typekey . '_date' => userdate($event['timestart'], $datefmt, $usertz),
                        $typekey . '_start' => userdate($event['timestart'], $timefmt, $usertz),
                        $typekey . '_end' => userdate($event['timeend'], $timefmt, $usertz),
                    ];

                    email_builder::send($user, $course, $typekey, $placeholders, $notiftype, $event['id']);
                    $totalnotifs++;
                }
            }
        }

        mtrace("Presential sessions check complete. Events found: {$totalevents}, Notifications sent: {$totalnotifs}");
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
