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

// Custom field settings.
$string['customfield_shortname'] = 'Custom field shortname';
$string['customfield_shortname_desc'] = 'Enter the shortname of the course custom field (checkbox) that enables notifications for individual courses. Only courses with this field enabled will receive notifications. The custom field must be created in Site administration → Courses → Course custom fields. Recommended: courseemailnotifications_enabled';

// Scheduled task names.
$string['task_check_progress_25'] = 'Progress notification 25%';
$string['task_check_progress_50'] = 'Progress notification 50%';
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
$string['coursespage:title'] = 'Plugin: Notificaciones';
$string['coursespage:desc'] = 'Configure diploma-only mode and trigger manual sends per course. Toggle changes are saved when you click Save.';
$string['coursespage:saved'] = 'Course settings saved successfully.';
$string['local/courseprogressnotify:managecourses'] = 'Manage per-course notification settings';
$string['run_now_button'] = 'Run Now';
$string['run_now_done'] = 'Verification completed successfully.';
$string['run_now_error'] = 'An error occurred while running:';
$string['runpage:nocategory'] = 'No custom field configured in settings. Configure the custom field shortname to enable the plugin operations.';
$string['runpage:course_selector_heading'] = 'Course selection';
$string['runpage:course_selector_desc'] = 'Select a specific course to limit the check to that course only, or leave on "All courses" to run on every enabled course.';
$string['runpage:all_courses'] = 'All courses';

// Settings.
$string['settings:zoomdaysbefore'] = 'Days before Zoom invitation';
$string['settings:zoomdaysbefore_desc'] = 'Number of days before the Zoom session date to send the automatic invitation.';
$string['settings:presentialdaysbefore'] = 'Days before on-site sessions';
$string['settings:presentialdaysbefore_desc'] = 'Number of days before the on-site session (exam/tutoring) to send the reminder.';
$string['settings:send_combined_email'] = 'Send Spanish and Catalan emails combined';
$string['settings:send_combined_email_desc'] = 'When enabled, emails will contain both Spanish and Catalan versions in the same message. When disabled, emails will be sent in the user\'s preferred language only.';

// Matching keywords for presential session classification.
$string['settings:presential_keywords_heading'] = 'Matching keywords';
$string['settings:presential_keywords_heading_desc'] = 'These keywords determine how presential calendar events are classified as exams or tutoring sessions. <strong>An event is only detected as presential if it has a location set.</strong> Accents are ignored when matching (e.g., &ldquo;sessi&oacute;&rdquo; also matches &ldquo;sessio&rdquo;). Enter one keyword per line.';
$string['settings:presential_exam_keywords'] = 'Exam keywords';
$string['settings:presential_exam_keywords_desc'] = 'If any of these words appears in a calendar event\'s name or description, it will be classified as an <strong>exam</strong>. One keyword per line.';
$string['settings:presential_tutoring_keywords'] = 'Tutoring / session keywords';
$string['settings:presential_tutoring_keywords_desc'] = 'If any of these words appears in a calendar event\'s name or description, it will be classified as a <strong>tutoring session</strong>. One keyword per line.';

// Run block in settings page.
$string['settings:run:desc'] = 'Manually run the notifications verification from this page. It will apply to courses with notifications enabled via the custom field.';

// Diploma-only course settings.
$string['settings:diploma_only_heading'] = 'Per-course configuration';
$string['settings:diploma_only_heading_desc'] = 'Configure plugin behaviour per course: enable diploma-only mode to suppress all other emails, or trigger manual sends ignoring date restrictions.';
$string['settings:diploma_only_courses'] = 'Course settings';
$string['settings:diploma_only_courses_desc'] = 'Courses marked in <span style="color:#721c24;font-weight:700">red/yellow</span> have diploma-only mode active — double-check before saving.';
$string['settings:col_course'] = 'Course';
$string['settings:col_diploma_only'] = 'Diploma-only mode';
$string['settings:col_manual_send'] = 'Manual send (ignore dates)';
$string['settings:diploma_only_configure_first'] = 'Configure the custom field shortname above first.';
$string['settings:diploma_only_no_courses'] = 'No courses are currently enabled for this plugin (no course has the custom field active).';
$string['settings:diploma_only_active_badge'] = '⚠ DIPLOMA ONLY';
$string['settings:diploma_only_warning_active'] = 'WARNING: one or more courses have diploma-only mode active. Non-diploma emails will NOT be sent to students in those courses.';

// Progress table.
$string['progress:header:activity'] = 'Activity';
$string['progress:header:status'] = 'Status';
$string['progress:status:complete'] = 'Complete';
$string['progress:status:incomplete'] = 'Incomplete';

// Privacy.
$string['privacy:metadata'] = 'The plugin local_courseprogressnotify stores logs of notifications sent to users.';
$string['privacy:metadata:local_courseprogressnotify_log'] = 'Log of notifications sent';
$string['privacy:metadata:local_courseprogressnotify_log:userid'] = 'Recipient user id';
$string['privacy:metadata:local_courseprogressnotify_log:courseid'] = 'Course associated with the notification';
$string['privacy:metadata:local_courseprogressnotify_log:notification_type'] = 'Type of notification sent';
$string['privacy:metadata:local_courseprogressnotify_log:entityid'] = 'Associated entity id (e.g. Zoom or session)';
$string['privacy:metadata:local_courseprogressnotify_log:time_sent'] = 'Timestamp of the send';

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

// ── Activity report ───────────────────────────────────────────────────────────
$string['report:title']   = 'Notifications Activity Report';
$string['report:heading'] = 'Notifications Activity Report';
$string['settings:report_link']      = 'Activity report';
$string['settings:report_link_desc'] = 'View a detailed report of which emails have been sent for each enabled course, and why pending emails have not fired yet.';
$string['report:viewreport'] = 'View activity report';

// Course overview.
$string['report:intro']             = 'Showing activity for {$a} course(s) with notifications enabled.';
$string['report:nocourses']         = 'No courses have notifications enabled via the configured custom field.';
$string['report:no_courses_in_filter'] = 'No courses match the current filter.';
$string['report:haswarnings']       = 'Has configuration warnings';
$string['report:open_course']       = 'Open course';
$string['report:startdate']         = 'Start date';
$string['report:enddate']           = 'End date';
$string['report:students']          = 'Enrolled students';
$string['report:completion']        = 'Completion enabled';
$string['report:notset']            = 'Not set';

// Summary bar.
$string['report:summary_total']    = '{$a} enabled course(s)';
$string['report:summary_warnings'] = '{$a} with configuration warnings';
$string['report:summary_sent']     = '{$a} total email records';
$string['report:filter_label']     = 'Show:';
$string['report:filter_all']       = 'All courses ({$a})';
$string['report:filter_warnings']  = 'Warnings only ({$a})';

// Warnings.
$string['report:warnings']               = 'Configuration warnings';
$string['report:warn_start_past_year']   = 'Start date is set to {$a->year} ({$a->date}). The first-day and second-day email tasks only fire on the exact start date — this means those emails will never send with the current date configured.';
$string['report:warn_end_past_year']     = 'End date is set to {$a->year} ({$a->date}). End-of-course emails (7 days before, last day, diploma) will never fire.';
$string['report:warn_no_completion']     = 'Course completion is disabled. Progress-based emails (25%, 50%) cannot be sent.';
$string['report:warn_no_enddate']        = 'No end date is configured. End-of-course and diploma emails will not fire.';

// Notification history section.
$string['report:notificationsent'] = 'Notification history';
$string['report:notiftype']        = 'Notification type';
$string['report:sentcount']        = 'Sent';
$string['report:lastsent']         = 'Last sent';
$string['report:statusreason']     = 'Status / Reason';

// Notification type labels.
$string['report:notiftype_first_day']           = 'First day tasks';
$string['report:notiftype_second_day']          = 'Second day (browser info)';
$string['report:notiftype_progress25']          = 'Progress 25%';
$string['report:notiftype_progress50']          = 'Progress 50%';
$string['report:notiftype_end_soon']            = 'Course ending soon (7 days)';
$string['report:notiftype_last_day']            = 'Last day reminder';
$string['report:notiftype_zoom']                = 'Zoom session reminder';
$string['report:notiftype_presential_exam']     = 'Exam reminder';
$string['report:notiftype_presential_tutoring'] = 'Tutoring reminder';
$string['report:notiftype_diploma']             = 'Diploma available';

// Status / reason strings.
$string['report:reason_sent_n']            = 'Sent to {$a->n} of {$a->total} enrolled students';
$string['report:reason_no_startdate']      = 'No start date configured';
$string['report:reason_wrong_start_year']  = 'Start date year is {$a->year} ({$a->date}) — tasks only run on the exact start day. Correct the start date year to the current year.';
$string['report:reason_starts_today']      = 'Course starts today — task will fire in today\'s scheduled run';
$string['report:reason_future_start']      = 'Course not started yet — task will fire on {$a->date}';
$string['report:reason_window_passed']          = 'Window passed ({$a->days} days since the start date).';
$string['report:reason_fires_today']            = 'Condition met today — task will fire in today\'s scheduled run';
$string['report:reason_in_recovery_window']     = 'Within recovery window — next cron run will send this';
$string['report:firstday_diag_toggle']          = 'Diagnose';
$string['report:firstday_diag_window']          = 'Active cron window:';
$string['report:firstday_diag_startdate']       = 'Course start date:';
$string['report:firstday_diag_inwindow']        = 'In window?';
$string['report:firstday_diag_inwindow_yes']    = 'Yes — next cron run will send the email';
$string['report:firstday_diag_inwindow_no']     = 'No — outside the 2-day window. Email cannot be sent automatically.';
$string['report:firstday_diag_viewlogs']        = 'View cron task logs →';
$string['report:reason_no_completion']     = 'Course completion is disabled — progress cannot be tracked';
$string['report:reason_below_threshold']   = 'No student has reached the {$a->pct}% progress threshold yet';
$string['report:reason_no_enddate']        = 'No end date configured';
$string['report:reason_end_in_n_days']     = 'Course ends in {$a->days} days — this email will fire in {$a->fires} days (when exactly 7 days remain)';
$string['report:reason_end_window_passed_n'] = 'The 7-day window has passed without sending. End date was {$a->date}. Verify the task ran at the right time.';
$string['report:reason_course_ended']      = 'Course ended on {$a->date}';
$string['report:reason_last_day_future']   = 'Will fire on {$a->date} (in {$a->days} days — the day before course end)';
$string['report:reason_diploma_future']    = 'Will fire on {$a->date} (30 days after course end)';
$string['report:reason_diploma_pending']   = 'Will fire in {$a->days} day(s) (30 days after course end)';
$string['report:reason_diploma_window_passed'] = 'Window passed. Course ended {$a->date}. Verify the task ran 30 days after end.';
$string['report:reason_zoom_sent']         = 'Sent to {$a->users} students across {$a->sessions} Zoom session(s)';
$string['report:reason_zoom_none']         = 'No Zoom session reminders recorded yet for this course';
$string['report:reason_presential_sent']   = 'Sent to {$a->users} students across {$a->sessions} session(s)';
$string['report:reason_presential_none']   = 'No reminders recorded yet — see the presential events section below';

// Presential events section.
$string['report:presentialevents']      = 'Presential session events (last 30 days → next 60 days)';
$string['report:presentialevents_none'] = 'No calendar events found for this course in the reporting window (last 30 → next 60 days).';
$string['report:eventname']             = 'Event name';
$string['report:eventdate']             = 'Date';
$string['report:eventlocation']         = 'Location';
$string['report:eventdetected']         = 'Detected as';
$string['report:eventreason']           = 'Issue / Status';
$string['report:nolocation']            = 'No location set';
$string['report:detected_no']           = 'Not detected';
$string['report:notified_n']            = 'Notified: {$a}';
$string['report:event_will_notify']     = 'Will send notification N days before the event (as configured)';
$string['report:reason_event_nokeyword']        = 'Event has a location set but no matching exam or tutoring keyword was found in the title or description.';
$string['report:reason_event_keywords_no_location'] = 'Event has a matching keyword but NO location is set. Add a physical location to the calendar event to trigger presential detection.';
$string['report:current_exam_kw']     = 'Current exam keywords:';
$string['report:current_tutoring_kw'] = 'Current tutoring keywords:';

