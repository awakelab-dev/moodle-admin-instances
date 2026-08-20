import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import {
  getPlatforms,
  getCourses,
  getCourseBreakdown,
  getCourseAccessReport,
  getCourseGradesReport,
} from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { formatBytes, formatUnixSeconds } from '@/lib/formatters';
import { downloadXlsx } from '@/lib/excel';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import Breadcrumb from './Breadcrumb';
import ErrorRetry from './ErrorRetry';

// Detecta cursos "plantilla" (no son cursos reales de alumnos) por el nombre
// de su categoría, para poder ocultarlos del listado con el toggle correspondiente.
function isTemplateCourse(course) {
  return /plantilla/i.test(course.category_name || '');
}

// Cualquier rol distinto de "student" (teacher, editingteacher, manager…)
// se trata como profesor/tutor de cara al filtro y a la etiqueta.
function isTeacherRole(student) {
  return Array.isArray(student.roles) && student.roles.length > 0 && !student.roles.includes('student');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CL');
}

function ListSkeleton({ rows = 6 }) {
  return (
    <div className="cs-list">
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-11 w-full" />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6, columns = 4 }) {
  return (
    <div className="cs-table-skeleton">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="cs-table-skeleton-row">
          {Array.from({ length: columns }).map((__, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="cs-stat-row">
      <span className="cs-stat-label">{label}</span>
      <span className="cs-stat-value">{value}</span>
    </div>
  );
}

// Página "Cursos y Alumnos" (menú principal). Navegación jerárquica en un
// solo componente con cuatro niveles controlados por `level`: plataformas ->
// cursos de la plataforma -> detalle de un curso (alumnos o desglose de
// almacenamiento) -> detalle de un alumno. Siempre arranca en `level ===
// 'platforms'`, pidiendo elegir plataforma explícitamente en vez de
// recordar la última visitada.
export default function CoursesStudentsPage() {
  const [level, setLevel] = useState('platforms');
  const [platforms, setPlatforms] = useState([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const [courseData, setCourseData] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [hideTemplates, setHideTemplates] = useState(false);

  const [courseTab, setCourseTab] = useState('students'); // 'detail' | 'students'
  const [breakdownData, setBreakdownData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState(null);

  const [accessReportData, setAccessReportData] = useState(null);
  const [accessReportLoading, setAccessReportLoading] = useState(false);
  const [accessReportError, setAccessReportError] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'students' | 'teachers'

  // Búsqueda y orden propios de la pestaña "Informe global" (independientes
  // de los de "Lista de alumnos", aunque ambas pestañas leen los mismos
  // `accessReportData`, ya cargados al abrir el curso). El informe en sí
  // solo se muestra tras pulsar el botón, igual que "Calificaciones", en
  // vez de aparecer ya generado al entrar en la pestaña.
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSortKey, setGlobalSortKey] = useState('lastname');
  const [globalSortDir, setGlobalSortDir] = useState('asc');
  const [hasRequestedGlobalReport, setHasRequestedGlobalReport] = useState(false);

  // Informe de calificaciones de TODOS los alumnos del curso (distinto del
  // que se consulta para un solo alumno en el nivel "student"). Al ser una
  // llamada costosa a Moodle, se carga solo bajo demanda con un botón,
  // igual que el desglose de almacenamiento.
  const [gradesReportData, setGradesReportData] = useState(null);
  const [gradesReportLoading, setGradesReportLoading] = useState(false);
  const [gradesReportError, setGradesReportError] = useState(null);
  const [hasRequestedGradesReport, setHasRequestedGradesReport] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentGrades, setStudentGrades] = useState(null);
  const [studentGradesLoading, setStudentGradesLoading] = useState(false);

  // Selector de plataforma con buscador (sustituye al <Select> simple):
  // `pickerOpen` controla si el desplegable está abierto y `platformSearch`
  // filtra la lista mientras se escribe. `pickerRef` se usa para cerrar el
  // desplegable al hacer clic fuera de él.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [platformSearch, setPlatformSearch] = useState('');
  const pickerRef = useRef(null);

  // Cierra el desplegable de plataforma si se hace clic fuera de él.
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    getPlatforms()
      .then((response) => {
        if (!isMounted) return;
        const list = (Array.isArray(response) ? response : []).sort((a, b) =>
          formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name))
        );
        setPlatforms(list);
      })
      .catch(() => {
        if (isMounted) setPlatforms([]);
      })
      .finally(() => {
        if (isMounted) setPlatformsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  function openPlatform(platform) {
    setSelectedPlatform(platform);
    setCourseData(null);
    setCourseSearch('');
    setCoursesError(null);
    setLevel('courses');
    setCoursesLoading(true);

    getCourses({ moodleSource: platform.source })
      .then((response) => setCourseData(response))
      .catch(() => {
        setCourseData(null);
        setCoursesError('No se pudieron cargar los cursos de esta plataforma.');
      })
      .finally(() => setCoursesLoading(false));
  }

  const allCourses = useMemo(() => {
    if (!courseData?.categories?.length) return [];
    const list = [];
    for (const cat of courseData.categories) {
      for (const course of cat.courses) {
        list.push({ ...course, category_name: cat.category_name });
      }
    }
    return list;
  }, [courseData]);

  // Lista de plataformas que se muestra en el desplegable con buscador,
  // filtrada por lo que se va escribiendo en `platformSearch`.
  const filteredPickerPlatforms = useMemo(() => {
    if (!platformSearch.trim()) return platforms;
    const term = platformSearch.toLowerCase();
    return platforms.filter((p) => formatPlatformDisplayName(p.name).toLowerCase().includes(term));
  }, [platforms, platformSearch]);

  function selectPlatformFromPicker(platform) {
    openPlatform(platform);
    setPickerOpen(false);
    setPlatformSearch('');
  }

  const templateCount = useMemo(
    () => allCourses.filter(isTemplateCourse).length,
    [allCourses]
  );

  const filteredCourses = useMemo(() => {
    let list = hideTemplates ? allCourses.filter((c) => !isTemplateCourse(c)) : allCourses;
    if (courseSearch.trim()) {
      const term = courseSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.course_name.toLowerCase().includes(term) ||
          (c.shortname || '').toLowerCase().includes(term) ||
          c.category_name.toLowerCase().includes(term)
      );
    }
    return list;
  }, [allCourses, courseSearch, hideTemplates]);

  function openCourse(course) {
    setSelectedCourse(course);
    setCourseTab('students');
    setBreakdownData(null);
    setBreakdownError(null);
    setAccessReportData(null);
    setAccessReportError(null);
    setStudentSearch('');
    setGlobalSearchTerm('');
    setHasRequestedGlobalReport(false);
    setGradesReportData(null);
    setGradesReportError(null);
    setHasRequestedGradesReport(false);
    setLevel('course');
    loadAccessReport(course.course_id);
  }

  function loadAccessReport(courseId) {
    setAccessReportLoading(true);
    setAccessReportError(null);
    getCourseAccessReport(courseId, { moodleSource: selectedPlatform.source })
      .then((response) => setAccessReportData(response))
      .catch(() => {
        setAccessReportData(null);
        setAccessReportError('No se pudo cargar la lista de alumnos de este curso.');
      })
      .finally(() => setAccessReportLoading(false));
  }

  // Carga el desglose de almacenamiento del curso solo la primera vez que se
  // abre la pestaña "Detalle del curso" (si ya hay datos y no se pide
  // refresh, no repite la llamada); `refresh: true` fuerza el recálculo en
  // vivo contra Moodle en vez de usar el resultado ya guardado.
  function loadBreakdown(courseId, { refresh = false } = {}) {
    if (breakdownLoading) return;
    if (breakdownData && !refresh) return;
    setBreakdownLoading(true);
    setBreakdownError(null);
    getCourseBreakdown(courseId, { moodleSource: selectedPlatform.source, ...(refresh ? { refresh: 1 } : {}) })
      .then((response) => setBreakdownData(response))
      .catch(() => {
        setBreakdownData(null);
        setBreakdownError('No se pudo cargar el detalle de almacenamiento de este curso.');
      })
      .finally(() => setBreakdownLoading(false));
  }

  // Carga el detalle de calificaciones por alumno (gradereport_user_get_grade_items
  // de Moodle) en vivo, para TODOS los alumnos del curso a la vez; puede venir
  // marcado como no disponible si la plataforma no tiene esa función
  // habilitada en su Web Service externo.
  function loadGradesReport() {
    if (!selectedCourse || !selectedPlatform) return;
    setHasRequestedGradesReport(true);
    setGradesReportLoading(true);
    setGradesReportError(null);
    getCourseGradesReport(selectedCourse.course_id, { moodleSource: selectedPlatform.source })
      .then((response) => setGradesReportData(response))
      .catch(() => {
        setGradesReportData(null);
        setGradesReportError('No se pudo cargar el informe de calificaciones de este curso.');
      })
      .finally(() => setGradesReportLoading(false));
  }

  function handleGlobalSort(key) {
    if (globalSortKey === key) {
      setGlobalSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setGlobalSortKey(key);
      setGlobalSortDir('asc');
    }
  }

  function globalSortIcon(key) {
    if (globalSortKey !== key) return ' ↕';
    return globalSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  // Exporta la ficha de alumnos ("Informe global") a un .xlsx real usando
  // downloadXlsx, con las mismas columnas que se ven en la pestaña.
  function handleExportGlobalReport() {
    if (!globalReportRows.length) return;

    const columns = [
      { header: 'Nombre', key: 'nombre', width: 16 },
      { header: 'Apellidos', key: 'apellidos', width: 20 },
      { header: 'Matrícula activa', key: 'matricula', width: 14 },
      { header: 'Usuario', key: 'usuario', width: 14 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Primer acceso (sitio)', key: 'primerAcceso', width: 18 },
      { header: 'Último acceso (curso)', key: 'ultimoAcceso', width: 18 },
      { header: 'Actividades de aprendizaje', key: 'actividades', width: 15 },
      { header: 'Nota final', key: 'notaFinal', width: 12 },
      { header: 'Evaluaciones', key: 'evaluaciones', width: 13 },
      { header: 'Mensajes Foro', key: 'mensajesForo', width: 13 },
    ];

    const rows = globalReportRows.map((student) => ({
      nombre: student.firstname || '',
      apellidos: student.lastname || '',
      matricula: student.activeEnrollment === null ? 'No disponible' : student.activeEnrollment ? 'Sí' : 'No',
      usuario: student.username,
      email: student.email || '',
      primerAcceso: formatUnixSeconds(student.firstAccess),
      ultimoAcceso: formatUnixSeconds(student.lastCourseAccess),
      actividades:
        student.activitiesTotal === null
          ? 'No disponible'
          : `${student.activitiesCompleted}/${student.activitiesTotal}`,
      notaFinal: student.finalGrade === null ? 'No disponible' : student.finalGrade,
      evaluaciones:
        student.evaluationsTotal === null
          ? 'No disponible'
          : `${student.evaluationsCompleted}/${student.evaluationsTotal}`,
      mensajesForo: student.forumMessageCount === null ? 'No disponible' : student.forumMessageCount,
    }));

    const courseLabel = selectedCourse?.shortname || selectedCourse?.course_name || 'curso';
    downloadXlsx({
      filename: `informe-global-${courseLabel}.xlsx`,
      sheetName: 'Ficha de alumnos',
      columns,
      rows,
    });
  }

  // Exporta el detalle de calificaciones a .xlsx. Cada alumno puede ocupar
  // varias filas (una por ítem evaluable); `groupStartRows` marca la fila
  // donde empieza cada alumno para que downloadXlsx la resalte visualmente.
  function handleExportGradesReport() {
    if (!gradesReportData?.students?.length) return;

    const columns = [
      { header: 'Alumno', key: 'alumno', width: 26 },
      { header: 'Evaluaciones', key: 'evaluaciones', width: 14 },
      { header: 'Nota curso (/10)', key: 'notaCurso', width: 15 },
      { header: 'Ítem evaluable', key: 'item', width: 42, wrap: true },
      { header: 'Nota del ítem', key: 'notaItem', width: 14 },
      { header: 'Nota (/10)', key: 'notaItem10', width: 12 },
    ];

    const rows = [];
    const groupStartRows = [];

    for (const student of gradesReportData.students) {
      groupStartRows.push(rows.length + 2); // +1 fila de cabecera, +1 base 1

      const base = {
        alumno: student.fullname,
        evaluaciones: `${student.completedItems}/${student.totalItems}`,
        notaCurso: student.courseScoreOutOf10,
      };

      if (!student.items.length) {
        rows.push({ ...base, item: '', notaItem: '', notaItem10: '' });
        continue;
      }

      student.items.forEach((item, idx) => {
        rows.push({
          ...(idx === 0 ? base : { alumno: '', evaluaciones: '', notaCurso: '' }),
          item: item.itemName,
          notaItem: item.gradeFormatted,
          notaItem10: item.scoreOutOf10,
        });
      });
    }

    const courseLabel = selectedCourse?.shortname || selectedCourse?.course_name || 'curso';
    downloadXlsx({
      filename: `calificaciones-${courseLabel}.xlsx`,
      sheetName: 'Detalle de calificaciones',
      columns,
      rows,
      groupStartRows,
    });
  }

  const allStudents = accessReportData?.students || [];
  const studentsCount = useMemo(() => allStudents.filter((s) => !isTeacherRole(s)).length, [allStudents]);
  const teachersCount = useMemo(() => allStudents.filter(isTeacherRole).length, [allStudents]);

  // Filas de la pestaña "Informe global": mismos datos que "Lista de
  // alumnos" pero con su propia búsqueda y orden por columna.
  const globalReportRows = useMemo(() => {
    let filtered = allStudents;
    if (globalSearchTerm.trim()) {
      const term = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.firstname.toLowerCase().includes(term) ||
          s.lastname.toLowerCase().includes(term) ||
          s.username.toLowerCase().includes(term) ||
          s.email.toLowerCase().includes(term)
      );
    }
    return [...filtered].sort((a, b) => {
      const valA = a[globalSortKey] ?? 0;
      const valB = b[globalSortKey] ?? 0;
      if (typeof valA === 'string') {
        return globalSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return globalSortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [allStudents, globalSearchTerm, globalSortKey, globalSortDir]);

  const filteredStudents = useMemo(() => {
    let list = allStudents;
    if (roleFilter === 'students') list = list.filter((s) => !isTeacherRole(s));
    if (roleFilter === 'teachers') list = list.filter(isTeacherRole);
    if (!studentSearch.trim()) return list;
    const term = studentSearch.toLowerCase();
    return list.filter(
      (s) =>
        s.firstname.toLowerCase().includes(term) ||
        s.lastname.toLowerCase().includes(term) ||
        s.username.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term)
    );
  }, [allStudents, roleFilter, studentSearch]);

  function openStudent(student) {
    setSelectedStudent(student);
    setStudentGrades(null);
    setLevel('student');

    setStudentGradesLoading(true);
    getCourseGradesReport(selectedCourse.course_id, { moodleSource: selectedPlatform.source })
      .then((response) => {
        if (!response?.available) return;
        const match = response.students.find((s) => s.userId === student.userId);
        setStudentGrades(match || null);
      })
      .catch(() => setStudentGrades(null))
      .finally(() => setStudentGradesLoading(false));
  }

  function backToPlatforms() {
    setLevel('platforms');
    setSelectedPlatform(null);
    setSelectedCourse(null);
    setSelectedStudent(null);
  }

  function backToCourses() {
    setLevel('courses');
    setSelectedCourse(null);
    setSelectedStudent(null);
  }

  function backToCourse() {
    setLevel('course');
    setSelectedStudent(null);
  }

  const breadcrumbItems = [
    { label: 'Plataformas', onClick: level !== 'platforms' ? backToPlatforms : undefined },
  ];
  if (selectedPlatform) {
    breadcrumbItems.push({
      label: formatPlatformDisplayName(selectedPlatform.name),
      onClick: level !== 'courses' ? backToCourses : undefined,
    });
  }
  if (selectedCourse) {
    breadcrumbItems.push({
      label: selectedCourse.course_name,
      onClick: level === 'student' ? backToCourse : undefined,
    });
  }
  if (selectedStudent) {
    breadcrumbItems.push({ label: `${selectedStudent.firstname} ${selectedStudent.lastname}`.trim() });
  }

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Moodle Insights</p>
          <h2 className="card-title section-title">Cursos y Alumnos</h2>
          <p className="panel-description">
            Explora cada plataforma, sus cursos y el detalle de cada alumno matriculado.
          </p>
        </div>
        {!platformsLoading && platforms.length > 0 && (
          <div className="cs-platform-picker" ref={pickerRef}>
            <button
              type="button"
              className="cs-platform-trigger"
              onClick={() => setPickerOpen((open) => !open)}
            >
              <span>
                {selectedPlatform ? formatPlatformDisplayName(selectedPlatform.name) : 'Selecciona una plataforma'}
              </span>
              <ChevronDown size={16} className={`cs-platform-chevron ${pickerOpen ? 'open' : ''}`} />
            </button>
            {pickerOpen && (
              <div className="cs-platform-dropdown">
                <div className="cs-platform-search">
                  <Search size={14} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar plataforma…"
                    value={platformSearch}
                    onChange={(e) => setPlatformSearch(e.target.value)}
                  />
                </div>
                <div className="cs-platform-options">
                  {filteredPickerPlatforms.map((p) => (
                    <button
                      key={p.source}
                      type="button"
                      className={`cs-platform-option ${selectedPlatform?.source === p.source ? 'active' : ''}`}
                      onClick={() => selectPlatformFromPicker(p)}
                    >
                      {formatPlatformDisplayName(p.name)}
                    </button>
                  ))}
                  {!filteredPickerPlatforms.length && (
                    <p className="cs-platform-empty">Sin resultados.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Breadcrumb items={breadcrumbItems} />

      {level === 'platforms' && (
        <Card className="p-4 min-w-0">
          {platformsLoading ? (
            <ListSkeleton rows={8} />
          ) : !platforms.length ? (
            <p className="empty">No hay plataformas configuradas todavía.</p>
          ) : (
            <>
              <p className="panel-description cs-platform-prompt">
                Elige una plataforma arriba para ver sus cursos y alumnos.
              </p>
              <div className="cs-platform-grid">
                {platforms.map((p) => (
                  <button
                    key={p.source}
                    type="button"
                    className="cs-platform-card"
                    onClick={() => openPlatform(p)}
                  >
                    {formatPlatformDisplayName(p.name)}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {level === 'courses' && (
        <Card className="p-4 min-w-0">
          <div className="table-header-row">
            <h3 className="card-title table-title">
              Cursos de {formatPlatformDisplayName(selectedPlatform.name)} ({filteredCourses.length})
            </h3>
            <Input
              type="text"
              className="table-search"
              placeholder="Buscar curso o categoría"
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
          </div>
          {templateCount > 0 && (
            <button
              type="button"
              className="cs-template-toggle"
              onClick={() => setHideTemplates((prev) => !prev)}
            >
              {hideTemplates
                ? `Mostrar plantillas (${templateCount} ocultas)`
                : `Ocultar plantillas (${templateCount})`}
            </button>
          )}
          {coursesLoading ? (
            <TableSkeleton columns={2} />
          ) : coursesError ? (
            <ErrorRetry message={coursesError} onRetry={() => openPlatform(selectedPlatform)} />
          ) : !allCourses.length ? (
            <p className="empty">
              No hay datos de cursos para esta plataforma. Sincronízala primero en Configuración.
            </p>
          ) : (
            <div className="table-wrapper insights-table-wrapper">
              <table className="course-table">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr
                      key={course.course_id}
                      className="course-row-clickable"
                      onClick={() => openCourse(course)}
                    >
                      <td>
                        <div className="course-cell">
                          <span className="course-name-text">{course.course_name}</span>
                          {course.shortname && (
                            <span className="course-short">{course.shortname}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="cat-badge">{course.category_name}</span>
                        {isTemplateCourse(course) && (
                          <Badge variant="secondary" className="cs-template-badge">
                            Plantilla
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredCourses.length && (
                    <tr>
                      <td colSpan={2} className="empty">
                        No se encontraron cursos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {level === 'course' && selectedCourse && (
        <Card className="p-4 min-w-0">
          <div className="table-header-row">
            <div>
              <h3 className="card-title table-title">{selectedCourse.course_name}</h3>
              <p className="panel-description">
                {selectedCourse.shortname ? `${selectedCourse.shortname} · ` : ''}
                {selectedCourse.category_name}
              </p>
            </div>
          </div>

          <div className="cs-tabs">
            <button
              type="button"
              className={`cs-tab ${courseTab === 'students' ? 'active' : ''}`}
              onClick={() => setCourseTab('students')}
            >
              Lista de alumnos
            </button>
            <button
              type="button"
              className={`cs-tab ${courseTab === 'global' ? 'active' : ''}`}
              onClick={() => setCourseTab('global')}
            >
              Informe global
            </button>
            <button
              type="button"
              className={`cs-tab ${courseTab === 'grades' ? 'active' : ''}`}
              onClick={() => setCourseTab('grades')}
            >
              Calificaciones
            </button>
            <button
              type="button"
              className={`cs-tab ${courseTab === 'detail' ? 'active' : ''}`}
              onClick={() => {
                setCourseTab('detail');
                loadBreakdown(selectedCourse.course_id);
              }}
            >
              Detalle del curso
            </button>
          </div>

          {courseTab === 'students' && (
            <>
              <Input
                type="text"
                className="table-search"
                placeholder="Buscar alumno, usuario o email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <div className="cs-role-filter">
                <button
                  type="button"
                  className={`cs-role-chip ${roleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('all')}
                >
                  Todos ({studentsCount + teachersCount})
                </button>
                <button
                  type="button"
                  className={`cs-role-chip ${roleFilter === 'students' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('students')}
                >
                  Alumnos ({studentsCount})
                </button>
                <button
                  type="button"
                  className={`cs-role-chip ${roleFilter === 'teachers' ? 'active' : ''}`}
                  onClick={() => setRoleFilter('teachers')}
                >
                  Profesores/tutores ({teachersCount})
                </button>
              </div>
              {accessReportLoading ? (
                <>
                  <p className="cs-detail-loading-note">
                    Consultando alumnos en vivo — en plataformas con muchos alumnos puede
                    tardar un poco en cargar.
                  </p>
                  <TableSkeleton columns={6} />
                </>
              ) : accessReportError ? (
                <ErrorRetry
                  message={accessReportError}
                  onRetry={() => loadAccessReport(selectedCourse.course_id)}
                />
              ) : !filteredStudents.length ? (
                <p className="empty">No hay alumnos matriculados en este curso.</p>
              ) : (
                <div className="table-wrapper insights-table-wrapper">
                  <table className="course-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Apellidos</th>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Nota final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr
                          key={student.userId}
                          className="course-row-clickable"
                          onClick={() => openStudent(student)}
                        >
                          <td>{student.firstname || '—'}</td>
                          <td>{student.lastname || '—'}</td>
                          <td className="mono">{student.username}</td>
                          <td>{student.email || '—'}</td>
                          <td>
                            <Badge variant={isTeacherRole(student) ? 'outline' : 'secondary'}>
                              {isTeacherRole(student) ? 'Profesor/tutor' : 'Alumno'}
                            </Badge>
                          </td>
                          <td>{student.finalGrade ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {courseTab === 'global' && (
            <>
              <div className="table-header-row">
                <p className="panel-description">
                  Matrícula, accesos, actividades completadas, nota final y mensajes de foro
                  de cada alumno, según los datos que expone el Web Service de Moodle.
                </p>
              </div>
              <div className="course-breakdown-actions">
                <p className="course-breakdown-warning">
                  Advertencia: en plataformas con muchos alumnos o cursos con mucha actividad,
                  este informe puede tardar un poco en generarse.
                </p>
                <Button
                  type="button"
                  className="course-breakdown-sync-btn"
                  onClick={() => setHasRequestedGlobalReport(true)}
                  disabled={accessReportLoading}
                >
                  {accessReportLoading
                    ? 'Cargando informe…'
                    : hasRequestedGlobalReport
                      ? 'Actualizar informe'
                      : 'Generar informe global'}
                </Button>
                {hasRequestedGlobalReport && Boolean(globalReportRows.length) && (
                  <Button type="button" variant="outline" onClick={handleExportGlobalReport}>
                    Descargar informe (Excel)
                  </Button>
                )}
              </div>

              {!hasRequestedGlobalReport ? (
                <p className="empty">
                  Presiona “Generar informe global” para ver la ficha completa de alumnos.
                </p>
              ) : accessReportLoading ? (
                <TableSkeleton columns={6} />
              ) : accessReportError ? (
                <ErrorRetry
                  message={accessReportError}
                  onRetry={() => loadAccessReport(selectedCourse.course_id)}
                />
              ) : !globalReportRows.length ? (
                <p className="empty">No hay alumnos matriculados en este curso.</p>
              ) : (
                <>
                  <Input
                    type="text"
                    className="table-search"
                    placeholder="Buscar alumno, usuario o email"
                    value={globalSearchTerm}
                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  />
                  <div className="cs-report-box table-wrapper insights-table-wrapper">
                    <Table className="course-table access-report-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sortable" onClick={() => handleGlobalSort('firstname')}>
                            Nombre{globalSortIcon('firstname')}
                          </TableHead>
                          <TableHead className="sortable" onClick={() => handleGlobalSort('lastname')}>
                            Apellidos{globalSortIcon('lastname')}
                          </TableHead>
                          <TableHead>Matrícula activa</TableHead>
                          <TableHead className="sortable" onClick={() => handleGlobalSort('username')}>
                            Usuario{globalSortIcon('username')}
                          </TableHead>
                          <TableHead className="sortable" onClick={() => handleGlobalSort('email')}>
                            Email{globalSortIcon('email')}
                          </TableHead>
                          <TableHead className="sortable" onClick={() => handleGlobalSort('firstAccess')}>
                            Primer acceso (sitio){globalSortIcon('firstAccess')}
                          </TableHead>
                          <TableHead
                            className="sortable"
                            onClick={() => handleGlobalSort('lastCourseAccess')}
                          >
                            Último acceso (curso){globalSortIcon('lastCourseAccess')}
                          </TableHead>
                          <TableHead>Tiempo acumulado</TableHead>
                          <TableHead>Actividades de aprendizaje</TableHead>
                          <TableHead>Nota final</TableHead>
                          <TableHead>Evaluaciones</TableHead>
                          <TableHead>Correos</TableHead>
                          <TableHead>Mensajes Foro</TableHead>
                          <TableHead>Mensajes chats</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {globalReportRows.map((student) => (
                          <TableRow key={student.userId}>
                            <TableCell>{student.firstname || '—'}</TableCell>
                            <TableCell>{student.lastname || '—'}</TableCell>
                            <TableCell>
                              {student.activeEnrollment === null
                                ? 'No disponible'
                                : student.activeEnrollment
                                  ? 'Sí'
                                  : 'No'}
                            </TableCell>
                            <TableCell className="mono">{student.username}</TableCell>
                            <TableCell>{student.email || '—'}</TableCell>
                            <TableCell>{formatUnixSeconds(student.firstAccess)}</TableCell>
                            <TableCell>{formatUnixSeconds(student.lastCourseAccess)}</TableCell>
                            <TableCell className="muted" title="No disponible por Web Services">—</TableCell>
                            <TableCell>
                              {student.activitiesTotal === null ? (
                                <span className="muted" title="Requiere 'Finalización de actividades' activada en el curso">
                                  No disponible
                                </span>
                              ) : (
                                `${student.activitiesCompleted}/${student.activitiesTotal}`
                              )}
                            </TableCell>
                            <TableCell>
                              {student.finalGrade === null ? (
                                <span className="muted" title="Requiere permiso de calificaciones habilitado">
                                  No disponible
                                </span>
                              ) : (
                                student.finalGrade
                              )}
                            </TableCell>
                            <TableCell>
                              {student.evaluationsTotal === null ? (
                                <span className="muted" title="Requiere permiso de calificaciones habilitado">
                                  No disponible
                                </span>
                              ) : (
                                `${student.evaluationsCompleted}/${student.evaluationsTotal}`
                              )}
                            </TableCell>
                            <TableCell className="muted" title="No disponible por Web Services">—</TableCell>
                            <TableCell>
                              {student.forumMessageCount === null ? (
                                <span className="muted" title="No hay foros disponibles en este curso">
                                  No disponible
                                </span>
                              ) : (
                                student.forumMessageCount
                              )}
                            </TableCell>
                            <TableCell className="muted" title="No disponible por Web Services">—</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="history-note">
                    "Registros", "Tiempo acumulado", "Correos" y "Mensajes chats" no están
                    disponibles por Web Services de Moodle — solo existen dentro de plugins de
                    informes (como block_advanced_reports), que no exponen API. "Actividades de
                    aprendizaje" necesita que el curso tenga activada la "Finalización de
                    actividades"; "Nota final" necesita el permiso de calificaciones habilitado;
                    "Mensajes Foro" necesita que el curso tenga al menos un foro.
                  </p>
                </>
              )}
            </>
          )}

          {courseTab === 'grades' && (
            <>
              <div className="table-header-row">
                <p className="panel-description">
                  Nota de cada tarea, examen y actividad evaluable por alumno matriculado,
                  obtenida en vivo de Moodle (<span className="mono">gradereport_user_get_grade_items</span>).
                </p>
              </div>
              <div className="course-breakdown-actions">
                <p className="course-breakdown-warning">
                  Advertencia: en plataformas con muchos alumnos o cursos con mucha actividad,
                  este informe puede tardar un poco en generarse.
                </p>
                <Button
                  type="button"
                  className="course-breakdown-sync-btn"
                  onClick={loadGradesReport}
                  disabled={gradesReportLoading}
                >
                  {gradesReportLoading
                    ? 'Cargando calificaciones…'
                    : hasRequestedGradesReport
                      ? 'Actualizar calificaciones'
                      : 'Cargar evaluaciones y calificaciones'}
                </Button>
                {Boolean(gradesReportData?.students?.length) && gradesReportData?.available && (
                  <Button type="button" variant="outline" onClick={handleExportGradesReport}>
                    Descargar informe (Excel)
                  </Button>
                )}
              </div>

              {!hasRequestedGradesReport ? (
                <p className="empty">
                  Presiona “Cargar evaluaciones y calificaciones” para consultar los datos en vivo.
                </p>
              ) : gradesReportLoading ? (
                <p className="empty">Consultando calificaciones en vivo…</p>
              ) : gradesReportError ? (
                <ErrorRetry message={gradesReportError} onRetry={loadGradesReport} />
              ) : gradesReportData?.available === false ? (
                <p className="empty error">
                  Esta plataforma todavía no tiene habilitada la función de calificaciones
                  (<span className="mono">gradereport_user_get_grade_items</span>) en su Web
                  Service — hay que pedirle al administrador de ese Moodle que la habilite en el
                  servicio externo y añada la capacidad <span className="mono">moodle/grade:viewall</span>.
                </p>
              ) : !gradesReportData?.students?.length ? (
                <p className="empty">No hay calificaciones registradas para este curso todavía.</p>
              ) : (
                <div className="cs-report-box table-wrapper insights-table-wrapper">
                  <Table className="course-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alumno</TableHead>
                        <TableHead className="right">Evaluaciones</TableHead>
                        <TableHead className="right">Nota curso (/10)</TableHead>
                        <TableHead>Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradesReportData.students.map((student) => (
                        <TableRow key={student.userId}>
                          <TableCell>{student.fullname || '—'}</TableCell>
                          <TableCell className="right mono">
                            {student.completedItems}/{student.totalItems}
                          </TableCell>
                          <TableCell className="right mono bold">{student.courseScoreOutOf10}</TableCell>
                          <TableCell>
                            {student.items.length ? (
                              <div className="grade-detail-cell">
                                {student.items.map((item, idx) => (
                                  <div key={idx} className="grade-detail-row">
                                    <span className="grade-detail-name">{item.itemName}</span>
                                    <span className="grade-detail-value mono">
                                      {item.gradeFormatted} ({item.scoreOutOf10}/10)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}

          {courseTab === 'detail' && (
            breakdownLoading ? (
              <div className="cs-detail-card">
                <p className="cs-detail-loading-note">
                  Calculando el detalle en vivo, archivo por archivo — puede tardar hasta un
                  minuto en cursos con mucho contenido.
                </p>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="cs-stat-row">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : breakdownError ? (
              <ErrorRetry
                message={breakdownError}
                onRetry={() => loadBreakdown(selectedCourse.course_id)}
              />
            ) : breakdownData ? (
              <div className="cs-detail-card">
                <div className="cs-detail-meta-row">
                  <p className={`course-breakdown-meta course-breakdown-meta-${breakdownData.source || 'live'}`}>
                    {breakdownData.source === 'cache' ? 'Detalle cargado desde caché' : 'Detalle recalculado en vivo'} ·
                    {' '}Calculado: {formatDateTime(breakdownData.calculatedAt)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={breakdownLoading}
                    onClick={() => loadBreakdown(selectedCourse.course_id, { refresh: true })}
                  >
                    Recalcular
                  </Button>
                </div>
                <StatRow label="Contenido" value={formatBytes(breakdownData.course.size_bytes)} />
                <StatRow
                  label="Entregas"
                  value={formatBytes(breakdownData.course.assignment_size_bytes)}
                />
                <StatRow label="Foros" value={formatBytes(breakdownData.course.forum_size_bytes)} />
                <StatRow
                  label="Backups"
                  value={formatBytes(breakdownData.course.backup_size_bytes)}
                />
                <StatRow
                  label="Total"
                  value={formatBytes(breakdownData.course.total_bytes)}
                />
              </div>
            ) : (
              <p className="empty">Cargando…</p>
            )
          )}
        </Card>
      )}

      {level === 'student' && selectedStudent && (
        <Card className="p-4 min-w-0">
          <h3 className="card-title table-title">
            {selectedStudent.firstname} {selectedStudent.lastname}
          </h3>
          <p className="panel-description">Estadísticas del curso {selectedCourse?.course_name}</p>

          <div className="cs-detail-card">
            <StatRow label="Nombre" value={selectedStudent.firstname || '—'} />
            <StatRow label="Apellidos" value={selectedStudent.lastname || '—'} />
            <StatRow
              label="Matrícula activa"
              value={
                selectedStudent.activeEnrollment === null
                  ? 'No disponible'
                  : selectedStudent.activeEnrollment
                    ? 'Sí'
                    : 'No'
              }
            />
            <StatRow label="Usuario" value={selectedStudent.username} />
            <StatRow label="Email" value={selectedStudent.email || '—'} />
            <StatRow label="Primer acceso (sitio)" value={formatUnixSeconds(selectedStudent.firstAccess)} />
            <StatRow
              label="Último acceso (curso)"
              value={formatUnixSeconds(selectedStudent.lastCourseAccess)}
            />
            <StatRow
              label="Registros"
              value={<Badge variant="secondary">No disponible</Badge>}
            />
            <StatRow
              label="Tiempo acumulado"
              value={<Badge variant="secondary">No disponible</Badge>}
            />
            <StatRow
              label="Actividades de aprendizaje"
              value={
                selectedStudent.activitiesTotal === null
                  ? 'No disponible'
                  : `${selectedStudent.activitiesCompleted}/${selectedStudent.activitiesTotal}`
              }
            />
            <StatRow
              label="Evaluaciones"
              value={
                selectedStudent.evaluationsTotal === null
                  ? 'No disponible'
                  : `${selectedStudent.evaluationsCompleted}/${selectedStudent.evaluationsTotal}`
              }
            />
            <StatRow label="Nota final" value={selectedStudent.finalGrade ?? 'No disponible'} />
            <StatRow
              label="Correos"
              value={<Badge variant="secondary">No disponible</Badge>}
            />
            <StatRow
              label="Mensajes Foro"
              value={selectedStudent.forumMessageCount ?? 'No disponible'}
            />
            <StatRow
              label="Mensajes chats"
              value={<Badge variant="secondary">No disponible</Badge>}
            />
          </div>

          {studentGradesLoading ? (
            <div className="grade-detail-cell" style={{ maxHeight: 220 }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-4 w-full" />
              ))}
            </div>
          ) : studentGrades?.items?.length ? (
            <div className="cs-grades-detail">
              <p className="eyebrow">Detalle por evaluación</p>
              <div className="grade-detail-cell" style={{ maxHeight: 220 }}>
                {studentGrades.items.map((item, idx) => (
                  <div key={idx} className="grade-detail-row">
                    <span className="grade-detail-name">{item.itemName}</span>
                    <span className="grade-detail-value mono">{item.gradeFormatted}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
