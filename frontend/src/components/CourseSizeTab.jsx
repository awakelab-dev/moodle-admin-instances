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
import { getCourseBreakdown, getCourseAccessReport, getCourses } from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { formatBytes } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

function formatUnixSeconds(value) {
  if (!value) return 'Nunca';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

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
  const latestBreakdownRequestRef = useRef(0);
  const [accessReportData, setAccessReportData] = useState(null);
  const [accessReportLoading, setAccessReportLoading] = useState(false);
  const [accessReportError, setAccessReportError] = useState(null);
  const [accessReportRequestedCourseId, setAccessReportRequestedCourseId] = useState(null);
  const [accessSearchTerm, setAccessSearchTerm] = useState('');
  const [accessSortKey, setAccessSortKey] = useState('lastname');
  const [accessSortDir, setAccessSortDir] = useState('asc');
  const latestAccessReportRequestRef = useRef(0);

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
          <table className="course-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th
                  className="sortable"
                  onClick={() => handleSort('course_name')}
                >
                  Curso{sortIcon('course_name')}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('category_name')}
                >
                  Categoría{sortIcon('category_name')}
                </th>
                <th
                  className="sortable right"
                  onClick={() => handleSort('size_bytes')}
                >
                  Contenido{sortIcon('size_bytes')}
                </th>
                <th
                  className="sortable right"
                  onClick={() => handleSort('assignment_size_bytes')}
                >
                  Entregas{sortIcon('assignment_size_bytes')}
                </th>
                <th
                  className="sortable right"
                  onClick={() => handleSort('forum_size_bytes')}
                >
                  Foros{sortIcon('forum_size_bytes')}
                </th>
                <th
                  className="sortable right"
                  onClick={() => handleSort('backup_size_bytes')}
                >
                  Backups{sortIcon('backup_size_bytes')}
                </th>
                <th
                  className="sortable right"
                  onClick={() => handleSort('total_bytes')}
                >
                  Total{sortIcon('total_bytes')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableCourses.map((course, idx) => (
                <tr
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
                  <td className="row-num">{idx + 1}</td>
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
                  </td>
                  <td className="right mono">
                    {course.size_bytes > 0 ? (
                      <span className="metric-value metric-value-content">
                        {formatBytes(course.size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right mono">
                    {course.assignment_size_bytes > 0 ? (
                      <span className="metric-value metric-value-assignment">
                        {formatBytes(course.assignment_size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right mono">
                    {course.forum_size_bytes > 0 ? (
                      <span className="metric-value metric-value-forum">
                        {formatBytes(course.forum_size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right mono">
                    {course.backup_size_bytes > 0 ? (
                      <span className="metric-value metric-value-backup">
                        {formatBytes(course.backup_size_bytes)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right mono bold">
                    <span className="metric-total">{formatBytes(course.total_bytes)}</span>
                  </td>
                </tr>
              ))}
              {tableCourses.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No se encontraron cursos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
            <p className="empty error">{breakdownError}</p>
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
              <table className="course-table course-breakdown-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Componente</th>
                    <th>Filearea</th>
                    <th className="right">% curso</th>
                    <th className="right">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownData.rows.map((row, idx) => (
                    <tr key={`${row.component}-${row.filearea}-${idx}`}>
                      <td className="row-num">{idx + 1}</td>
                      <td>
                        <span className="breakdown-chip">{row.component || '—'}</span>
                      </td>
                      <td>
                        <span className="breakdown-chip breakdown-chip-secondary">
                          {row.filearea || '—'}
                        </span>
                      </td>
                      <td className="right mono">
                        {formatPercentage(row.size_bytes || 0, breakdownData.course?.total_bytes || 0)}
                      </td>
                      <td className="right mono bold">{formatBytes(row.size_bytes || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="course-breakdown-panel">
          <div className="panel-header panel-header-compact course-breakdown-header">
            <div>
              <p className="eyebrow">Informe Global</p>
              <h3 className="card-title table-title">
                {selectedCourse ? 'Accesos de alumnos' : 'Selecciona un curso'}
              </h3>
              {selectedCourse && (
                <p className="panel-description">
                  Primer y último acceso al sitio, y último acceso a este curso, según los
                  datos que expone el Web Service de Moodle. No incluye tiempo dedicado,
                  registros de actividad ni evaluaciones: eso no está disponible por Web
                  Services (ver nota más abajo).
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
                    : 'Cargar informe de accesos'}
              </Button>
            </div>
          )}
          {hasLoadedAccessReportForSelectedCourse && (
            <p className="course-breakdown-meta course-breakdown-meta-live">
              Calculado: {formatDateTime(accessReportData?.calculatedAt)}
            </p>
          )}

          {!selectedCourse ? (
            <p className="empty">Selecciona un curso para ver su informe de accesos.</p>
          ) : accessReportLoading ? (
            <p className="empty">Consultando alumnos matriculados en vivo…</p>
          ) : accessReportError ? (
            <p className="empty error">{accessReportError}</p>
          ) : accessReportRequestedCourseId !== selectedCourseId ? (
            <p className="empty">
              Presiona “Cargar informe de accesos” para consultar los datos en vivo.
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
                <table className="course-table access-report-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => handleAccessSort('firstname')}>
                        Nombre{accessSortIcon('firstname')}
                      </th>
                      <th className="sortable" onClick={() => handleAccessSort('lastname')}>
                        Apellidos{accessSortIcon('lastname')}
                      </th>
                      <th>Matrícula activa</th>
                      <th className="sortable" onClick={() => handleAccessSort('username')}>
                        Usuario{accessSortIcon('username')}
                      </th>
                      <th className="sortable" onClick={() => handleAccessSort('email')}>
                        Email{accessSortIcon('email')}
                      </th>
                      <th className="sortable" onClick={() => handleAccessSort('firstAccess')}>
                        Primer acceso (sitio){accessSortIcon('firstAccess')}
                      </th>
                      <th className="sortable" onClick={() => handleAccessSort('lastAccess')}>
                        Último acceso (sitio){accessSortIcon('lastAccess')}
                      </th>
                      <th
                        className="sortable"
                        onClick={() => handleAccessSort('lastCourseAccess')}
                      >
                        Último acceso (curso){accessSortIcon('lastCourseAccess')}
                      </th>
                      <th>Registros</th>
                      <th>Tiempo acumulado</th>
                      <th>Contenidos visualizados</th>
                      <th>Evaluaciones</th>
                      <th>Correos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessReportRows.map((student) => (
                      <tr key={student.userId}>
                        <td>{student.firstname || '—'}</td>
                        <td>{student.lastname || '—'}</td>
                        <td>
                          {student.activeEnrollment === null
                            ? 'No disponible'
                            : student.activeEnrollment
                              ? 'Sí'
                              : 'No'}
                        </td>
                        <td className="mono">{student.username}</td>
                        <td>{student.email || '—'}</td>
                        <td>{formatUnixSeconds(student.firstAccess)}</td>
                        <td>{formatUnixSeconds(student.lastAccess)}</td>
                        <td>{formatUnixSeconds(student.lastCourseAccess)}</td>
                        <td className="muted" title="No disponible por Web Services">—</td>
                        <td className="muted" title="No disponible por Web Services">—</td>
                        <td className="muted" title="No disponible por Web Services">—</td>
                        <td className="muted" title="No disponible por Web Services">—</td>
                        <td className="muted" title="No disponible por Web Services">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="history-note">
                "Registros", "Tiempo acumulado", "Contenidos visualizados", "Evaluaciones" y
                "Correos" no están disponibles por Web Services de Moodle — solo existen dentro
                de plugins de informes (como Configurable Reports), que no exponen API.
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
