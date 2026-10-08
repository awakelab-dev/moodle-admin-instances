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

namespace local_courseprogressnotify;

defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/../../../lib/completionlib.php');
require_once(__DIR__ . '/../../../lib/gradelib.php');

use completion_info;
use html_writer;
use grade_item;
use grade_grade;

/**
 * Calculates user progress and builds an HTML table for progress.
 *
 * @package   local_courseprogressnotify
 */
class progress_calculator {

    /**
     * Get course progress percentage for a user (0-100).
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return float
     */
    public static function get_progress_percentage(\stdClass $course, \stdClass $user): float {
        $completion = new completion_info($course);
        if (!$completion->is_enabled()) {
            return 0.0;
        }

        $cms = $completion->get_activities();
        $trackable = 0;
        $completed = 0;
        foreach ($cms as $cm) {
            if (!$completion->is_enabled($cm)) {
                continue;
            }
            $trackable++;
            $data = $completion->get_data($cm, false, $user->id);
            if (!empty($data) && (int)$data->completionstate >= COMPLETION_COMPLETE) {
                $completed++;
            }
        }
        if ($trackable === 0) {
            return 0.0;
        }
        return round(($completed / $trackable) * 100, 1);
    }

    /**
     * % de calificaciones APROBADAS entre las YA calificadas (excluye el
     * total del curso y las categorías, solo mira items de actividad
     * individuales) — usado por el disparador de "variante por
     * calificaciones" (progress_50/progress_75, ver NOTIFICATION_TRIGGERS
     * en el backend). Null si el alumno todavía no tiene ninguna
     * calificación puesta: el llamador lo trata como "sin reprobados
     * todavía" (variante positiva), no como 0%.
     *
     * Aprobado = nota >= gradepass del item si está configurado, si no >=
     * 50% de grademax (fallback razonable cuando el profesor no definió un
     * umbral de aprobado explícito en ese item).
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return float|null
     */
    public static function get_grade_pass_percentage(\stdClass $course, \stdClass $user): ?float {
        $items = grade_item::fetch_all(['courseid' => $course->id]);
        if (empty($items)) {
            return null;
        }

        $graded = 0;
        $passed = 0;
        foreach ($items as $item) {
            if (in_array($item->itemtype, ['course', 'category'], true)) {
                continue;
            }
            $grade = grade_grade::fetch(['itemid' => $item->id, 'userid' => $user->id]);
            if (!$grade || $grade->finalgrade === null) {
                continue;
            }
            $graded++;
            $passmark = !empty($item->gradepass) ? (float)$item->gradepass : ((float)$item->grademax * 0.5);
            if ((float)$grade->finalgrade >= $passmark) {
                $passed++;
            }
        }

        if ($graded === 0) {
            return null;
        }
        return round(($passed / $graded) * 100, 1);
    }

    /**
     * Resuelve qué plantilla usar para un trigger que puede tener variantes
     * (ver `variantParam`/`variants`/`threshold` en la respuesta de
     * insights_client::get_config() — hoy solo progress_50/progress_75, con
     * el parámetro elegido en el dashboard: calificaciones, asistencia o
     * riesgo de abandono). Si el trigger no tiene variantes configuradas, o
     * el parámetro no es uno que sepamos evaluar, devuelve simplemente la
     * plantilla única ($trigconf['template']), igual que antes.
     *
     * Para 'grades'/'attendance' (más alto = mejor), sin datos todavía se
     * trata como positivo (nada reprobado/sin tomar asistencia aún, no hay
     * motivo para un aviso negativo). Para 'inactivity_risk' (menos días =
     * mejor) get_days_inactive() nunca devuelve null — un alumno que nunca
     * entró se cuenta como máximo riesgo, no como neutral.
     *
     * @param array $trigconf Entrada de $config[trigger] (ver insights_client::get_config()).
     * @param \stdClass $course
     * @param \stdClass $user
     * @return array|null Plantilla ['language'=>..,'subject'=>..,'bodyHtml'=>..] o null si no hay ninguna disponible.
     */
    public static function resolve_template_for_trigger(array $trigconf, \stdClass $course, \stdClass $user): ?array {
        $template = $trigconf['template'] ?? null;
        $variantparam = $trigconf['variantParam'] ?? null;
        if (empty($variantparam) || empty($trigconf['variants'])) {
            return $template;
        }

        switch ($variantparam) {
            case 'grades':
                $value = self::get_grade_pass_percentage($course, $user);
                $higherisbetter = true;
                break;
            case 'attendance':
                $value = self::get_attendance_percentage($course, $user);
                $higherisbetter = true;
                break;
            case 'inactivity_risk':
                $value = self::get_days_inactive($course, $user);
                $higherisbetter = false;
                break;
            default:
                return $template;
        }

        $threshold = isset($trigconf['threshold']) ? (float)$trigconf['threshold'] : 50.0;
        $ispositive = $value === null ? true : ($higherisbetter ? $value >= $threshold : $value <= $threshold);
        $variantkey = $ispositive ? 'positive' : 'negative';
        return $trigconf['variants'][$variantkey] ?? $template;
    }

    /**
     * % de sesiones de asistencia (módulo mod_attendance) marcadas como
     * presente, sobre las sesiones ya pasadas y que ya tienen asistencia
     * tomada para este alumno. Null si el curso no usa mod_attendance, o
     * si está instalado pero no hay ninguna sesión con asistencia tomada
     * todavía (igual que get_grade_pass_percentage: sin datos = sin
     * motivo para un aviso negativo).
     *
     * "Presente" = puntos de ese status > 0 (mod_attendance permite varios
     * status con distinto valor de puntos — p. ej. "Tarde" puede valer
     * menos que "Presente" pero más que "Ausente"; aquí solo se mira si
     * sumó algo de puntos, no el valor exacto).
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return float|null
     */
    public static function get_attendance_percentage(\stdClass $course, \stdClass $user): ?float {
        global $DB;

        if (!$DB->get_manager()->table_exists('attendance')) {
            return null; // mod_attendance no instalado en esta plataforma.
        }

        $instanceids = $DB->get_fieldset_select('attendance', 'id', 'course = :courseid', ['courseid' => $course->id]);
        if (empty($instanceids)) {
            return null;
        }

        [$insql, $inparams] = $DB->get_in_or_equal(array_values($instanceids), SQL_PARAMS_NAMED, 'attendanceid');

        $sql = "SELECT l.statusid, s.grade AS statuspoints
                  FROM {attendance_log} l
                  JOIN {attendance_sessions} sess ON sess.id = l.sessionid
                  JOIN {attendance_statuses} s ON s.id = l.statusid
                 WHERE sess.attendanceid {$insql} AND sess.sessdate <= :now AND l.studentid = :studentid";
        $params = array_merge($inparams, ['now' => time(), 'studentid' => $user->id]);
        $logs = $DB->get_records_sql($sql, $params);

        if (empty($logs)) {
            return null;
        }

        $present = 0;
        foreach ($logs as $log) {
            if ((float)$log->statuspoints > 0) {
                $present++;
            }
        }
        return round(($present / count($logs)) * 100, 1);
    }

    /**
     * Días desde el último acceso del alumno a ESTE curso (no al sitio en
     * general). A diferencia de las otras dos métricas, nunca devuelve
     * null: un alumno sin ningún acceso registrado se trata como el peor
     * caso posible (máximo riesgo), no como "sin datos".
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return float
     */
    public static function get_days_inactive(\stdClass $course, \stdClass $user): float {
        global $DB;
        $record = $DB->get_record('user_lastaccess', ['userid' => $user->id, 'courseid' => $course->id]);
        if (!$record || empty($record->timeaccess)) {
            return 9999.0;
        }
        return round((time() - $record->timeaccess) / DAYSECS, 1);
    }

    /**
     * Build an HTML table with the progress of the user per activity.
     *
     * @param \stdClass $course
     * @param \stdClass $user
     * @return string HTML
     */
    public static function build_progress_table_html(\stdClass $course, \stdClass $user): string {
        $completion = new completion_info($course);
        if (!$completion->is_enabled()) {
            return '';
        }
        $cms = $completion->get_activities();
        if (empty($cms)) {
            return '';
        }
        $rows = [];
        foreach ($cms as $cm) {
            if (!$completion->is_enabled($cm)) {
                continue;
            }
            $data = $completion->get_data($cm, false, $user->id);
            $done = (!empty($data) && (int)$data->completionstate >= COMPLETION_COMPLETE);
            $status = $done ? get_string('progress:status:complete', 'local_courseprogressnotify') : get_string('progress:status:incomplete', 'local_courseprogressnotify');
            $name = format_string($cm->name, true, ['context' => \context_module::instance($cm->id)]);
            $rows[] = [s($name), s($status)];
        }

        if (empty($rows)) {
            return '';
        }

        $html = html_writer::start_tag('table', ['class' => 'generaltable local-courseprogressnotify-progress']);
        $html .= html_writer::start_tag('thead');
        $html .= html_writer::start_tag('tr');
        $html .= html_writer::tag('th', get_string('progress:header:activity', 'local_courseprogressnotify'));
        $html .= html_writer::tag('th', get_string('progress:header:status', 'local_courseprogressnotify'));
        $html .= html_writer::end_tag('tr');
        $html .= html_writer::end_tag('thead');
        $html .= html_writer::start_tag('tbody');
        foreach ($rows as [$n, $s]) {
            $html .= html_writer::start_tag('tr');
            $html .= html_writer::tag('td', $n);
            $html .= html_writer::tag('td', $s);
            $html .= html_writer::end_tag('tr');
        }
        $html .= html_writer::end_tag('tbody');
        $html .= html_writer::end_tag('table');
        return $html;
    }
}
