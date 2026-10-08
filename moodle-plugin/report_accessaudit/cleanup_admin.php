<?php
require_once(__DIR__ . '/../../config.php');
require_login();
require_capability('moodle/site:config', context_system::instance());

global $DB;

// Pegar todos os site admins
$admins = get_admins();
$count = 0;
foreach ($admins as $admin) {
    $deleted = $DB->delete_records('report_accessaudit', ['userid' => $admin->id]);
    $count += $deleted;
}

echo "Registros de administradores removidos: $count";
