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

$string['pluginname'] = 'Enquestes de qualitat (Moodle Insights)';
$string['settings:insights_heading'] = 'Connexió amb Moodle Insights';
$string['settings:insights_heading_desc'] = 'Quines campanyes d\'enquesta estan actives i a qui s\'han d\'enviar es configura des de Moodle Insights, secció "Enquestes" — no aquí. Aquest plugin només necessita saber com connectar-se.';
$string['settings:insights_url'] = 'URL de Moodle Insights';
$string['settings:insights_url_desc'] = 'Ex: https://moodle-dashboard.awakelab.world (sense barra final).';
$string['settings:insights_api_key'] = 'API key de notificacions';
$string['settings:insights_api_key_desc'] = 'La mateixa API key que ja es va generar per a Gestió de Notificacions, des de Configuració > Plataformes, per a aquesta plataforma en concret.';
$string['settings:run:desc'] = 'Prova manual, sense esperar al cron diari (9:45):';

$string['task_check_survey_campaigns'] = 'Enquestes de qualitat (Moodle Insights)';

$string['runpage:title'] = 'Enquestes de qualitat — prova manual';
$string['runpage:heading'] = 'Verificar enquestes ara';
$string['runpage:desc'] = 'Revisar les campanyes d\'enquesta actives a Moodle Insights i enviar, a qui li toqui avui, el missatge amb l\'enllaç a l\'enquesta (si no se li ha enviat ja aquell dia concret).';
$string['run_now_button'] = 'Provar Enquestes Ara';
$string['run_now_done'] = 'La verificació s\'ha executat correctament.';
$string['run_now_error'] = 'La verificació ha acabat amb errors:';
$string['survey_email_subject'] = 'Enquesta de qualitat del curs';
$string['backtosettings'] = '← Tornar a configuració';
$string['local/insightssurveys:run'] = 'Executar manualment la verificació d\'enquestes';
