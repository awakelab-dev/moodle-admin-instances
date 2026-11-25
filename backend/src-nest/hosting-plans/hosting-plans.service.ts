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

@Injectable()
export class HostingPlansService {
  constructor(private prisma: PrismaService) {}

  // Encadena las tasas de HostingIpcRate desde el año base del plan hasta
  // `targetYear` (inclusive) — si falta la tasa de algún año intermedio, se
  // reutiliza la última conocida (igual que describe la nota del cliente:
  // "el resto de años se irá actualizando conforme salgan los datos").
  private async computePriceWithIpc(
    basePriceEur: number,
    baseYear: number,
    targetYear: number,
    ratesByYear: Map<number, number>,
  ): Promise<number> {
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

  async listPlans(year?: number): Promise<HostingPlanWithPricing[]> {
    const targetYear = year || new Date().getFullYear();
    const [plans, rates] = await Promise.all([
      this.prisma.hostingPlan.findMany({ orderBy: { basePriceEur: 'asc' } }),
      this.prisma.hostingIpcRate.findMany(),
    ]);
    const ratesByYear = new Map(rates.map((r) => [r.year, Number(r.ratePercent)]));

    return Promise.all(
      plans.map(async (plan) => {
        const basePriceEur = Number(plan.basePriceEur);
        const priceWithIpc = await this.computePriceWithIpc(basePriceEur, plan.baseYear, targetYear, ratesByYear);
        const priceWithoutIpc = await this.computePriceWithIpc(
          basePriceEur,
          plan.baseYear,
          targetYear - 1,
          ratesByYear,
        );
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
      }),
    );
  }

  async listIpcRates() {
    const rates = await this.prisma.hostingIpcRate.findMany({ orderBy: { year: 'asc' } });
    return rates.map((r) => ({ year: r.year, ratePercent: Number(r.ratePercent) }));
  }
}
