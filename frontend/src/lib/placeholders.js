// Catálogo de variables ("placeholders") que el plugin local_courseprogressnotify
// sabe rellenar en un email, agrupadas por disparador — fuente única para el
// selector de NotificationsPage y para las "chips" del editor (RichTextEditor).
// firstname/lastname/coursename los rellena email_builder para CUALQUIER
// disparador; el resto solo existe si la plantilla se asocia al disparador
// correspondiente — una variable de otro grupo se queda sin sustituir (se
// envía el email con el texto "{{...}}" literal).
export const PLACEHOLDER_GROUPS = [
  {
    label: 'Común (cualquier disparador)',
    items: [
      { key: 'firstname', label: 'Nombre del alumno' },
      { key: 'lastname', label: 'Apellidos del alumno' },
      { key: 'coursename', label: 'Nombre del curso' },
    ],
  },
  {
    label: 'Progreso 25% / 50% / 75%',
    items: [
      { key: 'progress_percentage', label: '% de progreso alcanzado' },
      { key: 'courseenddate', label: 'Fecha de fin del curso' },
      { key: 'progress_table', label: 'Tabla con el detalle por actividad' },
    ],
  },
  {
    label: 'Fin de curso próximo / último día',
    items: [{ key: 'courseenddate', label: 'Fecha de fin del curso' }],
  },
  {
    label: 'Recordatorio Zoom',
    items: [
      { key: 'zoom_name', label: 'Nombre de la sesión' },
      { key: 'zoom_date', label: 'Fecha de la sesión' },
      { key: 'zoom_start', label: 'Hora de inicio' },
      { key: 'zoom_end', label: 'Hora de fin' },
      { key: 'zoom_time', label: 'Rango horario (inicio - fin)' },
      { key: 'zoom_link', label: 'Enlace a la sesión' },
    ],
  },
  {
    label: 'Examen presencial',
    items: [
      { key: 'exam_location', label: 'Ubicación del examen' },
      { key: 'exam_date', label: 'Fecha del examen' },
      { key: 'exam_start', label: 'Hora de inicio' },
      { key: 'exam_end', label: 'Hora de fin' },
    ],
  },
  {
    label: 'Tutoría presencial',
    items: [
      { key: 'tutoring_location', label: 'Ubicación de la tutoría' },
      { key: 'tutoring_date', label: 'Fecha de la tutoría' },
      { key: 'tutoring_start', label: 'Hora de inicio' },
      { key: 'tutoring_end', label: 'Hora de fin' },
    ],
  },
  {
    label: 'Diploma disponible',
    items: [{ key: 'campus_url', label: 'Enlace al curso en el campus' }],
  },
  {
    label: 'Encuesta de calidad de curso',
    items: [
      { key: 'survey_link', label: 'Enlace a la encuesta (texto)' },
      { key: 'survey_link_url', label: 'URL de la encuesta (para tu propio botón)' },
    ],
  },
];

// key -> etiqueta corta, para mostrar en vez de "{{key}}" tanto en el
// selector como en las chips del editor.
export const PLACEHOLDER_LABELS = PLACEHOLDER_GROUPS.reduce((acc, group) => {
  for (const item of group.items) {
    if (!(item.key in acc)) acc[item.key] = item.label;
  }
  return acc;
}, {});

export function placeholderLabel(key) {
  return PLACEHOLDER_LABELS[key] || key;
}
