<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $ADMIN->add('reports', new admin_externalpage(
        'report_accessaudit',
        get_string('pluginname', 'report_accessaudit'),
        new moodle_url('/report/accessaudit/index.php')
    ));
}
