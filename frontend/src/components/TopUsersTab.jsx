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
import { getTopUsers } from '../api';
import { Card } from '@/components/ui/card';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CHART_FONT_FAMILY = "'Segoe UI', sans-serif";
const USER_BAR_COLOR = '#19F7F1';
const USER_BORDER_COLOR = '#01264C';

function truncateLabel(value, maxLength = 26) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function TopUsersTab({ moodleSource, platformName }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    if (!moodleSource) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    getTopUsers({ moodleSource })
      .then((response) => {
        if (isMounted) {
          setUsers(response);
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUsers([]);
          setError('No se pudieron cargar los datos de usuarios. Verifica la conexión e intenta de nuevo.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [moodleSource]);

  const chartData = useMemo(() => {
    if (!users.length) return null;

    return {
      labels: users.map((u) => truncateLabel(u.fullname || u.username)),
      datasets: [
        {
          label: 'Almacenamiento total',
          data: users.map((u) => u.total_size_bytes),
          backgroundColor: USER_BAR_COLOR,
          borderColor: USER_BORDER_COLOR,
          borderWidth: 1,
          borderRadius: 8,
          barThickness: 28,
        },
      ],
    };
  }, [users]);

  if (loading) return <p className="empty">Cargando datos…</p>;
  if (error) return <p className="empty error">{error}</p>;
  if (!users.length)
    return (
      <p className="empty">
        No hay datos de usuarios para {platformName || 'la plataforma seleccionada'}.
        Sincroniza primero esa instancia.
      </p>
    );

  return (
    <Card className="p-4 detail-chart-card detail-users-card">
      <div className="panel-header panel-header-compact">
        <div>
          <p className="eyebrow">Usuarios</p>
          <h3 className="card-title">Top 10 usuarios por tamaño</h3>
          <p className="panel-description">
            Ranking de uso de almacenamiento por usuario dentro de {platformName || 'la plataforma seleccionada'}.
          </p>
        </div>
      </div>
      <div className="chart-container chart-container-tall">
        <Bar
          data={chartData}
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
                  label: (ctx) => formatBytes(ctx.raw),
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  color: '#C9D6EA',
                  font: { size: 11, family: CHART_FONT_FAMILY },
                  callback: (v) => formatBytes(Number(v)),
                },
                grid: { color: 'rgba(240, 243, 252, 0.10)' },
                border: { display: false },
              },
              y: {
                ticks: {
                  color: '#C9D6EA',
                  font: { size: 12, family: CHART_FONT_FAMILY },
                },
                grid: { display: false },
                border: { display: false },
              },
            },
          }}
        />
      </div>
    </Card>
  );
}
