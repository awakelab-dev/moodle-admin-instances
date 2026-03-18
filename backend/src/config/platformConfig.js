const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'moodles.json');
const DEFAULT_CURRENCY = 'USD';
const GLOBAL_COST_PER_GB = 1;

function normalizeUrl(url = '') {
  return String(url).trim().replace(/\/+$/, '');
}

function slugifyPlatform(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCurrency() {
  return DEFAULT_CURRENCY;
}

function normalizeOptionalAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}
function normalizeIsActive(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return true;
}

function normalizePlatform(platform = {}) {
  return {
    name: String(platform.name ?? '').trim(),
    url: normalizeUrl(platform.url),
    token: String(platform.token ?? '').trim(),
    monthlyCharge: normalizeOptionalAmount(platform.monthlyCharge),
    currency: normalizeCurrency(),
    isActive: normalizeIsActive(platform.isActive),
  };
}

function readPlatformConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.map(normalizePlatform) : [];
}

function writePlatformConfig(platforms) {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(platforms.map(normalizePlatform), null, 2),
    'utf-8'
  );
}

function hasFinancialConfig(platform = {}) {
  return (
    Number.isFinite(platform?.monthlyCharge) &&
    platform.monthlyCharge >= 0
  );
}

function isPlatformActive(platform = {}) {
  return normalizeIsActive(platform?.isActive);
}

function bytesToGigabytes(bytes = 0) {
  return Number(bytes || 0) / Math.pow(1024, 3);
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function calculateFinancialMetrics(totalBytes = 0, platform = {}) {
  const totalGb = bytesToGigabytes(totalBytes);
  const monthlyCharge = normalizeOptionalAmount(platform.monthlyCharge);
  const costPerGb = GLOBAL_COST_PER_GB;
  const currency = normalizeCurrency();
  const configured = Number.isFinite(monthlyCharge);

  if (!configured) {
    return {
      totalBytes,
      totalGb,
      monthlyCharge,
      costPerGb,
      currency,
      income: null,
      cost: null,
      margin: null,
      hasFinancialConfig: false,
    };
  }

  const income = roundMoney(monthlyCharge);
  const cost = roundMoney(totalGb * costPerGb);
  const margin = roundMoney(income - cost);

  return {
    totalBytes,
    totalGb,
    monthlyCharge,
    costPerGb,
    currency,
    income,
    cost,
    margin,
    hasFinancialConfig: true,
  };
}

function getMonthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_CURRENCY,
  GLOBAL_COST_PER_GB,
  normalizeUrl,
  slugifyPlatform,
  normalizeCurrency,
  normalizeOptionalAmount,
  normalizeIsActive,
  normalizePlatform,
  readPlatformConfig,
  writePlatformConfig,
  hasFinancialConfig,
  isPlatformActive,
  bytesToGigabytes,
  calculateFinancialMetrics,
  getMonthKey,
};
