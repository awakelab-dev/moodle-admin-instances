<?php
namespace local_courseprogressnotify\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_courseprogressnotify\email_builder;
use local_courseprogressnotify\notification_log;

/**
 * Task to notify users 7 days before course end date.
 */
class check_course_end_soon extends scheduled_task {

    /** @var int When > 0, only process this specific course ID. */
    protected $targetcourseid = 0;

    public function set_target_course_id(int $id): void {
        $this->targetcourseid = $id;
    }

    public function get_name() {
        return get_string('task_check_course_end_soon', 'local_courseprogressnotify');
    }

    public function execute() {
        global $DB;
        mtrace('=== Running task: course end soon (7 days) ===');
        $now = time();

        $customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');
        
        if (empty($customfieldshortname)) {
            mtrace('✗ No custom field configured; skipping.');
            return;
        }
        
        mtrace("✓ Using custom field: {$customfieldshortname}");

        $courses = $DB->get_records_select('course', 'visible = 1 AND enddate > 0', []);
        
        // Filter courses based on custom field
        $courses = array_filter($courses, function($course) use ($customfieldshortname) {
            return $this->is_course_enabled($course->id, $customfieldshortname);
        });
        $coursecount = count($courses);
        mtrace("Found {$coursecount} course(s) with end dates and notifications enabled");

        // Filter to a single target course if executing per-course from the run page.
        if ($this->targetcourseid > 0) {
            $courses = array_filter($courses, fn($c) => (int)$c->id === $this->targetcourseid);
            if (empty($courses)) {
                mtrace("  Target course ID {$this->targetcourseid} not found among enabled courses.");
                return;
            }
            mtrace("  Targeting single course ID: {$this->targetcourseid}");
        }

        $processedcount = 0;
        $sentcount = 0;

        // Filter out diploma-only courses (they should only receive the diploma email).
        $diplomaonlyids = notification_log::get_diploma_only_course_ids();
        
        foreach ($courses as $course) {
            // Skip diploma-only courses.
            if (!empty($diplomaonlyids) && in_array((int)$course->id, $diplomaonlyids, true)) {
                mtrace("  [DIPLOMA-ONLY] Skipping {$course->fullname} — configured to only receive diploma email.");
                continue;
            }

            $days = (int)floor(($course->enddate - $now) / DAYSECS);
            mtrace("\nCourse {$course->id} ({$course->fullname}): ends in {$days} days (" . userdate($course->enddate) . ")");
            
            if ($days !== 7) { // Send only exactly 7 days before.
                mtrace("  \u2192 Not exactly 7 days away, skipping");
                continue;
            }
            
            mtrace("  \u2713 Exactly 7 days before end date!");
            $students = $this->get_course_students($course->id);
            $studentcount = count($students);
            mtrace("  Found {$studentcount} enrolled student(s)");
            
            foreach ($students as $user) {
                $processedcount++;
                if (notification_log::has_sent($user->id, $course->id, 'course_end_soon')) {
                    mtrace("  User {$user->id} ({$user->email}): already notified");
                    continue;
                }
                $placeholders = [
                    'courseenddate' => $this->format_date_for_user($user, $course->enddate),
                ];
                $result = email_builder::send($user, $course, 'end_soon', $placeholders, 'course_end_soon');
                if ($result) {
                    $sentcount++;
                }
            }
        }
        
        mtrace("\n=== Summary: Processed {$processedcount} student(s), sent {$sentcount} email(s) ===");
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

    protected function format_date_for_user(\stdClass $user, int $timestamp): string {
        if (empty($timestamp)) { return ''; }
        $defaulttz = \core_date::get_user_timezone($user);
        return userdate($timestamp, get_string('strftimedatetime', 'langconfig'), $defaulttz);
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
