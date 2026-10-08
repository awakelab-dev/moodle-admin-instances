<?php
require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/adminlib.php');

require_login();
require_sesskey();
require_capability('report/accessaudit:view', context_system::instance());

$returnurl = optional_param('returnurl', '/report/accessaudit/index.php?tab=patterns', PARAM_LOCALURL);

// Executar análise
require_once($CFG->dirroot . '/report/accessaudit/classes/analyzer.php');

try {
    $result = \report_accessaudit\analyzer::run();

    $msg = get_string('analyze_done', 'report_accessaudit',
        ['patterns' => $result['patterns_found'], 'courses' => $result['courses_analyzed']]);
    \core\notification::success($msg);

} catch (\Exception $e) {
    \core\notification::error('Erro na análise: ' . $e->getMessage());
}

redirect(new moodle_url($returnurl));
