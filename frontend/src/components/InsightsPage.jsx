import { useEffect, useState } from 'react';
import { getPlatforms } from '../api';
import InsightsTab from './InsightsTab';
import { formatPlatformDisplayName } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Valor de "plataforma" reservado para la vista agregada — no es un
// source real, así que no puede coincidir con ninguna plataforma.
const ALL_PLATFORMS_VALUE = '__all__';

// Pantalla "Dashboard" de Moodle Insights (menú principal de la app). Carga la lista
// de plataformas configuradas, deja elegir una con el selector superior y delega el
// contenido (stats, gráficos y tablas de cursos/alumnos) a InsightsTab. Por defecto
// arranca en "Todas las plataformas" (datos agregados), no en una plataforma concreta.
export default function InsightsPage() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSource, setSelectedSource] = useState(ALL_PLATFORMS_VALUE);

  useEffect(() => {
    let isMounted = true;

    getPlatforms()
      .then((response) => {
        if (!isMounted) return;
        const list = (Array.isArray(response) ? response : []).sort((a, b) =>
          formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name))
        );
        setPlatforms(list);
        setError(null);
      })
      .catch(() => {
        if (!isMounted) return;
        setPlatforms([]);
        setError('No se pudieron cargar las plataformas.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <p className="empty">Cargando plataformas…</p>;
  if (error) return <p className="empty error">{error}</p>;
  if (!platforms.length) {
    return (
      <p className="empty">
        No hay plataformas configuradas todavía. Agrega una conexión en Configuración para empezar.
      </p>
    );
  }

  const isAllPlatforms = selectedSource === ALL_PLATFORMS_VALUE;
  const selectedPlatform = !isAllPlatforms && platforms.find((p) => p.source === selectedSource);

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2 className="card-title section-title">Moodle Insights</h2>
          <p className="panel-description">
            Cursos, alumnos y matrículas de una plataforma Moodle concreta, o agregados de
            todas a la vez.
          </p>
        </div>
        <Select value={selectedSource} onValueChange={setSelectedSource}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecciona una plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLATFORMS_VALUE}>Todas las plataformas</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p.source} value={p.source}>
                {formatPlatformDisplayName(p.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <InsightsTab
        moodleSource={selectedPlatform ? selectedPlatform.source : undefined}
        platformName={selectedPlatform ? formatPlatformDisplayName(selectedPlatform.name) : 'todas las plataformas'}
      />
    </div>
  );
}
