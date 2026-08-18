import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import {
  getPlatforms,
  getCourses,
  getCourseBreakdown,
  getCourseAccessReport,
  getCourseGradesReport,
} from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { formatBytes } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Breadcrumb from './Breadcrumb';

const NAV_STORAGE_KEY = 'cs-nav-state';

function isTemplateCourse(course) {
  return /plantilla/i.test(course.category_name || '');
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

function formatUnixSeconds(value) {
  if (!value) return 'Nunca';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return (
    date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
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

export default function CoursesStudentsPage() {
  const [level, setLevel] = useState('platforms');
  const [platforms, setPlatforms] = useState([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [platformSearch, setPlatformSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const [courseData, setCourseData] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [hideTemplates, setHideTemplates] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const [courseTab, setCourseTab] = useState('students'); // 'detail' | 'students'
  const [breakdownData, setBreakdownData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState(null);

  const [accessReportData, setAccessReportData] = useState(null);
  const [accessReportLoading, setAccessReportLoading] = useState(false);
  const [accessReportError, setAccessReportError] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentGrades, setStudentGrades] = useState(null);
  const [studentGradesLoading, setStudentGradesLoading] = useState(false);

  const pendingRestoreRef = useRef(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) || 'null');
      } catch {
        return null;
      }
    })()
  );

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

  // Restaurar la última plataforma/curso/alumno visitados (localStorage) al
  // entrar a la página, en vez de empezar siempre desde "Plataformas".
  useEffect(() => {
    if (platformsLoading) return;
    const pending = pendingRestoreRef.current;
    if (!pending?.platformSource) {
      setRestoring(false);
      return;
    }
    const platform = platforms.find((p) => p.source === pending.platformSource);
    if (!platform) {
      pendingRestoreRef.current = null;
      setRestoring(false);
      return;
    }
    openPlatform(platform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformsLoading, platforms]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending || !courseData) return;

    if (pending.courseId) {
      const course = allCourses.find((c) => c.course_id === pending.courseId);
      if (course) {
        openCourse(course);
        if (!pending.studentUserId) {
          pendingRestoreRef.current = null;
          setRestoring(false);
        }
        return;
      }
    }
    pendingRestoreRef.current = null;
    setRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseData]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending?.studentUserId || !accessReportData) return;

    const student = accessReportData.students?.find((s) => s.userId === pending.studentUserId);
    pendingRestoreRef.current = null;
    setRestoring(false);
    if (student) openStudent(student);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessReportData]);

  useEffect(() => {
    if (restoring) return;
    try {
      if (selectedPlatform) {
        localStorage.setItem(
          NAV_STORAGE_KEY,
          JSON.stringify({
            platformSource: selectedPlatform.source,
            courseId: selectedCourse?.course_id || null,
            studentUserId: selectedStudent?.userId || null,
          })
        );
      } else {
        localStorage.removeItem(NAV_STORAGE_KEY);
      }
    } catch {
      // localStorage no disponible: se ignora, simplemente no se restaura la próxima vez
    }
  }, [restoring, selectedPlatform, selectedCourse, selectedStudent]);

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

  function loadBreakdown(courseId) {
    if (breakdownData || breakdownLoading) return;
    setBreakdownLoading(true);
    setBreakdownError(null);
    getCourseBreakdown(courseId, { moodleSource: selectedPlatform.source })
      .then((response) => setBreakdownData(response))
      .catch(() => {
        setBreakdownData(null);
        setBreakdownError('No se pudo cargar el detalle de almacenamiento de este curso.');
      })
      .finally(() => setBreakdownLoading(false));
  }

  const filteredStudents = useMemo(() => {
    const students = accessReportData?.students || [];
    if (!studentSearch.trim()) return students;
    const term = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.firstname.toLowerCase().includes(term) ||
        s.lastname.toLowerCase().includes(term) ||
        s.username.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term)
    );
  }, [accessReportData, studentSearch]);

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

  const filteredPlatforms = useMemo(() => {
    if (!platformSearch.trim()) return platforms;
    const term = platformSearch.toLowerCase();
    return platforms.filter((p) => formatPlatformDisplayName(p.name).toLowerCase().includes(term));
  }, [platforms, platformSearch]);

  const breadcrumbItems = [{ label: 'Plataformas', onClick: level !== 'platforms' ? backToPlatforms : undefined }];
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
      </div>

      <Breadcrumb items={breadcrumbItems} />

      {level === 'platforms' && (
        <Card className="p-4">
          <div className="table-header-row">
            <h3 className="card-title table-title">Plataformas ({platforms.length})</h3>
            <Input
              type="text"
              className="table-search"
              placeholder="Buscar plataforma"
              value={platformSearch}
              onChange={(e) => setPlatformSearch(e.target.value)}
            />
          </div>
          {platformsLoading ? (
            <ListSkeleton rows={8} />
          ) : (
            <div className="cs-list">
              {filteredPlatforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  className="cs-list-item"
                  onClick={() => openPlatform(platform)}
                >
                  <span>{formatPlatformDisplayName(platform.name)}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!filteredPlatforms.length && (
                <p className="empty">No se encontraron plataformas.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {level === 'courses' && (
        <Card className="p-4">
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
            <p className="empty error">{coursesError}</p>
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
        <Card className="p-4">
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
              className={`cs-tab ${courseTab === 'detail' ? 'active' : ''}`}
              onClick={() => {
                setCourseTab('detail');
                loadBreakdown(selectedCourse.course_id);
              }}
            >
              Detalle del curso
            </button>
          </div>

          {courseTab === 'students' ? (
            <>
              <Input
                type="text"
                className="table-search"
                placeholder="Buscar alumno, usuario o email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {accessReportLoading ? (
                <TableSkeleton columns={5} />
              ) : accessReportError ? (
                <p className="empty error">{accessReportError}</p>
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
                          <td>{student.finalGrade ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : breakdownLoading ? (
            <div className="cs-detail-card">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="cs-stat-row">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : breakdownError ? (
            <p className="empty error">{breakdownError}</p>
          ) : breakdownData ? (
            <div className="cs-detail-card">
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
          )}
        </Card>
      )}

      {level === 'student' && selectedStudent && (
        <Card className="p-4">
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
