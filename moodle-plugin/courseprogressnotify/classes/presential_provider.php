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
 * Helper class to detect and classify presential sessions from calendar events.
 *
 * @package    local_courseprogressnotify
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class presential_provider {

    /**
     * Check if a calendar event is a presential event.
     *
     * An event is considered presential if:
     * - The location field is populated, OR
     * - The word "presencial" appears in name or description
     *
     * @param \calendar_event $event The calendar event object
     * @return bool True if event is presential
     */
    public static function is_presential(\calendar_event $event): bool {
        // Check if location is set and not empty
        if (!empty($event->location)) {
            return true;
        }

        // Check for "presencial" in name or description (case-insensitive)
        $searchtext = strtolower($event->name . ' ' . $event->description);
        
        // Match "presencial" with common variations
        if (preg_match('/presencial/ui', $searchtext)) {
            return true;
        }

        return false;
    }

    /**
     * Determine the type of presential event (exam or tutoring).
     *
     * Keywords are loaded from plugin settings (configurable by administrators).
     * Matching is case-insensitive and accent-insensitive.
     *
     * @param \calendar_event $event The calendar event object
     * @return string|null 'exam', 'tutoring', or null if type cannot be determined
     */
    public static function get_presential_type(\calendar_event $event): ?string {
        $searchtext = strtolower($event->name . ' ' . $event->description);

        // Remove accents for more flexible matching
        $searchtext = self::remove_accents($searchtext);

        // Load keywords from config (falls back to defaults if not set)
        $examkeywords = self::get_keywords_from_config(
            'presential_exam_keywords',
            "examen\nexam\nevaluacion\nprueba"
        );
        $tutoringkeywords = self::get_keywords_from_config(
            'presential_tutoring_keywords',
            "tutoria\ntuto\nasesoria\nconsulta\nsesion\nsessio"
        );

        // Check for exam keywords
        if (!empty($examkeywords)) {
            $pattern = '/\b(' . implode('|', array_map('preg_quote', $examkeywords)) . ')\b/ui';
            if (preg_match($pattern, $searchtext)) {
                return 'exam';
            }
        }

        // Check for tutoring / session keywords
        if (!empty($tutoringkeywords)) {
            $pattern = '/\b(' . implode('|', array_map('preg_quote', $tutoringkeywords)) . ')\b/ui';
            if (preg_match($pattern, $searchtext)) {
                return 'tutoring';
            }
        }

        // If we can't determine, return null
        return null;
    }

    /**
     * Parse a keyword list from plugin config.
     *
     * Each keyword is stored on its own line (newlines are the separator;
     * commas are also accepted).  Accents are stripped so that, for example,
     * "sessió" stored in config correctly matches "sessio" in a calendar event.
     *
     * @param string $configkey  The plugin config key to read.
     * @param string $default    Newline-separated default keywords to use when config is empty.
     * @return string[]          Lowercase, accent-stripped, deduplicated keywords.
     */
    private static function get_keywords_from_config(string $configkey, string $default): array {
        $raw = get_config('local_courseprogressnotify', $configkey);
        if ($raw === false || trim((string) $raw) === '') {
            $raw = $default;
        }
        // Accept newline- or comma-separated lists
        $keywords = preg_split('/[\n,]+/', (string) $raw);
        $keywords = array_map('trim', $keywords);
        $keywords = array_filter($keywords, fn($k) => $k !== '');
        // Strip accents and lowercase to match the pre-processed search text
        $keywords = array_map([self::class, 'remove_accents'], $keywords);
        $keywords = array_map('strtolower', $keywords);
        return array_values(array_unique($keywords));
    }

    /**
     * Get presential events for a course within a time window.
     *
     * @param int $courseid The course ID
     * @param int $starttime Start of time window (timestamp)
     * @param int $endtime End of time window (timestamp)
     * @return array Array of presential events with classification
     */
    public static function get_presential_events(int $courseid, int $starttime, int $endtime): array {
        global $DB;

        // Get all calendar events for this course in the time window
        $sql = "SELECT *
                  FROM {event}
                 WHERE courseid = :courseid
                   AND timestart >= :starttime
                   AND timestart < :endtime
                   AND (eventtype = 'course' OR eventtype = 'group' OR eventtype = 'user')
              ORDER BY timestart ASC";

        $events = $DB->get_records_sql($sql, [
            'courseid' => $courseid,
            'starttime' => $starttime,
            'endtime' => $endtime
        ]);

        $presentialevents = [];

        foreach ($events as $eventdata) {
            // Create calendar_event object
            $event = new \calendar_event($eventdata);

            // Check if it's presential
            if (!self::is_presential($event)) {
                continue;
            }

            // Determine type
            $type = self::get_presential_type($event);
            
            // Skip if we can't determine type
            if ($type === null) {
                continue;
            }

            // Calculate duration
            $duration = !empty($event->timeduration) ? $event->timeduration : 3600; // Default 1 hour
            $endtime = $event->timestart + $duration;

            $presentialevents[] = [
                'id' => $event->id,
                'name' => $event->name,
                'type' => $type,
                'location' => $event->location ?? '',
                'timestart' => $event->timestart,
                'timeend' => $endtime,
                'description' => $event->description ?? '',
            ];
        }

        return $presentialevents;
    }

    /**
     * Remove accents from a string for more flexible matching.
     *
     * @param string $string The input string
     * @return string String without accents
     */
    private static function remove_accents(string $string): string {
        $accents = [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
            'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u',
            'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U',
            'ä' => 'a', 'ë' => 'e', 'ï' => 'i', 'ö' => 'o', 'ü' => 'u',
            'Ä' => 'A', 'Ë' => 'E', 'Ï' => 'I', 'Ö' => 'O', 'Ü' => 'U',
            'ñ' => 'n', 'Ñ' => 'N', 'ç' => 'c', 'Ç' => 'C'
        ];
        return strtr($string, $accents);
    }

    /**
     * Format session time for email display.
     *
     * @param int $timestamp Unix timestamp
     * @param string $lang Language code
     * @return string Formatted date/time
     */
    public static function format_session_datetime(int $timestamp, string $lang = 'es'): string {
        return userdate($timestamp, get_string('strftimedaydatetime', 'langconfig'));
    }

    /**
     * Format session time (HH:MM format).
     *
     * @param int $timestamp Unix timestamp
     * @return string Formatted time (e.g., "14:30")
     */
    public static function format_session_time(int $timestamp): string {
        return userdate($timestamp, '%H:%M');
    }
}
