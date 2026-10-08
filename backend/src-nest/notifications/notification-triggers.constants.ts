// Parámetros disponibles para distinguir plantilla "positiva"/"negativa" en
// un trigger que lo admita (ver `variantParams` más abajo). `higherIsBetter`
// dice cómo se compara el valor calculado por el plugin contra el umbral
// guardado en NotificationRule.params.threshold: con true, valor >= umbral
// = positivo (calificaciones, asistencia); con false, valor <= umbral =
// positivo (riesgo de abandono: MENOS días inactivo es mejor). `unit` es
// solo para la UI (qué poner junto al campo de umbral).
export const VARIANT_PARAM_DEFS = {
  grades: { label: 'Calificaciones aprobadas', unit: '%', higherIsBetter: true },
  attendance: { label: 'Asistencia (sesiones presenciales/Zoom)', unit: '%', higherIsBetter: true },
  inactivity_risk: { label: 'Riesgo de abandono (días sin acceder)', unit: 'días', higherIsBetter: false },
} as const;

export type VariantParamKey = keyof typeof VARIANT_PARAM_DEFS;
export const VARIANT_PARAM_KEYS = Object.keys(VARIANT_PARAM_DEFS) as VariantParamKey[];

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
    // Pedido explícito del cliente: distinguir plantilla "positiva"/"negativa"
    // según cómo le va al alumno a esta altura del curso, con el parámetro
    // que se elija de VARIANT_PARAM_DEFS — ver NotificationRule.variant y
    // upsertTriggerVariants().
    variantParams: VARIANT_PARAM_KEYS,
  },
  {
    key: 'progress_75',
    label: 'Progreso de curso al 75%',
    paramsSchema: {},
    variantParams: VARIANT_PARAM_KEYS,
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
