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

namespace local_courseprogressnotify\privacy;

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\core_userlist_provider;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

defined('MOODLE_INTERNAL') || die();

/**
 * Privacy provider for local_courseprogressnotify.
 *
 * Los registros de `local_courseprogressnotify_log` viven "dentro" de un
 * curso (userid + courseid), así que el contexto relevante para cada fila
 * es el contexto de curso — igual que hacen la mayoría de plugins de
 * actividad de Moodle con sus propios logs.
 *
 * @package   local_courseprogressnotify
 * @copyright Copyright (c) 2025
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\plugin\provider,
    core_userlist_provider {

    /**
     * Returns metadata about this plugin's data storage.
     *
     * @param collection $items
     * @return collection
     */
    public static function get_metadata(collection $items): collection {
        $items->add_database_table('local_courseprogressnotify_log', [
            'userid' => 'privacy:metadata:local_courseprogressnotify_log:userid',
            'courseid' => 'privacy:metadata:local_courseprogressnotify_log:courseid',
            'notification_type' => 'privacy:metadata:local_courseprogressnotify_log:notification_type',
            'entityid' => 'privacy:metadata:local_courseprogressnotify_log:entityid',
            'time_sent' => 'privacy:metadata:local_courseprogressnotify_log:time_sent',
        ], 'privacy:metadata:local_courseprogressnotify_log');
        return $items;
    }

    /**
     * Get the list of contexts (course contexts) that contain user
     * information for the specified user.
     *
     * @param int $userid
     * @return contextlist
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $sql = "SELECT ctx.id
                  FROM {local_courseprogressnotify_log} l
                  JOIN {context} ctx ON ctx.instanceid = l.courseid AND ctx.contextlevel = :contextcourse
                 WHERE l.userid = :userid";
        $params = ['userid' => $userid, 'contextcourse' => CONTEXT_COURSE];

        $contextlist = new contextlist();
        $contextlist->add_from_sql($sql, $params);
        return $contextlist;
    }

    /**
     * Get the list of users within a specific course context.
     *
     * @param userlist $userlist
     */
    public static function get_users_in_context(userlist $userlist): void {
        $context = $userlist->get_context();
        if ($context->contextlevel !== CONTEXT_COURSE) {
            return;
        }

        $sql = "SELECT userid
                  FROM {local_courseprogressnotify_log}
                 WHERE courseid = :courseid";
        $userlist->add_from_sql('userid', $sql, ['courseid' => $context->instanceid]);
    }

    /**
     * Export all user data for the specified user, for each approved
     * course context.
     *
     * @param approved_contextlist $contextlist
     */
    public static function export_user_data(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;

        foreach ($contextlist->get_contexts() as $context) {
            if ($context->contextlevel !== CONTEXT_COURSE) {
                continue;
            }

            $records = $DB->get_records('local_courseprogressnotify_log', [
                'userid' => $userid,
                'courseid' => $context->instanceid,
            ], 'time_sent ASC');

            if (empty($records)) {
                continue;
            }

            $data = array_map(function ($record) {
                return (object) [
                    'notification_type' => $record->notification_type,
                    'entityid' => $record->entityid,
                    'time_sent' => \core_privacy\local\request\transform::datetime($record->time_sent),
                ];
            }, array_values($records));

            writer::with_context($context)->export_data(
                [get_string('privacy:path:notifications', 'local_courseprogressnotify')],
                (object) ['notifications' => $data]
            );
        }
    }

    /**
     * Delete all data for all users within a single course context.
     *
     * @param \context $context
     */
    public static function delete_data_for_all_users_in_context(\context $context): void {
        global $DB;

        if ($context->contextlevel !== CONTEXT_COURSE) {
            return;
        }

        $DB->delete_records('local_courseprogressnotify_log', ['courseid' => $context->instanceid]);
    }

    /**
     * Delete all data for the specified user, in each approved course
     * context.
     *
     * @param approved_contextlist $contextlist
     */
    public static function delete_data_for_user(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;

        foreach ($contextlist->get_contexts() as $context) {
            if ($context->contextlevel !== CONTEXT_COURSE) {
                continue;
            }

            $DB->delete_records('local_courseprogressnotify_log', [
                'userid' => $userid,
                'courseid' => $context->instanceid,
            ]);
        }
    }

    /**
     * Delete multiple users' data within a single course context.
     *
     * @param approved_userlist $userlist
     */
    public static function delete_data_for_users(approved_userlist $userlist): void {
        global $DB;

        $context = $userlist->get_context();
        if ($context->contextlevel !== CONTEXT_COURSE) {
            return;
        }

        $userids = $userlist->get_userids();
        if (empty($userids)) {
            return;
        }

        [$insql, $inparams] = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED);
        $inparams['courseid'] = $context->instanceid;
        $DB->delete_records_select(
            'local_courseprogressnotify_log',
            "courseid = :courseid AND userid {$insql}",
            $inparams
        );
    }
}
