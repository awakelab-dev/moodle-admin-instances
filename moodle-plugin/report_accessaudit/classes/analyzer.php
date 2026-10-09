<?php
namespace report_accessaudit;

defined('MOODLE_INTERNAL') || die();

class analyzer {

    // Limiares configuráveis (futuramente virão de settings)
    const MIN_VIEW_TIME        = 15;   // segundos mínimos por recurso
    const MIN_USERS_PER_IP     = 2;    // mínimo de alunos no mesmo IP
    const SEQUENTIAL_WINDOW    = 600;  // segundos entre fim de um e início do próximo (10 min)
    const SIMULTANEOUS_WINDOW  = 300;  // segundos de sobreposição para considerar simultâneo (5 min)
    const ANALYSIS_DAYS        = 30;   // período de análise em dias

    /**
     * Executa a análise completa e salva os resultados.
     * Retorna um array com estatísticas do processamento.
     */
    public static function run(): array {
        global $DB;

        // Limpar resultados anteriores
        $DB->delete_records('report_accessaudit_patterns');

        $since = time() - (self::ANALYSIS_DAYS * 86400);

        // Buscar todos os cursos que tiveram atividade no período
        $courses = $DB->get_records_sql(
            "SELECT DISTINCT courseid FROM {logstore_standard_log}
              WHERE timecreated > ? AND courseid > 0 AND userid > 0
                AND action = 'viewed'",
            [$since]
        );

        $total_patterns = 0;

        foreach ($courses as $course_row) {
            $courseid = $course_row->courseid;

            // Buscar logs do curso no período, excluindo admins
            $admin_ids = array_keys(get_admins());
            $admin_placeholders = implode(',', array_fill(0, count($admin_ids), '?'));

            $params = array_merge([$since, $courseid], $admin_ids);

            $logs = $DB->get_records_sql(
                "SELECT id, userid, ip, timecreated, component, action
                   FROM {logstore_standard_log}
                  WHERE timecreated > ? AND courseid = ? AND userid > 0
                    AND action = 'viewed'
                    AND ip IS NOT NULL AND ip != ''
                    AND userid NOT IN ($admin_placeholders)
                  ORDER BY ip, userid, timecreated ASC",
                $params
            );

            if (empty($logs)) continue;

            // Agrupar por IP → userid → lista de timestamps
            $ip_user_times = [];
            foreach ($logs as $log) {
                if (!filter_var($log->ip, FILTER_VALIDATE_IP)) {
                    continue; // ignorar IPs inválidos
                }
                $ip_user_times[$log->ip][$log->userid][] = (int)$log->timecreated;
            }

            // Analisar cada IP que tem 2+ usuários diferentes
            foreach ($ip_user_times as $ip => $users_times) {
                if (count($users_times) < self::MIN_USERS_PER_IP) continue;

                // Calcular tempo médio por recurso para cada usuário
                $user_stats = [];
                foreach ($users_times as $userid => $times) {
                    sort($times);
                    $avg_time = self::calc_avg_view_time($times);
                    $user_stats[$userid] = [
                        'userid'   => $userid,
                        'times'    => $times,
                        'start'    => min($times),
                        'end'      => max($times),
                        'avg_time' => $avg_time,
                        'suspicious_time' => ($avg_time > 0 && $avg_time < self::MIN_VIEW_TIME),
                    ];
                }

                // Verificar Padrão A — sequencial
                $pattern_a = self::detect_sequential($user_stats);
                // Verificar Padrão B — simultâneo
                $pattern_b = self::detect_simultaneous($user_stats);

                if ($pattern_a || $pattern_b) {
                    $course = $DB->get_record('course', ['id' => $courseid], 'id, fullname');
                    $coursename = $course ? $course->fullname : "Curso $courseid";

                    $pattern_type = $pattern_a ? 'sequential' : 'simultaneous';
                    if ($pattern_a && $pattern_b) $pattern_type = 'both';

                    // Calcular nível de risco
                    $suspicious_count = count(array_filter($user_stats, fn($u) => $u['suspicious_time']));
                    $risk = self::calc_risk($suspicious_count, count($user_stats), $pattern_a && $pattern_b);

                    // Buscar nomes dos usuários
                    $userids_list = array_keys($user_stats);
                    $usernames_map = [];
                    foreach ($userids_list as $uid) {
                        $u = $DB->get_record('user', ['id' => $uid], 'id, firstname, lastname');
                        if ($u) $usernames_map[$uid] = fullname($u);
                    }

                    $record = new \stdClass();
                    $record->ip           = $ip;
                    $record->courseid     = $courseid;
                    $record->coursename   = $coursename;
                    $record->pattern_type = $pattern_type;
                    $record->userids      = json_encode($userids_list);
                    $record->usernames    = json_encode($usernames_map);
                    $record->detail_json  = json_encode($user_stats);
                    $record->risk_level   = $risk;
                    $record->timecreated  = time();

                    $DB->insert_record('report_accessaudit_patterns', $record);
                    $total_patterns++;
                }
            }
        }

        // Reporta a Moodle Insights (si está conectado) el snapshot
        // completo recién generado — fuera de la transacción de inserción
        // de arriba a propósito: si la llamada HTTP falla (sin conexión,
        // Insights caído), el análisis local ya quedó guardado igual, esto
        // es solo un espejo opcional, nunca debe bloquear ni revertir el
        // resultado local.
        try {
            $freshpatterns = $DB->get_records('report_accessaudit_patterns');
            \report_accessaudit\insights_client::report_patterns($freshpatterns);
        } catch (\Exception $e) {
            mtrace('[report_accessaudit] No se pudo reportar a Moodle Insights: ' . $e->getMessage());
        }

        return [
            'patterns_found' => $total_patterns,
            'courses_analyzed' => count($courses),
            'analyzed_at' => time(),
        ];
    }

    /**
     * Calcula o tempo médio entre eventos consecutivos (proxy de "tempo por recurso")
     */
    private static function calc_avg_view_time(array $times): int {
        if (count($times) < 2) return 0;
        $diffs = [];
        for ($i = 1; $i < count($times); $i++) {
            $diff = $times[$i] - $times[$i - 1];
            if ($diff > 0 && $diff < 3600) { // ignorar gaps > 1h (sessão diferente)
                $diffs[] = $diff;
            }
        }
        if (empty($diffs)) return 0;
        return (int)round(array_sum($diffs) / count($diffs));
    }

    /**
     * Detecta padrão sequencial: usuários se revezam no tempo, um após o outro
     */
    private static function detect_sequential(array $user_stats): bool {
        // Ordenar usuários pelo horário de início
        $sorted = array_values($user_stats);
        usort($sorted, fn($a, $b) => $a['start'] - $b['start']);

        $sequential_pairs = 0;
        for ($i = 0; $i < count($sorted) - 1; $i++) {
            $curr = $sorted[$i];
            $next = $sorted[$i + 1];

            // O próximo começa depois que o atual terminou, dentro da janela
            $gap = $next['start'] - $curr['end'];
            if ($gap >= 0 && $gap <= self::SEQUENTIAL_WINDOW) {
                // Verificar que não há sobreposição real (seria simultâneo)
                if ($next['start'] >= $curr['end']) {
                    // Pelo menos um dos dois tem tempo suspeito
                    if ($curr['suspicious_time'] || $next['suspicious_time']) {
                        $sequential_pairs++;
                    }
                }
            }
        }

        return $sequential_pairs >= 1;
    }

    /**
     * Detecta padrão simultâneo: usuários ativos ao mesmo tempo no mesmo IP
     */
    private static function detect_simultaneous(array $user_stats): bool {
        $users = array_values($user_stats);
        for ($i = 0; $i < count($users); $i++) {
            for ($j = $i + 1; $j < count($users); $j++) {
                $a = $users[$i];
                $b = $users[$j];

                // Verificar sobreposição de períodos de atividade
                $overlap_start = max($a['start'], $b['start']);
                $overlap_end   = min($a['end'],   $b['end']);
                $overlap = $overlap_end - $overlap_start;

                if ($overlap >= self::SIMULTANEOUS_WINDOW) {
                    // Pelo menos um tem tempo suspeito
                    if ($a['suspicious_time'] || $b['suspicious_time']) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Calcula o nível de risco baseado nos sinais detectados
     */
    private static function calc_risk(int $suspicious_count, int $total_users, bool $both_patterns): string {
        if ($both_patterns) return 'high';
        $ratio = $total_users > 0 ? $suspicious_count / $total_users : 0;
        if ($ratio >= 0.75) return 'high';
        if ($ratio >= 0.4)  return 'medium';
        return 'low';
    }
}
