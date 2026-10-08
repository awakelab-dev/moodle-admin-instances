<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Tarefas agendadas do plugin report_accessaudit.
 * A análise roda automaticamente todo dia às 03:00.
 * O administrador pode alterar o horário em:
 * Administração do site → Servidor → Tarefas agendadas
 */
$tasks = [
    [
        'classname'  => 'report_accessaudit\task\analyze_task',
        'blocking'   => 0,
        'minute'     => '0',
        'hour'       => '3',
        'day'        => '*',
        'month'      => '*',
        'dayofweek'  => '*',
    ],
];
