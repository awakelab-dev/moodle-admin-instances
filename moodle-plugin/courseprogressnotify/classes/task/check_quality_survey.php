<?php
namespace local_courseprogressnotify\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_courseprogressnotify\email_builder;
use local_courseprogressnotify\notification_log;
use local_courseprogressnotify\insights_client;

/**
 * Tarea de "Encuesta de calidad de curso" (trigger 'quality_survey'): manda
 * el link de una encuesta externa (Typeform/Google Form, params.surveyUrl)
 * el día de inicio del curso y los (params.daysCount - 1) días siguientes.
 * A diferencia de first_day/second_day (un único disparo), esta tarea
 * reparte el envío en varios días — cada día se deduplica por separado con
 * su propia clave ("quality_survey_day{N}") en notification_log.
 */
class check_quality_survey extends scheduled_task {

    /** @var int When > 0, only process this specific course ID. */
    protected $targetcourseid = 0;

    public function set_target_course_id(int $id): void {
        $this->targetcourseid = $id;
    }

    public function get_name() {
        return get_string('task_check_quality_survey', 'local_courseprogressnotify');
    }

    public function execute() {
        global $DB;

        mtrace('Running task: quality survey notification');

        $config = insights_client::get_config();
        if (empty($config['quality_survey']['template'])) {
            mtrace('✗ Sin plantilla configurada en Moodle Insights para "quality_survey"; no se enviará ningún email.');
            return;
        }
        $template = $config['quality_survey']['template'];
        $params = $config['quality_survey']['params'] ?? [];
        $surveyurl = trim((string)($params['surveyUrl'] ?? ''));
        $dayscount = max(1, (int)($params['daysCount'] ?? 5));

        if ($surveyurl === '') {
            mtrace('✗ Sin "surveyUrl" configurada en el disparador "quality_survey"; no se enviará ningún email.');
            return;
        }

        $customfieldshortname = insights_client::get_settings()['courseCustomFieldShortname'] ?? '';
        if (empty($customfieldshortname)) {
            mtrace('No custom field configured; skipping.');
            return;
        }

        mtrace("Using custom field: {$customfieldshortname}");
        mtrace("Survey URL: {$surveyurl} — días de envío: {$dayscount}");

        $now = time();
        $todaymidnight = usergetmidnight($now);
        // Cualquier curso cuyo día 0 (startdate) caiga dentro de los últimos
        // (daysCount - 1) días, incluyendo hoy, puede tener un día pendiente hoy.
        $windowstart = $todaymidnight - ($dayscount - 1) * DAYSECS;
        $windowend = $todaymidnight + DAYSECS;

        mtrace("Time window : " . userdate($windowstart, '%Y-%m-%d %H:%M:%S') . " → " . userdate($windowend, '%Y-%m-%d %H:%M:%S'));

        $courses = $DB->get_records_select('course',
            'visible = 1 AND startdate >= :from AND startdate < :to',
            ['from' => $windowstart, 'to' => $windowend]
        );

        mtrace('  Visible courses in window (before custom field filter): ' . count($courses));

        if (empty($courses)) {
            mtrace('  No courses within the quality-survey window.');
            return;
        }

        $enabled = [];
        foreach ($courses as $course) {
            if ($this->is_course_enabled($course->id, $customfieldshortname)) {
                $enabled[] = $course;
            } else {
                mtrace("  [SKIPPED]  {$course->fullname} — custom field '{$customfieldshortname}' not set or not enabled");
            }
        }
        $courses = $enabled;

        if ($this->targetcourseid > 0) {
            $courses = array_filter($courses, fn($c) => (int)$c->id === $this->targetcourseid);
        }

        if (empty($courses)) {
            mtrace('  No enabled courses to process.');
            return;
        }

        $totalnotifs = 0;
        $results = [];

        foreach ($courses as $course) {
            $coursemidnight = usergetmidnight($course->startdate);
            $dayindex = (int)round(($todaymidnight - $coursemidnight) / DAYSECS);
            if ($dayindex < 0 || $dayindex >= $dayscount) {
                continue;
            }

            mtrace("  Course: {$course->fullname} (día {$dayindex} de {$dayscount})");

            $students = $this->get_course_students($course->id);
            if (empty($students)) {
                mtrace("    No students found.");
                continue;
            }

            $notificationtype = "quality_survey_day{$dayindex}";
            $placeholders = [
                'survey_link' => '<a href="' . s($surveyurl) . '">' . s($surveyurl) . '</a>',
            ];

            $notified = 0;
            foreach ($students as $user) {
                $sent = email_builder::send_from_template($user, $course, $template, $placeholders, $notificationtype);
                $results[] = [
                    'trigger' => 'quality_survey',
                    'courseId' => (int)$course->id,
                    'userId' => (int)$user->id,
                    'entityId' => (string)$dayindex,
                    'success' => $sent,
                ];
                if ($sent) {
                    $notified++;
                    $totalnotifs++;
                }
            }

            mtrace("    Notified: {$notified}");
        }

        insights_client::report_log($results);
        mtrace("Quality survey check complete. Total notifications sent: {$totalnotifs}");
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

    private function is_course_enabled($courseid, $customfieldshortname) {
        global $DB;

        $field = $DB->get_record('customfield_field', ['shortname' => $customfieldshortname]);
        if (!$field) {
            return false;
        }

        $data = $DB->get_record('customfield_data', [
            'fieldid' => $field->id,
            'instanceid' => $courseid,
        ]);

        return $data && $data->value == 1;
    }
}
