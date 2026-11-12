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

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_insightssurveys', get_string('pluginname', 'local_insightssurveys'));

    $plugin = new stdClass();
    require(__DIR__ . '/version.php');
    $versioninfo = html_writer::tag('div',
        html_writer::tag('strong', 'Version: ') . $plugin->release . ' (Build: ' . $plugin->version . ')',
        ['style' => 'padding: 10px; background: #e8f4f8; border-left: 4px solid #0066cc; margin-bottom: 20px;']
    );
    $settings->add(new admin_setting_heading('local_insightssurveys_version', '', $versioninfo));

    // ── Conexión con Moodle Insights ───────────────────────────────────────
    // Mismo patrón que local_courseprogressnotify: este plugin no guarda
    // ninguna campaña localmente, solo cómo conectarse (URL + API key, la
    // MISMA que ya se generó para Gestión de Notificaciones).
    $settings->add(new admin_setting_heading(
        'local_insightssurveys_insights_heading',
        get_string('settings:insights_heading', 'local_insightssurveys'),
        get_string('settings:insights_heading_desc', 'local_insightssurveys')
    ));

    $settings->add(new admin_setting_configtext(
        'local_insightssurveys/insights_url',
        get_string('settings:insights_url', 'local_insightssurveys'),
        get_string('settings:insights_url_desc', 'local_insightssurveys'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'local_insightssurveys/insights_api_key',
        get_string('settings:insights_api_key', 'local_insightssurveys'),
        get_string('settings:insights_api_key_desc', 'local_insightssurveys'),
        ''
    ));

    $runurl = new moodle_url('/local/insightssurveys/run.php');
    $desc = html_writer::tag('p', get_string('settings:run:desc', 'local_insightssurveys'));
    $desc .= html_writer::link($runurl, get_string('run_now_button', 'local_insightssurveys'), ['class' => 'btn btn-primary']);
    $settings->add(new admin_setting_heading('local_insightssurveys_runblock', get_string('runpage:heading', 'local_insightssurveys'), $desc));

    $ADMIN->add('localplugins', $settings);
}
