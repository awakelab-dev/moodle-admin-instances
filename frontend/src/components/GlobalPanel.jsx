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
import { getGlobalStorageHistory, getPlatformStorageSummary } from '../api';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const CHART_FONT_FAMILY = "'Poppins', sans-serif";
const PLATFORM_COLORS = [
  '#19F7F1',
  '#0FCED3',
  '#0ABCC9',
  '#0B93AA',
  '#11EAEA',
  '#17DCE8',
  '#0DBFD1',
  '#0AA0B5',
  '#158FA8',
  '#1C7FA0',
  '#2670A0',
  '#3B6996',
  '#2E8CA6',
  '#12B8C4',
  '#0E9CB0',
  '#21AEBE',
  '#1A7A94',
  '#2E6E9A',
  '#3D82AE',
  '#14C2CE',
  '#0C88A0',
  '#248AA8',
  '#1BA8B8',
  '#2F76AE',
];
const STORAGE_FILTER_OPTIONS = [
  { value: '5', label: 'Top 5' },
  { value: '10', label: 'Top 10' },
  { value: 'all', label: 'Todas' },
];

function parseMonthKey(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
const MARGIN_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'positive', label: 'Ganancia' },
  { value: 'negative', label: 'Pérdida' },
];
const GLOBAL_HISTORY_GROUP_BY_OPTIONS = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
];

function formatGigabytes(value) {
  return `${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Number(value || 0))} GB`;
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

function buildGroupedGlobalStoragePoints(points, groupBy) {
  const sortedPoints = [...points].sort((a, b) =>
    String(a.month || '').localeCompare(String(b.month || ''))
  );

  if (groupBy === 'month') {
    return sortedPoints.map((point) => ({
      ...point,
      key: point.month,
      label: formatMonthLabel(point.month),
      totalGb: Number(point.totalGb || 0),
      platformCount: Number(point.platformCount || 0),
    }));
  }

  const groups = new Map();

  sortedPoints.forEach((point) => {
    const key = groupBy === 'quarter' ? getQuarterKey(point.month) : getYearKey(point.month);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...point,
        key,
        label: formatPeriodLabel(key, groupBy),
        totalGb: Number(point.totalGb || 0),
        platformCount: Number(point.platformCount || 0),
      });
      return;
    }

    existing.month = point.month;
    existing.totalGb = Number(point.totalGb || 0);
    existing.totalBytes = Number(point.totalBytes || 0);
    existing.platformCount = Number(point.platformCount || 0);
  });

  return Array.from(groups.values());
}

function buildGroupedPlatformStoragePoints(points, groupBy) {
  const sortedPoints = [...points].sort((a, b) =>
    String(a.month || '').localeCompare(String(b.month || ''))
  );

  if (groupBy === 'month') {
    return sortedPoints.map((point) => ({
      ...point,
      key: point.month,
      label: formatMonthLabel(point.month),
      totalGb: Number(point.totalGb || 0),
    }));
  }

  const groups = new Map();

  sortedPoints.forEach((point) => {
    const key = groupBy === 'quarter' ? getQuarterKey(point.month) : getYearKey(point.month);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...point,
        key,
        label: formatPeriodLabel(key, groupBy),
        totalGb: Number(point.totalGb || 0),
      });
      return;
    }

    existing.month = point.month;
    existing.totalGb = Number(point.totalGb || 0);
    existing.totalBytes = Number(point.totalBytes || 0);
  });

  return Array.from(groups.values());
}

function hasMarginData(point) {
  return (
    Number.isFinite(Number(point?.margin)) &&
    (point?.hasFinancialConfig || point?.hasPartialFinancialConfig)
  );
}

function buildGroupedPlatformFinancialPoints(points, groupBy) {
  const sortedPoints = [...points].sort((a, b) =>
    String(a.month || '').localeCompare(String(b.month || ''))
  );

  if (groupBy === 'month') {
    return sortedPoints.map((point) => ({
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

  sortedPoints.forEach((point) => {
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

function getGlobalHistoryDescription(groupBy) {
  if (groupBy === 'quarter') {
    return 'Comparativa del almacenamiento por empresa al cierre de cada trimestre. Cada línea representa una plataforma distinta.';
  }

  if (groupBy === 'year') {
    return 'Comparativa del almacenamiento por empresa al cierre de cada año. Cada línea representa una plataforma distinta.';
  }

  return 'Comparativa mensual del almacenamiento por empresa. Cada línea representa una plataforma distinta.';
}

function getGlobalMarginDescription(groupBy) {
  if (groupBy === 'quarter') {
    return 'Comparativa del margen acumulado por empresa para los trimestres seleccionados, usando los mismos filtros del histórico global y un costo global de USD 1 por GB.';
  }

  if (groupBy === 'year') {
    return 'Comparativa del margen acumulado por empresa para los años seleccionados, usando los mismos filtros del histórico global y un costo global de USD 1 por GB.';
  }

  return 'Comparativa del margen por empresa para los meses seleccionados, usando los mismos filtros del histórico global y un costo global de USD 1 por GB.';
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

function getClosestTickIndex(scale, pixel) {
  if (!scale?.ticks?.length) return -1;

  const tickPixels = scale.ticks.map((_, index) => scale.getPixelForTick(index));
  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;

  tickPixels.forEach((tickPixel, index) => {
    const distance = Math.abs(tickPixel - pixel);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function getCanvasEventPosition(event, chart) {
  if (typeof event?.x === 'number' && typeof event?.y === 'number') {
    return { x: event.x, y: event.y };
  }

  const nativeEvent = event?.native || event;
  if (typeof nativeEvent?.offsetX === 'number' && typeof nativeEvent?.offsetY === 'number') {
    return { x: nativeEvent.offsetX, y: nativeEvent.offsetY };
  }

  const rect = chart?.canvas?.getBoundingClientRect?.();
  if (
    rect &&
    typeof nativeEvent?.clientX === 'number' &&
    typeof nativeEvent?.clientY === 'number'
  ) {
    return {
      x: nativeEvent.clientX - rect.left,
      y: nativeEvent.clientY - rect.top,
    };
  }

  return null;
}

function isHorizontalChartLabelArea(position, chart) {
  const yScale = chart?.scales?.y;
  const chartArea = chart?.chartArea;
  if (!position || !yScale || !chartArea) return false;

  const withinVerticalBounds =
    position.y >= yScale.top - 18 && position.y <= yScale.bottom + 18;
  const withinHorizontalBounds =
    position.x >= 0 && position.x <= chartArea.left;

  return withinHorizontalBounds && withinVerticalBounds;
}

function getPlatformColor(index) {
  return PLATFORM_COLORS[index % PLATFORM_COLORS.length];
}

function getMarginColor(value) {
  return value < 0 ? '#34547A' : '#19F7F1';
}

export default function GlobalPanel({
  onSelectPlatform,
  refreshKey = 0,
  searchTerm = '',
  onSearchTermChange,
  searchSubmitRef,
}) {
  const [platformSummaries, setPlatformSummaries] = useState([]);
  const [storageHistory, setStorageHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storageFilter, setStorageFilter] = useState('all');
  const [storageHistoryGroupBy, setStorageHistoryGroupBy] = useState('month');
  const [storageHistoryRangeStartKey, setStorageHistoryRangeStartKey] = useState('');
  const [storageHistoryRangeEndKey, setStorageHistoryRangeEndKey] = useState('');
  const [marginFilter, setMarginFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError(null);

    Promise.all([getPlatformStorageSummary(), getGlobalStorageHistory()])
      .then(([summaryResponse, historyResponse]) => {
        if (!isMounted) return;
        setPlatformSummaries(Array.isArray(summaryResponse) ? summaryResponse : []);
        setStorageHistory(
          historyResponse && typeof historyResponse === 'object'
            ? historyResponse
            : null
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        setPlatformSummaries([]);
        setStorageHistory(null);
        setError(
          err?.message || 'No se pudo cargar el panel global de plataformas.'
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const currentPlatforms = useMemo(
    () =>
      [...platformSummaries]
        .map((platform, index) => ({
          ...platform,
          id: platform.source || `platform-${index}`,
          color: getPlatformColor(index),
          currentStorageGb: Number(platform.totalGb || 0),
        }))
        .sort((a, b) => {
          if (b.currentStorageGb !== a.currentStorageGb) {
            return b.currentStorageGb - a.currentStorageGb;
          }
          return a.name.localeCompare(b.name);
        }),
    [platformSummaries]
  );

  const filteredPlatforms = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!normalizedTerm) return [];
    return currentPlatforms.filter((platform) =>
      platform.name.toLowerCase().includes(normalizedTerm)
    );
  }, [currentPlatforms, searchTerm]);


  const globalStorageHistoryGroupedPoints = useMemo(() => {
    const points = Array.isArray(storageHistory?.points) ? storageHistory.points : [];
    return buildGroupedGlobalStoragePoints(points, storageHistoryGroupBy);
  }, [storageHistory, storageHistoryGroupBy]);

  const globalStorageHistoryPeriodOptions = useMemo(
    () =>
      globalStorageHistoryGroupedPoints.map((point) => ({
        value: point.key,
        label: point.label,
      })),
    [globalStorageHistoryGroupedPoints]
  );

  useEffect(() => {
    if (!globalStorageHistoryGroupedPoints.length) {
      setStorageHistoryRangeStartKey('');
      setStorageHistoryRangeEndKey('');
      return;
    }

    setStorageHistoryRangeStartKey(globalStorageHistoryGroupedPoints[0].key);
    setStorageHistoryRangeEndKey(
      globalStorageHistoryGroupedPoints[globalStorageHistoryGroupedPoints.length - 1].key
    );
  }, [storageHistoryGroupBy, globalStorageHistoryGroupedPoints]);

  const globalStorageHistoryPoints = useMemo(() => {
    if (!globalStorageHistoryGroupedPoints.length) return [];

    const startIndex = globalStorageHistoryGroupedPoints.findIndex(
      (point) => point.key === storageHistoryRangeStartKey
    );
    const endIndex = globalStorageHistoryGroupedPoints.findIndex(
      (point) => point.key === storageHistoryRangeEndKey
    );
    const safeStartIndex = startIndex >= 0 ? startIndex : 0;
    const safeEndIndex =
      endIndex >= 0 ? endIndex : globalStorageHistoryGroupedPoints.length - 1;
    const normalizedStartIndex = Math.min(safeStartIndex, safeEndIndex);
    const normalizedEndIndex = Math.max(safeStartIndex, safeEndIndex);

    return globalStorageHistoryGroupedPoints.slice(
      normalizedStartIndex,
      normalizedEndIndex + 1
    );
  }, [
    globalStorageHistoryGroupedPoints,
    storageHistoryRangeEndKey,
    storageHistoryRangeStartKey,
  ]);

  const storageChartPlatforms = useMemo(() => {
    if (storageFilter === 'all') return currentPlatforms;

    const limit = Number(storageFilter);
    if (!Number.isFinite(limit) || limit <= 0) return currentPlatforms;

    return currentPlatforms.slice(0, limit);
  }, [currentPlatforms, storageFilter]);

  const pendingFinancialPlatforms = useMemo(
    () =>
      currentPlatforms.filter((platform) => !platform.hasFinancialConfig),
    [currentPlatforms]
  );

  const storageHistoryPlatforms = useMemo(() => {
    const historyPlatforms = Array.isArray(storageHistory?.platforms)
      ? storageHistory.platforms
      : [];
    if (!historyPlatforms.length) return [];

    const historyBySource = new Map(
      historyPlatforms.map((platform) => [platform.source, platform])
    );
    const orderedPlatforms = [];
    const usedSources = new Set();

    currentPlatforms.forEach((platform) => {
      const historyPlatform = historyBySource.get(platform.source);
      if (!historyPlatform) return;

      orderedPlatforms.push({
        ...historyPlatform,
        color: platform.color,
      });
      usedSources.add(platform.source);
    });

    historyPlatforms.forEach((platform, index) => {
      if (usedSources.has(platform.source)) return;

      orderedPlatforms.push({
        ...platform,
        color: getPlatformColor(orderedPlatforms.length + index),
      });
    });

    return orderedPlatforms;
  }, [storageHistory, currentPlatforms]);


  const isGlobalHistoryFullRangeSelected =
    globalStorageHistoryGroupedPoints.length > 0 &&
    storageHistoryRangeStartKey === globalStorageHistoryGroupedPoints[0]?.key &&
    storageHistoryRangeEndKey ===
      globalStorageHistoryGroupedPoints[globalStorageHistoryGroupedPoints.length - 1]?.key;

  const selectedGlobalHistoryLabel = !globalStorageHistoryPoints.length
    ? 'Sin datos'
    : isGlobalHistoryFullRangeSelected
      ? 'Todo el rango'
      : globalStorageHistoryPoints.length === 1
        ? globalStorageHistoryPoints[0].label
        : `${globalStorageHistoryPoints[0].label} → ${
            globalStorageHistoryPoints[globalStorageHistoryPoints.length - 1].label
          }`;

  const globalHistoryDescription = getGlobalHistoryDescription(storageHistoryGroupBy);
  const globalMarginDescription = getGlobalMarginDescription(storageHistoryGroupBy);
  const selectedGlobalHistoryKeys = useMemo(
    () => globalStorageHistoryPoints.map((point) => point.key),
    [globalStorageHistoryPoints]
  );
  const selectedGlobalHistoryKeySet = useMemo(
    () => new Set(selectedGlobalHistoryKeys),
    [selectedGlobalHistoryKeys]
  );

  const marginPlatforms = useMemo(() => {
    if (!selectedGlobalHistoryKeySet.size) return [];

    return storageHistoryPlatforms
      .map((platform, index) => {
        const groupedPoints = buildGroupedPlatformFinancialPoints(
          Array.isArray(platform.points) ? platform.points : [],
          storageHistoryGroupBy
        );
        const filteredPoints = groupedPoints.filter((point) =>
          selectedGlobalHistoryKeySet.has(point.key)
        );

        if (!filteredPoints.length) return null;

        const financialPoints = filteredPoints.filter(hasMarginData);
        const hasFinancialData = financialPoints.length > 0;
        const latestPoint = filteredPoints[filteredPoints.length - 1];

        return {
          id: platform.source || `margin-platform-${index}`,
          source: platform.source,
          name: platform.name,
          color: platform.color || getPlatformColor(index),
          currency: latestPoint?.currency || financialPoints[0]?.currency || 'USD',
          income: hasFinancialData
            ? financialPoints.reduce((sum, point) => sum + Number(point.income || 0), 0)
            : null,
          cost: hasFinancialData
            ? financialPoints.reduce((sum, point) => sum + Number(point.cost || 0), 0)
            : null,
          margin: hasFinancialData
            ? financialPoints.reduce((sum, point) => sum + Number(point.margin || 0), 0)
            : null,
          hasFinancialConfig:
            filteredPoints.length > 0 &&
            filteredPoints.every((point) => point.hasFinancialConfig),
          hasPartialFinancialConfig:
            filteredPoints.some((point) => point.hasPartialFinancialConfig) ||
            (hasFinancialData && filteredPoints.some((point) => !point.hasFinancialConfig)),
        };
      })
      .filter(Boolean)
      .filter((platform) => Number.isFinite(Number(platform.margin)))
      .sort((a, b) => {
        if ((b.margin || 0) !== (a.margin || 0)) {
          return (b.margin || 0) - (a.margin || 0);
        }
        return a.name.localeCompare(b.name);
      });
  }, [selectedGlobalHistoryKeySet, storageHistoryPlatforms, storageHistoryGroupBy]);

  const marginChartPlatforms = useMemo(() => {
    if (marginFilter === 'positive') {
      return marginPlatforms.filter((platform) => Number(platform.margin || 0) >= 0);
    }

    if (marginFilter === 'negative') {
      return marginPlatforms.filter((platform) => Number(platform.margin || 0) < 0);
    }

    return marginPlatforms;
  }, [marginPlatforms, marginFilter]);

  const marginCurrencies = useMemo(
    () =>
      Array.from(
        new Set(marginChartPlatforms.map((platform) => platform.currency).filter(Boolean))
      ),
    [marginChartPlatforms]
  );

  const currentComparisonData = useMemo(
    () => ({
      labels: storageChartPlatforms.map((platform) => platform.name),
      datasets: [
        {
          label: 'Contenido total actual',
          data: storageChartPlatforms.map((platform) => platform.currentStorageGb),
          backgroundColor: storageChartPlatforms.map((platform) => platform.color),
          borderRadius: 10,
          maxBarThickness: 56,
        },
      ],
    }),
    [storageChartPlatforms]
  );

  const marginComparisonData = useMemo(
    () => ({
      labels: marginChartPlatforms.map((platform) => platform.name),
      datasets: [
        {
          label: 'Margen del rango seleccionado',
          data: marginChartPlatforms.map((platform) => platform.margin || 0),
          backgroundColor: marginChartPlatforms.map((platform) =>
            getMarginColor(platform.margin || 0)
          ),
          borderColor: marginChartPlatforms.map((platform) =>
            getMarginColor(platform.margin || 0)
          ),
          borderRadius: 10,
          maxBarThickness: 56,
        },
      ],
    }),
    [marginChartPlatforms]
  );

  const globalStorageHistoryDatasets = useMemo(() => {
    if (!selectedGlobalHistoryKeys.length) return [];

    return storageHistoryPlatforms
      .map((platform, index) => {
        const groupedPoints = buildGroupedPlatformStoragePoints(
          Array.isArray(platform.points) ? platform.points : [],
          storageHistoryGroupBy
        );
        const groupedPointsByKey = new Map(
          groupedPoints.map((point) => [point.key, point])
        );
        const data = selectedGlobalHistoryKeys.map(
          (key) => groupedPointsByKey.get(key)?.totalGb ?? null
        );

        if (data.every((value) => value === null)) return null;

        const color = platform.color || getPlatformColor(index);

        return {
          label: platform.name,
          data,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          pointHoverRadius: 5,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.28,
          fill: false,
          spanGaps: true,
        };
      })
      .filter(Boolean);
  }, [selectedGlobalHistoryKeys, storageHistoryPlatforms, storageHistoryGroupBy]);

  const globalStorageHistoryData = useMemo(
    () => ({
      labels: globalStorageHistoryPoints.map((point) => point.label),
      datasets: globalStorageHistoryDatasets,
    }),
    [globalStorageHistoryDatasets, globalStorageHistoryPoints]
  );

  function selectPlatform(platform) {
    onSelectPlatform?.({
      id: platform.id,
      name: platform.name,
      source: platform.source,
    });
  }

  useEffect(() => {
    if (searchSubmitRef) {
      searchSubmitRef.current = () => {
        if (!filteredPlatforms.length) return;
        selectPlatform(filteredPlatforms[0]);
      };
    }
  }, [filteredPlatforms, searchSubmitRef]);

  function handleBarChartClick(event, activeElements, chart, platforms) {
    if (activeElements.length) {
      selectPlatform(platforms[activeElements[0].index]);
      return;
    }

    const position = getCanvasEventPosition(event, chart);
    const yScale = chart?.scales?.y;
    if (!position || !yScale || !isHorizontalChartLabelArea(position, chart)) return;

    const labelIndex = getClosestTickIndex(yScale, position.y);
    if (labelIndex >= 0 && platforms[labelIndex]) {
      selectPlatform(platforms[labelIndex]);
    }
  }

  function handleBarChartHover(event, activeElements, chart) {
    const position = getCanvasEventPosition(event, chart);
    const isInteractiveLabel = isHorizontalChartLabelArea(position, chart);

    if (chart?.canvas) {
      chart.canvas.style.cursor =
        activeElements.length || isInteractiveLabel ? 'pointer' : 'default';
    }
  }

  if (loading) return <p className="empty">Cargando panel global…</p>;
  if (error) return <p className="empty error">{error}</p>;
  if (!currentPlatforms.length) {
    return (
      <p className="empty">
        No hay plataformas configuradas todavía. Agrega una conexión y sincroniza
        para empezar a ver métricas.
      </p>
    );
  }

  const sharedMarginCurrency = marginCurrencies[0] || 'CLP';

  return (
    <div className="section-stack">
      {searchTerm.trim() && (
        <div className="card">
          <div className="global-search-results">
            {filteredPlatforms.length ? (
              filteredPlatforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  className="global-search-result"
                  onClick={() => selectPlatform(platform)}
                >
                  {platform.name}
                </button>
              ))
            ) : (
              <span className="global-search-empty">
                No se encontraron plataformas que coincidan con tu búsqueda.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="panel-header panel-header-compact panel-header-split">
          <div>
            <p className="eyebrow">Gráfico 1</p>
            <h3 className="card-title">Empresas vs. contenido total actual</h3>
            <p className="panel-description">
              Comparativa actual del contenido total en GB por plataforma Moodle,
              calculada desde el total real sincronizado de cada empresa.
            </p>
            <div className="chart-filter-row">
              <span className="chart-filter-label">Mostrar:</span>
              <ToggleGroup
                type="single"
                value={storageFilter}
                onValueChange={(value) => value && setStorageFilter(value)}
                aria-label="Filtro gráfico almacenamiento"
              >
                {STORAGE_FILTER_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <div className="global-panel-badge">
            <span className="global-panel-badge-label">Plataformas</span>
            <strong className="global-panel-badge-value">{storageChartPlatforms.length}</strong>
          </div>
        </div>

        <div className="chart-container chart-container-global">
          <Bar
            data={currentComparisonData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              onClick: (event, activeElements, chart) =>
                handleBarChartClick(event, activeElements, chart, storageChartPlatforms),
              onHover: handleBarChartHover,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: '#01264C',
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
                  beginAtZero: true,
                  ticks: {
                    color: '#C9D6EA',
                    font: { size: 11, family: CHART_FONT_FAMILY },
                    callback: (value) => formatGigabytes(Number(value)),
                  },
                  grid: {
                    color: 'rgba(240, 243, 252, 0.10)',
                  },
                  border: {
                    display: false,
                  },
                },
                y: {
                  ticks: {
                    color: '#C9D6EA',
                    font: { size: 11, family: CHART_FONT_FAMILY },
                  },
                  grid: {
                    display: false,
                  },
                  border: {
                    display: false,
                  },
                },
              },
            }}
          />
        </div>
        <p className="chart-click-hint">
          Haz clic en una barra o en el nombre de la empresa para abrir su detalle.
        </p>
      </div>

      <div className="card">
        <div className="panel-header panel-header-compact panel-header-split">
          <div>
            <p className="eyebrow">Gráfico 2</p>
            <h3 className="card-title">Historial global de almacenamiento</h3>
            <p className="panel-description">{globalHistoryDescription}</p>
          </div>
          <div className="history-filter-panel">
            <div className="history-filter-group">
              <span className="chart-filter-label">Vista</span>
              <ToggleGroup
                type="single"
                value={storageHistoryGroupBy}
                onValueChange={(value) => value && setStorageHistoryGroupBy(value)}
                aria-label="Granularidad histórico global"
              >
                {GLOBAL_HISTORY_GROUP_BY_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <label className="history-filter-select-group">
              <span className="chart-filter-label">Desde</span>
              <Select
                value={storageHistoryRangeStartKey}
                onValueChange={setStorageHistoryRangeStartKey}
                disabled={!globalStorageHistoryPeriodOptions.length}
              >
                <SelectTrigger className="history-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {globalStorageHistoryPeriodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="history-filter-select-group">
              <span className="chart-filter-label">Hasta</span>
              <Select
                value={storageHistoryRangeEndKey}
                onValueChange={setStorageHistoryRangeEndKey}
                disabled={!globalStorageHistoryPeriodOptions.length}
              >
                <SelectTrigger className="history-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {globalStorageHistoryPeriodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="history-filter-group history-filter-action">
              <span className="chart-filter-label">Rango</span>
              <ToggleGroup
                type="single"
                value={isGlobalHistoryFullRangeSelected ? 'full' : ''}
                onValueChange={() => {
                  if (!globalStorageHistoryGroupedPoints.length) return;
                  setStorageHistoryRangeStartKey(globalStorageHistoryGroupedPoints[0].key);
                  setStorageHistoryRangeEndKey(
                    globalStorageHistoryGroupedPoints[
                      globalStorageHistoryGroupedPoints.length - 1
                    ].key
                  );
                }}
              >
                <ToggleGroupItem value="full" disabled={!globalStorageHistoryGroupedPoints.length}>
                  Todo
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>
        <p className="history-filter-summary">
          Vista actual:{' '}
          <strong>
            {
              GLOBAL_HISTORY_GROUP_BY_OPTIONS.find(
                (option) => option.value === storageHistoryGroupBy
              )?.label
            }
          </strong>
          {' · '}
          Rango: <strong>{selectedGlobalHistoryLabel}</strong>
        </p>

        {!globalStorageHistoryPoints.length || !globalStorageHistoryDatasets.length ? (
          <p className="empty">
            Aún no hay snapshots globales suficientes para mostrar el historial de almacenamiento.
          </p>
        ) : (
          <div className="chart-container chart-container-global">
            <Line
              data={globalStorageHistoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                      usePointStyle: true,
                      boxWidth: 8,
                      boxHeight: 8,
                      padding: 14,
                      color: '#C9D6EA',
                      font: { size: 11, family: CHART_FONT_FAMILY },
                    },
                  },
                  tooltip: {
                    backgroundColor: '#01264C',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    padding: 12,
                    callbacks: {
                      label: (context) =>
                        `${context.dataset.label}: ${formatGigabytes(context.raw)}`,
                      footer: (items) => {
                        const point = globalStorageHistoryPoints[items[0]?.dataIndex];
                        if (!point) return [];

                        return [
                          `Total global: ${formatGigabytes(point.totalGb)}`,
                          point.platformCount
                            ? `Plataformas incluidas: ${point.platformCount}`
                            : null,
                        ].filter(Boolean);
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: {
                      color: '#C9D6EA',
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
                      color: '#C9D6EA',
                      font: { size: 11, family: CHART_FONT_FAMILY },
                      callback: (value) => formatGigabytes(Number(value)),
                    },
                    grid: {
                      color: 'rgba(240, 243, 252, 0.10)',
                    },
                    border: {
                      display: false,
                    },
                  },
                },
              }}
            />
          </div>
        )}
      </div>

      <div className="card">
        <div className="panel-header panel-header-compact panel-header-split">
          <div>
            <p className="eyebrow">Gráfico 3</p>
            <h3 className="card-title">Empresas vs. margen del rango seleccionado</h3>
            <p className="panel-description">{globalMarginDescription}</p>
            <div className="chart-filter-row">
              <span className="chart-filter-label">Ver:</span>
              <ToggleGroup
                type="single"
                value={marginFilter}
                onValueChange={(value) => value && setMarginFilter(value)}
                aria-label="Filtro gráfico margen"
              >
                {MARGIN_FILTER_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>
        <p className="history-filter-summary">
          Anclado al histórico global · Vista:{' '}
          <strong>
            {
              GLOBAL_HISTORY_GROUP_BY_OPTIONS.find(
                (option) => option.value === storageHistoryGroupBy
              )?.label
            }
          </strong>
          {' · '}
          Rango: <strong>{selectedGlobalHistoryLabel}</strong>
        </p>

        {pendingFinancialPlatforms.length > 0 && (
          <div className="history-note history-note-warning">
            Configuración financiera pendiente en:{' '}
            <strong>
              {pendingFinancialPlatforms.map((platform) => platform.name).join(', ')}
            </strong>
            .
          </div>
        )}

        {!marginPlatforms.length ? (
          <p className="empty">
            Todavía no hay plataformas con monto mensual configurado para mostrar
            el margen del rango seleccionado.
          </p>
        ) : !marginChartPlatforms.length ? (
          <p className="empty">
            No hay plataformas que coincidan con el filtro actual del gráfico de margen
            para el rango seleccionado.
          </p>
        ) : marginCurrencies.length > 1 ? (
          <p className="empty">
            El gráfico global de margen sólo se muestra cuando todas las plataformas
            comparadas en el rango seleccionado usan la misma moneda. Monedas detectadas:{' '}
            {marginCurrencies.join(', ')}.
          </p>
        ) : (
          <>
            <div className="chart-container chart-container-global">
              <Bar
                data={marginComparisonData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  onClick: (event, activeElements, chart) =>
                    handleBarChartClick(event, activeElements, chart, marginChartPlatforms),
                  onHover: handleBarChartHover,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#01264C',
                      titleColor: '#FFFFFF',
                      bodyColor: '#FFFFFF',
                      padding: 12,
                      callbacks: {
                        label: (context) => {
                          const platform = marginChartPlatforms[context.dataIndex];
                          return `Margen: ${formatCurrency(
                            platform.margin,
                            platform.currency
                          )}`;
                        },
                        afterLabel: (context) => {
                          const platform = marginChartPlatforms[context.dataIndex];
                          return [
                            `Ingreso: ${formatCurrency(
                              platform.income,
                              platform.currency
                            )}`,
                            `Costo: ${formatCurrency(
                              platform.cost,
                              platform.currency
                            )}`,
                          ];
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: {
                        color: '#C9D6EA',
                        font: { size: 11, family: CHART_FONT_FAMILY },
                        callback: (value) =>
                          formatCurrencyCompact(value, sharedMarginCurrency),
                      },
                      grid: {
                        color: 'rgba(240, 243, 252, 0.10)',
                      },
                      border: {
                        display: false,
                      },
                    },
                    y: {
                      ticks: {
                        color: '#C9D6EA',
                        font: { size: 11, family: CHART_FONT_FAMILY },
                      },
                      grid: {
                        display: false,
                      },
                      border: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            </div>
            <p className="chart-click-hint">
              Haz clic en una barra o en el nombre de la empresa para abrir su detalle.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
