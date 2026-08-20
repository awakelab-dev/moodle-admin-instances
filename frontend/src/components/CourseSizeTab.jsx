import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getCourseBreakdown, getCourseAccessReport, getCourseGradesReport, getCourses } from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { formatBytes, formatUnixSeconds } from '@/lib/formatters';
import { downloadXlsx } from '@/lib/excel';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ErrorRetry from './ErrorRetry';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const STORAGE_COLORS = {
  content: '#19F7F1',
  assignments: '#0FCED3',
  forum: '#0ABCC9',
  backup: '#0B93AA',
  total: '#C9D6EA',
};

const CHART_FONT_FAMILY = "'Poppins', sans-serif";

function formatPercentage(part, total) {
  if (!part || !total) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function truncateLabel(value, maxLength = 30) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CL');
}

// Pestaña "Tamaño del curso" dentro del Dashboard de una plataforma. Muestra
// el inventario completo de cursos con su desglose de almacenamiento (top 10
// en gráfico + tabla completa) y, al seleccionar un curso, tres paneles bajo
// demanda: desglose de archivos por componente/filearea, ficha de alumnos
// (accesos/actividades) e informe de calificaciones. Cada panel se consulta
// en vivo a Moodle solo cuando el usuario lo pide explícitamente, porque son
// llamadas costosas al Web Service.
export default function CourseSizeTab({ moodleSource, platformName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('total_bytes');
  const [sortDir, setSortDir] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState(null);
  const [breakdownRequestedCourseId, setBreakdownRequestedCourseId] = useState(null);
  // Contador de "petición vigente" para el desglose: cada llamada a
  // handleLoadBreakdown incrementa este ref y solo la última respuesta que
  // coincide con el valor guardado se aplica al estado. Evita que una
  // respuesta lenta de un curso ya abandonado (usuario cambió de curso o
  // pidió refrescar de nuevo) sobrescriba datos más recientes (race condition).
  const latestBreakdownRequestRef = useRef(0);
  const [accessReportData, setAccessReportData] = useState(null);
  const [accessReportLoading, setAccessReportLoading] = useState(false);
  const [accessReportError, setAccessReportError] = useState(null);
  const [accessReportRequestedCourseId, setAccessReportRequestedCourseId] = useState(null);
  const [accessSearchTerm, setAccessSearchTerm] = useState('');
  const [accessSortKey, setAccessSortKey] = useState('lastname');
  const [accessSortDir, setAccessSortDir] = useState('asc');
  // Mismo mecanismo anti-carrera que latestBreakdownRequestRef, aplicado al
  // informe de accesos.
  const latestAccessReportRequestRef = useRef(0);
  const [gradesReportData, setGradesReportData] = useState(null);
  const [gradesReportLoading, setGradesReportLoading] = useState(false);
  const [gradesReportError, setGradesReportError] = useState(null);
  const [gradesReportRequestedCourseId, setGradesReportRequestedCourseId] = useState(null);
  // Mismo mecanismo anti-carrera, aplicado al informe de calificaciones.
  const latestGradesReportRequestRef = useRef(0);

  // Al cambiar de plataforma o de curso seleccionado, se invalidan los tres
  // paneles bajo demanda (desglose, accesos, calificaciones): se incrementan
  // sus refs de petición vigente para descartar cualquier respuesta pendiente
  // del curso anterior y se limpia el estado para forzar que el usuario vuelva
  // a pedir la carga explícitamente en el curso nuevo.
  useEffect(() => {
    latestBreakdownRequestRef.current += 1;
    setBreakdownData(null);
    setBreakdownError(null);
    setBreakdownLoading(false);
    setBreakdownRequestedCourseId(null);
    latestAccessReportRequestRef.current += 1;
    setAccessReportData(null);
    setAccessReportError(null);
    setAccessReportLoading(false);
    setAccessReportRequestedCourseId(null);
    setAccessSearchTerm('');
    latestGradesReportRequestRef.current += 1;
    setGradesReportData(null);
    setGradesReportError(null);
    setGradesReportLoading(false);
    setGradesReportRequestedCourseId(null);
  }, [moodleSource, selectedCourseId]);

  useEffect(() => {
    let isMounted = true;

    if (!moodleSource) {
      setData(null);
      setError(null);
      setSelectedCourseId(null);
      setBreakdownData(null);
      setBreakdownError(null);
      setBreakdownRequestedCourseId(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setSelectedCourseId(null);
    setBreakdownData(null);
    setBreakdownError(null);
    setBreakdownRequestedCourseId(null);

    getCourses({ moodleSource })
      .then((response) => {
        if (!isMounted) return;
        setData(response);
        setError(null);
      })
      .catch(() => {
        if (!isMounted) return;
        setData(null);
        setError('No se pudieron cargar los cursos. Intenta sincronizar nuevamente.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [moodleSource]);


  const allCourses = useMemo(() => {
    if (!data || !data.categories?.length) return [];
    const list = [];
    for (const cat of data.categories) {
      for (const course of cat.courses) {
        list.push({
          ...course,
          category_name: cat.category_name,
          total_bytes:
            (course.size_bytes || 0) +
            (course.backup_size_bytes || 0) +
            (course.assignment_size_bytes || 0) +
            (course.forum_size_bytes || 0),
        });
      }
    }
    return list;
  }, [data]);

  useEffect(() => {
    if (!allCourses.length || selectedCourseId === null) {
      setSelectedCourseId(null);
      return;
    }

    const selectedExists = allCourses.some((course) => course.course_id === selectedCourseId);
    if (!selectedExists) {
      setSelectedCourseId(null);
    }
  }, [allCourses, selectedCourseId]);

  // Carga el desglose de almacenamiento (por componente/filearea) del curso
  // seleccionado. `refresh: true` fuerza un recálculo en vivo contra Moodle;
  // sin refresh, el backend puede devolver el resultado ya guardado ("de
  // caché") si existe. `breakdownData.source` indica cuál de los dos ocurrió
  // (ver breakdownSourceLabel más abajo).
  async function handleLoadBreakdown({ refresh = false } = {}) {
    if (!moodleSource || !selectedCourseId) return;

    const courseId = selectedCourseId;
    const requestId = latestBreakdownRequestRef.current + 1;
    latestBreakdownRequestRef.current = requestId;

    setBreakdownRequestedCourseId(courseId);
    setBreakdownError(null);
    setBreakdownData(null);
    setBreakdownLoading(true);

    try {
      const response = await getCourseBreakdown(courseId, {
        moodleSource,
        ...(refresh ? { refresh: 1 } : {}),
      });
      if (latestBreakdownRequestRef.current !== requestId) return;
      setBreakdownData(response);
    } catch {
      if (latestBreakdownRequestRef.current !== requestId) return;
      setBreakdownData(null);
      setBreakdownError('No se pudo cargar el desglose detallado de este curso.');
    } finally {
      if (latestBreakdownRequestRef.current === requestId) {
        setBreakdownLoading(false);
      }
    }
  }

  // Carga la ficha de alumnos (matrícula, accesos, actividades, nota final,
  // mensajes de foro) consultando el Web Service de Moodle en vivo; no hay
  // caché para este informe.
  async function handleLoadAccessReport() {
    if (!moodleSource || !selectedCourseId) return;

    const courseId = selectedCourseId;
    const requestId = latestAccessReportRequestRef.current + 1;
    latestAccessReportRequestRef.current = requestId;

    setAccessReportRequestedCourseId(courseId);
    setAccessReportError(null);
    setAccessReportData(null);
    setAccessReportLoading(true);

    try {
      const response = await getCourseAccessReport(courseId, { moodleSource });
      if (latestAccessReportRequestRef.current !== requestId) return;
      setAccessReportData(response);
    } catch {
      if (latestAccessReportRequestRef.current !== requestId) return;
      setAccessReportData(null);
      setAccessReportError('No se pudo cargar el informe de accesos de este curso.');
    } finally {
      if (latestAccessReportRequestRef.current === requestId) {
        setAccessReportLoading(false);
      }
    }
  }

  // Carga el detalle de calificaciones por alumno (gradereport_user_get_grade_items
  // de Moodle) en vivo; puede venir marcado como no disponible si la
  // plataforma no tiene esa función habilitada en su Web Service externo.
  async function handleLoadGradesReport() {
    if (!moodleSource || !selectedCourseId) return;

    const courseId = selectedCourseId;
    const requestId = latestGradesReportRequestRef.current + 1;
    latestGradesReportRequestRef.current = requestId;

    setGradesReportRequestedCourseId(courseId);
    setGradesReportError(null);
    setGradesReportData(null);
    setGradesReportLoading(true);

    try {
      const response = await getCourseGradesReport(courseId, { moodleSource });
      if (latestGradesReportRequestRef.current !== requestId) return;
      setGradesReportData(response);
    } catch {
      if (latestGradesReportRequestRef.current !== requestId) return;
      setGradesReportData(null);
      setGradesReportError('No se pudo cargar el informe de calificaciones de este curso.');
    } finally {
      if (latestGradesReportRequestRef.current === requestId) {
        setGradesReportLoading(false);
      }
    }
  }

  // Exporta la ficha de alumnos a un .xlsx real (no CSV) usando downloadXlsx,
  // que genera el archivo en el navegador con formato de columnas propio.
  function handleExportAccessReport() {
    if (!accessReportData?.students?.length) return;

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

    const rows = accessReportRows.map((student) => ({
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

  // Exporta el detalle de calificaciones a .xlsx. A diferencia del informe de
  // accesos, aquí cada alumno puede ocupar varias filas (una por ítem
  // evaluable), por lo que se calcula `groupStartRows` con la fila donde
  // empieza cada alumno: downloadXlsx usa esos índices para fusionar/agrupar
  // visualmente las celdas repetidas (nombre, evaluaciones, nota curso) en la
  // hoja de Excel en vez de repetirlas en cada fila.
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

  function handleAccessSort(key) {
    if (accessSortKey === key) {
      setAccessSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setAccessSortKey(key);
      setAccessSortDir('asc');
    }
  }

  function accessSortIcon(key) {
    if (accessSortKey !== key) return ' ↕';
    return accessSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const accessReportRows = useMemo(() => {
    const students = accessReportData?.students || [];
    let filtered = students;

    if (accessSearchTerm.trim()) {
      const term = accessSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.firstname.toLowerCase().includes(term) ||
          s.lastname.toLowerCase().includes(term) ||
          s.username.toLowerCase().includes(term) ||
          s.email.toLowerCase().includes(term)
      );
    }

    return [...filtered].sort((a, b) => {
      const valA = a[accessSortKey] ?? 0;
      const valB = b[accessSortKey] ?? 0;
      if (typeof valA === 'string') {
        return accessSortDir === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return accessSortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [accessReportData, accessSearchTerm, accessSortKey, accessSortDir]);

  const selectedCourse = useMemo(
    () => allCourses.find((course) => course.course_id === selectedCourseId) || null,
    [allCourses, selectedCourseId]
  );
  const breakdownCourse = breakdownData?.course || selectedCourse;
  const hasLoadedAccessReportForSelectedCourse =
    selectedCourseId !== null &&
    accessReportRequestedCourseId === selectedCourseId &&
    Boolean(accessReportData);
  const hasLoadedGradesReportForSelectedCourse =
    selectedCourseId !== null &&
    gradesReportRequestedCourseId === selectedCourseId &&
    Boolean(gradesReportData);
  const hasLoadedBreakdownForSelectedCourse =
    selectedCourseId !== null &&
    breakdownRequestedCourseId === selectedCourseId &&
    Boolean(breakdownData);
  const breakdownSourceLabel =
    breakdownData?.source === 'cache' ? 'Detalle cargado desde caché' : 'Detalle recalculado en vivo';

  const chartData = useMemo(() => {
    if (!allCourses.length) return null;

    const top10 = [...allCourses]
      .sort((a, b) => b.total_bytes - a.total_bytes)
      .slice(0, 10);

    return {
      labels: top10.map((course) => truncateLabel(course.course_name)),
      datasets: [
        {
          label: 'Contenido del curso',
          data: top10.map((course) => course.size_bytes || 0),
          backgroundColor: STORAGE_COLORS.content,
          borderRadius: 8,
          stack: 'storage',
        },
        {
          label: 'Entregas de alumnos',
          data: top10.map((course) => course.assignment_size_bytes || 0),
          backgroundColor: STORAGE_COLORS.assignments,
          borderRadius: 8,
          stack: 'storage',
        },
        {
          label: 'Archivos en foros',
          data: top10.map((course) => course.forum_size_bytes || 0),
          backgroundColor: STORAGE_COLORS.forum,
          borderRadius: 8,
          stack: 'storage',
        },
        {
          label: 'Copias de seguridad (.mbz)',
          data: top10.map((course) => course.backup_size_bytes || 0),
          backgroundColor: STORAGE_COLORS.backup,
          borderRadius: 8,
          stack: 'storage',
        },
      ],
    };
  }, [allCourses]);

  const tableCourses = useMemo(() => {
    let filtered = allCourses;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (course) =>
          course.course_name.toLowerCase().includes(term) ||
          (course.shortname && course.shortname.toLowerCase().includes(term)) ||
          course.category_name.toLowerCase().includes(term)
      );
    }

    return [...filtered].sort((a, b) => {
      const valA = a[sortKey] ?? 0;
      const valB = b[sortKey] ?? 0;
      if (typeof valA === 'string') {
        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [allCourses, sortKey, sortDir, searchTerm]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIcon(key) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function handleRowSelect(courseId) {
    setSelectedCourseId(courseId);
  }

  const displayPlatformName =
    formatPlatformDisplayName(data?.platformName) || platformName;

  if (loading) return <p className="empty">Cargando datos…</p>;
  if (error) return <p className="empty error">{error}</p>;
  if (!data || !data.categories?.length) {
    return (
      <p className="empty">
        No hay datos de cursos para {displayPlatformName || 'la plataforma seleccionada'}.
        Sincroniza primero esa instancia.
      </p>
    );
  }

  return (
    <div className="section-stack detail-tab-content">
      <div className="stats-grid">
        <div className="stat-box stat-box-total">
          <div className="stat-label">Total plataforma</div>
          {displayPlatformName && (
            <div className="stat-platform-name">{displayPlatformName}</div>
          )}
          <div className="stat-value">{formatBytes(data.totalBytes)}</div>
        </div>
        <div className="stat-box stat-box-content">
          <div className="stat-label stat-label-with-dot">
            <span className="stat-dot" />
            Contenido cursos
          </div>
          <div className="stat-value stat-value-content">
            {formatBytes(data.totalContentBytes)}
          </div>
        </div>
        <div className="stat-box stat-box-assignment">
          <div className="stat-label stat-label-with-dot">
            <span className="stat-dot" />
            Entregas alumnos
          </div>
          <div className="stat-value stat-value-assignment">
            {formatBytes(data.totalAssignmentBytes)}
          </div>
        </div>
        <div className="stat-box stat-box-forum">
          <div className="stat-label stat-label-with-dot">
            <span className="stat-dot" />
            Foros
          </div>
          <div className="stat-value stat-value-forum">
            {formatBytes(data.totalForumBytes)}
          </div>
        </div>
        <div className="stat-box stat-box-backup">
          <div className="stat-label stat-label-with-dot">
            <span className="stat-dot" />
            Backups
          </div>
          <div className="stat-value stat-value-backup">
            {formatBytes(data.totalBackupBytes)}
          </div>
        </div>
        <div className="stat-box stat-box-secondary">
          <div className="stat-label">Categorías</div>
          <div className="stat-value">{data.categories.length}</div>
        </div>
        <div className="stat-box stat-box-secondary">
          <div className="stat-label">Cursos</div>
          <div className="stat-value">{allCourses.length}</div>
        </div>
      </div>

      <Card className="p-4 detail-chart-card">
        <div className="panel-header panel-header-compact">
          <div>
            <p className="eyebrow">Cursos</p>
            <h3 className="card-title">
              Top 10 cursos más pesados de {displayPlatformName || 'la plataforma seleccionada'}
            </h3>
            <p className="panel-description">
              Desglose por tipo de almacenamiento para identificar rápidamente los
              cursos de mayor impacto en {displayPlatformName || 'la plataforma seleccionada'}.
            </p>
          </div>
        </div>
        <div className="chart-container">
          {chartData && (
            <Bar
              data={chartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      boxWidth: 12,
                      padding: 18,
                      color: STORAGE_COLORS.total,
                      font: { size: 11, family: CHART_FONT_FAMILY },
                    },
                  },
                  tooltip: {
                    backgroundColor: '#01264C',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    padding: 12,
                    callbacks: {
                      label: (ctx) =>
                        `${ctx.dataset.label}: ${formatBytes(ctx.raw)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    stacked: true,
                    ticks: {
                      color: STORAGE_COLORS.total,
                      font: { size: 11, family: CHART_FONT_FAMILY },
                      callback: (value) => formatBytes(Number(value)),
                    },
                    grid: { color: 'rgba(240, 243, 252, 0.10)' },
                    border: { display: false },
                  },
                  y: {
                    stacked: true,
                    ticks: {
                      color: STORAGE_COLORS.total,
                      font: { size: 11, family: CHART_FONT_FAMILY },
                    },
                    grid: { display: false },
                    border: { display: false },
                  },
                },
              }}
            />
          )}
        </div>
      </Card>

      <Card className="p-4 detail-table-card">
        <div className="table-header-row">
          <div>
            <p className="eyebrow">Inventario</p>
            <h3 className="card-title table-title">
              Todos los cursos de {displayPlatformName || 'la plataforma seleccionada'} ({tableCourses.length})
            </h3>
            <p className="panel-description">
              El detalle tipo Moodle por componente y filearea se sincroniza manualmente por curso.
            </p>
          </div>
          <Input
            type="text"
            className="table-search"
            placeholder="Buscar curso o categoría"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="table-wrapper inventory-table-wrapper">
          <Table className="course-table">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '40px' }}>#</TableHead>
                <TableHead
                  className="sortable"
                  onClick={() => handleSort('course_name')}
                >
                  Curso{sortIcon('course_name')}
                </TableHead>
                <TableHead
                  className="sortable"
                  onClick={() => handleSort('category_name')}
                >
                  Categoría{sortIcon('category_name')}
                </TableHead>
                <TableHead
                  className="sortable right"
                  onClick={() => handleSort('size_bytes')}
                >
                  Contenido{sortIcon('size_bytes')}
                </TableHead>
                <TableHead
                  className="sortable right"
                  onClick={() => handleSort('assignment_size_bytes')}
                >
                  Entregas{sortIcon('assignment_size_bytes')}
                </TableHead>
                <TableHead
                  className="sortable right"
                  onClick={() => handleSort('forum_size_bytes')}
                >
                  Foros{sortIcon('forum_size_bytes')}
                </TableHead>
                <TableHead
                  className="sortable right"
                  onClick={() => handleSort('backup_size_bytes')}
                >
                  Backups{sortIcon('backup_size_bytes')}
                </TableHead>
                <TableHead
                  className="sortable right"
                  onClick={() => handleSort('total_bytes')}
                >
                  Total{sortIcon('total_bytes')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableCourses.map((course, idx) => (
                <TableRow
                  key={`${course.moodle_source}-${course.course_id ?? idx}`}
                  className={course.course_id === selectedCourseId ? 'course-row-selected' : ''}
                  onClick={() => handleRowSelect(course.course_id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleRowSelect(course.course_id);
                    }
                  }}
                  tabIndex={0}
                >
                  <TableCell className="row-num">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="course-cell">
                      <span className="course-name-text">{course.course_name}</span>
                      {course.shortname && (
                        <span className="course-short">{course.shortname}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="cat-badge">{course.category_name}</span>
                  </TableCell>
                  <TableCell className="right mono">
                    {course.size_bytes > 0 ? (
                      <span className="metric-value metric-value-content">
                        {formatBytes(course.size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="right mono">
                    {course.assignment_size_bytes > 0 ? (
                      <span className="metric-value metric-value-assignment">
                        {formatBytes(course.assignment_size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="right mono">
                    {course.forum_size_bytes > 0 ? (
                      <span className="metric-value metric-value-forum">
                        {formatBytes(course.forum_size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="right mono">
                    {course.backup_size_bytes > 0 ? (
                      <span className="metric-value metric-value-backup">
                        {formatBytes(course.backup_size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="right mono bold">
                    <span className="metric-total">{formatBytes(course.total_bytes)}</span>
                  </TableCell>
                </TableRow>
              ))}
              {tableCourses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="empty">
                    No se encontraron cursos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="course-breakdown-panel">
          <div className="panel-header panel-header-compact course-breakdown-header">
            <div>
              <p className="eyebrow">Detalle del curso</p>
              <h3 className="card-title table-title">
                {breakdownCourse?.course_name || 'Selecciona un curso'}
              </h3>
              {breakdownCourse && (
                <p className="panel-description">
                  {breakdownCourse.shortname ? `${breakdownCourse.shortname} · ` : ''}
                  {breakdownCourse.category_name}
                </p>
              )}
            </div>
            {breakdownCourse && (
              <div className="course-breakdown-total">
                <span className="course-breakdown-total-label">Total del curso</span>
                <strong>{formatBytes(breakdownCourse.total_bytes || 0)}</strong>
              </div>
            )}
          </div>

          {selectedCourse && (
            <div className="course-breakdown-summary">
              <div className="course-breakdown-summary-item">
                <span>Contenido</span>
                <strong>{formatBytes(breakdownCourse.size_bytes || 0)}</strong>
              </div>
              <div className="course-breakdown-summary-item">
                <span>Entregas</span>
                <strong>{formatBytes(breakdownCourse.assignment_size_bytes || 0)}</strong>
              </div>
              <div className="course-breakdown-summary-item">
                <span>Foros</span>
                <strong>{formatBytes(breakdownCourse.forum_size_bytes || 0)}</strong>
              </div>
              <div className="course-breakdown-summary-item">
                <span>Backups</span>
                <strong>{formatBytes(breakdownCourse.backup_size_bytes || 0)}</strong>
              </div>
            </div>
          )}

          {selectedCourse && (
            <div className="course-breakdown-actions">
              <p className="course-breakdown-warning">
                Advertencia: este detalle se sincroniza solo para el curso seleccionado y puede demorar algunos minutos en generarse.
              </p>
              <Button
                type="button"
                className="course-breakdown-sync-btn"
                onClick={() => handleLoadBreakdown({ refresh: hasLoadedBreakdownForSelectedCourse })}
                disabled={breakdownLoading}
              >
                {breakdownLoading
                  ? 'Sincronizando detalle…'
                  : hasLoadedBreakdownForSelectedCourse
                    ? 'Actualizar detalle del curso'
                    : 'Cargar detalle del curso'}
              </Button>
            </div>
          )}
          {hasLoadedBreakdownForSelectedCourse && (
            <p className={`course-breakdown-meta course-breakdown-meta-${breakdownData?.source || 'live'}`}>
              {breakdownSourceLabel} · Calculado: {formatDateTime(breakdownData?.calculatedAt)}
            </p>
          )}

          {!selectedCourse ? (
            <p className="empty">Selecciona un curso para ver su desglose detallado.</p>
          ) : breakdownLoading ? (
            <p className="empty">Calculando desglose detallado en vivo…</p>
          ) : breakdownError ? (
            <ErrorRetry message={breakdownError} onRetry={() => handleLoadBreakdown()} />
          ) : breakdownRequestedCourseId !== selectedCourseId ? (
            <p className="empty">
              Presiona “Cargar detalle del curso” para ver el detalle guardado o calcularlo por primera vez.
            </p>
          ) : !breakdownData?.rows?.length ? (
            <p className="empty">
              No se encontraron archivos detallados para este curso.
            </p>
          ) : (
            <div className="table-wrapper course-breakdown-table-wrapper">
              <Table className="course-table course-breakdown-table">
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '40px' }}>#</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead>Filearea</TableHead>
                    <TableHead className="right">% curso</TableHead>
                    <TableHead className="right">Tamaño</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdownData.rows.map((row, idx) => (
                    <TableRow key={`${row.component}-${row.filearea}-${idx}`}>
                      <TableCell className="row-num">{idx + 1}</TableCell>
                      <TableCell>
                        <span className="breakdown-chip">{row.component || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="breakdown-chip breakdown-chip-secondary">
                          {row.filearea || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="right mono">
                        {formatPercentage(row.size_bytes || 0, breakdownData.course?.total_bytes || 0)}
                      </TableCell>
                      <TableCell className="right mono bold">{formatBytes(row.size_bytes || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="course-breakdown-panel">
          <div className="panel-header panel-header-compact course-breakdown-header">
            <div>
              <p className="eyebrow">Informe Global</p>
              <h3 className="card-title table-title">
                {selectedCourse ? 'Ficha de alumnos' : 'Selecciona un curso'}
              </h3>
              {selectedCourse && (
                <p className="panel-description">
                  Matrícula, accesos, actividades completadas, nota final y mensajes de foro
                  de cada alumno, según los datos que expone el Web Service de Moodle.
                  "Registros", "Tiempo acumulado", "Correos" y "Mensajes chats" no están
                  disponibles por esta vía (ver nota más abajo).
                </p>
              )}
            </div>
          </div>

          {selectedCourse && (
            <div className="course-breakdown-actions">
              <Button
                type="button"
                className="course-breakdown-sync-btn"
                onClick={handleLoadAccessReport}
                disabled={accessReportLoading}
              >
                {accessReportLoading
                  ? 'Cargando informe…'
                  : hasLoadedAccessReportForSelectedCourse
                    ? 'Actualizar informe'
                    : 'Cargar informe de alumnos'}
              </Button>
              {hasLoadedAccessReportForSelectedCourse && (
                <Button type="button" variant="outline" onClick={handleExportAccessReport}>
                  Descargar informe (Excel)
                </Button>
              )}
            </div>
          )}
          {hasLoadedAccessReportForSelectedCourse && (
            <p className="course-breakdown-meta course-breakdown-meta-live">
              Calculado: {formatDateTime(accessReportData?.calculatedAt)}
            </p>
          )}

          {!selectedCourse ? (
            <p className="empty">Selecciona un curso para ver su ficha de alumnos.</p>
          ) : accessReportLoading ? (
            <p className="empty">Consultando alumnos matriculados en vivo…</p>
          ) : accessReportError ? (
            <ErrorRetry message={accessReportError} onRetry={handleLoadAccessReport} />
          ) : accessReportRequestedCourseId !== selectedCourseId ? (
            <p className="empty">
              Presiona “Cargar informe de alumnos” para consultar los datos en vivo.
            </p>
          ) : !accessReportData?.students?.length ? (
            <p className="empty">No hay alumnos matriculados en este curso.</p>
          ) : (
            <>
              <Input
                type="text"
                className="table-search"
                placeholder="Buscar alumno, usuario o email"
                value={accessSearchTerm}
                onChange={(e) => setAccessSearchTerm(e.target.value)}
              />
              <div className="table-wrapper insights-table-wrapper">
                <Table className="course-table access-report-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sortable" onClick={() => handleAccessSort('firstname')}>
                        Nombre{accessSortIcon('firstname')}
                      </TableHead>
                      <TableHead className="sortable" onClick={() => handleAccessSort('lastname')}>
                        Apellidos{accessSortIcon('lastname')}
                      </TableHead>
                      <TableHead>Matrícula activa</TableHead>
                      <TableHead className="sortable" onClick={() => handleAccessSort('username')}>
                        Usuario{accessSortIcon('username')}
                      </TableHead>
                      <TableHead className="sortable" onClick={() => handleAccessSort('email')}>
                        Email{accessSortIcon('email')}
                      </TableHead>
                      <TableHead className="sortable" onClick={() => handleAccessSort('firstAccess')}>
                        Primer acceso (sitio){accessSortIcon('firstAccess')}
                      </TableHead>
                      <TableHead
                        className="sortable"
                        onClick={() => handleAccessSort('lastCourseAccess')}
                      >
                        Último acceso (curso){accessSortIcon('lastCourseAccess')}
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
                    {accessReportRows.map((student) => (
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
                "Tiempo acumulado", "Evaluaciones", "Correos" y "Mensajes chats" no están
                disponibles por Web Services de Moodle — solo existen dentro de plugins de
                informes (como block_advanced_reports), que no exponen API. "Actividades de
                aprendizaje" necesita que el curso tenga activada la "Finalización de
                actividades"; "Nota final" necesita el permiso de calificaciones habilitado;
                "Mensajes Foro" necesita que el curso tenga al menos un foro.
              </p>
            </>
          )}
        </div>

        <div className="course-breakdown-panel">
          <div className="panel-header panel-header-compact course-breakdown-header">
            <div>
              <p className="eyebrow">Evaluaciones</p>
              <h3 className="card-title table-title">
                {selectedCourse ? 'Detalle de calificaciones' : 'Selecciona un curso'}
              </h3>
              {selectedCourse && (
                <p className="panel-description">
                  Nota de cada tarea, examen y actividad evaluable por alumno matriculado,
                  obtenida en vivo de Moodle (<span className="mono">gradereport_user_get_grade_items</span>).
                </p>
              )}
            </div>
          </div>

          {selectedCourse && (
            <div className="course-breakdown-actions">
              <Button
                type="button"
                className="course-breakdown-sync-btn"
                onClick={handleLoadGradesReport}
                disabled={gradesReportLoading}
              >
                {gradesReportLoading
                  ? 'Cargando calificaciones…'
                  : hasLoadedGradesReportForSelectedCourse
                    ? 'Actualizar calificaciones'
                    : 'Cargar evaluaciones y calificaciones'}
              </Button>
              {hasLoadedGradesReportForSelectedCourse && gradesReportData?.available && (
                <Button type="button" variant="outline" onClick={handleExportGradesReport}>
                  Descargar informe (Excel)
                </Button>
              )}
            </div>
          )}

          {!selectedCourse ? (
            <p className="empty">Selecciona un curso para ver sus calificaciones.</p>
          ) : gradesReportLoading ? (
            <p className="empty">Consultando calificaciones en vivo…</p>
          ) : gradesReportError ? (
            <ErrorRetry message={gradesReportError} onRetry={handleLoadGradesReport} />
          ) : gradesReportRequestedCourseId !== selectedCourseId ? (
            <p className="empty">
              Presiona “Cargar evaluaciones y calificaciones” para consultar los datos en vivo.
            </p>
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
            <div className="table-wrapper insights-table-wrapper">
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
        </div>
      </Card>
    </div>
  );
}
