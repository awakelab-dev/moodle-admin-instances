// Funciones de utilidad compartidas por PlatformsService y DashboardService:
// normalización de URLs/nombres de plataforma y cálculo de métricas
// financieras (ingreso/costo/margen) a partir del uso de almacenamiento.

export const GLOBAL_COST_PER_GB = Number(process.env.GLOBAL_COST_PER_GB || 1);

// Quita espacios y la barra final para que la misma URL de Moodle escrita
// con o sin "/" al final se trate siempre como la misma plataforma.
export function normalizeUrl(url = ''): string {
  return String(url).trim().replace(/\/+$/, '');
}

// Rango Unicode de los diacríticos combinados (acentos) que quedan como
// caracteres sueltos tras normalizar con NFD; se eliminan para poder
// generar un slug solo con caracteres ASCII.
const COMBINING_DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

// Genera un slug (solo minúsculas, números y guiones) a partir del nombre
// o la URL de una plataforma, para usarlo como identificador legible.
export function slugifyPlatform(value = ''): string {
  return String(value)
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Convierte un valor de formulario (string, número o vacío) al monto
// numérico a guardar, o null si no viene, está vacío o no es válido
// (negativo o no numérico).
export function normalizeOptionalAmount(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

export function bytesToGigabytes(bytes: number | bigint = 0): number {
  return Number(bytes || 0) / Math.pow(1024, 3);
}

// Redondea a 2 decimales evitando errores de coma flotante (Number.EPSILON)
// antes de mostrar montos de dinero.
export function roundMoney(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

// Calcula ingreso/costo/margen de una plataforma a partir de su tamaño
// total y el cobro mensual configurado. Si no hay monthlyCharge configurado
// (plataforma sin datos financieros), devuelve todos esos campos en null y
// hasFinancialConfig:false, para que el frontend muestre "sin configurar"
// en vez de un 0 engañoso.
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

// Clave "YYYY-MM" en UTC usada para agrupar los snapshots mensuales de
// almacenamiento (un snapshot por plataforma y mes).
export function getMonthKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
