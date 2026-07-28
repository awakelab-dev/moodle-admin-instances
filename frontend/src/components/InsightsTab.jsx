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
import { getInsights } from '../api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function truncateLabel(value, maxLength = 24) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
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

  const { stats, topCategories, courses, students } = data;

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
            <Badge variant="secondary">Pendiente</Badge>
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

      <Card className="p-4 detail-table-card">
        <div className="table-header-row">
          <div>
            <p className="eyebrow">Inventario</p>
            <h3 className="card-title table-title">Cursos ({courses.length})</h3>
          </div>
        </div>
        <div className="table-wrapper insights-table-wrapper">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface">
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Alumnos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4 detail-table-card">
        <div className="table-header-row">
          <div>
            <p className="eyebrow">Inventario</p>
            <h3 className="card-title table-title">Alumnos ({students.length})</h3>
          </div>
        </div>
        <div className="table-wrapper insights-table-wrapper">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface">
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Cursos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.userId}>
                  <TableCell className="font-semibold text-white">
                    {student.fullname || student.username}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.email || '—'}</TableCell>
                  <TableCell className="text-right">{student.courseCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
