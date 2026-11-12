import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSurveyCampaignDto } from './dto/create-survey-campaign.dto';

// Encuestas de calidad de curso: cada campaña manda, por EMAIL REAL
// inmediato (no mensajería interna de Moodle — se probó que eso no
// garantiza entrega instantánea, depende del cron y de preferencias por
// usuario), el link de una encuesta externa (Typeform/Google Form) el día
// de inicio del curso y los días siguientes configurados.
//
// El envío en sí NO lo dispara este backend: lo hace el plugin
// local_courseprogressnotify ya instalado en cada plataforma (mismo
// mecanismo probado que las notificaciones de progreso, que llama a
// email_to_user() de Moodle directamente). Este servicio solo expone, vía
// SurveysPluginController, qué campañas tienen un envío pendiente HOY para
// la plataforma que pregunta, y registra el resultado que el plugin reporta
// después de intentarlo — igual que NotificationsService con
// getConfigForPlatform/reportDelivery. Por eso toda campaña necesita una
// plataforma con la API key de notificaciones ya generada (Configuración >
// Plataformas > Gestión de Notificaciones > Conexión).
@Injectable()
export class SurveysService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.surveyCampaign.findMany({
      include: { platform: { select: { id: true, name: true } }, _count: { select: { sends: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { id },
      include: { platform: { select: { id: true, name: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    const sends = await this.prisma.surveyCampaignSend.findMany({
      where: { campaignId: id },
      orderBy: [{ dayIndex: 'asc' }, { recipientEmail: 'asc' }],
    });
    return { ...campaign, sends };
  }

  async create(dto: CreateSurveyCampaignDto) {
    if (dto.recipientSource === 'manual' && !dto.manualRecipients?.length) {
      throw new BadRequestException('manualRecipients es obligatorio cuando recipientSource = manual');
    }
    if (dto.recipientSource === 'course_enrollment' && (!dto.platformId || dto.courseId == null)) {
      throw new BadRequestException('platformId y courseId son obligatorios cuando recipientSource = course_enrollment');
    }
    if (!dto.platformId) {
      throw new BadRequestException('platformId es obligatorio: es la plataforma Moodle desde la que se manda el correo');
    }
    const platform = await this.prisma.platform.findUnique({ where: { id: dto.platformId } });
    if (!platform?.notificationsApiKeyHash) {
      throw new BadRequestException(
        'Esa plataforma todavía no tiene generada la API key de notificaciones (Configuración > Plataformas > Gestión de Notificaciones > Conexión) — el plugin la necesita para poder recoger y mandar la encuesta.',
      );
    }

    return this.prisma.surveyCampaign.create({
      data: {
        name: dto.name,
        surveyUrl: dto.surveyUrl,
        messageTemplate: dto.messageTemplate || undefined,
        recipientSource: dto.recipientSource,
        manualRecipients: dto.recipientSource === 'manual' ? dto.manualRecipients! : [],
        platformId: dto.platformId,
        courseId: dto.recipientSource === 'course_enrollment' ? dto.courseId : null,
        startDate: new Date(dto.startDate),
        daysCount: dto.daysCount ?? 5,
      },
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensureExists(id);
    return this.prisma.surveyCampaign.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.surveyCampaign.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExists(id: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return campaign;
  }

  /**
   * Llamado por el plugin (GET /api/surveys/plugin/campaigns) al principio
   * de su tarea programada: devuelve, para esta plataforma, las campañas
   * activas cuyo día de envío es HOY, con todo lo que el plugin necesita
   * para resolver destinatarios y mandar el correo sin más vueltas.
   */
  async getDueCampaignsForPlatform(platformId: string) {
    const campaigns = await this.prisma.surveyCampaign.findMany({
      where: { platformId, isActive: true },
    });
    return campaigns
      .map((c) => ({ campaign: c, dayIndex: this.dayIndexForToday(c.startDate, c.daysCount) }))
      .filter((c) => c.dayIndex !== null)
      .map(({ campaign, dayIndex }) => ({
        campaignId: campaign.id,
        dayIndex,
        recipientSource: campaign.recipientSource,
        manualRecipients: campaign.manualRecipients,
        courseId: campaign.courseId,
        surveyUrl: campaign.surveyUrl,
        messageTemplate: campaign.messageTemplate,
      }));
  }

  /** null si hoy está fuera del rango [startDate, startDate + daysCount - 1] de la campaña. */
  private dayIndexForToday(startDate: Date, daysCount: number): number | null {
    const today = this.dateOnly(new Date());
    const start = this.dateOnly(startDate);
    const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000);
    if (diffDays < 0 || diffDays > daysCount - 1) return null;
    return diffDays;
  }

  private dateOnly(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /**
   * Llamado por el plugin (POST /api/surveys/plugin/log) justo después de
   * intentar cada envío (éxito o fallo), en lote. La deduplicación real ya
   * la garantiza la tabla local del plugin (local_courseprogressnotify_log)
   * — esto solo centraliza el seguimiento para verlo en Insights.
   */
  async reportPluginLog(
    platformId: string,
    results: { campaignId: string; dayIndex: number; recipientEmail: string; moodleUserId?: number; success: boolean; errorMessage?: string }[],
  ) {
    for (const r of results) {
      const campaign = await this.prisma.surveyCampaign.findUnique({ where: { id: r.campaignId } });
      if (!campaign || campaign.platformId !== platformId) continue; // una plataforma no puede reportar logs de la campaña de otra
      try {
        await this.prisma.surveyCampaignSend.create({
          data: {
            campaignId: r.campaignId,
            dayIndex: r.dayIndex,
            recipientEmail: r.recipientEmail,
            moodleUserId: r.moodleUserId ?? null,
            success: r.success,
            errorMessage: r.errorMessage ?? null,
          },
        });
      } catch {
        // Ya existe un registro para esta campaña+día+destinatario — se ignora (el plugin reintentó o corrió dos veces).
      }
    }
    return { ok: true };
  }
}
