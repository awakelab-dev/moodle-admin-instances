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

$string['pluginname'] = 'Notificacions de progrés de curs';

// Custom field settings.
$string['customfield_shortname'] = 'Nom curt del camp personalitzat';
$string['customfield_shortname_desc'] = 'Introduïu el nom curt del camp personalitzat del curs (casella de verificació) que habilita les notificacions per a cursos individuals. Només els cursos amb aquest camp habilitat rebran notificacions. El camp personalitzat s\'ha de crear a Administració del lloc → Cursos → Camps personalitzats del curs. Recomanat: courseemailnotifications_enabled';

// Scheduled task names.
$string['task_check_progress_25'] = 'Notificació de progrés 25%';
$string['task_check_progress_50'] = 'Notificació de progrés 50%';
$string['task_check_course_end_soon'] = 'Avís: 7 dies abans de finalitzar el curs';
$string['task_check_course_last_day'] = 'Avís: darrer dia del curs';
$string['task_check_zoom_sessions'] = 'Recordatoris de sessions Zoom';
$string['task_check_presential_sessions'] = 'Recordatoris de sessions presencials';
$string['task_check_diploma_available'] = 'Avís: diploma disponible (30 dies)';
$string['task_check_first_day_tasks'] = 'Primer dia: tasques inicials';
$string['task_check_second_day_tasks'] = 'Segon dia: navegadors i finestres emergents';

// Manual run page.
$string['runpage:title'] = 'Verificació manual de notificacions';
$string['runpage:heading'] = 'Verificar notificacions ara';
$string['runpage:desc'] = 'Pots executar manualment diferents verificacions de notificacions. Selecciona el tipus que vols provar:';
$string['runpage:type_progress'] = 'Notificacions de Progrés (25% i 50%)';
$string['runpage:confirm_progress'] = 'Revisar tots els estudiants dels cursos amb notificacions habilitades i enviar correus als que hagin assolit el 25% o 50% de progrés (si no han estat notificats prèviament).';
$string['runpage:type_courseend'] = 'Notificacions de Fi de Curs (7 dies abans i últim dia)';
$string['runpage:confirm_courseend'] = 'Revisar cursos que finalitzen aviat (exactament dins de 7 dies) o avui, i enviar recordatoris als estudiants matriculats (si no han estat notificats prèviament).';
$string['runpage:type_zoom'] = 'Notificacions de Sessions Zoom';
$string['runpage:confirm_zoom'] = 'Revisar sessions Zoom properes (segons dies configurats) i enviar recordatoris als estudiants matriculats (si no han estat notificats prèviament).';
$string['runpage:type_presential'] = 'Notificacions de Sessions Presencials (Exàmens i Tutories)';
$string['runpage:confirm_presential'] = 'Detectar automàticament sessions presencials d\'esdeveniments del calendari (per ubicació i paraules clau) i enviar recordatoris als estudiants matriculats (si no han estat notificats prèviament).';
$string['runpage:type_diploma'] = 'Notificacions de Diploma Disponible (30 dies)';
$string['runpage:confirm_diploma'] = 'Revisar cursos que van finalitzar fa exactament 30 dies i enviar notificació de diploma disponible a tots els estudiants matriculats (si no han estat notificats prèviament).';
$string['runpage:type_firstday'] = 'Notificacions de Primer Dia (Tasques Inicials)';
$string['runpage:confirm_firstday'] = 'Revisar cursos que inicien avui i enviar als estudiants les instruccions sobre signatura de normativa, rebut de material i requisits del curs.';
$string['runpage:type_secondday'] = 'Notificacions de Segon Dia (Navegadors)';
$string['runpage:confirm_secondday'] = 'Revisar cursos en el seu segon dia i enviar als estudiants informació sobre navegadors compatibles i configuració de finestres emergents.';
$string['runpage:confirm'] = 'Fes clic al botó per iniciar la verificació. Es revisaran tots els estudiants dels cursos amb notificacions habilitades i s\'enviaran correus als que hagin assolit el 25% o 50% de progrés (si no han estat notificats prèviament).';
$string['run_progress_button'] = 'Provar Correus de Progrés';
$string['run_courseend_button'] = 'Provar Correus de Fi de Curs';
$string['run_zoom_button'] = 'Provar Correus de Zoom';
$string['run_presential_button'] = 'Provar Correus de Sessions Presencials';
$string['run_diploma_button'] = 'Provar Correus de Diploma';
$string['run_firstday_button'] = 'Provar Correus de Primer Dia';
$string['run_secondday_button'] = 'Provar Correus de Segon Dia';
$string['run_clear_button'] = 'Netejar registres i executar';
$string['run_ignore_restrictions_button'] = 'Enviar a tots (ignorar dates)';
$string['settings:send_course_firstday'] = '1r Dia (ignorar dates)';
$string['settings:send_course_diploma'] = 'Diploma (ignorar dates)';
$string['backtosettings'] = 'Tornar a configuració';
$string['coursespage:title'] = 'Plugin: Notificaciones';
$string['coursespage:desc'] = 'Configura el mode «només diploma» i executa enviaments manuals per curs. Els canvis dels toggles es desen en fer clic a Desa.';
$string['coursespage:saved'] = 'Configuració desada correctament.';
$string['local/courseprogressnotify:managecourses'] = 'Gestionar la configuració de notificacions per curs';
$string['run_now_button'] = 'Verificar notificacions ara';
$string['run_now_done'] = 'La verificació s\'ha executat correctament.';
$string['run_now_error'] = 'S\'ha produït un error durant l\'execució:';
$string['runpage:nocategory'] = 'No hi ha cap camp personalitzat configurat. Configureu el nom curt del camp personalitzat per habilitar les operacions del connector.';
$string['runpage:course_selector_heading'] = 'Selecció de curs';
$string['runpage:course_selector_desc'] = 'Seleccioneu un curs específic per limitar la verificació a aquell curs, o deixeu "Tots els cursos" per executar en tots els cursos habilitats.';
$string['runpage:all_courses'] = 'Tots els cursos';

// Settings.

$string['settings:zoomdaysbefore'] = 'Dies abans per a la invitació Zoom';
$string['settings:zoomdaysbefore_desc'] = 'Nombre de dies abans de la data de la sessió Zoom per enviar la invitació automàtica.';
$string['settings:presentialdaysbefore'] = 'Dies abans per a sessions presencials';
$string['settings:presentialdaysbefore_desc'] = 'Nombre de dies abans de la sessió presencial (examen/tutoria) per enviar el recordatori.';
$string['settings:send_combined_email'] = 'Enviar correus combinats en espanyol i català';
$string['settings:send_combined_email_desc'] = 'Quan està habilitat, els correus contindran tant la versió en espanyol com en català en el mateix missatge. Quan està deshabilitat, els correus s\'enviaran només en l\'idioma preferit de l\'usuari.';

// Paraules clau per a classificació de sessions presencials.
$string['settings:presential_keywords_heading'] = 'Paraules clau de classificació';
$string['settings:presential_keywords_heading_desc'] = 'Aquestes paraules clau determinen com es classifiquen els esdeveniments del calendari com a exàmens o tutories. <strong>Un esdeveniment només es detecta com a presencial si té una ubicació definida.</strong> Els accents s\'ignoren en comparar (p.ex., &ldquo;sessi&oacute;&rdquo; també coincideix amb &ldquo;sessio&rdquo;). Introduïu una paraula clau per línia.';
$string['settings:presential_exam_keywords'] = 'Paraules clau per a exàmens';
$string['settings:presential_exam_keywords_desc'] = 'Si alguna d\'aquestes paraules apareix al nom o descripció d\'un esdeveniment del calendari, es classificarà com a <strong>examen</strong>. Una paraula clau per línia.';
$string['settings:presential_tutoring_keywords'] = 'Paraules clau per a tutories / sessions';
$string['settings:presential_tutoring_keywords_desc'] = 'Si alguna d\'aquestes paraules apareix al nom o descripció d\'un esdeveniment del calendari, es classificarà com a <strong>tutoria</strong>. Una paraula clau per línia.';

// Run block in settings page.
$string['settings:run:desc'] = 'Executa manualment les verificacions de notificacions des d\'aquesta pàgina. S\'aplicarà als cursos amb notificacions habilitades mitjançant el camp personalitzat.';

// Configuració cursos només-diploma.
$string['settings:diploma_only_heading'] = 'Configuració avançada per curs';
$string['settings:diploma_only_heading_desc'] = 'Configura el comportament del plugin per a cada curs: activa el mode «només diploma» per suprimir la resta de correus, o executa enviaments manuals ignorant les restriccions de data.';
$string['settings:diploma_only_courses'] = 'Configuració per curs';
$string['settings:diploma_only_courses_desc'] = 'Els cursos marcats en <span style="color:#721c24;font-weight:700">vermell/groc</span> tenen el mode «només diploma» actiu — revisa-ho bé abans de desar.';
$string['settings:col_course'] = 'Curs';
$string['settings:col_diploma_only'] = 'Només enviar diploma';
$string['settings:col_manual_send'] = 'Enviament manual (sense dates)';
$string['settings:diploma_only_configure_first'] = 'Configura primer el nom curt del camp personalitzat.';
$string['settings:diploma_only_no_courses'] = 'No hi ha cursos habilitats per a aquest connector (cap curs té el camp personalitzat actiu).';
$string['settings:diploma_only_active_badge'] = '⚠ NOMÉS DIPLOMA';
$string['settings:diploma_only_warning_active'] = 'ATENCIÓ: un o més cursos tenen el mode només-diploma actiu. NO s\'enviaran correus no-diploma als estudiants d\'aquells cursos.';

// Progress table.
$string['progress:header:activity'] = 'Activitat';
$string['progress:header:status'] = 'Estat';
$string['progress:status:complete'] = 'Completat';
$string['progress:status:incomplete'] = 'Pendent';

// Privacy.
$string['privacy:metadata'] = 'El connector local_courseprogressnotify emmagatzema registres de notificacions enviades als usuaris.';
$string['privacy:metadata:local_courseprogressnotify_log'] = 'Registre de notificacions enviades';
$string['privacy:metadata:local_courseprogressnotify_log:userid'] = 'Usuari destinatari';
$string['privacy:metadata:local_courseprogressnotify_log:courseid'] = 'Curs associat a la notificació';
$string['privacy:metadata:local_courseprogressnotify_log:notification_type'] = 'Tipus de notificació enviada';
$string['privacy:metadata:local_courseprogressnotify_log:entityid'] = 'Identificador de l\'entitat associada (p. ex., Zoom o sessió)';
$string['privacy:metadata:local_courseprogressnotify_log:time_sent'] = 'Marca temporal de l\'enviament';

// Email templates (from emails_ca.txt).
$string['email_zoom_subject'] = 'Sessió Zoom del curs {{coursename}}';
$string['email_zoom_body'] = '<p>Hola {{firstname}}!</p>

<p>T\'escrivim en relació al curs <strong>{{coursename}}</strong> que estàs realitzant.</p>

<p>Et recordem que el proper <strong>{{zoom_date}}</strong>, de <strong>{{zoom_start}}</strong> a <strong>{{zoom_end}}</strong>, tindrà lloc una sessió en directe per Zoom amb el/la tutor/a.</p>

<p>El mateix dia de la sessió, quan accedeixis a la plataforma, veuràs l\'enllaç per unir-te directament a la videotrucada.</p>
<p><img src="{{image_zoom_link_ca}}" alt="Ubicació de l\'enllaç Zoom" style="max-width: 100%; height: auto;"></p>
<p>Aquesta sessió té com a objectiu:</p>
<ul>
  <li>Resoldre dubtes del curs</li>
  <li>Profunditzar en continguts específics</li>
  <li>Fer una sessió més dinàmica i pràctica</li>
</ul>

<p>T’esperem!</p>';

$string['email_25_subject'] = 'Seguiment del 25% del curs {{coursename}}';
$string['email_25_body'] = '<p>Benvingut/da {{firstname}},</p>

<p>T\'informem que has assolit el <strong>25%</strong> del curs <strong>{{coursename}}</strong>. Aquesta és la teva evolució fins avui:</p>

{{progress_table}}

<p>Encara hi ha temps per finalitzar el curs, que conclou el <strong>{{courseenddate}}</strong>. Recorda que per completar-lo cal:</p>

<ul>
  <li>Arribar a una connexió mínima del 75% de les hores</li>
  <li>Visualitzar el 100% dels continguts</li>
  <li>Realitzar les activitats d\'avaluació</li>
</ul>

<p>Recorda també completar el <strong>Qüestionari de valoració de l\'alumne</strong>, disponible a l\'apartat d\'avaluació de la qualitat.</p>

<p><img src="{{image_progress_25}}" alt="Informe de progrés" style="max-width: 100%; height: auto;"></p>

<p>Per a qualsevol dubte, contacta amb nosaltres.</p>

<p>Salutacions,</p>';

$string['email_50_subject'] = 'Seguiment meitat del curs {{coursename}}';
$string['email_50_body'] = '<p>Benvingut/da {{firstname}}!</p>

<p>Ja hem arribat a la meitat del curs <strong>{{coursename}}</strong>. El curs finalitza el <strong>{{courseenddate}}</strong> i per completar-lo cal visualitzar tots els continguts i realitzar les activitats.</p>

<p>Pots conèixer l\'evolució respecte als aspectes bàsics d\'aquest curs consultant les barres de PROGRÉS DEL CURS. Totes dues es troben ubicades a la columna dreta de la teva pantalla principal i mostren en color verd els fites assolides i el vermell els que encara has d\'afrontar.</p>

<p><img src="{{image_progress_50}}" alt="Ubicació del progrés del curs" style="max-width: 100%; height: auto;"></p>

<p>Aquesta és la teva evolució fins al dia d\'avui:</p>

{{progress_table}}

<p>T\'animem a continuar avançant i a contactar amb nosaltres davant qualsevol dubte.</p>

<p>Una salutació,</p>';

$string['email_end_soon_subject'] = 'Recta final del curs {{coursename}}';
$string['email_end_soon_body'] = '<p>Hola {{firstname}}!</p>

<p>Hem entrat a l\'última setmana del curs <strong>{{coursename}}</strong>, que finalitza el proper <strong>{{courseenddate}}</strong>.</p>

<p>Recorda els requisits de finalització:</p>

<ul>
  <li>Completar les avaluacions</li>
  <li>Visualitzar el 100% dels continguts</li>
  <li>Arribar al 75% de connexió</li>
</ul>

<p>Aprofita aquests darrers dies per finalitzar el curs.</p>

<p>Molts ànims!</p>';

$string['email_last_day_subject'] = 'Instruccions de finalització del curs {{coursename}}';
$string['email_last_day_body'] = '<p>Hola {{firstname}},</p>

<p>Et recordem que demà és l\'últim dia de formació del curs <strong>{{coursename}}</strong>.</p>

<p>Ha estat un plaer comptar amb tu i esperem que l\'experiència hagi estat profitosa.</p>

<p>Si encara no ho has fet, completa les avaluacions i verifica que has visualitzat tots els continguts per obtenir el diploma.</p>

<p>També pots realitzar el qüestionari de satisfacció final disponible a l\'apartat d\'avaluació de la qualitat.</p>

<p><img src="{{image_quality_survey}}" alt="Ubicació del qüestionari de qualitat" style="max-width: 100%; height: auto;"></p>

<p>Un cop finalitzat el curs, ens posarem en contacte per informar-te de la disponibilitat del diploma.</p>

<p>Gràcies per la teva participació.</p>

<p>Una cordial salutació,</p>';

// ── Informe d'activitat ───────────────────────────────────────────────────────
$string['report:title']   = 'Informe d\'activitat de notificacions';
$string['report:heading'] = 'Informe d\'activitat de notificacions';
$string['settings:report_link']      = 'Informe d\'activitat';
$string['settings:report_link_desc'] = 'Visualitza un informe detallat dels correus enviats per cada curs habilitat i per què els pendents encara no s\'han activat.';
$string['report:viewreport'] = 'Veure informe d\'activitat';

// Resum del curs.
$string['report:intro']             = 'Mostrant activitat de {$a} curs(os) amb notificacions habilitades.';
$string['report:nocourses']         = 'Cap curs té les notificacions habilitades amb el camp personalitzat configurat.';
$string['report:no_courses_in_filter'] = 'Cap curs coincideix amb el filtre actual.';
$string['report:haswarnings']       = 'Té advertències de configuració';
$string['report:open_course']       = 'Obrir curs';
$string['report:startdate']         = 'Data d\'inici';
$string['report:enddate']           = 'Data de fi';
$string['report:students']          = 'Estudiants matriculats';
$string['report:completion']        = 'Finalització habilitada';
$string['report:notset']            = 'No configurat';

// Barra de resum.
$string['report:summary_total']    = '{$a} curs(os) habilitat(s)';
$string['report:summary_warnings'] = '{$a} amb advertències de configuració';
$string['report:summary_sent']     = '{$a} registres de correu total';
$string['report:filter_label']     = 'Mostrar:';
$string['report:filter_all']       = 'Tots els cursos ({$a})';
$string['report:filter_warnings']  = 'Només amb advertències ({$a})';

// Advertències.
$string['report:warnings']               = 'Advertències de configuració';
$string['report:warn_start_past_year']   = 'La data d\'inici està configurada a {$a->year} ({$a->date}). Les tasques de primer i segon dia només s\'executen en la data exacta d\'inici — amb aquesta configuració aquests correus no s\'enviaran mai.';
$string['report:warn_end_past_year']     = 'La data de fi està configurada a {$a->year} ({$a->date}). Els correus de fi de curs (7 dies abans, últim dia, diploma) no es dispararan mai.';
$string['report:warn_no_completion']     = 'La finalització del curs està desactivada. Els correus de progrés (25%, 50%) no es poden enviar.';
$string['report:warn_no_enddate']        = 'No hi ha cap data de fi configurada. Els correus de fi de curs i diploma no es dispararan.';

// Historial de notificacions.
$string['report:notificationsent'] = 'Historial de notificacions';
$string['report:notiftype']        = 'Tipus de notificació';
$string['report:sentcount']        = 'Enviats';
$string['report:lastsent']         = 'Darrer enviament';
$string['report:statusreason']     = 'Estat / Motiu';

// Etiquetes de tipus de notificació.
$string['report:notiftype_first_day']           = 'Tasques del primer dia';
$string['report:notiftype_second_day']          = 'Segon dia (info de navegadors)';
$string['report:notiftype_progress25']          = 'Progrés 25%';
$string['report:notiftype_progress50']          = 'Progrés 50%';
$string['report:notiftype_end_soon']            = 'Fi de curs proper (7 dies)';
$string['report:notiftype_last_day']            = 'Recordatori últim dia';
$string['report:notiftype_zoom']                = 'Recordatori sessió Zoom';
$string['report:notiftype_presential_exam']     = 'Recordatori examen presencial';
$string['report:notiftype_presential_tutoring'] = 'Recordatori tutoria presencial';
$string['report:notiftype_diploma']             = 'Diploma disponible';

// Motius d'estat.
$string['report:reason_sent_n']            = 'Enviat a {$a->n} de {$a->total} estudiants matriculats';
$string['report:reason_no_startdate']      = 'No hi ha cap data d\'inici configurada';
$string['report:reason_wrong_start_year']  = 'L\'any de la data d\'inici és {$a->year} ({$a->date}) — les tasques només s\'executen en la data exacta d\'inici. Corregeix l\'any a l\'any actual.';
$string['report:reason_starts_today']      = 'El curs comença avui — la tasca s\'executarà en la propera execució programada d\'avui';
$string['report:reason_future_start']      = 'El curs encara no ha començat — la tasca s\'executarà el {$a->date}';
$string['report:reason_window_passed']          = 'Finestra passada (fa {$a->days} dies des de la data d\'inici).';
$string['report:reason_fires_today']            = 'Condició complerta avui — la tasca s\'executarà en la propera execució programada';
$string['report:reason_in_recovery_window']     = 'Dins de la finestra de recuperació — el proper cron ho enviarà';
$string['report:firstday_diag_toggle']          = 'Diagnosticar';
$string['report:firstday_diag_window']          = 'Finestra activa del cron:';
$string['report:firstday_diag_startdate']       = 'Data d\'inici del curs:';
$string['report:firstday_diag_inwindow']        = 'A la finestra?';
$string['report:firstday_diag_inwindow_yes']    = 'Sí — el proper cron enviarà el correu';
$string['report:firstday_diag_inwindow_no']     = 'No — fora de la finestra de 2 dies. El correu no es pot enviar automàticament.';
$string['report:firstday_diag_viewlogs']        = 'Veure logs del cron →';
$string['report:reason_no_completion']     = 'La finalització del curs està desactivada — no es pot fer seguiment del progrés';
$string['report:reason_below_threshold']   = 'Cap estudiant ha assolit encara el llindar del {$a->pct}% de progrés';
$string['report:reason_no_enddate']        = 'No hi ha cap data de fi configurada';
$string['report:reason_end_in_n_days']     = 'El curs finalitza en {$a->days} dies — aquest correu es dispararà en {$a->fires} dies (quan quedin exactament 7 dies)';
$string['report:reason_end_window_passed_n'] = 'La finestra de 7 dies ha passat sense enviament. La data de fi era {$a->date}. Verifica que la tasca s\'ha executat en el moment correcte.';
$string['report:reason_course_ended']      = 'El curs va finalitzar el {$a->date}';
$string['report:reason_last_day_future']   = 'Es dispararà el {$a->date} (d\'aquí a {$a->days} dies — el dia abans del fi del curs)';
$string['report:reason_diploma_future']    = 'Es dispararà el {$a->date} (30 dies després del fi del curs)';
$string['report:reason_diploma_pending']   = 'Es dispararà en {$a->days} dia(es) (30 dies després del fi del curs)';
$string['report:reason_diploma_window_passed'] = 'Finestra passada. El curs va finalitzar el {$a->date}. Verifica que la tasca es va executar 30 dies després del fi.';
$string['report:reason_zoom_sent']         = 'Enviat a {$a->users} estudiants en {$a->sessions} sessió(ns) Zoom';
$string['report:reason_zoom_none']         = 'No hi ha recordatoris Zoom registrats per a aquest curs encara';
$string['report:reason_presential_sent']   = 'Enviat a {$a->users} estudiants en {$a->sessions} sessió(ns)';
$string['report:reason_presential_none']   = 'No hi ha recordatoris registrats encara — veure la secció d\'esdeveniments presencials avall';

// Secció d'esdeveniments presencials.
$string['report:presentialevents']      = 'Esdeveniments de sessions presencials (darrers 30 dies → propers 60 dies)';
$string['report:presentialevents_none'] = 'No s\'han trobat esdeveniments de calendari per a aquest curs a la finestra de l\'informe (darrers 30 → propers 60 dies).';
$string['report:eventname']             = 'Nom de l\'esdeveniment';
$string['report:eventdate']             = 'Data';
$string['report:eventlocation']         = 'Ubicació';
$string['report:eventdetected']         = 'Detectat com';
$string['report:eventreason']           = 'Problema / Estat';
$string['report:nolocation']            = 'Sense ubicació';
$string['report:detected_no']           = 'No detectat';
$string['report:notified_n']            = 'Notificats: {$a}';
$string['report:event_will_notify']     = 'S\'enviarà notificació N dies abans de l\'esdeveniment (segons configuració)';
$string['report:reason_event_nokeyword']        = 'L\'esdeveniment té ubicació configurada però no s\'ha trobat cap paraula clau d\'examen o tutoria al títol o descripció.';
$string['report:reason_event_keywords_no_location'] = 'L\'esdeveniment té una paraula clau coincident però NO té ubicació. Afegeix una ubicació física a l\'esdeveniment del calendari per activar la detecció presencial.';
$string['report:current_exam_kw']     = 'Paraules clau d\'examen actuals:';
$string['report:current_tutoring_kw'] = 'Paraules clau de tutoria actuals:';

$string['email_exam_subject'] = 'Examen presencial obligatori del curs {{coursename}}';
$string['email_exam_body'] = '<p>Hola {{firstname}},</p>

<p>Et recordem que el proper <strong>{{exam_date}}</strong> està programat l\'examen presencial obligatori del curs <strong>{{coursename}}</strong>.</p>

<p><strong>Lloc:</strong> {{exam_location}}<br>
<strong>Horari:</strong> de {{exam_start}} a {{exam_end}}</p>

<p>És imprescindible haver completat totes les activitats i avaluacions per poder accedir a l\'examen.</p>

<p>Recorda arribar amb antelació i portar el DNI o NIE.</p>

<p>Molta sort!</p>';

$string['email_tutoring_subject'] = 'Tutoria presencial obligatòria del curs {{coursename}}';
$string['email_tutoring_body'] = '<p>Hola {{firstname}},</p>

<p>El proper <strong>{{tutoring_date}}</strong> tindrà lloc la tutoria presencial obligatòria del curs <strong>{{coursename}}</strong>.</p>

<p><strong>Lloc:</strong> {{tutoring_location}}<br>
<strong>Horari:</strong> de {{tutoring_start}} a {{tutoring_end}}</p>

<p>Durant la tutoria es realitzaran activitats pràctiques i resolució de dubtes.</p>

<p>Et recomanem portar preparades les teves consultes.</p>

<p>Ens veiem aviat!</p>';

$string['email_diploma_subject'] = 'Diploma del curs {{coursename}}';
$string['email_diploma_body'] = '<p>Benvolgut/da {{firstname}},</p>

<p>Des d\'avui ja tens disponible al campus virtual el diploma del curs <strong>{{coursename}}</strong>.</p>

<p>Pots accedir al campus des del següent enllaç:</p>

<p><a href="{{campus_url}}">{{campus_url}}</a></p>

<p>Per descarregar el diploma cal haver completat tots els requisits del curs.</p>

<p>Si encara no ho has fet, recorda completar el qüestionari de satisfacció final.</p>

<p>Moltes gràcies per la teva participació.</p>

<p>Una salutació,</p>';

// First day tasks email.
$string['email_first_day_subject'] = 'Primeres tasques a realitzar a la plataforma';
$string['email_first_day_body'] = '<p>Hola a tothom!</p>

<p>T\'escrivim en relació al curs <strong>{{coursename}}</strong> que estàs realitzant amb nosaltres.</p>

<p>Com a primera tasca, heu de llegir i signar la normativa interna i el Rebut de Material. Podeu trobar-la en la pàgina inicial del campus virtual a l\'apartat documentació tal i com es mostra a la imatge que t\'adjunto a continuació:</p>

<p><img src="{{image_documentation}}" alt="Ubicació de documentació" style="max-width: 70%; height: auto;"></p>

<p>Es imprescindible signar aquests dos documents per poder tenir accés als continguts de la formació.</p>

<p>Aprofito per recordar-vos els requisits necessaris per a poder finalitzar el curs i obtenir així el vostre diploma d\'aprofitament:</p>

<ul>
  <li>Visualitzar com a mínim el <strong>75% de continguts</strong>. A través de la barra de progrés podràs veure marcat en color vermell els continguts pendents de visualitzar.</li>
  <li>Complir amb un <strong>temps de connexió mínim del 75%</strong> de la durada de la formació.</li>
  <li>Realitzar les <strong>avaluacions obligatòries</strong> (parcials i final).</li>
</ul>

<p>Si tens algun dubte a referència de com utilitzar la plataforma pots visualitzar el videotutorial següent:</p>

<p><img src="{{image_tutorial}}" alt="Video tutorial" style="max-width: 70%; height: auto;"></p>

<p>Per a qualsevol consulta no dubteu en posar-vos en contacte amb el dinamitzador/a corresponent.</p>

<p>Salutacions.</p>';

// Second day tasks email.
$string['email_second_day_subject'] = 'Activació de finestres emergents i navegadors recomanats per accedir al campus';
$string['email_second_day_body'] = '<p>Bon dia,</p>

<p>Per tal de visualitzar correctament tots els continguts del curs, és necessari que les finestres emergents (pop-ups) i les cookies estiguin habilitades al vostre navegador. Si les teniu bloquejades, alguns recursos del curs no s\'obriran amb normalitat.</p>

<p>Us recomanem accedir al campus virtual des dels navegadors següents:</p>

<ul>
  <li>Mozilla Firefox</li>
  <li>Google Chrome</li>
  <li>Internet Explorer</li>
</ul>

<p>⚠️ <strong>Important:</strong> El navegador Safari no és compatible amb la plataforma i pot generar múltiples errors.</p>

<p>Si, tot i així, continueu tenint problemes podeu consultar el document preguntes freqüents (FAQ) que trobareu en l\'apartat de documentació de la plataforma.</p>

<p>Per a qualsevol dubte, podeu contactar amb el vostre dinamitzador/a del curs.</p>

<p>Moltes gràcies.</p>';
