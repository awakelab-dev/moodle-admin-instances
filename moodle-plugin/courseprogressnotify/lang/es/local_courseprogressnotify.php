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

$string['pluginname'] = 'Notificaciones de progreso de curso';

// Custom field settings.
$string['customfield_shortname'] = 'Nombre corto del campo personalizado';
$string['customfield_shortname_desc'] = 'Introduzca el nombre corto del campo personalizado del curso (casilla de verificación) que habilita las notificaciones para cursos individuales. Solo los cursos con este campo habilitado recibirán notificaciones. El campo personalizado debe crearse en Administración del sitio → Cursos → Campos personalizados del curso. Recomendado: courseemailnotifications_enabled';

// Scheduled task names.
$string['task_check_progress_25'] = 'Notificación de progreso 25%';
$string['task_check_progress_50'] = 'Notificación de progreso 50%';
$string['task_check_course_end_soon'] = 'Aviso: 7 días antes de finalizar el curso';
$string['task_check_course_last_day'] = 'Aviso: último día del curso';
$string['task_check_zoom_sessions'] = 'Recordatorios de sesiones Zoom';
$string['task_check_presential_sessions'] = 'Recordatorios de sesiones presenciales';
$string['task_check_diploma_available'] = 'Aviso: diploma disponible (30 días)';
$string['task_check_first_day_tasks'] = 'Primer día: tareas iniciales';
$string['task_check_second_day_tasks'] = 'Segundo día: navegadores y ventanas emergentes';

// Manual run page.
$string['runpage:title'] = 'Verificación manual de notificaciones';
$string['runpage:heading'] = 'Verificar notificaciones ahora';
$string['runpage:desc'] = 'Puedes ejecutar manualmente diferentes verificaciones de notificaciones. Selecciona el tipo que deseas probar:';
$string['runpage:type_progress'] = 'Notificaciones de Progreso (25% y 50%)';
$string['runpage:confirm_progress'] = 'Revisar todos los estudiantes de los cursos con notificaciones habilitadas y enviar emails a quienes hayan alcanzado el 25% o 50% de progreso (si no han sido notificados previamente).';
$string['runpage:type_courseend'] = 'Notificaciones de Fin de Curso (7 días antes y último día)';
$string['runpage:confirm_courseend'] = 'Revisar cursos que finalizan pronto (exactamente dentro de 7 días) o mañana, y enviar recordatorios a los estudiantes matriculados (si no han sido notificados previamente).';
$string['runpage:type_zoom'] = 'Notificaciones de Sesiones Zoom';
$string['runpage:confirm_zoom'] = 'Revisar sesiones Zoom próximas (según días configurados) y enviar recordatorios a los estudiantes matriculados (si no han sido notificados previamente).';
$string['runpage:type_presential'] = 'Notificaciones de Sesiones Presenciales (Exámenes y Tutorías)';
$string['runpage:confirm_presential'] = 'Detectar automáticamente sesiones presenciales de eventos del calendario (por ubicación y palabras clave) y enviar recordatorios a los estudiantes matriculados (si no han sido notificados previamente).';
$string['runpage:type_diploma'] = 'Notificaciones de Diploma Disponible (30 días)';
$string['runpage:confirm_diploma'] = 'Revisar cursos que finalizaron hace exactamente 30 días y enviar notificación de diploma disponible a todos los estudiantes matriculados (si no han sido notificados previamente).';
$string['runpage:type_firstday'] = 'Notificaciones de Primer Día (Tareas Iniciales)';
$string['runpage:confirm_firstday'] = 'Revisar cursos que inician hoy y enviar a estudiantes las instrucciones sobre firma de normativa, recibo de material y requisitos del curso.';
$string['runpage:type_secondday'] = 'Notificaciones de Segundo Día (Navegadores)';
$string['runpage:confirm_secondday'] = 'Revisar cursos en su segundo día y enviar a estudiantes información sobre navegadores compatibles y configuración de ventanas emergentes.';
$string['runpage:confirm'] = 'Haz clic en el botón para iniciar la verificación. Se revisarán todos los estudiantes de los cursos con notificaciones habilitadas y se enviarán emails a quienes hayan alcanzado el 25% o 50% de progreso (si no han sido notificados previamente).';
$string['run_progress_button'] = 'Probar Emails de Progreso';
$string['run_courseend_button'] = 'Probar Emails de Fin de Curso';
$string['run_zoom_button'] = 'Probar Emails de Zoom';
$string['run_presential_button'] = 'Probar Emails de Sesiones Presenciales';
$string['run_diploma_button'] = 'Probar Emails de Diploma';
$string['run_firstday_button'] = 'Probar Emails de Primer Día';
$string['run_secondday_button'] = 'Probar Emails de Segundo Día';
$string['run_clear_button'] = 'Limpiar Logs y Ejecutar';
$string['run_ignore_restrictions_button'] = 'Enviar a todos (ignorar fechas)';
$string['settings:send_course_firstday'] = '1er Día (ignorar fechas)';
$string['settings:send_course_diploma'] = 'Diploma (ignorar fechas)';
$string['backtosettings'] = 'Volver a configuración';
$string['coursespage:title'] = 'Plugin: Notificaciones';
$string['coursespage:desc'] = 'Configura el modo «solo diploma» y ejecuta envíos manuales por curso. Los cambios de los toggles se guardan al hacer clic en Guardar.';
$string['coursespage:saved'] = 'Configuración guardada correctamente.';
$string['local/courseprogressnotify:managecourses'] = 'Gestionar la configuración de notificaciones por curso';
$string['run_now_button'] = 'Verificar Notificaciones Ahora';
$string['run_now_done'] = 'La verificación se ejecutó correctamente.';
$string['run_now_error'] = 'Se produjo un error durante la ejecución:';
$string['runpage:nocategory'] = 'No hay un campo personalizado configurado. Configure el nombre corto del campo personalizado para habilitar las operaciones del plugin.';
$string['runpage:course_selector_heading'] = 'Selección de curso';
$string['runpage:course_selector_desc'] = 'Selecciona un curso específico para limitar la verificación a ese curso, o deja "Todos los cursos" para ejecutar en todos los cursos habilitados.';
$string['runpage:all_courses'] = 'Todos los cursos';

// Settings.
$string['settings:zoomdaysbefore'] = 'Días antes para la invitación Zoom';
$string['settings:zoomdaysbefore_desc'] = 'Número de días antes de la fecha de la sesión Zoom para enviar la invitación automática.';
$string['settings:presentialdaysbefore'] = 'Días antes para sesiones presenciales';
$string['settings:presentialdaysbefore_desc'] = 'Número de días antes de la sesión presencial (examen/tutoría) para enviar el recordatorio.';
$string['settings:send_combined_email'] = 'Enviar correos combinados en español y catalán';
$string['settings:send_combined_email_desc'] = 'Cuando está habilitado, los correos contendrán tanto la versión en español como en catalán en el mismo mensaje. Cuando está deshabilitado, los correos se enviarán solo en el idioma preferido del usuario.';

// Palabras clave para clasificación de sesiones presenciales.
$string['settings:presential_keywords_heading'] = 'Palabras clave de clasificación';
$string['settings:presential_keywords_heading_desc'] = 'Estas palabras clave determinan cómo se clasifican los eventos del calendario como exámenes o tutorías. <strong>Un evento solo se detecta como presencial si tiene una ubicación definida.</strong> Los acentos se ignoran al comparar (p.ej., &ldquo;sessi&oacute;&rdquo; también coincide con &ldquo;sessio&rdquo;). Introduce una palabra clave por línea.';
$string['settings:presential_exam_keywords'] = 'Palabras clave para exámenes';
$string['settings:presential_exam_keywords_desc'] = 'Si alguna de estas palabras aparece en el nombre o descripción de un evento del calendario, se clasificará como <strong>examen</strong>. Una palabra clave por línea.';
$string['settings:presential_tutoring_keywords'] = 'Palabras clave para tutorías / sesiones';
$string['settings:presential_tutoring_keywords_desc'] = 'Si alguna de estas palabras aparece en el nombre o descripción de un evento del calendario, se clasificará como <strong>tutoría</strong>. Una palabra clave por línea.';

// Run block in settings page.
$string['settings:run:desc'] = 'Ejecuta manualmente las verificaciones de notificaciones desde esta página. Se aplicará a los cursos con notificaciones habilitadas mediante el campo personalizado.';

// Configuración cursos solo-diploma.
$string['settings:diploma_only_heading'] = 'Configuración avanzada por curso';
$string['settings:diploma_only_heading_desc'] = 'Configura el comportamiento del plugin para cada curso: activa el modo «solo diploma» para suprimir todos los demás correos, o ejecuta envíos manuales ignorando las restricciones de fecha.';
$string['settings:diploma_only_courses'] = 'Configuración por curso';
$string['settings:diploma_only_courses_desc'] = 'Los cursos marcados en <span style="color:#721c24;font-weight:700">rojo/amarillo</span> tienen el modo «solo diploma» activo — revisa bien antes de guardar.';
$string['settings:col_course'] = 'Curso';
$string['settings:col_diploma_only'] = 'Sólo enviar diploma';
$string['settings:col_manual_send'] = 'Ejecutar envío manual (sin fechas)';
$string['settings:diploma_only_configure_first'] = 'Configura primero el nombre corto del campo personalizado.';
$string['settings:diploma_only_no_courses'] = 'No hay cursos habilitados para este plugin (ningún curso tiene el campo personalizado activo).';
$string['settings:diploma_only_active_badge'] = '⚠ SOLO DIPLOMA';
$string['settings:diploma_only_warning_active'] = 'ATENCIÓN: uno o más cursos tienen el modo solo-diploma activo. NO se enviarán correos no-diploma a los estudiantes de esos cursos.';

// Progress table.
$string['progress:header:activity'] = 'Actividad';
$string['progress:header:status'] = 'Estado';
$string['progress:status:complete'] = 'Completado';
$string['progress:status:incomplete'] = 'Pendiente';

// Privacy.
$string['privacy:metadata'] = 'El plugin local_courseprogressnotify almacena registros de notificaciones enviadas a los usuarios.';
$string['privacy:metadata:local_courseprogressnotify_log'] = 'Registro de notificaciones enviadas';
$string['privacy:metadata:local_courseprogressnotify_log:userid'] = 'Usuario destinatario de la notificación';
$string['privacy:metadata:local_courseprogressnotify_log:courseid'] = 'Curso asociado a la notificación';
$string['privacy:metadata:local_courseprogressnotify_log:notification_type'] = 'Tipo de notificación enviada';
$string['privacy:metadata:local_courseprogressnotify_log:entityid'] = 'Identificador de la entidad asociada (p.ej., Zoom o sesión)';
$string['privacy:metadata:local_courseprogressnotify_log:time_sent'] = 'Marca temporal del envío';

// Email templates (from emails_es.txt).
$string['email_zoom_subject'] = 'Sesión Zoom del curso {{coursename}}';
$string['email_zoom_body'] = '<p>¡Hola {{firstname}}!</p>

<p>Te escribimos en relación al curso <strong>{{coursename}}</strong> que estás realizando.</p>

<p>Te recordamos que el próximo <strong>{{zoom_date}}</strong>, de <strong>{{zoom_start}}</strong> a <strong>{{zoom_end}}</strong>, tendrá lugar una sesión en directo por Zoom con el/la tutor/a.</p>

<p>El mismo día de la sesión, cuando accedas a la plataforma, verás el enlace para unirte directamente a la videollamada.</p>

<p><img src="{{image_zoom_link_es}}" alt="Ubicación del enlace Zoom" style="max-width: 100%; height: auto;"></p>

<p>Esta sesión tiene como objetivo:</p>
<ul>
  <li>Resolver dudas del curso</li>
  <li>Profundizar en algún contenido específico</li>
  <li>Realizar una sesión más dinámica y práctica</li>
</ul>

<p>¡Te esperamos!</p>';

$string['email_25_subject'] = 'Seguimiento del 25% del curso {{coursename}}';
$string['email_25_body'] = '<p>Bienvenido/a {{firstname}},</p>

<p>Te informamos que has alcanzado el <strong>25%</strong> del curso <strong>{{coursename}}</strong>. A continuación, te mostramos tu evolución hasta el día de hoy:</p>

{{progress_table}}

<p>Aún hay tiempo para finalizar el curso, que concluye el <strong>{{courseenddate}}</strong>. Recuerda que para completarlo debes:</p>

<ul>
  <li>Alcanzar una conexión mínima del 75% de las horas totales del curso</li>
  <li>Visualizar el 100% de los contenidos</li>
  <li>Realizar las actividades de evaluación</li>
</ul>

<p>Te recordamos también que debes realizar el <strong>Cuestionario de valoración del alumno</strong>, disponible en el apartado de evaluación de la calidad.</p>

<p><img src="{{image_progress_25}}" alt="Informe de progreso" style="max-width: 100%; height: auto;"></p>

<p>Ante cualquier duda, puedes ponerte en contacto con nosotros.</p>

<p>Un saludo,</p>';

$string['email_50_subject'] = 'Seguimiento mitad del curso {{coursename}}';
$string['email_50_body'] = '<p>¡Bienvenido/a {{firstname}}!</p>

<p>Ya hemos llegado a la mitad del curso <strong>{{coursename}}</strong>. El curso finaliza el <strong>{{courseenddate}}</strong>, y para completarlo es necesario haber visualizado todos los contenidos y realizado las actividades y evaluaciones.</p>

<p>Puedes conocer la evolución respecto a los aspectos básicos de este curso consultando las barras de PROGRESO DEL CURSO. Ambas se encuentran ubicadas en la columna derecha de su pantalla principal y muestran en color verde los mojones alcanzados y el rojo los que aún tiene que afrontar.</p>

<p><img src="{{image_progress_50}}" alt="Ubicación del progreso del curso" style="max-width: 100%; height: auto;"></p>

<p>Ésta es su evolución hasta el día de hoy:</p>

{{progress_table}}

<p>Te animamos a seguir avanzando y te recordamos que puedes contactar con nosotros ante cualquier duda.</p>

<p>Un saludo,</p>';

$string['email_end_soon_subject'] = 'Recta final del curso {{coursename}}';
$string['email_end_soon_body'] = '<p>¡Hola {{firstname}}!</p>

<p>Te escribimos para recordarte que hemos entrado en la última semana del curso <strong>{{coursename}}</strong>, que finaliza el próximo <strong>{{courseenddate}}</strong>.</p>

<p>Recuerda los requisitos de finalización:</p>

<ul>
  <li>Completar las evaluaciones del curso</li>
  <li>Visualizar el 100% de los contenidos</li>
  <li>Alcanzar una conexión mínima del 75% de las horas</li>
</ul>

<p>Aprovecha estos últimos días para finalizar el curso y resolver cualquier duda pendiente.</p>

<p>¡Mucho ánimo!</p>';

$string['email_last_day_subject'] = 'Instrucciones de finalización del curso {{coursename}}';
$string['email_last_day_body'] = '<p>Hola {{firstname}},</p>

<p>Te recordamos que mañana es el último día de formación del curso <strong>{{coursename}}</strong>.</p>

<p>Ha sido un placer contar contigo durante este período y esperamos que la experiencia haya sido útil y enriquecedora.</p>

<p>Si aún no lo has hecho, te animamos a completar las evaluaciones y verificar que has visualizado el 100% de los contenidos para poder obtener tu diploma.</p>

<p>También puedes realizar el cuestionario de satisfacción final disponible en el apartado de evaluación de la calidad.</p>

<p><img src="{{image_quality_survey}}" alt="Ubicación del cuestionario de calidad" style="max-width: 100%; height: auto;"></p>

<p>Una vez finalizado el curso, nos pondremos en contacto contigo para informarte sobre la disponibilidad de descarga del diploma.</p>

<p>Gracias por tu participación y compromiso.</p>

<p>Un cordial saludo,</p>';

// ── Informe de actividad ──────────────────────────────────────────────────────
$string['report:title']   = 'Informe de actividad de notificaciones';
$string['report:heading'] = 'Informe de actividad de notificaciones';
$string['settings:report_link']      = 'Informe de actividad';
$string['settings:report_link_desc'] = 'Ver un informe detallado de los correos enviados por curso habilitado y por qué los pendientes no se han disparado todavía.';
$string['report:viewreport'] = 'Ver informe de actividad';

// Resumen del curso.
$string['report:intro']             = 'Mostrando actividad de {$a} curso(s) con notificaciones habilitadas.';
$string['report:nocourses']         = 'Ningún curso tiene notificaciones habilitadas con el campo personalizado configurado.';
$string['report:no_courses_in_filter'] = 'Ningún curso coincide con el filtro actual.';
$string['report:haswarnings']       = 'Tiene advertencias de configuración';
$string['report:open_course']       = 'Abrir curso';
$string['report:startdate']         = 'Fecha de inicio';
$string['report:enddate']           = 'Fecha de fin';
$string['report:students']          = 'Estudiantes matriculados';
$string['report:completion']        = 'Finalización habilitada';
$string['report:notset']            = 'No configurado';

// Barra de resumen.
$string['report:summary_total']    = '{$a} curso(s) habilitado(s)';
$string['report:summary_warnings'] = '{$a} con advertencias de configuración';
$string['report:summary_sent']     = '{$a} registros de correo total';
$string['report:filter_label']     = 'Mostrar:';
$string['report:filter_all']       = 'Todos los cursos ({$a})';
$string['report:filter_warnings']  = 'Solo con advertencias ({$a})';

// Advertencias.
$string['report:warnings']               = 'Advertencias de configuración';
$string['report:warn_start_past_year']   = 'La fecha de inicio está configurada en {$a->year} ({$a->date}). Las tareas de primer y segundo día solo se ejecutan en la fecha exacta de inicio — con esta configuración esos correos nunca se enviarán.';
$string['report:warn_end_past_year']     = 'La fecha de fin está configurada en {$a->year} ({$a->date}). Los correos de fin de curso (7 días antes, último día, diploma) nunca se dispararán.';
$string['report:warn_no_completion']     = 'La finalización de curso está desactivada. Los correos de progreso (25%, 50%) no pueden enviarse.';
$string['report:warn_no_enddate']        = 'No hay fecha de fin configurada. Los correos de fin de curso y diploma no se dispararán.';

// Historial de notificaciones.
$string['report:notificationsent'] = 'Historial de notificaciones';
$string['report:notiftype']        = 'Tipo de notificación';
$string['report:sentcount']        = 'Enviados';
$string['report:lastsent']         = 'Último envío';
$string['report:statusreason']     = 'Estado / Motivo';

// Etiquetas de tipo de notificación.
$string['report:notiftype_first_day']           = 'Tareas del primer día';
$string['report:notiftype_second_day']          = 'Segundo día (info de navegadores)';
$string['report:notiftype_progress25']          = 'Progreso 25%';
$string['report:notiftype_progress50']          = 'Progreso 50%';
$string['report:notiftype_end_soon']            = 'Fin de curso próximo (7 días)';
$string['report:notiftype_last_day']            = 'Recordatorio último día';
$string['report:notiftype_zoom']                = 'Recordatorio sesión Zoom';
$string['report:notiftype_presential_exam']     = 'Recordatorio examen presencial';
$string['report:notiftype_presential_tutoring'] = 'Recordatorio tutoría presencial';
$string['report:notiftype_diploma']             = 'Diploma disponible';

// Motivos de estado.
$string['report:reason_sent_n']            = 'Enviado a {$a->n} de {$a->total} estudiantes matriculados';
$string['report:reason_no_startdate']      = 'No hay fecha de inicio configurada';
$string['report:reason_wrong_start_year']  = 'El año de la fecha de inicio es {$a->year} ({$a->date}) — las tareas solo se ejecutan en la fecha exacta de inicio. Corrige el año al año actual.';
$string['report:reason_starts_today']      = 'El curso empieza hoy — la tarea se ejecutará en la próxima ejecución programada de hoy';
$string['report:reason_future_start']      = 'El curso aún no ha empezado — la tarea se ejecutará el {$a->date}';
$string['report:reason_window_passed']          = 'Ventana pasada (hace {$a->days} días desde la fecha de inicio).';
$string['report:reason_fires_today']            = 'Condición cumplida hoy — la tarea se ejecutará en la próxima ejecución programada';
$string['report:reason_in_recovery_window']     = 'Dentro de la ventana de recuperación — el próximo cron lo enviará';
$string['report:firstday_diag_toggle']          = 'Diagnosticar';
$string['report:firstday_diag_window']          = 'Ventana activa del cron:';
$string['report:firstday_diag_startdate']       = 'Fecha de inicio del curso:';
$string['report:firstday_diag_inwindow']        = '¿En ventana?';
$string['report:firstday_diag_inwindow_yes']    = 'Sí — el próximo cron enviará el email';
$string['report:firstday_diag_inwindow_no']     = 'No — fuera de la ventana de 2 días. El email no se puede enviar automáticamente.';
$string['report:firstday_diag_viewlogs']        = 'Ver logs del cron →';
$string['report:reason_no_completion']     = 'La finalización de curso está desactivada — no se puede rastrear el progreso';
$string['report:reason_below_threshold']   = 'Ningún estudiante ha alcanzado el umbral del {$a->pct}% de progreso todavía';
$string['report:reason_no_enddate']        = 'No hay fecha de fin configurada';
$string['report:reason_end_in_n_days']     = 'El curso finaliza en {$a->days} días — este correo se disparará en {$a->fires} días (cuando queden exactamente 7 días)';
$string['report:reason_end_window_passed_n'] = 'La ventana de 7 días ha pasado sin envío. La fecha de fin era {$a->date}. Verifica que la tarea se ejecutó en el momento correcto.';
$string['report:reason_course_ended']      = 'El curso finalizó el {$a->date}';
$string['report:reason_last_day_future']   = 'Se disparará el {$a->date} (en {$a->days} días — el día antes del fin del curso)';
$string['report:reason_diploma_future']    = 'Se disparará el {$a->date} (30 días después del fin del curso)';
$string['report:reason_diploma_pending']   = 'Se disparará en {$a->days} día(s) (30 días después del fin del curso)';
$string['report:reason_diploma_window_passed'] = 'Ventana pasada. El curso finalizó el {$a->date}. Verifica que la tarea se ejecutó 30 días después del fin.';
$string['report:reason_zoom_sent']         = 'Enviado a {$a->users} estudiantes en {$a->sessions} sesión(es) Zoom';
$string['report:reason_zoom_none']         = 'No hay recordatorios de Zoom registrados para este curso todavía';
$string['report:reason_presential_sent']   = 'Enviado a {$a->users} estudiantes en {$a->sessions} sesión(es)';
$string['report:reason_presential_none']   = 'No hay recordatorios registrados todavía — ver la sección de eventos presenciales abajo';

// Sección de eventos presenciales.
$string['report:presentialevents']      = 'Eventos de sesiones presenciales (últimos 30 días → próximos 60 días)';
$string['report:presentialevents_none'] = 'No se encontraron eventos de calendario para este curso en la ventana del informe (últimos 30 → próximos 60 días).';
$string['report:eventname']             = 'Nombre del evento';
$string['report:eventdate']             = 'Fecha';
$string['report:eventlocation']         = 'Ubicación';
$string['report:eventdetected']         = 'Detectado como';
$string['report:eventreason']           = 'Problema / Estado';
$string['report:nolocation']            = 'Sin ubicación';
$string['report:detected_no']           = 'No detectado';
$string['report:notified_n']            = 'Notificados: {$a}';
$string['report:event_will_notify']     = 'Se enviará notificación N días antes del evento (según configuración)';
$string['report:reason_event_nokeyword']        = 'El evento tiene ubicación configurada pero no se encontró ninguna palabra clave de examen o tutoría en el título o descripción.';
$string['report:reason_event_keywords_no_location'] = 'El evento tiene una palabra clave coincidente pero NO tiene ubicación. Añade una ubicación física al evento del calendario para activar la detección presencial.';
$string['report:current_exam_kw']     = 'Palabras clave de examen actuales:';
$string['report:current_tutoring_kw'] = 'Palabras clave de tutoría actuales:';

$string['email_exam_subject'] = 'Examen presencial obligatorio del curso {{coursename}}';
$string['email_exam_body'] = '<p>Hola {{firstname}},</p>

<p>Te recordamos que el próximo <strong>{{exam_date}}</strong> está programado el examen presencial obligatorio correspondiente al curso <strong>{{coursename}}</strong>.</p>

<p><strong>Lugar:</strong> {{exam_location}}<br>
<strong>Horario:</strong> de {{exam_start}} a {{exam_end}}</p>

<p>Para poder acceder al examen es imprescindible haber completado todas las actividades y evaluaciones del curso.</p>

<p>Recuerda llegar con antelación y llevar tu DNI o NIE para la identificación.</p>

<p>¡Mucha suerte!</p>';

$string['email_tutoring_subject'] = 'Tutoría presencial obligatoria del curso {{coursename}}';
$string['email_tutoring_body'] = '<p>Hola {{firstname}},</p>

<p>Te recordamos que el próximo <strong>{{tutoring_date}}</strong> tendrá lugar la tutoría presencial obligatoria del curso <strong>{{coursename}}</strong>.</p>

<p><strong>Lugar:</strong> {{tutoring_location}}<br>
<strong>Horario:</strong> de {{tutoring_start}} a {{tutoring_end}}</p>

<p>Durante la tutoría se realizarán actividades prácticas, exposición de contenidos y resolución de dudas.</p>

<p>Te recomendamos llevar preparadas tus consultas.</p>

<p>¡Nos vemos pronto!</p>';

$string['email_diploma_subject'] = 'Diploma del curso {{coursename}}';
$string['email_diploma_body'] = '<p>Estimado/a {{firstname}},</p>

<p>Desde hoy ya tienes disponible en el campus virtual el diploma correspondiente al curso <strong>{{coursename}}</strong>.</p>

<p>Puedes acceder al campus desde el siguiente enlace:</p>

<p><a href="{{campus_url}}">{{campus_url}}</a></p>

<p>Para descargar el diploma es necesario haber completado todos los requisitos del curso y la documentación solicitada.</p>

<p>Si aún no lo has hecho, recuerda completar el cuestionario de satisfacción final.</p>

<p>Muchas gracias por tu participación y te animamos a seguir formándote con nosotros.</p>

<p>Un saludo,</p>';

// First day tasks email.
$string['email_first_day_subject'] = 'Primeras tareas a realizar en la plataforma';
$string['email_first_day_body'] = '<p>Hola a todos/as,</p>

<p>Te escribimos en relación al curso <strong>{{coursename}}</strong> que estás realizando con nosotros.</p>

<p>Como primera tarea del curso, debéis leer y firmar la normativa interna y el Recibo de Material. Podéis encontrarlos en la página inicial del campus virtual, en el apartado de Documentación, tal y como se muestra en la imagen que os adjuntamos a continuación:</p>

<p><img src="{{image_documentation}}" alt="Ubicación de documentación" style="max-width: 70%; height: auto;"></p>

<p>Es imprescindible firmar estos dos documentos para poder acceder a los contenidos de la formación.</p>

<p>Aprovecho para recordaros los requisitos necesarios para poder finalizar el curso y obtener así vuestro diploma de aprovechamiento:</p>

<ul>
  <li>Visualizar como mínimo el <strong>75% de los contenidos</strong>. A través de la barra de progreso podréis ver en color rojo los contenidos pendientes de visualizar.</li>
  <li>Cumplir con un <strong>tiempo mínimo de conexión del 75%</strong> de la duración de la formación.</li>
  <li>Realizar las <strong>evaluaciones obligatorias</strong> (parciales y final).</li>
</ul>

<p>Si tenéis alguna duda sobre cómo utilizar la plataforma, podéis visualizar el siguiente videotutorial:</p>

<p><img src="{{image_tutorial}}" alt="Video tutorial" style="max-width: 70%; height: auto;"></p>

<p>Para cualquier consulta, no dudéis en poneros en contacto con el/la dinamizador/a correspondiente.</p>

<p>Saludos.</p>';

// Second day tasks email.
$string['email_second_day_subject'] = 'Activación de ventanas emergentes y navegadores recomendados para acceder al campus';
$string['email_second_day_body'] = '<p>Buenos días,</p>

<p>Para poder visualizar correctamente todos los contenidos del curso, es necesario que las ventanas emergentes (pop-ups) y las cookies estén activadas en vuestro navegador. Si las tenéis bloqueadas, algunos recursos del curso no se abrirán con normalidad.</p>

<p>Os recomendamos acceder al campus virtual desde los siguientes navegadores:</p>

<ul>
  <li>Mozilla Firefox</li>
  <li>Google Chrome</li>
  <li>Internet Explorer</li>
</ul>

<p>⚠️ <strong>Importante:</strong> El navegador Safari no es compatible con la plataforma y puede generar múltiples errores.</p>

<p>Si aun así continuáis teniendo problemas, podéis consultar el documento de preguntas frecuentes (FAQ) que encontraréis en el apartado de documentación de la plataforma.</p>

<p>Para cualquier duda, podéis contactar con vuestro/a dinamizador/a del curso.</p>

<p>Muchas gracias.</p>';
