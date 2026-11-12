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

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Encuestas de calidad (Moodle Insights)';
$string['settings:insights_heading'] = 'Conexión con Moodle Insights';
$string['settings:insights_heading_desc'] = 'Qué campañas de encuesta están activas y a quién hay que mandárselas se configura desde Moodle Insights, sección "Encuestas" — no aquí. Este plugin solo necesita saber cómo conectarse.';
$string['settings:insights_url'] = 'URL de Moodle Insights';
$string['settings:insights_url_desc'] = 'Ej: https://moodle-dashboard.awakelab.world (sin barra final).';
$string['settings:insights_api_key'] = 'API key de notificaciones';
$string['settings:insights_api_key_desc'] = 'La misma API key que ya se generó para Gestión de Notificaciones, desde Configuración > Plataformas, para esta plataforma en concreto.';
$string['settings:run:desc'] = 'Prueba manual, sin esperar al cron diario (9:45):';

$string['task_check_survey_campaigns'] = 'Encuestas de calidad (Moodle Insights)';

$string['runpage:title'] = 'Encuestas de calidad — prueba manual';
$string['runpage:heading'] = 'Verificar encuestas ahora';
$string['runpage:desc'] = 'Revisar las campañas de encuesta activas en Moodle Insights y mandar, a quien le toque hoy, el mensaje con el enlace a la encuesta (si no se le ha mandado ya ese día concreto).';
$string['run_now_button'] = 'Probar Encuestas Ahora';
$string['run_now_done'] = 'La verificación se ejecutó correctamente.';
$string['run_now_error'] = 'La verificación terminó con errores:';
$string['survey_email_subject'] = 'Encuesta de calidad del curso';
$string['backtosettings'] = '← Volver a configuración';
$string['local/insightssurveys:run'] = 'Ejecutar manualmente la verificación de encuestas';
