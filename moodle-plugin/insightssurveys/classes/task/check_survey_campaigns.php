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

namespace local_insightssurveys\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_insightssurveys\survey_mailer;
use local_insightssurveys\insights_client;

class check_survey_campaigns extends scheduled_task {

    protected $targetcourseid = 0;

    public function set_target_course_id(int $id): void {
        $this->targetcourseid = $id;
    }

    public function get_name() {
        return get_string('task_check_survey_campaigns', 'local_insightssurveys');
    }

    public function execute() {
        mtrace('Running task: survey campaigns');
        $campaigns = insights_client::get_due_survey_campaigns();
        if (empty($campaigns)) {
            mtrace('  No hay campañas de encuesta pendientes hoy.');
            return;
        }
        mtrace('  Campañas pendientes: ' . count($campaigns));

        $results = [];
        $totalsent = 0;

        foreach ($campaigns as $campaign) {
            $campaignid = (string)($campaign['campaignId'] ?? '');
            $dayindex = (int)($campaign['dayIndex'] ?? 0);
            $surveyurl = (string)($campaign['surveyUrl'] ?? '');
            $template = (string)($campaign['messageTemplate'] ?? '');
            $recipientsource = (string)($campaign['recipientSource'] ?? 'manual');
            $campaigncourseid = $campaign['courseId'] ?? null;

            if ($this->targetcourseid > 0 && (int)$campaigncourseid !== $this->targetcourseid) {
                continue;
            }

            mtrace("  Campaña {$campaignid} (día {$dayindex}, fuente: {$recipientsource})");

            $recipients = $this->resolve_recipients($recipientsource, $campaign);
            if (empty($recipients)) {
                mtrace('    Sin destinatarios resueltos.');
                continue;
            }

            $notificationtype = "survey_{$campaignid}_day{$dayindex}";
            $courseidforlog = (int)($campaigncourseid ?? 0);

            foreach ($recipients as $user) {
                $name = trim(($user->firstname ?? '') . ' ' . ($user->lastname ?? '')) ?: $user->email;
                $body = $this->replace_placeholders($template, [
                    'nombre' => s($name),
                    'link' => '<a href="' . s($surveyurl) . '">' . s($surveyurl) . '</a>',
                ]);
                $bodyhtml = nl2br($body);
                $subject = get_string('survey_email_subject', 'local_insightssurveys');

                $sent = survey_mailer::send($user, $subject, $bodyhtml, $notificationtype, $courseidforlog);

                $results[] = [
                    'campaignId' => $campaignid,
                    'dayIndex' => $dayindex,
                    'recipientEmail' => $user->email,
                    'moodleUserId' => (int)$user->id,
                    'success' => $sent,
                ];
                if ($sent) {
                    $totalsent++;
                }
            }
        }

        insights_client::report_survey_log($results);
        mtrace("Survey campaigns check complete. Total enviados: {$totalsent}");
    }

    protected function resolve_recipients(string $recipientsource, array $campaign): array {
        global $DB;

        if ($recipientsource === 'course_enrollment') {
            $courseid = (int)($campaign['courseId'] ?? 0);
            if ($courseid <= 0) {
                return [];
            }
            return array_values($this->get_course_students($courseid));
        }

        $emails = is_array($campaign['manualRecipients'] ?? null) ? $campaign['manualRecipients'] : [];
        $users = [];
        foreach ($emails as $email) {
            $email = trim((string)$email);
            if ($email === '') {
                continue;
            }
            $user = $DB->get_record('user', ['email' => $email, 'deleted' => 0, 'suspended' => 0], '*', IGNORE_MULTIPLE);
            if ($user) {
                $users[] = $user;
            } else {
                mtrace("    ✗ No existe ningún usuario con email {$email} en esta plataforma.");
            }
        }
        return $users;
    }

    protected function get_course_students(int $courseid): array {
        global $DB;
        $sql = "SELECT DISTINCT u.* FROM {user} u
                  JOIN {user_enrolments} ue ON ue.userid = u.id AND ue.status = 0
                  JOIN {enrol} e ON e.id = ue.enrolid AND e.courseid = :courseid AND e.status = 0
                  JOIN {role_assignments} ra ON ra.userid = u.id
                  JOIN {role} r ON r.id = ra.roleid AND r.archetype = 'student'
                  JOIN {context} ctx ON ctx.id = ra.contextid AND ctx.contextlevel = :ctxlevel AND ctx.instanceid = :courseid2
                 WHERE u.deleted = 0 AND u.suspended = 0";
        $params = ['courseid' => $courseid, 'courseid2' => $courseid, 'ctxlevel' => CONTEXT_COURSE];
        return $DB->get_records_sql($sql, $params);
    }

    protected function replace_placeholders(string $template, array $values): string {
        $replacements = [];
        foreach ($values as $k => $v) {
            $replacements['{{' . $k . '}}'] = (string)$v;
        }
        return strtr($template, $replacements);
    }
}
