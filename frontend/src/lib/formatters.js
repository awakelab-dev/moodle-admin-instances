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

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

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

export function parseMonthKey(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonthLabel(month) {
  const date = parseMonthKey(month);
  if (!date) return month;

  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getQuarterKey(month) {
  const date = parseMonthKey(month);
  if (!date) return month;

  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

export function formatQuarterLabel(quarterKey) {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarterKey);
  if (!match) return quarterKey;

  return `Q${match[2]} ${match[1]}`;
}

export function getYearKey(month) {
  const date = parseMonthKey(month);
  if (!date) return String(month).slice(0, 4);

  return String(date.getFullYear());
}

export function formatPeriodLabel(periodKey, groupBy) {
  if (groupBy === 'quarter') return formatQuarterLabel(periodKey);
  if (groupBy === 'year') return periodKey;
  return formatMonthLabel(periodKey);
}

export function hasMarginData(point) {
  return (
    Number.isFinite(Number(point?.margin)) &&
    (point?.hasFinancialConfig || point?.hasPartialFinancialConfig)
  );
}
