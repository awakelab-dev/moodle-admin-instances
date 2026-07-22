export const GLOBAL_COST_PER_GB = Number(process.env.GLOBAL_COST_PER_GB || 1);

export function normalizeUrl(url = ''): string {
  return String(url).trim().replace(/\/+$/, '');
}

const COMBINING_DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

export function slugifyPlatform(value = ''): string {
  return String(value)
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeOptionalAmount(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

export function bytesToGigabytes(bytes: number | bigint = 0): number {
  return Number(bytes || 0) / Math.pow(1024, 3);
}

export function roundMoney(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function calculateFinancialMetrics(totalBytes: number | bigint, monthlyCharge: number | null) {
  const totalGb = bytesToGigabytes(totalBytes);
  const costPerGb = GLOBAL_COST_PER_GB;
  const configured = Number.isFinite(monthlyCharge as number);

  if (!configured) {
    return { totalBytes: Number(totalBytes), totalGb, monthlyCharge, costPerGb, currency: 'USD', income: null, cost: null, margin: null, hasFinancialConfig: false };
  }

  const income = roundMoney(monthlyCharge as number);
  const cost = roundMoney(totalGb * costPerGb);
  const margin = roundMoney(income - cost);

  return { totalBytes: Number(totalBytes), totalGb, monthlyCharge, costPerGb, currency: 'USD', income, cost, margin, hasFinancialConfig: true };
}

export function getMonthKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
