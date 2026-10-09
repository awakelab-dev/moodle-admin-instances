<?php
defined('MOODLE_INTERNAL') || die();

// Strings originais
$string['pluginname']         = 'Access Audit';
$string['accessaudit:view']   = 'View access audit';
$string['pagetitle']          = 'User Access Audit';
$string['username']           = 'Username';
$string['fullname']           = 'Full name';
$string['email']              = 'Email';
$string['access']             = 'Access';
$string['ip']                 = 'IP';
$string['city']               = 'City';
$string['region']             = 'State/Region';
$string['country']            = 'Country';
$string['datetime']           = 'Date & time';
$string['suspicious']         = '⚠️ Suspicious';
$string['normal']             = 'Normal';
$string['filter_suspicious']  = 'Suspicious only';
$string['filter_all']         = 'All';
$string['no_records']         = 'No access records yet.';
$string['locations_detected'] = 'Locations detected';

// Abas
$string['tab_locations'] = 'Login locations';
$string['tab_patterns']  = 'Sharing patterns';

// Padrões
$string['analyze_now']          = 'Analyze now';
$string['analyze_hint']         = 'Analysis runs automatically every night at 03:00. To change the schedule go to Site administration → Server → Scheduled tasks.';
$string['analyze_done']         = 'Analysis complete: {$a->patterns} patterns found in {$a->courses} courses analyzed.';
$string['no_patterns_yet']      = 'No analysis run yet. Click "Analyze now" to start.';
$string['no_patterns_filtered'] = 'No patterns match the selected filter.';
$string['last_analysis']        = 'Last analysis';
$string['pattern_type']         = 'Pattern';
$string['pattern_sequential']   = 'Sequential';
$string['pattern_simultaneous'] = 'Simultaneous';
$string['pattern_both']         = 'Sequential + Simultaneous';
$string['students_count']       = 'Students (avg time/resource)';
$string['risk_level']           = 'Risk';
$string['risk_high']            = 'High';
$string['risk_medium']          = 'Medium';
$string['risk_low']             = 'Low';
$string['detail']               = 'Detected at';

// Scheduled task
$string['task_analyze']         = 'Analyze suspicious access patterns';
$string['no_patterns_yet']      = 'No analysis run yet. The report runs automatically every night at 03:00.';

// Moodle Insights connection ("Security" tab)
$string['settings:pagename']            = 'Access Audit: Moodle Insights';
$string['settings:insights_heading']    = 'Moodle Insights connection';
$string['settings:insights_heading_desc'] = 'Optional: if configured, each nightly analysis also sends its suspicious patterns to Moodle Insights ("Security" tab), to view them centralized alongside other platforms. The local analysis on this Moodle keeps working the same even if this is not configured.';
$string['settings:insights_url']        = 'Moodle Insights URL';
$string['settings:insights_url_desc']   = 'E.g.: https://insights.awakelab.dev (no trailing slash).';
$string['settings:insights_api_key']    = 'Security API key';
$string['settings:insights_api_key_desc'] = 'Generated from Moodle Insights → Settings → Platforms → Security, format "platformId.secret".';
