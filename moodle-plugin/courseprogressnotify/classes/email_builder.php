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
     * Render and send an email to a user based on email key prefix.
     * It will read strings 'email_{$key}_subject' and 'email_{$key}_body'.
     *
     * @param \stdClass $user Recipient user
     * @param \stdClass $course Course
     * @param string $key Email key, e.g. '25', '50', 'end_soon', 'last_day', 'zoom', 'exam', 'tutoring', 'diploma'
     * @param array $placeholders Placeholder mapping
     * @param string $notificationtype Type for the log table
     * @param int|null $entityid Optional related entity id for de-duplication (e.g., zoom id, session id)
     * @return bool
     */
    public static function send(\stdClass $user, \stdClass $course, string $key, array $placeholders,
                                string $notificationtype, ?int $entityid = null): bool {
        global $CFG;
        require_once($CFG->libdir . '/weblib.php');

        // Debug: Log attempt
        mtrace("  → Checking notification for user {$user->id} ({$user->email}), type: {$notificationtype}");

        if (notification_log::has_sent($user->id, $course->id, $notificationtype, $entityid)) {
            mtrace("    ✓ Already sent (skipping)");
            return false; // Already sent.
        }

        // Verify user has valid email
        if (empty($user->email) || !validate_email($user->email)) {
            mtrace("    ✗ Invalid or missing email address: {$user->email}");
            return false;
        }

        // Check if combined email setting is enabled
        $sendcombined = get_config('local_courseprogressnotify', 'send_combined_email');

        if ($sendcombined) {
            // Send combined Spanish and Catalan email
            return self::send_combined_email($user, $course, $key, $placeholders, $notificationtype, $entityid);
        }

        // Original behavior: use user's preferred language
        $lang = empty($user->lang) ? current_language() : $user->lang;
        $reset = force_current_language($lang);

        try {
            // Ensure basic placeholders exist.
            $placeholders['firstname'] = $placeholders['firstname'] ?? $user->firstname;
            $placeholders['lastname']  = $placeholders['lastname'] ?? $user->lastname;
            $placeholders['coursename'] = $placeholders['coursename'] ?? format_string($course->fullname, true, ['context' => \context_course::instance($course->id)]);
            $placeholders['campus_url'] = $placeholders['campus_url'] ?? (new moodle_url('/'))->out(false);

            $subjectkey = 'email_' . $key . '_subject';
            $bodykey    = 'email_' . $key . '_body';

            $subjecttpl = get_string($subjectkey, 'local_courseprogressnotify');
            $bodyhtmltpl = get_string($bodykey, 'local_courseprogressnotify');

            // Replace placeholders in templates.
            $subject = self::replace_placeholders($subjecttpl, $placeholders);
            $bodyhtml = self::replace_placeholders($bodyhtmltpl, $placeholders);

            // Build plain text fallback by stripping tags.
            $bodytext = html_to_text($bodyhtml);

            $from = \core_user::get_support_user();
            
            mtrace("    → Sending email: {$subject}");
            $sent = email_to_user($user, $from, $subject, $bodytext, $bodyhtml);

            force_current_language($reset); // Restore previous language.

            if ($sent) {
                notification_log::log_sent($user->id, $course->id, $notificationtype, $entityid);
                mtrace("    ✓ Email sent successfully");
            } else {
                mtrace("    ✗ email_to_user() returned false - check Moodle email configuration");
            }
            return $sent;
        } catch (\Throwable $e) {
            force_current_language($reset);
            mtrace("    ✗ Exception: " . $e->getMessage());
            return false;
        }
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

    /**
     * Send combined Spanish and Catalan email.
     *
     * @param \stdClass $user Recipient user
     * @param \stdClass $course Course
     * @param string $key Email key
     * @param array $placeholders Placeholder mapping
     * @param string $notificationtype Type for the log table
     * @param int|null $entityid Optional related entity id
     * @return bool
     */
    private static function send_combined_email(\stdClass $user, \stdClass $course, string $key, array $placeholders,
                                               string $notificationtype, ?int $entityid = null): bool {
        global $CFG;

        // Ensure basic placeholders exist.
        $placeholders['firstname'] = $placeholders['firstname'] ?? $user->firstname;
        $placeholders['lastname']  = $placeholders['lastname'] ?? $user->lastname;
        $placeholders['coursename'] = $placeholders['coursename'] ?? format_string($course->fullname, true, ['context' => \context_course::instance($course->id)]);
        $placeholders['campus_url'] = $placeholders['campus_url'] ?? (new moodle_url('/'))->out(false);

        $subjectkey = 'email_' . $key . '_subject';
        $bodykey    = 'email_' . $key . '_body';

        // Load strings directly from our plugin's language files.
        $stringses = self::load_lang_strings('es');
        $stringsca = self::load_lang_strings('ca');

        $subjectes = $stringses[$subjectkey] ?? '';
        $bodyhtmles = $stringses[$bodykey] ?? '';
        $subjectca = $stringsca[$subjectkey] ?? '';
        $bodyhtmlca = $stringsca[$bodykey] ?? '';

        // Replace placeholders in both versions
        $subjectes = self::replace_placeholders($subjectes, $placeholders);
        $bodyhtmles = self::replace_placeholders($bodyhtmles, $placeholders);
        $subjectca = self::replace_placeholders($subjectca, $placeholders);
        $bodyhtmlca = self::replace_placeholders($bodyhtmlca, $placeholders);

        // Use Spanish subject (or combine both if needed)
        $subject = $subjectes;

        // Combine both bodies with a clear separator
        $separator = '<hr style="margin: 30px 0; border: 2px solid #0066cc;" />';
        $bodyhtml = $bodyhtmles . $separator . $bodyhtmlca;

        // Build plain text fallback
        $bodytext = html_to_text($bodyhtmles) . "\n\n" . str_repeat('-', 50) . "\n\n" . html_to_text($bodyhtmlca);

        $from = \core_user::get_support_user();
        
        mtrace("    → Sending combined email: {$subject}");
        $sent = email_to_user($user, $from, $subject, $bodytext, $bodyhtml);

        if ($sent) {
            notification_log::log_sent($user->id, $course->id, $notificationtype, $entityid);
            mtrace("    ✓ Combined email sent successfully");
        } else {
            mtrace("    ✗ email_to_user() returned false - check Moodle email configuration");
        }
        return $sent;
    }

    /**
     * Load language strings directly from the plugin's lang file.
     *
     * @param string $lang Language code ('es', 'ca', 'en')
     * @return array The $string array from the language file
     */
    private static function load_lang_strings(string $lang): array {
        $langfile = __DIR__ . '/../lang/' . $lang . '/local_courseprogressnotify.php';
        if (!file_exists($langfile)) {
            return [];
        }
        $string = [];
        include($langfile);
        return $string;
    }
}
