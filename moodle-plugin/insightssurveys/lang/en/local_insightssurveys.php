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

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Course quality surveys (Moodle Insights)';
$string['settings:insights_heading'] = 'Connection to Moodle Insights';
$string['settings:insights_heading_desc'] = 'Which survey campaigns are active and who to send them to is configured from Moodle Insights, "Surveys" section — not here. This plugin only needs to know how to connect.';
$string['settings:insights_url'] = 'Moodle Insights URL';
$string['settings:insights_url_desc'] = 'E.g.: https://moodle-dashboard.awakelab.world (no trailing slash).';
$string['settings:insights_api_key'] = 'Notifications API key';
$string['settings:insights_api_key_desc'] = 'The same API key already generated for Notification Management, from Configuration > Platforms, for this specific platform.';
$string['settings:run:desc'] = 'Manual test, without waiting for the daily cron (9:45):';

$string['task_check_survey_campaigns'] = 'Quality surveys (Moodle Insights)';

$string['runpage:title'] = 'Quality surveys — manual test';
$string['runpage:heading'] = 'Check surveys now';
$string['runpage:desc'] = 'Check active survey campaigns in Moodle Insights and send, to whoever is due today, the message with the survey link (if not already sent that specific day).';
$string['run_now_button'] = 'Test Surveys Now';
$string['run_now_done'] = 'The check ran successfully.';
$string['run_now_error'] = 'The check finished with errors:';
$string['survey_email_subject'] = 'Course quality survey';
$string['backtosettings'] = '← Back to settings';
$string['local/insightssurveys:run'] = 'Manually run the survey check';
