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
$string['settings:insights_heading'] = 'Conexión con Moodle Insights';
$string['settings:insights_heading_desc'] = 'Qué disparadores están activos y qué plantilla usa cada uno se configura desde Moodle Insights, sección "Gestión de Notificaciones" — no aquí. Este plugin solo necesita saber cómo conectarse.';
$string['settings:insights_url'] = 'URL de Moodle Insights';
$string['settings:insights_url_desc'] = 'Ej: https://moodle-dashboard.awakelab.world (sin barra final).';
$string['settings:insights_api_key'] = 'API key de notificaciones';
$string['settings:insights_api_key_desc'] = 'Generada desde Moodle Insights, en Configuración > Plataformas > Gestión de Notificaciones, para esta plataforma en concreto.';

// Scheduled task names.
$string['task_check_progress_25'] = 'Notificación de progreso 25%';
$string['task_check_progress_50'] = 'Notificación de progreso 50%';
$string['task_check_progress_75'] = 'Notificación de progreso 75%';
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
$string['local/courseprogressnotify:run'] = 'Ejecutar manualmente las verificaciones de notificaciones';
$string['run_now_button'] = 'Verificar Notificaciones Ahora';
$string['run_now_done'] = 'La verificación se ejecutó correctamente.';
$string['run_now_error'] = 'Se produjo un error durante la ejecución:';
$string['runpage:nocategory'] = 'No hay un campo personalizado configurado. Configure el nombre corto del campo personalizado para habilitar las operaciones del plugin.';
$string['runpage:course_selector_heading'] = 'Selección de curso';
$string['runpage:course_selector_desc'] = 'Selecciona un curso específico para limitar la verificación a ese curso, o deja "Todos los cursos" para ejecutar en todos los cursos habilitados.';
$string['runpage:all_courses'] = 'Todos los cursos';

// Run block in settings page.
$string['settings:run:desc'] = 'Ejecuta manualmente las verificaciones de notificaciones desde esta página. Se aplicará a los cursos con notificaciones habilitadas mediante el campo personalizado configurado en Moodle Insights.';

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
$string['privacy:path:notifications'] = 'Notificaciones de progreso de curso';

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
