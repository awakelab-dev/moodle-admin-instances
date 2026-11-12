import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MoodleClient } from '../sync/moodle-client.service';
import { CreateSurveyCampaignDto } from './dto/create-survey-campaign.dto';
import { SurveyRecipientSource } from '@prisma/client';

// Encuestas de calidad de curso: cada campaña manda, vía mensajería interna
// de Moodle (core_message_send_instant_messages, Web Service ya habilitado
// en cualquier plataforma sincronizada — no requiere instalar ningún
// plugin), el link de una encuesta externa (Typeform/Google Form) el día de
// inicio del curso y los días siguientes configurados.
//
// Importante: Moodle solo reenvía un mensaje interno por EMAIL si el
// destinatario tiene esa preferencia activada (o el admin del sitio fuerza
// el canal "Email" para mensajes personales en Administración del sitio >
// Mensajes > Configuración de notificaciones) y, según el sitio, puede
// depender también de que el cron de Moodle esté corriendo. No es tan
// inmediato/fiable como un plugin que llame a email_to_user(), pero no
// necesita instalar nada en la plataforma — esa es la decisión tomada aquí.
@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

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
    if (dto.recipientSource === 'course_enrollment' && dto.courseId == null) {
      throw new BadRequestException('courseId es obligatorio cuando recipientSource = course_enrollment');
    }
    if (!dto.platformId) {
      throw new BadRequestException('platformId es obligatorio: es la plataforma Moodle desde la que se manda el mensaje');
    }
    const platform = await this.prisma.platform.findUnique({ where: { id: dto.platformId } });
    if (!platform?.url || !platform?.token) {
      throw new BadRequestException('Esa plataforma todavía no tiene URL/token de Web Service configurados.');
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

  /** Fuerza el envío del día que toque HOY para una campaña concreta (botón "Enviar ahora"). */
  async sendNow(id: string) {
    const campaign = await this.ensureExists(id);
    const dayIndex = this.dayIndexForToday(campaign.startDate, campaign.daysCount);
    if (dayIndex === null) {
      throw new BadRequestException('Hoy está fuera del rango de fechas de esta campaña (día de inicio + días configurados).');
    }
    return this.sendCampaignDay(campaign, dayIndex);
  }

  /** Cron diario: revisa TODAS las campañas activas y manda, a quien le toque hoy, el que no se le haya mandado ya ese día. */
  @Cron('0 45 9 * * *', { timeZone: 'Europe/Madrid', name: 'daily-survey-campaigns-check' })
  async checkDueCampaigns() {
    const campaigns = await this.prisma.surveyCampaign.findMany({ where: { isActive: true } });
    for (const campaign of campaigns) {
      const dayIndex = this.dayIndexForToday(campaign.startDate, campaign.daysCount);
      if (dayIndex === null) continue;
      try {
        await this.sendCampaignDay(campaign, dayIndex);
      } catch (err: any) {
        this.logger.error(`Campaña ${campaign.id} día ${dayIndex}: ${err?.message || err}`);
      }
    }
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

  private async sendCampaignDay(
    campaign: { id: string; platformId: string | null; recipientSource: SurveyRecipientSource; manualRecipients: string[]; courseId: number | null; surveyUrl: string; messageTemplate: string },
    dayIndex: number,
  ) {
    if (!campaign.platformId) throw new BadRequestException('La campaña no tiene plataforma asociada.');
    const platform = await this.prisma.platform.findUnique({ where: { id: campaign.platformId } });
    if (!platform?.url || !platform?.token) throw new BadRequestException('La plataforma no tiene URL/token configurados.');

    const client = new MoodleClient(platform.url, platform.token);
    const siteInfo = await client.getSiteInfo();
    const ownUserId = Number(siteInfo?.userid ?? 0);

    const recipients = await this.resolveRecipients(client, campaign);
    const results: { recipientEmail: string; moodleUserId: number | null; success: boolean; errorMessage?: string }[] = [];

    for (const recipient of recipients) {
      const alreadySent = await this.prisma.surveyCampaignSend.findUnique({
        where: { campaignId_dayIndex_recipientEmail: { campaignId: campaign.id, dayIndex, recipientEmail: recipient.email } },
      });
      if (alreadySent) continue;

      if (!recipient.id) {
        results.push({ recipientEmail: recipient.email, moodleUserId: null, success: false, errorMessage: 'No existe ningún usuario con ese email en esta plataforma.' });
        continue;
      }
      if (recipient.id === ownUserId) {
        results.push({ recipientEmail: recipient.email, moodleUserId: recipient.id, success: false, errorMessage: 'El destinatario es el mismo usuario dueño del token — Moodle no notifica auto-mensajes.' });
        continue;
      }

      const body = this.replacePlaceholders(campaign.messageTemplate, {
        nombre: recipient.name || recipient.email,
        link: `<a href="${this.escapeHtml(campaign.surveyUrl)}">${this.escapeHtml(campaign.surveyUrl)}</a>`,
      });

      try {
        await client.sendInstantMessage(recipient.id, body, 1);
        results.push({ recipientEmail: recipient.email, moodleUserId: recipient.id, success: true });
      } catch (err: any) {
        results.push({ recipientEmail: recipient.email, moodleUserId: recipient.id, success: false, errorMessage: err?.message || String(err) });
      }
    }

    for (const r of results) {
      try {
        await this.prisma.surveyCampaignSend.create({
          data: {
            campaignId: campaign.id,
            dayIndex,
            recipientEmail: r.recipientEmail,
            moodleUserId: r.moodleUserId,
            success: r.success,
            errorMessage: r.errorMessage ?? null,
          },
        });
      } catch {
        // Carrera entre dos ejecuciones (cron + "enviar ahora" casi a la vez) — el índice único ya evita el duplicado.
      }
    }

    return { dayIndex, sent: results.filter((r) => r.success).length, total: results.length, results };
  }

  private async resolveRecipients(
    client: MoodleClient,
    campaign: { recipientSource: SurveyRecipientSource; manualRecipients: string[]; courseId: number | null },
  ): Promise<{ email: string; id: number | null; name: string }[]> {
    if (campaign.recipientSource === 'course_enrollment') {
      if (campaign.courseId == null) return [];
      const enrolled: any[] = await client.getEnrolledUsers(campaign.courseId);
      return (enrolled || [])
        .filter((u) => (u.roles || []).some((r: any) => r.shortname === 'student'))
        .map((u) => ({ email: u.email, id: u.id, name: u.fullname }));
    }

    const emails = campaign.manualRecipients || [];
    if (!emails.length) return [];
    const found: any[] = await client.getUsersByField('email', emails);
    const byEmail = new Map((found || []).map((u) => [String(u.email).toLowerCase(), u]));
    return emails.map((email) => {
      const u = byEmail.get(email.toLowerCase());
      return { email, id: u ? u.id : null, name: u ? u.fullname : email };
    });
  }

  private replacePlaceholders(template: string, values: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.split(`{{${key}}}`).join(value);
    }
    return result;
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
