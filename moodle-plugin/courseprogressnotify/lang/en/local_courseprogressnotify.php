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

$string['pluginname'] = 'Course progress notifications';
$string['settings:insights_heading'] = 'Connection to Moodle Insights';
$string['settings:insights_heading_desc'] = 'Which triggers are active and which template each one uses is configured from Moodle Insights, "Notification Management" section — not here. This plugin only needs to know how to connect.';
$string['settings:insights_url'] = 'Moodle Insights URL';
$string['settings:insights_url_desc'] = 'E.g.: https://moodle-dashboard.awakelab.world (no trailing slash).';
$string['settings:insights_api_key'] = 'Notifications API key';
$string['settings:insights_api_key_desc'] = 'Generated from Moodle Insights, under Configuration > Platforms > Notification Management, for this specific platform.';

// Scheduled task names.
$string['task_check_progress_25'] = 'Progress notification 25%';
$string['task_check_progress_50'] = 'Progress notification 50%';
$string['task_check_progress_75'] = 'Progress notification 75%';
$string['task_check_course_end_soon'] = 'Reminder: 7 days before course end';
$string['task_check_course_last_day'] = 'Reminder: last day of course';
$string['task_check_zoom_sessions'] = 'Zoom session reminders';
$string['task_check_presential_sessions'] = 'On-site session reminders';
$string['task_check_diploma_available'] = 'Reminder: diploma available (30 days)';
$string['task_check_first_day_tasks'] = 'First day tasks reminder';
$string['task_check_second_day_tasks'] = 'Second day tasks reminder';

// Manual run page.
$string['runpage:title'] = 'Manual notifications verification';
$string['runpage:heading'] = 'Run notifications check now';
$string['runpage:desc'] = 'You can manually run different notification checks. Select the type you want to test:';
$string['runpage:type_progress'] = 'Progress Notifications (25% and 50%)';
$string['runpage:confirm_progress'] = 'Check all students in courses with notifications enabled and send emails to those who have reached 25% or 50% progress (if they haven\'t been notified yet).';
$string['runpage:type_courseend'] = 'Course End Notifications (7 days before and last day)';
$string['runpage:confirm_courseend'] = 'Check courses ending soon (exactly 7 days away) or today, and send reminder emails to enrolled students (if they haven\'t been notified yet).';
$string['runpage:type_zoom'] = 'Zoom Session Notifications';
$string['runpage:confirm_zoom'] = 'Check upcoming Zoom sessions and send reminder emails to enrolled students.';
$string['runpage:type_presential'] = 'On-site Session Notifications (Exams and Tutoring)';
$string['runpage:confirm_presential'] = 'Check upcoming on-site sessions and send reminder emails to enrolled students.';
$string['runpage:type_diploma'] = 'Diploma Available Notifications';
$string['runpage:confirm_diploma'] = 'Check courses that ended 30 days ago and send diploma availability reminders to enrolled students.';
$string['runpage:type_firstday'] = 'First Day Tasks Notifications';
$string['runpage:confirm_firstday'] = 'Check courses starting today and send first day tasks reminders to enrolled students.';
$string['runpage:type_secondday'] = 'Second Day Tasks Notifications';
$string['runpage:confirm_secondday'] = 'Check courses that started yesterday and send second day tasks reminders to enrolled students.';
$string['runpage:confirm'] = 'Click the button below to start the verification. This will check all students in courses with notifications enabled and send emails to those who have reached 25% or 50% progress (if they haven\'t been notified yet).';
$string['run_progress_button'] = 'Test Progress Emails';
$string['run_courseend_button'] = 'Test Course End Emails';
$string['run_zoom_button'] = 'Test Zoom Emails';
$string['run_presential_button'] = 'Test On-site Session Emails';
$string['run_diploma_button'] = 'Test Diploma Emails';
$string['run_firstday_button'] = 'Test First Day Emails';
$string['run_secondday_button'] = 'Test Second Day Emails';
$string['run_clear_button'] = 'Clear Logs & Run';
$string['run_ignore_restrictions_button'] = 'Send to All (Ignore Date Restrictions)';
$string['settings:send_course_firstday'] = '1st Day (ignore dates)';
$string['settings:send_course_diploma'] = 'Diploma (ignore dates)';
$string['backtosettings'] = 'Back to settings';
$string['local/courseprogressnotify:run'] = 'Manually run notification checks';
$string['run_now_button'] = 'Run Now';
$string['run_now_done'] = 'Verification completed successfully.';
$string['run_now_error'] = 'An error occurred while running:';
$string['runpage:nocategory'] = 'No custom field configured in settings. Configure the custom field shortname to enable the plugin operations.';
$string['runpage:course_selector_heading'] = 'Course selection';
$string['runpage:course_selector_desc'] = 'Select a specific course to limit the check to that course only, or leave on "All courses" to run on every enabled course.';
$string['runpage:all_courses'] = 'All courses';

// Run block in settings page.
$string['settings:run:desc'] = 'Manually run the notifications verification from this page. It will apply to courses with notifications enabled via the custom field configured in Moodle Insights.';

// Progress table.
$string['progress:header:activity'] = 'Activity';
$string['progress:header:status'] = 'Status';
$string['progress:status:complete'] = 'Complete';
$string['progress:status:incomplete'] = 'Incomplete';

// Privacy.
$string['privacy:metadata:local_courseprogressnotify_log'] = 'Log of notifications sent';
$string['privacy:metadata:local_courseprogressnotify_log:userid'] = 'Recipient user id';
$string['privacy:metadata:local_courseprogressnotify_log:courseid'] = 'Course associated with the notification';
$string['privacy:metadata:local_courseprogressnotify_log:notification_type'] = 'Type of notification sent';
$string['privacy:metadata:local_courseprogressnotify_log:entityid'] = 'Associated entity id (e.g. Zoom or session)';
$string['privacy:metadata:local_courseprogressnotify_log:time_sent'] = 'Timestamp of the send';
$string['privacy:path:notifications'] = 'Course progress notifications';

// Email templates (English fallback).
$string['email_zoom_subject'] = 'Zoom session for course {{coursename}}';
$string['email_zoom_body'] = '<p>Hello {{firstname}}!</p>

<p>We are writing regarding the course <strong>{{coursename}}</strong> you are taking.</p>

<p>Please remember that on <strong>{{zoom_date}}</strong>, from <strong>{{zoom_start}}</strong> to <strong>{{zoom_end}}</strong>, there will be a live Zoom session with the tutor.</p>

<p>On the day of the session, when you access the platform, you will see the link to join the video call directly.</p>

<p><img src="{{image_zoom_link}}" alt="Zoom link location" style="max-width: 100%; height: auto;"></p>

<p>This session aims to:</p>
<ul>
  <li>Resolve course questions</li>
  <li>Deepen specific content</li>
  <li>Offer a more dynamic and practical session</li>
</ul>

<p>We look forward to seeing you!</p>';

$string['email_25_subject'] = '25% progress for course {{coursename}}';
$string['email_25_body'] = '<p>Welcome {{firstname}},</p>

<p>You have reached <strong>25%</strong> of the course <strong>{{coursename}}</strong>. Below is your progress to date:</p>
{{progress_table}}

<p>There is still time to finish the course, which ends on <strong>{{courseenddate}}</strong>. To complete it, you must:</p>

<ul>
  <li>Reach a minimum connection of 75% of total hours</li>
  <li>View 100% of the contents</li>
  <li>Complete the assessment activities</li>
</ul>

<p>Please also complete the <strong>Student evaluation questionnaire</strong>, available in the quality evaluation section.</p>

<p><img src="{{image_progress_25}}" alt="Progress report" style="max-width: 100%; height: auto;"></p>

<p>If you have any questions, contact us.</p>

<p>Regards,</p>';

$string['email_50_subject'] = 'Halfway progress for course {{coursename}}';
$string['email_50_body'] = '<p>Welcome {{firstname}}!</p>

<p>We have reached the middle of the course <strong>{{coursename}}</strong>. The course ends on <strong>{{courseenddate}}</strong>, and to complete it you need to view all content and complete the activities and assessments.</p>

<p>You can check your progress on the basic aspects of this course by consulting the COURSE PROGRESS bars. Both are located in the right column of your main screen and show in green the milestones achieved and in red those you still need to complete.</p>

<p><img src="{{image_progress_50}}" alt="Course progress location" style="max-width: 100%; height: auto;"></p>

<p>Here is your progress to date:</p>

{{progress_table}}

<p>Keep going, and contact us if you have any questions.</p>

<p>Regards,</p>';

$string['email_end_soon_subject'] = 'Final stretch of the course {{coursename}}';
$string['email_end_soon_body'] = '<p>Hello {{firstname}}!</p>

<p>This is a reminder that we are in the last week of the course <strong>{{coursename}}</strong>, which ends on <strong>{{courseenddate}}</strong>.</p>

<p>Remember the completion requirements:</p>

<ul>
  <li>Complete the course assessments</li>
  <li>View 100% of the contents</li>
  <li>Reach a minimum connection of 75% of the hours</li>
</ul>

<p>Make the most of these last days to finish the course.</p>

<p>All the best!</p>';

$string['email_last_day_subject'] = 'Course {{coursename}} final day instructions';
$string['email_last_day_body'] = '<p>Hello {{firstname}},</p>

<p>This is a reminder that tomorrow is the last training day of the course <strong>{{coursename}}</strong>.</p>

<p>It has been a pleasure to have you on the course and we hope it has been useful and enriching.</p>

<p>If you have not done so yet, please complete the assessments and ensure you have viewed 100% of the contents to obtain your diploma.</p>

<p>You can also complete the final satisfaction survey available in the quality evaluation section.</p>

<p><img src="{{image_quality_survey}}" alt="Quality survey location" style="max-width: 100%; height: auto;"></p>

<p>After the course ends, we will contact you to inform you about the availability of the diploma download.</p>

<p>Thank you for your participation and commitment.</p>

<p>Kind regards,</p>';

$string['email_exam_subject'] = 'Mandatory on-site exam for course {{coursename}}';
$string['email_exam_body'] = '<p>Hello {{firstname}},</p>

<p>Please remember that on <strong>{{exam_date}}</strong> the mandatory on-site exam for the course <strong>{{coursename}}</strong> is scheduled.</p>

<p><strong>Location:</strong> {{exam_location}}<br>
<strong>Time:</strong> from {{exam_start}} to {{exam_end}}</p>

<p>To access the exam, you must have completed all the course activities and assessments.</p>

<p>Please arrive early and bring your ID for verification.</p>

<p>Good luck!</p>';

$string['email_tutoring_subject'] = 'Mandatory on-site tutoring for course {{coursename}}';
$string['email_tutoring_body'] = '<p>Hello {{firstname}},</p>

<p>Please remember that on <strong>{{tutoring_date}}</strong> the mandatory on-site tutoring for the course <strong>{{coursename}}</strong> will take place.</p>

<p><strong>Location:</strong> {{tutoring_location}}<br>
<strong>Time:</strong> from {{tutoring_start}} to {{tutoring_end}}</p>

<p>During the tutoring there will be practical activities, content presentation, and Q&A.</p>

<p>We recommend preparing your questions in advance.</p>

<p>See you soon!</p>';

$string['email_diploma_subject'] = 'Diploma for course {{coursename}}';
$string['email_diploma_body'] = '<p>Dear {{firstname}},</p>

<p>Starting today, the diploma for the course <strong>{{coursename}}</strong> is available in the virtual campus.</p>

<p>You can access the campus using the following link:</p>

<p><a href="{{campus_url}}">{{campus_url}}</a></p>

<p>To download the diploma you must have completed all course requirements.</p>

<p>If you have not done so yet, please complete the final satisfaction survey.</p>

<p>Thank you for your participation. We encourage you to keep learning with us.</p>

<p>Regards,</p>';

// First day tasks email.
$string['email_first_day_subject'] = 'First tasks to complete on the platform';
$string['email_first_day_body'] = '<p>Hello everyone,</p>

<p>Welcome to the course <strong>{{coursename}}</strong>!</p>

<p>As a first step, we ask you to complete two important tasks:</p>

<ol>
<li><strong>Sign the regulations receipt</strong>: You will find it in the course documentation section. This document outlines the course rules and expectations.</li>
<li><strong>Sign the equipment receipt</strong>: If applicable, confirm receipt of any materials or equipment provided for the course.</li>
</ol>

<p><strong>Where to find these documents:</strong></p>
<p><img src="{{image_documentation}}" alt="Documentation location" style="max-width: 560px; width: 70%; height: auto;" /></p>

<p>Additionally, we recommend watching the introductory tutorial video available in the course:</p>
<p><img src="{{image_tutorial}}" alt="Tutorial video location" style="max-width: 560px; width: 70%; height: auto;" /></p>

<p>If you have any questions, please don\'t hesitate to contact us.</p>

<p>Best regards,</p>';

// Second day tasks email.
$string['email_second_day_subject'] = 'Important: compatible browsers and pop-ups';
$string['email_second_day_body'] = '<p>Hello {{firstname}},</p>

<p>This is a reminder about technical requirements for the course <strong>{{coursename}}</strong>:</p>

<p><strong>Compatible browsers:</strong></p>
<ul>
<li>Google Chrome (recommended)</li>
<li>Mozilla Firefox</li>
<li>Microsoft Edge</li>
<li>Safari (on macOS)</li>
</ul>

<p><strong>Important:</strong> Make sure to enable pop-up windows in your browser. Some course activities and external resources require pop-ups to function correctly.</p>

<p>If you experience technical issues, please contact support.</p>

<p>Best regards,</p>';


