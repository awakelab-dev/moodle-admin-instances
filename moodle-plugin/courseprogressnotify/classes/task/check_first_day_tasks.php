<?php
namespace local_courseprogressnotify\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_courseprogressnotify\email_builder;
use local_courseprogressnotify\notification_log;

/**
 * Task to notify users on the first day of course about initial tasks.
 */
class check_first_day_tasks extends scheduled_task {

    /** @var bool When true, skip date-window restrictions (manual override). */
    protected $ignoredaterestrictions = false;

    /** @var int When > 0, only process this specific course ID. */
    protected $targetcourseid = 0;

    /**
     * Enable or disable date restriction bypass for manual/forced execution.
     */
    public function set_ignore_date_restrictions(bool $value): void {
        $this->ignoredaterestrictions = $value;
    }

    /**
     * Restrict execution to a single course (used by per-course send from settings).
     */
    public function set_target_course_id(int $id): void {
        $this->targetcourseid = $id;
    }

    public function get_name() {
        return get_string('task_check_first_day_tasks', 'local_courseprogressnotify');
    }

    public function execute() {
        global $DB, $CFG;
        
        mtrace('Running task: first day tasks notification');
        
        $customfieldshortname = get_config('local_courseprogressnotify', 'customfield_shortname');
        
        if (empty($customfieldshortname)) {
            mtrace('No custom field configured; skipping.');
            return;
        }
        
        mtrace("Using custom field: {$customfieldshortname}");

        $now = time();

        if ($this->ignoredaterestrictions) {
            // Manual override: process ALL enabled courses regardless of start date.
            mtrace('⚠ Date restrictions IGNORED — processing all enabled visible courses.');
            $allcourses = $DB->get_records('course', ['visible' => 1]);
            $enabled = [];
            foreach ($allcourses as $c) {
                if ($this->is_course_enabled($c->id, $customfieldshortname)) {
                    $enabled[] = $c;
                }
            }
            $courses = $enabled;
            mtrace('  Found ' . count($courses) . ' enabled course(s) (date restrictions ignored).');
            if (empty($courses)) {
                mtrace('  No enabled courses found.');
                return;
            }
        } else {
            // Look back 1 extra day so that courses configured after the 9:00 AM cron on their start date
            // are still caught on the following run. The notification_log dedup prevents double-sends.
            $windowstart = usergetmidnight($now) - DAYSECS; // yesterday midnight
            $windowend   = usergetmidnight($now) + DAYSECS; // tomorrow midnight

            mtrace("Time window : " . userdate($windowstart, '%Y-%m-%d %H:%M:%S') . " → " . userdate($windowend, '%Y-%m-%d %H:%M:%S') . " (2-day window)");
            mtrace("Timestamps  : {$windowstart} → {$windowend}");
            mtrace("Server time : " . date('Y-m-d H:i:s T', $now));

            // Courses that started within the 2-day window and have not yet been notified.
            $courses = $DB->get_records_select('course',
                'visible = 1 AND startdate >= :from AND startdate < :to',
                [
                    'from' => $windowstart,
                    'to'   => $windowend,
                ]
            );

            mtrace('  Visible courses in window (before custom field filter): ' . count($courses));

            if (empty($courses)) {
                // Also check if there are courses in the window but hidden, to help diagnose visibility issues.
                $hiddencourses = $DB->get_records_select('course',
                    'visible = 0 AND startdate >= :from AND startdate < :to',
                    ['from' => $windowstart, 'to' => $windowend]
                );
                if (!empty($hiddencourses)) {
                    mtrace('  NOTE: ' . count($hiddencourses) . ' hidden (visible=0) course(s) were skipped: '
                        . implode(', ', array_column($hiddencourses, 'fullname')));
                }
                mtrace('  No visible courses starting today or yesterday.');
                return;
            }

            // Filter courses based on custom field, logging reason for each exclusion.
            $enabled = [];
            foreach ($courses as $course) {
                $startreadable = userdate($course->startdate, '%Y-%m-%d %H:%M:%S');
                if ($this->is_course_enabled($course->id, $customfieldshortname)) {
                    mtrace("  [ENABLED]  {$course->fullname} (startdate: {$startreadable} / {$course->startdate})");
                    $enabled[] = $course;
                } else {
                    mtrace("  [SKIPPED]  {$course->fullname} (startdate: {$startreadable} / {$course->startdate}) — custom field '{$customfieldshortname}' not set or not enabled");
                }
            }
            $courses = $enabled;

            if (empty($courses)) {
                mtrace('  Courses start today but none have notifications enabled (check the custom field setting).');
                return;
            }
        }

        // Filter out diploma-only courses (they should only receive the diploma email).
        $diplomaonlyids = notification_log::get_diploma_only_course_ids();
        if (!empty($diplomaonlyids)) {
            $courses = array_filter($courses, function($c) use ($diplomaonlyids) {
                if (in_array((int)$c->id, $diplomaonlyids, true)) {
                    mtrace("  [DIPLOMA-ONLY] Skipping {$c->fullname} — configured to only receive diploma email.");
                    return false;
                }
                return true;
            });
        }

        // Filter to a single target course if executing per-course from settings.
        if ($this->targetcourseid > 0) {
            $courses = array_filter($courses, fn($c) => (int)$c->id === $this->targetcourseid);
            if (empty($courses)) {
                mtrace("  Target course ID {$this->targetcourseid} not found among enabled courses.");
                return;
            }
            mtrace("  Targeting single course ID: {$this->targetcourseid}");
        }

        if (empty($courses)) {
            mtrace('  No courses to process after diploma-only filter.');
            return;
        }

        $totalnotifs = 0;
        
        foreach ($courses as $course) {
            mtrace("  Course: {$course->fullname} (starts: " . userdate($course->startdate, '%Y-%m-%d') . ")");
            
            $students = $this->get_course_students($course->id);
            if (empty($students)) {
                mtrace("    No students found.");
                continue;
            }
            
            $notified = 0;
            
            foreach ($students as $user) {
                if (notification_log::has_sent($user->id, $course->id, 'first_day_tasks')) {
                    mtrace("    ✓ Already sent to {$user->firstname} {$user->lastname} ({$user->email}) - skipping");
                    continue;
                }
                
                // Generate image URLs (all screenshots are in Catalan)
                $imgdocurl = new \moodle_url('/local/courseprogressnotify/pix/email_documentation_location.png');
                $imgtuturl = new \moodle_url('/local/courseprogressnotify/pix/email_tutorial_video.png');
                
                $placeholders = [
                    'image_documentation' => $imgdocurl->out(false),
                    'image_tutorial' => $imgtuturl->out(false),
                ];
                
                $sent = email_builder::send($user, $course, 'first_day', $placeholders, 'first_day_tasks');
                if ($sent) {
                    $notified++;
                    $totalnotifs++;
                }
            }
            
            mtrace("    Notified: {$notified}");
        }
        
        mtrace("First day tasks check complete. Total notifications sent: {$totalnotifs}");
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
