import { useState, useEffect, useMemo } from 'react';
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
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { getInsights } from '../api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CHART_FONT_FAMILY = "'Poppins', sans-serif";
const PAGE_SIZE_OPTIONS = [20, 50, 100, 500, 1000];

function truncateLabel(value, maxLength = 24) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatGradePercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return `${Number(value).toFixed(1)}%`;
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a ?? '').toLowerCase();
  const bs = String(b ?? '').toLowerCase();
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

// Búsqueda + orden por columna + paginación, compartido entre la tabla de
// cursos y la de alumnos (misma lógica, distintos campos).
function useTableControls(items, { searchKeys, defaultSortKey }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState('asc');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      searchKeys.some((key) => String(item[key] ?? '').toLowerCase().includes(term))
    );
  }, [items, search, searchKeys]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const result = compareValues(a[sortKey], b[sortKey]);
      return sortDir === 'asc' ? result : -result;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [sorted, clampedPage, pageSize]
  );

  function toggleSort(key) {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDir('asc');
      return key;
    });
    setPage(1);
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function updatePageSize(value) {
    setPageSize(Number(value));
    setPage(1);
  }

  return {
    search,
    setSearch: updateSearch,
    sortKey,
    sortDir,
    toggleSort,
    pageSize,
    setPageSize: updatePageSize,
    page: clampedPage,
    setPage,
    totalPages,
    totalCount: sorted.length,
    pageItems,
  };
}

function SortableHead({ label, sortKey, controls, align }) {
  const isActive = controls.sortKey === sortKey;
  return (
    <TableHead
      className={`insights-sortable-head ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => controls.toggleSort(sortKey)}
    >
      <span className="insights-sortable-head-inner">
        {label}
        {isActive &&
          (controls.sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </TableHead>
  );
}

function TableToolbar({ searchPlaceholder, controls }) {
  return (
    <div className="insights-table-toolbar">
      <div className="insights-table-search">
        <Search size={14} className="insights-table-search-icon" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={controls.search}
          onChange={(e) => controls.setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="insights-table-pagesize">
        <span>Mostrar</span>
        <Select value={String(controls.pageSize)} onValueChange={controls.setPageSize}>
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TablePagination({ controls }) {
  if (!controls.totalCount) return null;

  const start = (controls.page - 1) * controls.pageSize + 1;
  const end = Math.min(controls.page * controls.pageSize, controls.totalCount);

  return (
    <div className="insights-table-pagination">
      <span className="insights-table-pagination-summary">
        {start}-{end} de {controls.totalCount}
      </span>
      <div className="insights-table-pagination-buttons">
        <Button
          size="sm"
          variant="outline"
          onClick={() => controls.setPage((p) => Math.max(1, p - 1))}
          disabled={controls.page <= 1}
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="insights-table-pagination-page">
          Página {controls.page} de {controls.totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => controls.setPage((p) => Math.min(controls.totalPages, p + 1))}
          disabled={controls.page >= controls.totalPages}
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

export default function InsightsTab({ moodleSource, platformName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    if (!moodleSource) {
      setData(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    getInsights({ moodleSource })
      .then((response) => {
        if (isMounted) {
          setData(response);
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(null);
          setError('No se pudieron cargar los insights. Verifica la conexión e intenta de nuevo.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [moodleSource]);

  const categoryChartData = useMemo(() => {
    if (!data?.topCategories?.length) return null;

    return {
      labels: data.topCategories.map((c) => truncateLabel(c.category)),
      datasets: [
        {
          label: 'Cursos',
          data: data.topCategories.map((c) => c.count),
          backgroundColor: '#19F7F1',
          borderColor: '#01264C',
          borderWidth: 1,
          borderRadius: 8,
          barThickness: 28,
        },
      ],
    };
  }, [data]);

  const gradeChartData = useMemo(() => {
    if (!data?.topGradedCourses?.length) return null;

    return {
      labels: data.topGradedCourses.map((c) => truncateLabel(c.shortname || c.courseName)),
      datasets: [
        {
          label: 'Promedio de calificación',
          data: data.topGradedCourses.map((c) => c.averageGradePercent),
          backgroundColor: '#19F7F1',
          borderColor: '#01264C',
          borderWidth: 1,
          borderRadius: 8,
          barThickness: 28,
        },
      ],
    };
  }, [data]);

  const courses = data?.courses || [];
  const students = data?.students || [];

  const courseControls = useTableControls(courses, {
    searchKeys: ['courseName', 'shortname', 'categoryName'],
    defaultSortKey: 'courseName',
  });
  const studentControls = useTableControls(students, {
    searchKeys: ['fullname', 'username', 'email'],
    defaultSortKey: 'fullname',
  });

  if (loading) return <p className="empty">Cargando insights…</p>;
  if (error) return <p className="empty error">{error}</p>;
  if (!data || !data.stats.courses) {
    return (
      <p className="empty">
        No hay datos de cursos para {platformName || 'la plataforma seleccionada'}.
        Sincroniza primero esa instancia.
      </p>
    );
  }

  const { stats } = data;

  return (
    <div className="section-stack detail-tab-content">
      <div className="stats-grid">
        <div className="stat-box stat-box-total">
          <div className="stat-label">Cursos</div>
          <div className="stat-value">{stats.courses}</div>
          <div className="stat-sublabel">{stats.visibleCourses} visibles</div>
        </div>
        <div className="stat-box stat-box-content">
          <div className="stat-label stat-label-with-dot">
            <span className="stat-dot" />
            Alumnos
          </div>
          <div className="stat-value stat-value-content">{stats.students}</div>
        </div>
        <div className="stat-box stat-box-assignment">
          <div className="stat-label stat-label-with-dot">
            <span className="stat-dot" />
            Matrículas
          </div>
          <div className="stat-value stat-value-assignment">{stats.enrollments}</div>
        </div>
        <div className="stat-box stat-box-secondary">
          <div className="stat-label">Promedio global</div>
          <div className="stat-value">
            {stats.gradesAvailable ? (
              formatGradePercent(stats.globalAverageGrade)
            ) : (
              <Badge variant="secondary">Pendiente</Badge>
            )}
          </div>
        </div>
      </div>

      <Card className="p-4 detail-chart-card">
        <div className="panel-header panel-header-compact">
          <div>
            <p className="eyebrow">Cursos</p>
            <h3 className="card-title">Top 10 cursos por categoría</h3>
            <p className="panel-description">
              Categorías con más cursos dentro de {platformName || 'la plataforma seleccionada'}.
            </p>
          </div>
        </div>
        <div className="chart-container">
          {categoryChartData && (
            <Bar
              data={categoryChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#01264C',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    padding: 12,
                    callbacks: {
                      label: (ctx) => `${ctx.raw} curso${ctx.raw === 1 ? '' : 's'}`,
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: {
                      color: '#C9D6EA',
                      font: { size: 11, family: CHART_FONT_FAMILY },
                      precision: 0,
                    },
                    grid: { color: 'rgba(240, 243, 252, 0.10)' },
                    border: { display: false },
                  },
                  y: {
                    ticks: {
                      color: '#C9D6EA',
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

      <Card className="p-4 detail-chart-card">
        <div className="panel-header panel-header-compact">
          <div>
            <p className="eyebrow">Calificaciones</p>
            <h3 className="card-title">Top 10 cursos por promedio de calificación</h3>
            <p className="panel-description">
              {stats.gradesAvailable
                ? `Cursos con mejor promedio de calificación en ${platformName || 'la plataforma seleccionada'}.`
                : 'Pendiente: esta plataforma todavía no tiene habilitada la función de calificaciones de Moodle.'}
            </p>
          </div>
        </div>
        <div className="chart-container">
          {gradeChartData ? (
            <Bar
              data={gradeChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#01264C',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    padding: 12,
                    callbacks: {
                      label: (ctx) => formatGradePercent(ctx.raw) || '—',
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: '#C9D6EA', font: { size: 11, family: CHART_FONT_FAMILY } },
                    grid: { display: false },
                    border: { display: false },
                  },
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      color: '#C9D6EA',
                      font: { size: 11, family: CHART_FONT_FAMILY },
                      callback: (value) => `${value}%`,
                    },
                    grid: { color: 'rgba(240, 243, 252, 0.10)' },
                    border: { display: false },
                  },
                },
              }}
            />
          ) : (
            <p className="empty">Sin datos de calificaciones disponibles todavía.</p>
          )}
        </div>
      </Card>

      <Card className="p-4 detail-table-card">
        <div className="table-header-row">
          <div>
            <p className="eyebrow">Inventario</p>
            <h3 className="card-title table-title">Cursos ({courseControls.totalCount})</h3>
          </div>
        </div>
        <TableToolbar searchPlaceholder="Buscar por curso o categoría…" controls={courseControls} />
        <div className="table-wrapper insights-table-wrapper">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface">
              <TableRow>
                <SortableHead label="Curso" sortKey="courseName" controls={courseControls} />
                <SortableHead label="Categoría" sortKey="categoryName" controls={courseControls} />
                <TableHead>Estado</TableHead>
                <SortableHead
                  label="Alumnos"
                  sortKey="enrolledCount"
                  controls={courseControls}
                  align="right"
                />
                <SortableHead
                  label="Promedio"
                  sortKey="averageGradePercent"
                  controls={courseControls}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {courseControls.pageItems.map((course) => (
                <TableRow key={course.courseId}>
                  <TableCell>
                    <div className="font-semibold text-white">{course.courseName}</div>
                    {course.shortname && (
                      <div className="text-xs text-muted-foreground">{course.shortname}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{course.categoryName}</TableCell>
                  <TableCell>
                    <Badge variant={course.visible ? 'success' : 'secondary'}>
                      {course.visible ? 'visible' : 'oculto'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{course.enrolledCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatGradePercent(course.averageGradePercent) || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!courseControls.pageItems.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay cursos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination controls={courseControls} />
      </Card>

      <Card className="p-4 detail-table-card">
        <div className="table-header-row">
          <div>
            <p className="eyebrow">Inventario</p>
            <h3 className="card-title table-title">Alumnos ({studentControls.totalCount})</h3>
          </div>
        </div>
        <TableToolbar searchPlaceholder="Buscar por nombre o email…" controls={studentControls} />
        <div className="table-wrapper insights-table-wrapper">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface">
              <TableRow>
                <SortableHead label="Alumno" sortKey="fullname" controls={studentControls} />
                <SortableHead label="Email" sortKey="email" controls={studentControls} />
                <SortableHead
                  label="Cursos"
                  sortKey="courseCount"
                  controls={studentControls}
                  align="right"
                />
                <SortableHead
                  label="Promedio"
                  sortKey="averageGradePercent"
                  controls={studentControls}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentControls.pageItems.map((student) => (
                <TableRow key={student.userId}>
                  <TableCell className="font-semibold text-white">
                    {student.fullname || student.username}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.email || '—'}</TableCell>
                  <TableCell className="text-right">{student.courseCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatGradePercent(student.averageGradePercent) || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!studentControls.pageItems.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay alumnos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination controls={studentControls} />
      </Card>
    </div>
  );
}
