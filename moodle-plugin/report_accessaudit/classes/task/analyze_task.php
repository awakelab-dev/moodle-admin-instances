<?php
namespace report_accessaudit\task;

defined('MOODLE_INTERNAL') || die();

/**
 * Tarefa agendada: roda a análise de padrões suspeitos automaticamente.
 * Configurada para executar todo dia às 03:00 (horário do servidor).
 */
class analyze_task extends \core\task\scheduled_task {

    public function get_name(): string {
        return get_string('task_analyze', 'report_accessaudit');
    }

    public function execute(): void {
        global $CFG;
        require_once($CFG->dirroot . '/report/accessaudit/classes/analyzer.php');

        mtrace('[report_accessaudit] Iniciando análise de padrões suspeitos...');

        try {
            $result = \report_accessaudit\analyzer::run();
            mtrace('[report_accessaudit] Análise concluída.');
            mtrace('[report_accessaudit] Cursos analisados : ' . $result['courses_analyzed']);
            mtrace('[report_accessaudit] Padrões detectados: ' . $result['patterns_found']);
        } catch (\Exception $e) {
            mtrace('[report_accessaudit] ERRO na análise: ' . $e->getMessage());
            throw $e; // Repropagar para o cron registrar a falha
        }
    }
}
