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
    $settings = new admin_settingpage('local_courseprogressnotify', get_string('pluginname', 'local_courseprogressnotify'));

    // Plugin version info
    $plugin = new stdClass();
    require(__DIR__ . '/version.php');
    $versioninfo = html_writer::tag('div',
        html_writer::tag('strong', 'Version: ') . $plugin->release . ' (Build: ' . $plugin->version . ')',
        ['style' => 'padding: 10px; background: #e8f4f8; border-left: 4px solid #0066cc; margin-bottom: 20px;']
    );
    $settings->add(new admin_setting_heading(
        'local_courseprogressnotify_version',
        '',
        $versioninfo
    ));

    // ── Conexión con Moodle Insights ───────────────────────────────────────
    // Este plugin no guarda NINGÚN parámetro de negocio localmente (qué
    // disparadores están activos, sus plantillas, el campo personalizado
    // que activa notificaciones por curso, días de antelación de
    // Zoom/presencial, palabras clave de detección, cursos "solo
    // diploma"...) — todo eso se gestiona desde Moodle Insights, sección
    // "Gestión de Notificaciones", y se recibe entero en cada ejecución
    // (ver insights_client::get_config()/get_settings()). Lo único que
    // necesita este ajuste es cómo conectarse: la URL de esa app y una API
    // key (generada desde Configuración > Plataformas > Gestión de
    // Notificaciones allá, con formato "<platformId>.<secreto>").
    $settings->add(new admin_setting_heading(
        'local_courseprogressnotify_insights_heading',
        get_string('settings:insights_heading', 'local_courseprogressnotify'),
        get_string('settings:insights_heading_desc', 'local_courseprogressnotify')
    ));

    $settings->add(new admin_setting_configtext(
        'local_courseprogressnotify/insights_url',
        get_string('settings:insights_url', 'local_courseprogressnotify'),
        get_string('settings:insights_url_desc', 'local_courseprogressnotify'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'local_courseprogressnotify/insights_api_key',
        get_string('settings:insights_api_key', 'local_courseprogressnotify'),
        get_string('settings:insights_api_key_desc', 'local_courseprogressnotify'),
        ''
    ));

    // Add a manual run block inside the settings page — no configura nada,
    // solo dispara task->execute() de forma inmediata (que ya lee todo lo
    // que necesita desde Moodle Insights).
    $runurl = new moodle_url('/local/courseprogressnotify/run.php');
    $customfield = \local_courseprogressnotify\insights_client::get_settings()['courseCustomFieldShortname'] ?? '';
    $disabled = empty($customfield);
    $desc = html_writer::tag('p', get_string('settings:run:desc', 'local_courseprogressnotify'));
    if ($disabled) {
        $desc .= $OUTPUT->notification(get_string('runpage:nocategory', 'local_courseprogressnotify'), \core\output\notification::NOTIFY_WARNING);
    } else {
        $desc .= html_writer::link(
            $runurl,
            get_string('run_now_button', 'local_courseprogressnotify'),
            ['class' => 'btn btn-primary']
        );
    }

    $settings->add(new admin_setting_heading('local_courseprogressnotify_runblock', get_string('runpage:heading', 'local_courseprogressnotify'), $desc));

    $ADMIN->add('localplugins', $settings);
}
