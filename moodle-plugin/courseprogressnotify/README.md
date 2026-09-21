# local_courseprogressnotify

Plugin local para Moodle 4.4 que envía emails automáticos a alumnos en función de eventos académicos, usando SOLO Moodle core y mod_zoom. Sin plantillas editables; todos los textos de email se gestionan por idioma (es/ca).

## Características
- Envíos por tareas programadas (cron) exclusivamente. Sin observers.
- Sin duplicados: registro de envíos en tabla propia (`local_courseprogressnotify_log`).
- Emails HTML con fallback a texto plano.
- Multilenguaje por usuario con `force_current_language()`.
- Placeholders reemplazados por código (ver lista más abajo).
- Soporte para sesiones presenciales (tabla propia) y mod_zoom.

## Tipos de email
1. Progreso del curso: 25% y 50%.
2. Curso: 7 días antes de la fecha de fin y el día anterior al último día del curso.
3. Zoom: recordatorio X días antes de la sesión (configurable).
4. Presenciales: exámenes y tutorías (**detección automática desde eventos del calendario**).
5. Diploma: 30 días después de finalizado el curso (todos los estudiantes).
6. **Primer día**: tareas iniciales (firma de normativa y recibo de material, con imágenes).
7. **Segundo día**: información sobre navegadores compatibles y ventanas emergentes.

## Detección inteligente de sesiones presenciales
Las sesiones presenciales (exámenes y tutorías) se detectan automáticamente de eventos del calendario:

**Criterios de detección:**
- El evento tiene el campo "Ubicación" poblado, O
- La palabra "presencial" aparece en el título o descripción

**Clasificación del tipo:**
- **Examen**: si contiene palabras como "examen", "exámen", "evaluación", "prueba"
- **Tutoría**: si contiene palabras como "tutoría", "tutoria", "asesoría", "consulta"

La detección es **case-insensitive** y tolera acentos, reduciendo el margen de error humano.

## Imágenes en emails
Los emails del primer día incluyen imágenes embebidas:
- `pix/email_documentation_location.png` - Captura mostrando ubicación de documentación
- `pix/email_tutorial_video.png` - Captura indicando dónde encontrar videotutorial

Las imágenes se deben añadir manualmente en la carpeta `pix` del plugin.

## Instalación
1. Copia la carpeta `local_courseprogressnotify` dentro de `moodle/local/`.
2. Ve a Administración del sitio > Notificaciones para completar la instalación (creación de tablas y tareas).
3. Configura (opcional):
   - Administración del sitio > Plugins > Local plugins > Notificaciones de progreso de curso
   - `Días antes para la invitación Zoom` (por defecto 2)
   - `Días antes para sesiones presenciales` (por defecto 2)

## Base de datos
- `local_courseprogressnotify_log` (log de envíos):
  - `userid`, `courseid`, `notification_type`, `entityid` (nullable), `time_sent`
  - Índice único para evitar duplicados: `(userid, courseid, notification_type, entityid)`
  - Para sesiones presenciales, `entityid` almacena el ID del evento del calendario

## Cron (tareas)
- `check_progress_25`
- `check_progress_50`
- `check_course_end_soon`
- `check_course_last_day`
- `check_zoom_sessions`
- `check_presential_sessions`
- `check_diploma_available`
- `check_first_day_tasks`
- `check_second_day_tasks`

Los horarios están definidos en `db/tasks.php`. Ajusta los crontab si es necesario.

## Idiomas y plantillas
- Archivos de idioma:
  - `lang/es/local_courseprogressnotify.php`
  - `lang/ca/local_courseprogressnotify.php`
- Las plantillas de email se cargan como strings. Este repositorio incluye la conversión de tus archivos `emails_es.txt` y `emails_ca.txt` a claves `$string['email_*']`.

## Placeholders soportados
- `{{firstname}}`, `{{lastname}}`, `{{coursename}}`, `{{courseenddate}}`, `{{progress_percentage}}`, `{{progress_table}}`
- Zoom: `{{zoom_name}}`, `{{zoom_date}}`, `{{zoom_start}}`, `{{zoom_end}}`, `{{zoom_time}}`, `{{zoom_link}}`
- Examen: `{{exam_location}}`, `{{exam_date}}`, `{{exam_start}}`, `{{exam_end}}`
- Tutoría: `{{tutoring_location}}`, `{{tutoring_date}}`, `{{tutoring_start}}`, `{{tutoring_end}}`
- Diploma: `{{diploma_link}}`

## Buenas prácticas aplicadas
- Envío con `email_to_user()` y usuario de soporte como remitente.
- `force_current_language($user->lang)` por email, con restauración posterior.
- Evita duplicados con tabla propia y restricción única.
- Sin observers; solo `core\task\scheduled_task`.

## Notas de funcionamiento
- Progreso: se calcula mediante `completion_info` por actividad. La tabla HTML de progreso se construye automáticamente.
- Fin de curso: "7 días antes" se envía únicamente cuando faltan exactamente 7 días; el "día anterior al último" se envía un día antes de la fecha de fin (cuando el curso termina mañana).
- Zoom y Presenciales: recordatorios enviados en la franja del día N antes (medianoche a medianoche según servidor).
- Diploma: se envía a los 30 días exactos tras la fecha de fin a todos los estudiantes matriculados.
- Primer día: se envía el día que inicia el curso (según `course.startdate`).
- Segundo día: se envía al día siguiente del inicio del curso.

## Desarrollo
- Clases clave:
  - `classes/progress_calculator.php`
  - `classes/email_builder.php`
  - `classes/notification_log.php`
  - `classes/zoom_provider.php`
  - `classes/presential_provider.php` (detección inteligente de sesiones presenciales)
  - `classes/task/*`

## Seguridad y privacidad
- Proveedor de privacidad incluido (`classes/privacy/provider.php`) con metadatos de la tabla de log.

