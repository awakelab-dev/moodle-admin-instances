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

use moodle_url;

/**
 * Builds and sends localized HTML emails with plain text fallback.
 *
 * @package   local_courseprogressnotify
 */
class email_builder {

    /**
     * Construye y envía un email con el asunto/cuerpo YA resueltos desde
     * Moodle Insights (ver insights_client::get_config()) — la plantilla
     * viene en un único idioma concreto (template['language']), elegido
     * desde el dashboard; no hay modo "combinado es+ca" ni selección de
     * idioma preferido del usuario aquí, eso quedó en el dashboard.
     *
     * @param \stdClass $user Recipient user
     * @param \stdClass $course Course
     * @param array $template ['language'=>string,'subject'=>string,'bodyHtml'=>string]
     * @param array $placeholders Placeholder mapping
     * @param string $notificationtype Type for the log table
     * @param int|null $entityid Optional related entity id for de-duplication
     * @return bool
     */
    public static function send_from_template(\stdClass $user, \stdClass $course, array $template, array $placeholders,
                                string $notificationtype, ?int $entityid = null): bool {
        global $CFG;
        require_once($CFG->libdir . '/weblib.php');

        mtrace("  → Checking notification for user {$user->id} ({$user->email}), type: {$notificationtype}");

        if (notification_log::has_sent($user->id, $course->id, $notificationtype, $entityid)) {
            mtrace("    ✓ Already sent (skipping)");
            return false;
        }

        if (empty($user->email) || !validate_email($user->email)) {
            mtrace("    ✗ Invalid or missing email address: {$user->email}");
            return false;
        }

        $placeholders['firstname'] = $placeholders['firstname'] ?? $user->firstname;
        $placeholders['lastname']  = $placeholders['lastname'] ?? $user->lastname;
        $placeholders['coursename'] = $placeholders['coursename'] ?? format_string($course->fullname, true, ['context' => \context_course::instance($course->id)]);
        $placeholders['campus_url'] = $placeholders['campus_url'] ?? (new moodle_url('/'))->out(false);

        $subject = self::replace_placeholders((string)($template['subject'] ?? ''), $placeholders);
        $bodyhtml = self::replace_placeholders((string)($template['bodyHtml'] ?? ''), $placeholders);
        $bodytext = html_to_text($bodyhtml);

        $from = \core_user::get_support_user();

        mtrace("    → Sending email (plantilla de Moodle Insights): {$subject}");
        $sent = email_to_user($user, $from, $subject, $bodytext, $bodyhtml);

        if ($sent) {
            notification_log::log_sent($user->id, $course->id, $notificationtype, $entityid);
            mtrace("    ✓ Email sent successfully");
        } else {
            mtrace("    ✗ email_to_user() returned false - check Moodle email configuration");
        }
        return $sent;
    }

    /**
     * Replace {{placeholder}} occurrences with provided values.
     *
     * @param string $template
     * @param array $values
     * @return string
     */
    public static function replace_placeholders(string $template, array $values): string {
        $replacements = [];
        foreach ($values as $k => $v) {
            $replacements['{{' . $k . '}}'] = (string)$v;
        }
        return strtr($template, $replacements);
    }

}
