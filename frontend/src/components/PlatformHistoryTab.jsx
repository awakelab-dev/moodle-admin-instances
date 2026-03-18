import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { getPlatformHistory, getPlatformStorageSummary } from '../api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const CHART_FONT_FAMILY = "'Segoe UI', sans-serif";
const GROUP_BY_OPTIONS = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
];

function parseMonthKey(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthLabel(month) {
  const date = parseMonthKey(month);
  if (!date) return month;

  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getQuarterKey(month) {
  const date = parseMonthKey(month);
  if (!date) return month;

  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

function formatQuarterLabel(quarterKey) {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarterKey);
  if (!match) return quarterKey;

  return `Q${match[2]} ${match[1]}`;
}

function getYearKey(month) {
  const date = parseMonthKey(month);
  if (!date) return String(month).slice(0, 4);

  return String(date.getFullYear());
}

function formatPeriodLabel(periodKey, groupBy) {
  if (groupBy === 'quarter') return formatQuarterLabel(periodKey);
  if (groupBy === 'year') return periodKey;
  return formatMonthLabel(periodKey);
}

function formatGigabytes(value) {
  return `${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number(value || 0))} GB`;
}

function formatCurrency(value, currency = 'CLP') {
  if (!Number.isFinite(Number(value))) return '—';

  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'CLP',
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

function getCurrencyPrefix(currency = 'CLP') {
  try {
    const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'CLP',
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

function formatCurrencyCompact(value, currency = 'CLP') {
  if (!Number.isFinite(Number(value))) return '—';

  const amount = Number(value);
  const prefix = getCurrencyPrefix(currency);
  const compact = new Intl.NumberFormat('es-CL', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(amount));

  return `${amount < 0 ? '-' : ''}${prefix}${compact}`;
}

function getMarginColor(value) {
  return value < 0 ? '#A12727' : '#2C7D31';
}

function hasMarginData(point) {
  return (
    Number.isFinite(Number(point?.margin)) &&
    (point?.hasFinancialConfig || point?.hasPartialFinancialConfig)
  );
}

function buildGroupedPoints(points, groupBy) {
  if (groupBy === 'month') {
    return points.map((point) => ({
      ...point,
      key: point.month,
      label: formatMonthLabel(point.month),
      totalGb: Number(point.totalGb || 0),
      income: point.hasFinancialConfig ? Number(point.income || 0) : null,
      cost: point.hasFinancialConfig ? Number(point.cost || 0) : null,
      margin: point.hasFinancialConfig ? Number(point.margin || 0) : null,
      monthsCount: 1,
      financialMonthsCount: point.hasFinancialConfig ? 1 : 0,
      hasPartialFinancialConfig: false,
    }));
  }

  const groups = new Map();

  points.forEach((point) => {
    const key = groupBy === 'quarter' ? getQuarterKey(point.month) : getYearKey(point.month);
    const pointHasFinancialConfig = Boolean(point.hasFinancialConfig);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...point,
        key,
        label: formatPeriodLabel(key, groupBy),
        totalGb: Number(point.totalGb || 0),
        income: pointHasFinancialConfig ? Number(point.income || 0) : 0,
        cost: pointHasFinancialConfig ? Number(point.cost || 0) : 0,
        margin: pointHasFinancialConfig ? Number(point.margin || 0) : 0,
        monthsCount: 1,
        financialMonthsCount: pointHasFinancialConfig ? 1 : 0,
        hasFinancialConfig: pointHasFinancialConfig,
        hasPartialFinancialConfig: false,
      });
      return;
    }

    existing.totalGb = Number(point.totalGb || 0);
    existing.month = point.month;
    existing.currency = point.currency || existing.currency;
    existing.monthlyCharge = point.monthlyCharge ?? existing.monthlyCharge;
    existing.monthsCount += 1;

    if (pointHasFinancialConfig) {
      existing.financialMonthsCount += 1;
      existing.income += Number(point.income || 0);
      existing.cost += Number(point.cost || 0);
      existing.margin += Number(point.margin || 0);
    }
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    income: group.financialMonthsCount > 0 ? group.income : null,
    cost: group.financialMonthsCount > 0 ? group.cost : null,
    margin: group.financialMonthsCount > 0 ? group.margin : null,
    hasFinancialConfig:
      group.monthsCount > 0 && group.financialMonthsCount === group.monthsCount,
    hasPartialFinancialConfig:
      group.financialMonthsCount > 0 && group.financialMonthsCount < group.monthsCount,
  }));
}

function getViewDescription(groupBy) {
  if (groupBy === 'quarter') return 'Evolución trimestral';
  if (groupBy === 'year') return 'Evolución anual';
  return 'Evolución mensual';
}

function getStorageDescription(groupBy) {
  if (groupBy === 'quarter') {
    return 'Evolución del contenido total almacenado al cierre de cada trimestre.';
  }

  if (groupBy === 'year') {
    return 'Evolución del contenido total almacenado al cierre de cada año.';
  }

  return 'Evolución del contenido total almacenado por mes.';
}

function getMarginDescription(groupBy) {
  if (groupBy === 'quarter') {
    return 'Margen acumulado por trimestre calculado a partir del cobro fijo y un costo global de USD 1 por GB.';
  }

  if (groupBy === 'year') {
    return 'Margen acumulado por año calculado a partir del cobro fijo y un costo global de USD 1 por GB.';
  }

  return 'Margen mensual calculado a partir del cobro fijo y un costo global de USD 1 por GB.';
}

export default function PlatformHistoryTab({ moodleSource, platformName, userRole }) {
  const [groupBy, setGroupBy] = useState('month');
  const [rangeStartKey, setRangeStartKey] = useState('');
  const [rangeEndKey, setRangeEndKey] = useState('');
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    if (!moodleSource) {
      setSummary(null);
      setHistory(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      getPlatformStorageSummary({ moodleSource }),
      getPlatformHistory({ moodleSource }),
    ])
      .then(([summaryResponse, historyResponse]) => {
        if (!isMounted) return;

        setSummary(
          Array.isArray(summaryResponse) ? summaryResponse[0] || null : null
        );
        setHistory(historyResponse || null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setSummary(null);
        setHistory(null);
        setError(
          err?.message ||
            'No se pudo cargar el histórico de la plataforma seleccionada.'
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [moodleSource]);


  const allPoints = useMemo(
    () =>
      [...(history?.points || [])].sort((a, b) =>
        String(a.month || '').localeCompare(String(b.month || ''))
      ),
    [history]
  );

  const groupedPoints = useMemo(
    () => buildGroupedPoints(allPoints, groupBy),
    [allPoints, groupBy]
  );

  const periodOptions = useMemo(
    () =>
      groupedPoints.map((point) => ({
        value: point.key,
        label: point.label,
      })),
    [groupedPoints]
  );

  useEffect(() => {
    if (!groupedPoints.length) {
      setRangeStartKey('');
      setRangeEndKey('');
      return;
    }

    setRangeStartKey(groupedPoints[0].key);
    setRangeEndKey(groupedPoints[groupedPoints.length - 1].key);
  }, [groupBy, moodleSource, groupedPoints]);

  const filteredPoints = useMemo(
    () => {
      if (!groupedPoints.length) return [];

      const startIndex = groupedPoints.findIndex((point) => point.key === rangeStartKey);
      const endIndex = groupedPoints.findIndex((point) => point.key === rangeEndKey);
      const safeStartIndex = startIndex >= 0 ? startIndex : 0;
      const safeEndIndex = endIndex >= 0 ? endIndex : groupedPoints.length - 1;
      const normalizedStartIndex = Math.min(safeStartIndex, safeEndIndex);
      const normalizedEndIndex = Math.max(safeStartIndex, safeEndIndex);

      return groupedPoints.slice(normalizedStartIndex, normalizedEndIndex + 1);
    },
    [groupedPoints, rangeEndKey, rangeStartKey]
  );

  const effectiveCurrency = summary?.currency || history?.currency || 'CLP';
  const latestPoint = allPoints.length ? allPoints[allPoints.length - 1] : null;
  const currentStorageGb = summary?.totalGb ?? latestPoint?.totalGb ?? 0;
  const currentCharge = summary?.monthlyCharge ?? latestPoint?.monthlyCharge ?? null;
  const currentCost = summary?.cost ?? latestPoint?.cost ?? null;
  const currentMargin = summary?.margin ?? latestPoint?.margin ?? null;
  const snapshotsCount = allPoints.length;
  const canViewSnapshots = userRole === 'admin';
  const isFullRangeSelected =
    groupedPoints.length > 0 &&
    rangeStartKey === groupedPoints[0]?.key &&
    rangeEndKey === groupedPoints[groupedPoints.length - 1]?.key;
  const selectedPeriodLabel = !filteredPoints.length
    ? 'Sin datos'
    : isFullRangeSelected
      ? 'Todo el rango'
      : filteredPoints.length === 1
        ? filteredPoints[0].label
        : `${filteredPoints[0].label} → ${filteredPoints[filteredPoints.length - 1].label}`;
  const marginReady = filteredPoints.some((point) => hasMarginData(point));
  const marginHasGaps = filteredPoints.some(
    (point) => !point.hasFinancialConfig || point.hasPartialFinancialConfig
  );
  const historyDescription = getViewDescription(groupBy);
  const storageChartDescription = getStorageDescription(groupBy);
  const marginChartDescription = getMarginDescription(groupBy);
  const marginDatasetLabel =
    groupBy === 'quarter'
      ? 'Margen trimestral'
      : groupBy === 'year'
        ? 'Margen anual'
        : 'Margen mensual';

  const storageHistoryData = useMemo(
    () => ({
      labels: filteredPoints.map((point) => point.label),
      datasets: [
        {
          label: 'Almacenamiento total',
          data: filteredPoints.map((point) => point.totalGb),
          borderColor: '#35B3BA',
          backgroundColor: '#35B3BA',
          pointBackgroundColor: '#35B3BA',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointRadius: 4,
          borderWidth: 3,
          tension: 0.28,
        },
      ],
    }),
    [filteredPoints]
  );

  const marginHistoryData = useMemo(
    () => ({
      labels: filteredPoints.map((point) => point.label),
      datasets: [
        {
          label: marginDatasetLabel,
          data: filteredPoints.map((point) =>
            hasMarginData(point) ? point.margin : null
          ),
          backgroundColor: filteredPoints.map((point) =>
            hasMarginData(point) ? getMarginColor(point.margin) : '#D5D9D9'
          ),
          borderColor: filteredPoints.map((point) =>
            hasMarginData(point) ? getMarginColor(point.margin) : '#D5D9D9'
          ),
          borderRadius: 8,
          maxBarThickness: 44,
        },
      ],
    }),
    [filteredPoints, marginDatasetLabel]
  );

  if (loading) return <p className="empty">Cargando histórico…</p>;
  if (error) return <p className="empty error">{error}</p>;

  return (
    <div className="section-stack detail-tab-content">
      <div className="card detail-chart-card">
        <div className="panel-header panel-header-compact panel-header-split">
          <div>
            <p className="eyebrow">Histórico</p>
            <h3 className="card-title">Almacenamiento y margen por período</h3>
            <p className="panel-description">
              {historyDescription} de la plataforma{' '}
              {history?.platformName || platformName || 'seleccionada'}.
            </p>
          </div>
          <div className="history-filter-panel">
            <div className="history-filter-group">
              <span className="chart-filter-label">Vista</span>
              <div
                className="filter-chip-group"
                role="tablist"
                aria-label="Granularidad histórica"
              >
                {GROUP_BY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-chip ${groupBy === option.value ? 'active' : ''}`}
                    onClick={() => setGroupBy(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="history-filter-select-group">
              <span className="chart-filter-label">Desde</span>
              <select
                className="form-input history-filter-select"
                value={rangeStartKey}
                onChange={(event) => setRangeStartKey(event.target.value)}
                disabled={!periodOptions.length}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="history-filter-select-group">
              <span className="chart-filter-label">Hasta</span>
              <select
                className="form-input history-filter-select"
                value={rangeEndKey}
                onChange={(event) => setRangeEndKey(event.target.value)}
                disabled={!periodOptions.length}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="history-filter-group history-filter-action">
              <span className="chart-filter-label">Rango</span>
              <button
                type="button"
                className={`filter-chip ${isFullRangeSelected ? 'active' : ''}`}
                onClick={() => {
                  if (!groupedPoints.length) return;
                  setRangeStartKey(groupedPoints[0].key);
                  setRangeEndKey(groupedPoints[groupedPoints.length - 1].key);
                }}
                disabled={!groupedPoints.length}
              >
                Todo
              </button>
            </div>
          </div>
        </div>
        <p className="history-filter-summary">
          Vista actual:{' '}
          <strong>
            {GROUP_BY_OPTIONS.find((option) => option.value === groupBy)?.label}
          </strong>
          {' · '}
          Rango: <strong>{selectedPeriodLabel}</strong>
        </p>

        <div className="stats-grid">
          <div className="stat-box stat-box-total">
            <div className="stat-label">Almacenamiento actual</div>
            <div className="stat-value">{formatGigabytes(currentStorageGb)}</div>
          </div>
          <div className="stat-box stat-box-secondary">
            <div className="stat-label">Cobro mensual</div>
            <div className="stat-value">
              {formatCurrency(currentCharge, effectiveCurrency)}
            </div>
          </div>
          <div className="stat-box stat-box-secondary">
            <div className="stat-label">Costo actual</div>
            <div className="stat-value">
              {formatCurrency(currentCost, effectiveCurrency)}
            </div>
          </div>
          <div className="stat-box stat-box-secondary">
            <div className="stat-label">Margen actual</div>
            <div
              className={`stat-value ${
                Number.isFinite(currentMargin)
                  ? currentMargin < 0
                    ? 'stat-value-money-negative'
                    : 'stat-value-money-positive'
                  : ''
              }`}
            >
              {formatCurrency(currentMargin, effectiveCurrency)}
            </div>
          </div>
          {canViewSnapshots && (
            <div className="stat-box stat-box-secondary">
              <div className="stat-label">Snapshots</div>
              <div className="stat-value">{snapshotsCount}</div>
            </div>
          )}
        </div>

        {!summary?.hasFinancialConfig && (
          <div className="history-note history-note-warning">
            Configura el monto mensual para habilitar el cálculo de margen actual y
            futuro en esta plataforma.
          </div>
        )}
      </div>

      {allPoints.length === 0 ? (
        <p className="empty">
          Aún no hay snapshots mensuales para{' '}
          {history?.platformName || platformName || 'la plataforma seleccionada'}.
          Ejecuta una sincronización para generar el primer histórico.
        </p>
      ) : (
        <>
          <div className="card detail-chart-card">
            <div className="panel-header panel-header-compact">
              <div>
                <p className="eyebrow">Gráfico 1</p>
                <h3 className="card-title">Historial de almacenamiento</h3>
                <p className="panel-description">{storageChartDescription}</p>
              </div>
            </div>
            <div className="chart-container">
              <Line
                data={storageHistoryData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#294560',
                      titleColor: '#FFFFFF',
                      bodyColor: '#FFFFFF',
                      padding: 12,
                      callbacks: {
                        label: (context) => formatGigabytes(context.raw),
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        color: '#2F455E',
                        font: { size: 11, family: CHART_FONT_FAMILY },
                      },
                      grid: {
                        display: false,
                      },
                      border: {
                        display: false,
                      },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: '#2F455E',
                        font: { size: 11, family: CHART_FONT_FAMILY },
                        callback: (value) => formatGigabytes(Number(value)),
                      },
                      grid: {
                        color: 'rgba(47, 69, 94, 0.10)',
                      },
                      border: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="card detail-chart-card">
            <div className="panel-header panel-header-compact">
              <div>
                <p className="eyebrow">Gráfico 2</p>
                <h3 className="card-title">Historial de margen</h3>
                <p className="panel-description">{marginChartDescription}</p>
              </div>
            </div>

            {marginReady ? (
              <div className="chart-container">
                <Bar
                  data={marginHistoryData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#294560',
                        titleColor: '#FFFFFF',
                        bodyColor: '#FFFFFF',
                        padding: 12,
                        callbacks: {
                          label: (context) => {
                            const point = filteredPoints[context.dataIndex];
                            if (!hasMarginData(point)) {
                              return 'Configuración financiera pendiente';
                            }

                            return `${point.hasPartialFinancialConfig ? 'Margen parcial' : 'Margen'}: ${formatCurrency(
                              point.margin,
                              point.currency || effectiveCurrency
                            )}`;
                          },
                          afterLabel: (context) => {
                            const point = filteredPoints[context.dataIndex];
                            if (!hasMarginData(point)) return [];

                            const details = [
                              `Ingreso: ${formatCurrency(
                                point.income,
                                point.currency || effectiveCurrency
                              )}`,
                              `Costo: ${formatCurrency(
                                point.cost,
                                point.currency || effectiveCurrency
                              )}`,
                            ];

                            if (point.hasPartialFinancialConfig) {
                              details.unshift(
                                'Incluye sólo meses con configuración financiera completa.'
                              );
                            }

                            return details;
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        ticks: {
                          color: '#2F455E',
                          font: { size: 11, family: CHART_FONT_FAMILY },
                        },
                        grid: {
                          display: false,
                        },
                        border: {
                          display: false,
                        },
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          color: '#2F455E',
                          font: { size: 11, family: CHART_FONT_FAMILY },
                          callback: (value) =>
                            formatCurrencyCompact(value, effectiveCurrency),
                        },
                        grid: {
                          color: 'rgba(47, 69, 94, 0.10)',
                        },
                        border: {
                          display: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <p className="empty">
                No hay datos financieros suficientes en la vista y rango
                seleccionados para mostrar el margen histórico.
              </p>
            )}

            {marginReady && marginHasGaps && (
              <p className="history-note">
                Algunos períodos no muestran barra completa porque todavía no tenían
                configuración financiera suficiente.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
