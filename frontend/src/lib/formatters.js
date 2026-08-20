// Funciones de formato compartidas (fechas, tamaños, moneda, periodos) que
// usan los distintos paneles/tablas del dashboard.

// Convierte un timestamp Unix en segundos (formato típico de Moodle) a
// fecha+hora local es-CL; sin valor o inválido devuelve "Nunca".
export function formatUnixSeconds(value) {
  if (!value) return 'Nunca';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return (
    date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  );
}

// Formatea bytes crudos a la unidad más legible (B/KB/MB/GB/TB) con 2 decimales.
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

// Formatea un valor ya expresado en GB (no bytes) con separador de miles es-CL.
export function formatGigabytes(value) {
  return `${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number(value || 0))} GB`;
}

export function formatCurrency(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return '—';

  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value))} ${currency || ''}`.trim();
  }
}

// Obtiene solo el símbolo/prefijo de moneda (p. ej. "$", "US$") sin el
// monto, para poder anteponerlo manualmente en `formatCurrencyCompact`.
function getCurrencyPrefix(currency = 'USD') {
  try {
    const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    return (
      formatter
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value || currency
    );
  } catch {
    return currency || '';
  }
}

// Igual que formatCurrency pero en notación compacta (1.2K, 3.4M), usada en
// gráficos donde no cabe el monto completo.
export function formatCurrencyCompact(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return '—';

  const amount = Number(value);
  const prefix = getCurrencyPrefix(currency);
  const compact = new Intl.NumberFormat('es-CL', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(amount));

  return `${amount < 0 ? '-' : ''}${prefix}${compact}`;
}

// Parsea una clave de mes "YYYY-MM" a Date (día 1); null si no es válida.
export function parseMonthKey(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "YYYY-MM" -> etiqueta corta legible, p. ej. "ene 2026".
export function formatMonthLabel(month) {
  const date = parseMonthKey(month);
  if (!date) return month;

  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// Agrupa una clave de mes en su trimestre: "YYYY-MM" -> "YYYY-Qn". Se usa
// para las agregaciones por trimestre de las series históricas.
export function getQuarterKey(month) {
  const date = parseMonthKey(month);
  if (!date) return month;

  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

// "YYYY-Qn" -> etiqueta legible "Qn YYYY".
export function formatQuarterLabel(quarterKey) {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarterKey);
  if (!match) return quarterKey;

  return `Q${match[2]} ${match[1]}`;
}

// Agrupa una clave de mes en su año, para la agregación anual de series históricas.
export function getYearKey(month) {
  const date = parseMonthKey(month);
  if (!date) return String(month).slice(0, 4);

  return String(date.getFullYear());
}

// Formatea una clave de periodo (mes/trimestre/año) según el nivel de
// agrupación elegido en el selector de granularidad del gráfico.
export function formatPeriodLabel(periodKey, groupBy) {
  if (groupBy === 'quarter') return formatQuarterLabel(periodKey);
  if (groupBy === 'year') return periodKey;
  return formatMonthLabel(periodKey);
}

// Indica si un punto de la serie tiene datos de margen financiero válidos
// (requiere configuración financiera completa o parcial en la plataforma).
export function hasMarginData(point) {
  return (
    Number.isFinite(Number(point?.margin)) &&
    (point?.hasFinancialConfig || point?.hasPartialFinancialConfig)
  );
}
