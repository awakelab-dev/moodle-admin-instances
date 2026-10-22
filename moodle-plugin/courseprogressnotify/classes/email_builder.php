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

use moodle_url;

/**
 * Builds and sends localized HTML emails with plain text fallback.
 *
 * @package   local_courseprogressnotify
 */
class email_builder {

    /**
     * Construye y envía un email con el asunto/cuerpo YA resueltos desde
     * Moodle Insights (ver insights_client::get_config()) — la plantilla
     * viene en un único idioma concreto (template['language']), elegido
     * desde el dashboard; no hay modo "combinado es+ca" ni selección de
     * idioma preferido del usuario aquí, eso quedó en el dashboard.
     *
     * @param \stdClass $user Recipient user
     * @param \stdClass $course Course
     * @param array $template ['language'=>string,'subject'=>string,'bodyHtml'=>string]
     * @param array $placeholders Placeholder mapping
     * @param string $notificationtype Type for the log table
     * @param int|null $entityid Optional related entity id for de-duplication
     * @return bool
     */
    public static function send_from_template(\stdClass $user, \stdClass $course, array $template, array $placeholders,
                                string $notificationtype, ?int $entityid = null): bool {
        global $CFG;
        require_once($CFG->libdir . '/weblib.php');

        mtrace("  → Checking notification for user {$user->id} ({$user->email}), type: {$notificationtype}");

        if (notification_log::has_sent($user->id, $course->id, $notificationtype, $entityid)) {
            mtrace("    ✓ Already sent (skipping)");
            return false;
        }

        if (empty($user->email) || !validate_email($user->email)) {
            mtrace("    ✗ Invalid or missing email address: {$user->email}");
            return false;
        }

        $placeholders['firstname'] = $placeholders['firstname'] ?? $user->firstname;
        $placeholders['lastname']  = $placeholders['lastname'] ?? $user->lastname;
        $placeholders['coursename'] = $placeholders['coursename'] ?? format_string($course->fullname, true, ['context' => \context_course::instance($course->id)]);
        $placeholders['campus_url'] = $placeholders['campus_url'] ?? (new moodle_url('/'))->out(false);

        $subject = self::replace_placeholders((string)($template['subject'] ?? ''), $placeholders);
        $bodyhtml = self::replace_placeholders((string)($template['bodyHtml'] ?? ''), $placeholders);
        $bodytext = html_to_text($bodyhtml);

        $from = \core_user::get_support_user();

        // Los diseños con imágenes incrustadas (cabecera/pie como PNG — ver
        // Moodle Insights, email-designs/assets.ts) necesitan mandarse con
        // addEmbeddedImage(), que email_to_user() no soporta (solo admite
        // un único adjunto por ruta de archivo, no imágenes cid: con el
        // cuerpo HTML). Si el diseño no lleva imágenes (plantilla sin
        // envolver, o algún trigger legacy), se sigue usando el camino
        // normal de Moodle sin tocar nada.
        $images = $template['images'] ?? [];
        mtrace("    → Sending email (plantilla de Moodle Insights): {$subject}");
        if (!empty($images)) {
            $sent = self::send_html_with_embedded_images($user, $from, $subject, $bodytext, $bodyhtml, $images);
        } else {
            $sent = email_to_user($user, $from, $subject, $bodytext, $bodyhtml);
        }

        if ($sent) {
            notification_log::log_sent($user->id, $course->id, $notificationtype, $entityid);
            mtrace("    ✓ Email sent successfully");
        } else {
            mtrace("    ✗ Envío fallido - revisa la configuración de correo de Moodle");
        }
        return $sent;
    }

    /**
     * Igual que email_to_user() pero con imágenes cid: incrustadas en el
     * HTML — replica a mano las protecciones de email_to_user() que
     * importan en una instancia real (noemailever, divertallemailsto,
     * validación del destinatario, Sender/bounce, codificación UTF-8 para
     * HTML) porque get_mailer() por sí solo NO las aplica, solo monta el
     * transporte SMTP. Ver investigación completa en el historial de este
     * cambio — email_to_user() no expone ningún gancho para añadir
     * adjuntos embebidos, así que no queda otra que reimplementar esta
     * parte en vez de envolverla.
     *
     * @param \stdClass $user Recipient
     * @param \stdClass $from Sender (support user)
     * @param string $subject
     * @param string $bodytext Plain-text fallback
     * @param string $bodyhtml HTML body, referencing cid:<cid> for each image
     * @param array $images [{cid, filename, base64}]
     * @return bool
     */
    private static function send_html_with_embedded_images(\stdClass $user, \stdClass $from, string $subject,
                                string $bodytext, string $bodyhtml, array $images): bool {
        global $CFG;

        if (!empty($CFG->noemailever)) {
            debugging('No se envía el email por $CFG->noemailever', DEBUG_DEVELOPER);
            return true;
        }

        if (email_should_be_diverted($user->email)) {
            $subject = "[DIVERTED {$user->email}] {$subject}";
            $user = clone($user);
            $user->email = $CFG->divertallemailsto;
        }

        if (empty($user->email) || !validate_email($user->email)) {
            mtrace("    ✗ Invalid or missing email address: {$user->email}");
            return false;
        }

        $noreplyaddressdefault = 'noreply@' . get_host_from_url($CFG->wwwroot);
        $noreplyaddress = empty($CFG->noreplyaddress) ? $noreplyaddressdefault : $CFG->noreplyaddress;
        if (!validate_email($noreplyaddress)) {
            $noreplyaddress = $noreplyaddressdefault;
        }

        $mail = get_mailer();
        $mail->Sender = $noreplyaddress;
        $mail->From = $noreplyaddress;
        $mail->FromName = fullname($from);
        $mail->Subject = substr($subject, 0, 900);
        $mail->addAddress($user->email, fullname($user));
        $mail->isHTML(true);
        $mail->Encoding = 'quoted-printable';
        $mail->CharSet = 'UTF-8';
        $mail->Body = $bodyhtml;
        $mail->AltBody = $bodytext;
        if (empty($mail->MessageID)) {
            $mail->MessageID = generate_email_messageid();
        }

        foreach ($images as $image) {
            $cid = (string)($image['cid'] ?? '');
            $filename = (string)($image['filename'] ?? ($cid . '.png'));
            $base64 = (string)($image['base64'] ?? '');
            if ($cid === '' || $base64 === '') {
                continue;
            }
            $binary = base64_decode($base64, true);
            if ($binary === false) {
                continue;
            }
            $mail->addStringEmbeddedImage($binary, $cid, $filename, 'base64', 'image/png');
        }

        if ($mail->send()) {
            return true;
        }

        mtrace('Error: ' . $mail->ErrorInfo);
        \core\event\email_failed::create([
            'context' => \context_system::instance(),
            'userid' => $from->id,
            'relateduserid' => $user->id,
            'other' => [
                'subject' => $subject,
                'message' => $bodytext,
                'errorinfo' => $mail->ErrorInfo,
            ],
        ])->trigger();
        return false;
    }

    /**
     * Replace {{placeholder}} occurrences with provided values.
     *
     * @param string $template
     * @param array $values
     * @return string
     */
    public static function replace_placeholders(string $template, array $values): string {
        $replacements = [];
        foreach ($values as $k => $v) {
            $replacements['{{' . $k . '}}'] = (string)$v;
        }
        return strtr($template, $replacements);
    }

}
