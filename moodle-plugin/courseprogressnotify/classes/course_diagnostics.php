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
 * Diagnostic helper for the activity report.
 *
 * Provides methods to gather and analyse per-course notification data so the
 * report page can explain what has been sent, what hasn't, and why.
 *
 * @package   local_courseprogressnotify
 */
class course_diagnostics {

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Return all courses that have the notification custom field set to 1 (enabled).
     *
     * @param string $customfieldshortname
     * @return \stdClass[] Keyed by course id, sorted by fullname.
     */
    public static function get_enabled_courses(string $customfieldshortname): array {
        global $DB;

        $field = $DB->get_record('customfield_field', ['shortname' => $customfieldshortname]);
        if (!$field) {
            return [];
        }

        $sql = "SELECT * FROM {customfield_data}
                WHERE fieldid = :fieldid
                AND " . $DB->sql_compare_text('value') . " = " . $DB->sql_compare_text(':value');
        $datas = $DB->get_records_sql($sql, ['fieldid' => $field->id, 'value' => '1']);
        if (empty($datas)) {
            return [];
        }

        $courseids = array_column((array)$datas, 'instanceid');
        [$insql, $params] = $DB->get_in_or_equal($courseids);
        return $DB->get_records_select('course', "id {$insql}", $params, 'fullname ASC');
    }

    /**
     * Bulk-load all notification log records for a list of course ids.
     * Returns an array keyed by courseid, each value being an array of log records.
     *
     * @param int[] $courseids
     * @return array<int, \stdClass[]>
     */
    public static function get_all_logs(array $courseids): array {
        global $DB;

        if (empty($courseids)) {
            return [];
        }

        [$insql, $params] = $DB->get_in_or_equal($courseids);
        $logs = $DB->get_records_select('local_courseprogressnotify_log', "courseid {$insql}", $params);

        $result = [];
        foreach ($logs as $log) {
            $result[(int)$log->courseid][] = $log;
        }
        return $result;
    }

    /**
     * Bulk-load the number of enrolled active students for a list of course ids.
     * Returns an array keyed by courseid.
     *
     * @param int[] $courseids
     * @return array<int, int>
     */
    public static function get_all_enrolled_counts(array $courseids): array {
        global $DB;

        if (empty($courseids)) {
            return [];
        }

        [$insql, $params] = $DB->get_in_or_equal($courseids, SQL_PARAMS_NAMED, 'cid');
        $sql = "SELECT e.courseid, COUNT(DISTINCT u.id) AS cnt
                  FROM {user} u
                  JOIN {user_enrolments} ue ON ue.userid = u.id AND ue.status = 0
                  JOIN {enrol} e ON e.id = ue.enrolid AND e.status = 0 AND e.courseid {$insql}
                  JOIN {role_assignments} ra ON ra.userid = u.id
                  JOIN {role} r ON r.id = ra.roleid AND r.archetype = 'student'
                  JOIN {context} ctx ON ctx.id = ra.contextid
                       AND ctx.contextlevel = :ctxlevel AND ctx.instanceid = e.courseid
                 WHERE u.deleted = 0 AND u.suspended = 0
              GROUP BY e.courseid";
        $params['ctxlevel'] = CONTEXT_COURSE;

        $rows = $DB->get_records_sql($sql, $params);
        $result = [];
        foreach ($rows as $row) {
            $result[(int)$row->courseid] = (int)$row->cnt;
        }
        // Fill missing courseids with 0.
        foreach ($courseids as $cid) {
            if (!isset($result[(int)$cid])) {
                $result[(int)$cid] = 0;
            }
        }
        return $result;
    }

    /**
     * Return an array of human-readable configuration warning strings for a course.
     *
     * @param \stdClass $course
     * @return string[]
     */
    public static function get_date_warnings(\stdClass $course): array {
        $warnings = [];
        $now = time();
        $currentyear = (int)date('Y', $now);

        // --- Start date year ---
        if (!empty($course->startdate)) {
            $startyear = (int)date('Y', $course->startdate);
            if ($startyear < $currentyear) {
                $warnings[] = get_string('report:warn_start_past_year', 'local_courseprogressnotify', [
                    'year' => $startyear,
                    'date' => userdate($course->startdate, get_string('strftimedate', 'langconfig')),
                ]);
            }
        }

        // --- End date year ---
        if (!empty($course->enddate) && $course->enddate > 0) {
            $endyear = (int)date('Y', $course->enddate);
            if ($endyear < $currentyear) {
                $warnings[] = get_string('report:warn_end_past_year', 'local_courseprogressnotify', [
                    'year' => $endyear,
                    'date' => userdate($course->enddate, get_string('strftimedate', 'langconfig')),
                ]);
            }
        }

        // --- Completion disabled ---
        if (empty($course->enablecompletion)) {
            $warnings[] = get_string('report:warn_no_completion', 'local_courseprogressnotify');
        }

        // --- No end date ---
        if (empty($course->enddate) || $course->enddate == 0) {
            $warnings[] = get_string('report:warn_no_enddate', 'local_courseprogressnotify');
        }

        return $warnings;
    }

    /**
     * Build per-notification-type summary data for a single course.
     *
     * @param \stdClass   $course      Course record.
     * @param \stdClass[] $logs        Log records for this course (from get_all_logs).
     * @param int         $studentcount Enrolled active student count.
     * @return array<string, array{label:string, sent_count:int, last_sent:int, reason:string, status:string}>
     */
    public static function get_notification_summary(\stdClass $course, array $logs, int $studentcount): array {
        $now = time();

        // Index log records by notification_type.
        $bytype = [];
        foreach ($logs as $log) {
            $t = $log->notification_type;
            if (!isset($bytype[$t])) {
                $bytype[$t] = ['users' => [], 'entities' => [], 'last' => 0];
            }
            $bytype[$t]['users'][$log->userid] = true;
            if (!empty($log->entityid)) {
                $bytype[$t]['entities'][$log->entityid] = true;
            }
            if ($log->time_sent > $bytype[$t]['last']) {
                $bytype[$t]['last'] = (int)$log->time_sent;
            }
        }

        $summary = [];

        // Helper closure to get counts.
        $sent  = fn(string $type): int => isset($bytype[$type]) ? count($bytype[$type]['users']) : 0;
        $last  = fn(string $type): int => $bytype[$type]['last'] ?? 0;
        $sessi = fn(string $type): int => isset($bytype[$type]) ? count($bytype[$type]['entities']) : 0;

        // ── first_day_tasks ──────────────────────────────────────────────────
        $s = $sent('first_day_tasks');
        [$reason, $status] = self::reason_first_day($course, $now, $s, $studentcount);
        $summary['first_day_tasks'] = [
            'label'      => get_string('report:notiftype_first_day', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('first_day_tasks'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        // ── second_day_tasks ─────────────────────────────────────────────────
        $s = $sent('second_day_tasks');
        [$reason, $status] = self::reason_second_day($course, $now, $s, $studentcount);
        $summary['second_day_tasks'] = [
            'label'      => get_string('report:notiftype_second_day', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('second_day_tasks'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        // ── progress_25 ──────────────────────────────────────────────────────
        $s = $sent('progress_25');
        [$reason, $status] = self::reason_progress($course, $s, $studentcount, 25);
        $summary['progress_25'] = [
            'label'      => get_string('report:notiftype_progress25', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('progress_25'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        // ── progress_50 ──────────────────────────────────────────────────────
        $s = $sent('progress_50');
        [$reason, $status] = self::reason_progress($course, $s, $studentcount, 50);
        $summary['progress_50'] = [
            'label'      => get_string('report:notiftype_progress50', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('progress_50'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        // ── course_end_soon ──────────────────────────────────────────────────
        $s = $sent('course_end_soon');
        [$reason, $status] = self::reason_end_soon($course, $now, $s, $studentcount);
        $summary['course_end_soon'] = [
            'label'      => get_string('report:notiftype_end_soon', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('course_end_soon'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        // ── course_last_day ──────────────────────────────────────────────────
        $s = $sent('course_last_day');
        [$reason, $status] = self::reason_last_day($course, $now, $s, $studentcount);
        $summary['course_last_day'] = [
            'label'      => get_string('report:notiftype_last_day', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('course_last_day'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        // ── zoom_reminder ────────────────────────────────────────────────────
        $s  = $sent('zoom_reminder');
        $se = $sessi('zoom_reminder');
        $summary['zoom_reminder'] = [
            'label'      => get_string('report:notiftype_zoom', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('zoom_reminder'),
            'reason'     => $s > 0
                ? get_string('report:reason_zoom_sent', 'local_courseprogressnotify', ['users' => $s, 'sessions' => $se])
                : get_string('report:reason_zoom_none', 'local_courseprogressnotify'),
            'status'     => $s > 0 ? 'sent' : 'neutral',
        ];

        // ── presential_exam ──────────────────────────────────────────────────
        $s  = $sent('presential_exam');
        $se = $sessi('presential_exam');
        $summary['presential_exam'] = [
            'label'      => get_string('report:notiftype_presential_exam', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('presential_exam'),
            'reason'     => $s > 0
                ? get_string('report:reason_presential_sent', 'local_courseprogressnotify', ['users' => $s, 'sessions' => $se])
                : get_string('report:reason_presential_none', 'local_courseprogressnotify'),
            'status'     => $s > 0 ? 'sent' : 'neutral',
        ];

        // ── presential_tutoring ──────────────────────────────────────────────
        $s  = $sent('presential_tutoring');
        $se = $sessi('presential_tutoring');
        $summary['presential_tutoring'] = [
            'label'      => get_string('report:notiftype_presential_tutoring', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('presential_tutoring'),
            'reason'     => $s > 0
                ? get_string('report:reason_presential_sent', 'local_courseprogressnotify', ['users' => $s, 'sessions' => $se])
                : get_string('report:reason_presential_none', 'local_courseprogressnotify'),
            'status'     => $s > 0 ? 'sent' : 'neutral',
        ];

        // ── diploma_available ────────────────────────────────────────────────
        $s = $sent('diploma_available');
        [$reason, $status] = self::reason_diploma($course, $now, $s, $studentcount);
        $summary['diploma_available'] = [
            'label'      => get_string('report:notiftype_diploma', 'local_courseprogressnotify'),
            'sent_count' => $s,
            'last_sent'  => $last('diploma_available'),
            'reason'     => $reason,
            'status'     => $status,
        ];

        return $summary;
    }

    /**
     * Analyse all calendar events in a course for the report window (last 30 → next 60 days).
     * Returns every event that is either presential (detected or misconfigured) or that has
     * recognisable exam/tutoring keywords — so the admin can see exactly what the plugin
     * would or would not act on.
     *
     * @param int         $courseid
     * @param \stdClass[] $logs     Log records for this course (from get_all_logs).
     * @return array{events: array[]}
     */
    public static function analyze_presential_events(int $courseid, array $logs): array {
        global $DB;

        // Index sent notifications by event entity id.
        $sentexam     = [];
        $senttutoring = [];
        foreach ($logs as $log) {
            if ($log->notification_type === 'presential_exam' && !empty($log->entityid)) {
                $sentexam[(int)$log->entityid][$log->userid] = true;
            }
            if ($log->notification_type === 'presential_tutoring' && !empty($log->entityid)) {
                $senttutoring[(int)$log->entityid][$log->userid] = true;
            }
        }

        $now  = time();
        $from = $now - (30 * DAYSECS);
        $to   = $now + (60 * DAYSECS);

        $sql = "SELECT *
                  FROM {event}
                 WHERE courseid = :courseid
                   AND timestart >= :from
                   AND timestart < :to
                   AND eventtype IN ('course', 'group')
              ORDER BY timestart ASC";
        $events = $DB->get_records_sql($sql, [
            'courseid' => $courseid,
            'from'     => $from,
            'to'       => $to,
        ]);

        if (empty($events)) {
            return ['events' => []];
        }

        // Load keyword configuration (same logic as presential_provider).
        $examraw     = get_config('local_courseprogressnotify', 'presential_exam_keywords') ?: "examen\nexam\nevaluacion\nprueba";
        $tutoringraw = get_config('local_courseprogressnotify', 'presential_tutoring_keywords') ?: "tutoria\ntuto\nasesoria\nconsulta\nsesion\nsessio";
        $examkw     = self::parse_keywords($examraw);
        $tutoringkw = self::parse_keywords($tutoringraw);

        $result = [];

        foreach ($events as $evdata) {
            $location   = $evdata->location ?? '';
            $rawtext    = ($evdata->name ?? '') . ' ' . ($evdata->description ?? '');
            $normtext   = self::remove_accents(strtolower($rawtext));

            $haspresencial = (bool)preg_match('/presencial/ui', strtolower($rawtext));
            $haslocation   = !empty(trim($location));
            $is_presential = $haslocation || $haspresencial;

            // Determine keyword matches.
            $matchedkw = null;
            $type      = null;
            if (!empty($examkw)) {
                $pat = '/\b(' . implode('|', array_map('preg_quote', $examkw)) . ')\b/ui';
                if (preg_match($pat, $normtext)) {
                    $type = 'exam';
                }
            }
            if ($type === null && !empty($tutoringkw)) {
                $pat = '/\b(' . implode('|', array_map('preg_quote', $tutoringkw)) . ')\b/ui';
                if (preg_match($pat, $normtext)) {
                    $type = 'tutoring';
                }
            }

            $detected         = $is_presential && $type !== null;
            $detection_reason = null;

            if (!$is_presential) {
                // Only include this event if it has keywords — so the admin can spot it.
                if ($type === null) {
                    continue; // Purely unrelated event; skip entirely.
                }
                $detection_reason = 'keywords_no_location';
            } elseif ($type === null) {
                $detection_reason = 'no_keyword_match';
            }

            // Count sent notifications for this specific event.
            $eid = (int)$evdata->id;
            $notifications_sent = $detected
                ? count($type === 'exam' ? ($sentexam[$eid] ?? []) : ($senttutoring[$eid] ?? []))
                : 0;

            $result[] = [
                'id'                 => $eid,
                'name'               => $evdata->name,
                'timestart'          => (int)$evdata->timestart,
                'location'           => $location,
                'detected'           => $detected,
                'type'               => $type,
                'detection_reason'   => $detection_reason,
                'notifications_sent' => $notifications_sent,
                'exam_keywords'      => implode(', ', $examkw),
                'tutoring_keywords'  => implode(', ', $tutoringkw),
            ];
        }

        return ['events' => $result];
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Parse a keyword config string into a normalised array.
     *
     * @param string $raw Newline- or comma-separated keywords.
     * @return string[]
     */
    private static function parse_keywords(string $raw): array {
        $kws = preg_split('/[\n,]+/', $raw);
        $kws = array_map('trim', $kws);
        $kws = array_filter($kws, fn($k) => $k !== '');
        $kws = array_map([self::class, 'remove_accents'], $kws);
        $kws = array_map('strtolower', $kws);
        return array_values(array_unique($kws));
    }

    /**
     * Strip common Latin accents for normalised matching.
     *
     * @param string $string
     * @return string
     */
    private static function remove_accents(string $string): string {
        static $map = [
            'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u',
            'Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U',
            'à'=>'a','è'=>'e','ì'=>'i','ò'=>'o','ù'=>'u',
            'À'=>'A','È'=>'E','Ì'=>'I','Ò'=>'O','Ù'=>'U',
            'ä'=>'a','ë'=>'e','ï'=>'i','ö'=>'o','ü'=>'u',
            'Ä'=>'A','Ë'=>'E','Ï'=>'I','Ö'=>'O','Ü'=>'U',
            'â'=>'a','ê'=>'e','î'=>'i','ô'=>'o','û'=>'u',
            'Â'=>'A','Ê'=>'E','Î'=>'I','Ô'=>'O','Û'=>'U',
            'ñ'=>'n','Ñ'=>'N','ç'=>'c','Ç'=>'C',
        ];
        return strtr($string, $map);
    }

    /**
     * @return array{0:string, 1:string} [reason text, status key]
     */
    private static function reason_first_day(\stdClass $course, int $now, int $sent, int $total): array {
        if ($sent > 0) {
            return [get_string('report:reason_sent_n', 'local_courseprogressnotify', ['n' => $sent, 'total' => $total]), 'sent'];
        }
        $startdate = (int)($course->startdate ?? 0);
        if (empty($startdate)) {
            return [get_string('report:reason_no_startdate', 'local_courseprogressnotify'), 'warning'];
        }
        $startyear    = (int)date('Y', $startdate);
        $currentyear  = (int)date('Y', $now);
        if ($startyear < $currentyear) {
            return [
                get_string('report:reason_wrong_start_year', 'local_courseprogressnotify', [
                    'year' => $startyear,
                    'date' => userdate($startdate, get_string('strftimedate', 'langconfig')),
                ]),
                'warning',
            ];
        }
        // 2-day window: matches the task (yesterday midnight → tomorrow midnight).
        $windowstart = usergetmidnight($now) - DAYSECS;
        $windowend   = usergetmidnight($now) + DAYSECS;
        if ($startdate >= $windowstart && $startdate < $windowend) {
            return [get_string('report:reason_in_recovery_window', 'local_courseprogressnotify'), 'pending_today'];
        }
        if ($startdate >= $windowend) {
            return [
                get_string('report:reason_future_start', 'local_courseprogressnotify', [
                    'date' => userdate($startdate, get_string('strftimedate', 'langconfig')),
                ]),
                'pending',
            ];
        }
        $daysago = max(2, (int)floor(($now - $startdate) / DAYSECS));
        return [
            get_string('report:reason_window_passed', 'local_courseprogressnotify', ['days' => $daysago]),
            'missed',
        ];
    }

    /**
     * @return array{0:string, 1:string} [reason text, status key]
     */
    private static function reason_second_day(\stdClass $course, int $now, int $sent, int $total): array {
        if ($sent > 0) {
            return [get_string('report:reason_sent_n', 'local_courseprogressnotify', ['n' => $sent, 'total' => $total]), 'sent'];
        }
        $startdate   = (int)($course->startdate ?? 0);
        if (empty($startdate)) {
            return [get_string('report:reason_no_startdate', 'local_courseprogressnotify'), 'warning'];
        }
        $startyear   = (int)date('Y', $startdate);
        $currentyear = (int)date('Y', $now);
        if ($startyear < $currentyear) {
            return [
                get_string('report:reason_wrong_start_year', 'local_courseprogressnotify', [
                    'year' => $startyear,
                    'date' => userdate($startdate, get_string('strftimedate', 'langconfig')),
                ]),
                'warning',
            ];
        }
        $yesterdaystart = usergetmidnight($now - DAYSECS);
        $todaystart     = usergetmidnight($now);
        if ($startdate >= $yesterdaystart && $startdate < $todaystart) {
            return [get_string('report:reason_fires_today', 'local_courseprogressnotify'), 'pending_today'];
        }
        if ($startdate >= $todaystart) {
            return [
                get_string('report:reason_future_start', 'local_courseprogressnotify', [
                    'date' => userdate($startdate + DAYSECS, get_string('strftimedate', 'langconfig')),
                ]),
                'pending',
            ];
        }
        $daysago = max(1, (int)floor(($now - $startdate) / DAYSECS));
        return [
            get_string('report:reason_window_passed', 'local_courseprogressnotify', ['days' => $daysago]),
            'missed',
        ];
    }

    /**
     * @return array{0:string, 1:string} [reason text, status key]
     */
    private static function reason_progress(\stdClass $course, int $sent, int $total, int $percent): array {
        if (empty($course->enablecompletion)) {
            return [get_string('report:reason_no_completion', 'local_courseprogressnotify'), 'warning'];
        }
        if ($sent > 0) {
            return [get_string('report:reason_sent_n', 'local_courseprogressnotify', ['n' => $sent, 'total' => $total]), 'sent'];
        }
        return [
            get_string('report:reason_below_threshold', 'local_courseprogressnotify', ['pct' => $percent]),
            'neutral',
        ];
    }

    /**
     * @return array{0:string, 1:string} [reason text, status key]
     */
    private static function reason_end_soon(\stdClass $course, int $now, int $sent, int $total): array {
        if (empty($course->enddate) || $course->enddate == 0) {
            return [get_string('report:reason_no_enddate', 'local_courseprogressnotify'), 'warning'];
        }
        if ($sent > 0) {
            return [get_string('report:reason_sent_n', 'local_courseprogressnotify', ['n' => $sent, 'total' => $total]), 'sent'];
        }
        $days = (int)floor(($course->enddate - $now) / DAYSECS);
        if ($days > 7) {
            $firesin = $days - 7;
            return [
                get_string('report:reason_end_in_n_days', 'local_courseprogressnotify', ['days' => $days, 'fires' => $firesin]),
                'pending',
            ];
        }
        if ($days === 7) {
            return [get_string('report:reason_fires_today', 'local_courseprogressnotify'), 'pending_today'];
        }
        if ($days >= 0) {
            return [
                get_string('report:reason_end_window_passed_n', 'local_courseprogressnotify', [
                    'date' => userdate($course->enddate, get_string('strftimedate', 'langconfig')),
                ]),
                'missed',
            ];
        }
        return [
            get_string('report:reason_course_ended', 'local_courseprogressnotify', [
                'date' => userdate($course->enddate, get_string('strftimedate', 'langconfig')),
            ]),
            'neutral',
        ];
    }

    /**
     * @return array{0:string, 1:string} [reason text, status key]
     */
    private static function reason_last_day(\stdClass $course, int $now, int $sent, int $total): array {
        if (empty($course->enddate) || $course->enddate == 0) {
            return [get_string('report:reason_no_enddate', 'local_courseprogressnotify'), 'warning'];
        }
        if ($sent > 0) {
            return [get_string('report:reason_sent_n', 'local_courseprogressnotify', ['n' => $sent, 'total' => $total]), 'sent'];
        }
        $tomorrow        = usergetmidnight($now) + DAYSECS;
        $dayaftertomorrow = $tomorrow + DAYSECS;
        if ($course->enddate >= $tomorrow && $course->enddate < $dayaftertomorrow) {
            return [get_string('report:reason_fires_today', 'local_courseprogressnotify'), 'pending_today'];
        }
        $days = (int)floor(($course->enddate - $now) / DAYSECS);
        if ($days > 0) {
            return [
                get_string('report:reason_last_day_future', 'local_courseprogressnotify', [
                    'date' => userdate($course->enddate - DAYSECS, get_string('strftimedate', 'langconfig')),
                    'days' => $days,
                ]),
                'pending',
            ];
        }
        return [
            get_string('report:reason_course_ended', 'local_courseprogressnotify', [
                'date' => userdate($course->enddate, get_string('strftimedate', 'langconfig')),
            ]),
            'neutral',
        ];
    }

    /**
     * @return array{0:string, 1:string} [reason text, status key]
     */
    private static function reason_diploma(\stdClass $course, int $now, int $sent, int $total): array {
        if (empty($course->enddate) || $course->enddate == 0) {
            return [get_string('report:reason_no_enddate', 'local_courseprogressnotify'), 'warning'];
        }
        if ($sent > 0) {
            return [get_string('report:reason_sent_n', 'local_courseprogressnotify', ['n' => $sent, 'total' => $total]), 'sent'];
        }
        if ($course->enddate > $now) {
            return [
                get_string('report:reason_diploma_future', 'local_courseprogressnotify', [
                    'date' => userdate($course->enddate + (30 * DAYSECS), get_string('strftimedate', 'langconfig')),
                ]),
                'pending',
            ];
        }
        $daysafter = (int)floor(($now - $course->enddate) / DAYSECS);
        if ($daysafter < 30) {
            return [
                get_string('report:reason_diploma_pending', 'local_courseprogressnotify', ['days' => 30 - $daysafter]),
                'pending',
            ];
        }
        if ($daysafter === 30) {
            return [get_string('report:reason_fires_today', 'local_courseprogressnotify'), 'pending_today'];
        }
        return [
            get_string('report:reason_diploma_window_passed', 'local_courseprogressnotify', [
                'date' => userdate($course->enddate, get_string('strftimedate', 'langconfig')),
            ]),
            'missed',
        ];
    }
}
