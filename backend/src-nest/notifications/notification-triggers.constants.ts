// Catálogo de disparadores soportados. Cada uno corresponde 1:1 a una
// scheduled task del plugin local_courseprogressnotify — añadir un
// disparador nuevo aquí SIN la tarea correspondiente en el plugin no hace
// nada (la evaluación real de condiciones sigue viviendo en Moodle, solo la
// plantilla/activación se centraliza aquí). `paramsSchema` documenta qué
// campos admite `NotificationRule.params` para ese trigger — se valida a
// mano en el servicio, no vía class-validator, porque la forma cambia por
// trigger.
export const NOTIFICATION_TRIGGERS = [
  {
    key: 'progress_25',
    label: 'Progreso de curso al 25%',
    paramsSchema: {},
  },
  {
    key: 'progress_50',
    label: 'Progreso de curso al 50%',
    paramsSchema: {},
  },
  {
    key: 'progress_75',
    label: 'Progreso de curso al 75%',
    paramsSchema: {},
  },
  {
    key: 'course_end_soon',
    label: 'Fin de curso próximo (7 días antes)',
    paramsSchema: {},
  },
  {
    key: 'course_last_day',
    label: 'Último día de curso',
    paramsSchema: {},
  },
  {
    key: 'zoom_session',
    label: 'Recordatorio de sesión Zoom',
    paramsSchema: { daysBefore: 'number' },
  },
  {
    key: 'presential_exam',
    label: 'Recordatorio de examen presencial',
    paramsSchema: { daysBefore: 'number', examKeywords: 'string[]' },
  },
  {
    key: 'presential_tutoring',
    label: 'Recordatorio de tutoría presencial',
    paramsSchema: { daysBefore: 'number', tutoringKeywords: 'string[]' },
  },
  {
    key: 'diploma_available',
    label: 'Diploma disponible (30 días tras fin de curso)',
    paramsSchema: {},
  },
  {
    key: 'first_day',
    label: 'Tareas de primer día',
    paramsSchema: {},
  },
  {
    key: 'second_day',
    label: 'Tareas de segundo día',
    paramsSchema: {},
  },
] as const;

export type NotificationTriggerKey = (typeof NOTIFICATION_TRIGGERS)[number]['key'];

export const NOTIFICATION_TRIGGER_KEYS: NotificationTriggerKey[] = NOTIFICATION_TRIGGERS.map((t) => t.key);
