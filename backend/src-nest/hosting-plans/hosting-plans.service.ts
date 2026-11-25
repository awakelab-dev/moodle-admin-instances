import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HostingPlanWithPricing {
  key: string;
  name: string;
  diskGb: number;
  baseYear: number;
  basePriceEur: number;
  currentYear: number;
  // Precio del año en curso tal cual se viene arrastrando (base × IPC
  // acumulado año a año desde baseYear) y el mismo precio "sin" el último
  // incremento de IPC aplicado — es decir, el precio del año anterior, que
  // es lo que pidió el cliente: "precio sin IPC sería, por ejemplo en 2026,
  // quitarle un 2,9% al con-IPC de ese año".
  priceWithIpc: number;
  priceWithoutIpc: number;
}

export interface HostingExtraGbRateWithPricing {
  baseYear: number;
  basePriceEur: number;
  currentYear: number;
  priceWithIpc: number;
  priceWithoutIpc: number;
}

// Encadena las tasas de HostingIpcRate desde `baseYear` hasta `targetYear`
// (inclusive) — si falta la tasa de algún año intermedio, se reutiliza la
// última conocida (igual que describe la nota del cliente: "el resto de
// años se irá actualizando conforme salgan los datos"). Standalone (no
// método de instancia) para poder reutilizarla tanto con un HostingPlan
// como con el HostingExtraGbRate, que no comparten tabla.
function computePriceWithIpc(
  basePriceEur: number,
  baseYear: number,
  targetYear: number,
  ratesByYear: Map<number, number>,
): number {
  if (targetYear <= baseYear) return basePriceEur;
  let price = basePriceEur;
  let lastKnownRate = ratesByYear.get(baseYear) ?? 0;
  for (let year = baseYear + 1; year <= targetYear; year++) {
    const rate = ratesByYear.get(year);
    if (rate !== undefined) lastKnownRate = rate;
    price = price * (1 + lastKnownRate / 100);
  }
  return price;
}

@Injectable()
export class HostingPlansService {
  constructor(private prisma: PrismaService) {}

  async listPlans(year?: number): Promise<HostingPlanWithPricing[]> {
    const targetYear = year || new Date().getFullYear();
    const [plans, rates] = await Promise.all([
      this.prisma.hostingPlan.findMany({ orderBy: { basePriceEur: 'asc' } }),
      this.prisma.hostingIpcRate.findMany(),
    ]);
    const ratesByYear = new Map(rates.map((r) => [r.year, Number(r.ratePercent)]));

    return plans.map((plan) => {
      const basePriceEur = Number(plan.basePriceEur);
      const priceWithIpc = computePriceWithIpc(basePriceEur, plan.baseYear, targetYear, ratesByYear);
      const priceWithoutIpc = computePriceWithIpc(basePriceEur, plan.baseYear, targetYear - 1, ratesByYear);
      return {
        key: plan.key,
        name: plan.name,
        diskGb: plan.diskGb,
        baseYear: plan.baseYear,
        basePriceEur,
        currentYear: targetYear,
        priceWithIpc: Math.round(priceWithIpc * 100) / 100,
        priceWithoutIpc: Math.round(priceWithoutIpc * 100) / 100,
      };
    });
  }

  // Precio por GB de exceso sobre el límite del plan contratado ("PAGO POR
  // USO EXTRA" en la tabla enviada) — se usa junto con listPlans() para
  // calcular cuánto gasta de verdad una plataforma que supera su plan: base
  // del plan + (GB usados - GB del plan) × este precio, si es positivo.
  async getExtraGbRate(year?: number): Promise<HostingExtraGbRateWithPricing | null> {
    const targetYear = year || new Date().getFullYear();
    const [rate, rates] = await Promise.all([
      this.prisma.hostingExtraGbRate.findFirst(),
      this.prisma.hostingIpcRate.findMany(),
    ]);
    if (!rate) return null;
    const ratesByYear = new Map(rates.map((r) => [r.year, Number(r.ratePercent)]));
    const basePriceEur = Number(rate.basePriceEur);
    const priceWithIpc = computePriceWithIpc(basePriceEur, rate.baseYear, targetYear, ratesByYear);
    const priceWithoutIpc = computePriceWithIpc(basePriceEur, rate.baseYear, targetYear - 1, ratesByYear);
    return {
      baseYear: rate.baseYear,
      basePriceEur,
      currentYear: targetYear,
      priceWithIpc: Math.round(priceWithIpc * 10000) / 10000,
      priceWithoutIpc: Math.round(priceWithoutIpc * 10000) / 10000,
    };
  }

  async listIpcRates() {
    const rates = await this.prisma.hostingIpcRate.findMany({ orderBy: { year: 'asc' } });
    return rates.map((r) => ({ year: r.year, ratePercent: Number(r.ratePercent) }));
  }
}
