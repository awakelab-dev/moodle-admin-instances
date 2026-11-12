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

namespace local_insightssurveys;

defined('MOODLE_INTERNAL') || die();

/**
 * Envío de encuestas de calidad de curso — correo real e inmediato vía
 * email_to_user(), el mismo mecanismo que usa local_courseprogressnotify
 * para sus notificaciones de progreso (probado fiable en esta plataforma).
 *
 * Se descartó mandar esto como mensaje interno de Moodle
 * (core_message_send_instant_messages vía Web Service): Moodle solo lo
 * reenvía por email si el destinatario sigue sin leerlo pasado un tiempo, y
 * depende del cron + de las preferencias de mensajería de cada usuario.
 * email_to_user() es inmediato y no depende de nada de eso, pero solo se
 * puede llamar desde código que corre dentro del propio Moodle — de ahí
 * este plugin.
 *
 * @package local_insightssurveys
 */
class survey_mailer {

    /**
     * @param \stdClass $user Destinatario (de $DB->get_record('user', ...) o core_enrol).
     * @param string $subject
     * @param string $bodyhtml
     * @param string $notificationtype Clave única para el log de deduplicación (p. ej. "survey_<campaignId>_day<N>").
     * @param int $courseid 0 si la campaña no tiene curso asociado (destinatarios manuales).
     * @return bool
     */
    public static function send(\stdClass $user, string $subject, string $bodyhtml, string $notificationtype, int $courseid = 0): bool {
        global $CFG;
        require_once($CFG->libdir . '/weblib.php');

        if (survey_log::has_sent($user->id, $courseid, $notificationtype)) {
            mtrace("    ✓ Ya enviado antes a {$user->email} (se omite)");
            return false;
        }

        if (empty($user->email) || !validate_email($user->email)) {
            mtrace("    ✗ Email inválido o vacío: {$user->email}");
            return false;
        }

        $bodytext = html_to_text($bodyhtml);
        $from = \core_user::get_support_user();

        $sent = email_to_user($user, $from, $subject, $bodytext, $bodyhtml);

        if ($sent) {
            survey_log::log_sent($user->id, $courseid, $notificationtype);
            mtrace("    ✓ Encuesta enviada a {$user->email}");
        } else {
            mtrace("    ✗ Envío fallido a {$user->email} - revisa la configuración de correo de Moodle");
        }
        return $sent;
    }
}
