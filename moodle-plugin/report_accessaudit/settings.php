<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $ADMIN->add('reports', new admin_externalpage(
        'report_accessaudit',
        get_string('pluginname', 'report_accessaudit'),
        new moodle_url('/report/accessaudit/index.php')
    ));

    // Página de ajustes aparte (no la de arriba, que es el informe en sí)
    // para la conexión con Moodle Insights — el análisis sigue corriendo
    // localmente cada noche; esto solo decide si (y a dónde) se reporta
    // también el resultado, para verlo centralizado entre plataformas.
    $settings = new admin_settingpage('report_accessaudit_settings', get_string('settings:pagename', 'report_accessaudit'));

    $settings->add(new admin_setting_heading(
        'report_accessaudit_insights_heading',
        get_string('settings:insights_heading', 'report_accessaudit'),
        get_string('settings:insights_heading_desc', 'report_accessaudit')
    ));

    $settings->add(new admin_setting_configtext(
        'report_accessaudit/insights_url',
        get_string('settings:insights_url', 'report_accessaudit'),
        get_string('settings:insights_url_desc', 'report_accessaudit'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'report_accessaudit/insights_api_key',
        get_string('settings:insights_api_key', 'report_accessaudit'),
        get_string('settings:insights_api_key_desc', 'report_accessaudit'),
        ''
    ));

    $ADMIN->add('reports', $settings);
}
