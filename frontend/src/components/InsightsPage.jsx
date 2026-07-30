import { useEffect, useState } from 'react';
import { getPlatforms } from '../api';
import InsightsTab from './InsightsTab';
import { formatPlatformDisplayName } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function InsightsPage() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSource, setSelectedSource] = useState('');

  useEffect(() => {
    let isMounted = true;

    getPlatforms()
      .then((response) => {
        if (!isMounted) return;
        const list = (Array.isArray(response) ? response : []).sort((a, b) =>
          formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name))
        );
        setPlatforms(list);
        setSelectedSource((prev) => prev || list[0]?.source || '');
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

  const selectedPlatform = platforms.find((p) => p.source === selectedSource) || platforms[0];

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2 className="card-title section-title">Moodle Insights</h2>
          <p className="panel-description">
            Cursos, alumnos y matrículas de una plataforma Moodle concreta.
          </p>
        </div>
        <Select value={selectedSource} onValueChange={setSelectedSource}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecciona una plataforma" />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.source} value={p.source}>
                {formatPlatformDisplayName(p.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <InsightsTab
        moodleSource={selectedPlatform.source}
        platformName={formatPlatformDisplayName(selectedPlatform.name)}
      />
    </div>
  );
}
