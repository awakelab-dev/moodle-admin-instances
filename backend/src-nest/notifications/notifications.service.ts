import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UpsertRuleDto } from './dto/upsert-rule.dto';
import { UpsertTriggerVariantsDto } from './dto/upsert-trigger-variants.dto';
import { ReportDeliveryDto } from './dto/report-delivery.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { NOTIFICATION_TRIGGERS } from './notification-triggers.constants';
import type { PublicUser } from '../auth/auth.service';

// Defaults aplicados cuando una plataforma todavía no configuró nada en
// `Platform.notificationSettings` (JSON, ver schema.prisma) — el plugin
// siempre recibe un objeto completo, nunca tiene que adivinar un default
// localmente.
//
// notificationsEnabled empieza en `false` a propósito: es el interruptor
// maestro de envío para ESA plataforma (ver getConfigForPlatform). Así se
// puede generar la API key y conectar el plugin en una Moodle real sin
// ningún riesgo de que empiece a mandar emails solo por estar conectado —
// alguien tiene que activarlo explícitamente aquí, plataforma por
// plataforma, cuando de verdad esté listo.
const DEFAULT_PLATFORM_SETTINGS = {
  courseCustomFieldShortname: 'courseemailnotifications_enabled',
  diplomaOnlyCourseIds: [] as number[],
  notificationsEnabled: false,
  enabledCategoryIds: [] as number[],
};

// Módulo "Gestión de Notificaciones": centraliza en Moodle Insights lo que
// hoy vive disperso en la configuración local del plugin
// local_courseprogressnotify de cada plataforma — qué disparadores están
// activos, qué plantilla usa cada uno y el registro de qué se envió. Ver
// NOTIFICATIONS_INTEGRATION_PLAN.md (raíz del repo) para la arquitectura
// completa. El plugin nunca ve datos de otras plataformas: su API key
// (formato "<platformId>.<secreto>") identifica la plataforma por sí sola
// (ver PlatformApiKeyGuard), sin necesidad de un campo platformId aparte.
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  listTriggers() {
    return NOTIFICATION_TRIGGERS;
  }

  // ─── Plantillas ───

  listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: [{ name: 'asc' }, { language: 'asc' }] });
  }

  async createTemplate(dto: CreateTemplateDto, currentUser: PublicUser) {
    const created = await this.prisma.notificationTemplate.create({ data: dto });
    await this.logTemplateHistory(created.id, created.name, 'created', currentUser, null, created);
    return created;
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto, currentUser: PublicUser) {
    const before = await this.findTemplateOrThrow(id);
    const after = await this.prisma.notificationTemplate.update({ where: { id }, data: dto });
    await this.logTemplateHistory(id, after.name, 'updated', currentUser, before, after);
    return after;
  }

  // Historial de cambios de una plantilla — pedido explícitamente para
  // poder ver quién cambió qué y cuándo, con una foto completa del antes
  // y el después (no solo el campo que cambió).
  listTemplateHistory(templateId: string) {
    return this.prisma.notificationTemplateHistory.findMany({
      where: { templateId },
      orderBy: { changedAt: 'desc' },
    });
  }

  private async logTemplateHistory(
    templateId: string | null,
    templateName: string,
    action: 'created' | 'updated' | 'deleted',
    currentUser: PublicUser,
    previous: { name: string; language: string; subject: string; bodyHtml: string } | null,
    next: { name: string; language: string; subject: string; bodyHtml: string } | null,
  ) {
    await this.prisma.notificationTemplateHistory.create({
      data: {
        templateId,
        templateName,
        action,
        changedByUserId: currentUser?.id ?? null,
        changedByUsername: currentUser?.username ?? 'desconocido',
        previousData: previous
          ? ({ name: previous.name, language: previous.language, subject: previous.subject, bodyHtml: previous.bodyHtml } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        newData: next
          ? ({ name: next.name, language: next.language, subject: next.subject, bodyHtml: next.bodyHtml } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async deleteTemplate(id: string, currentUser: PublicUser) {
    const template = await this.findTemplateOrThrow(id);
    const inUse = await this.prisma.notificationRule.count({ where: { templateId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `Esta plantilla está en uso por ${inUse} regla(s) — quita esas reglas o cámbiales la plantilla antes de eliminarla.`,
      );
    }
    await this.prisma.notificationTemplate.delete({ where: { id } });
    // templateId va a null a propósito: el registro se crea DESPUÉS de
    // borrar la plantilla, así que ya no hay una fila válida a la que
    // apuntar (poner el id borrado violaría la clave foránea). templateName
    // guarda el nombre para que el historial siga siendo legible.
    await this.logTemplateHistory(null, template.name, 'deleted', currentUser, template, null);
    return { message: 'Plantilla eliminada.' };
  }

  private async findTemplateOrThrow(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada.');
    return template;
  }

  // ─── Reglas (disparador ↔ plantilla) ───

  listRules(platformId?: string) {
    return this.prisma.notificationRule.findMany({
      where: platformId ? { OR: [{ platformId }, { platformId: null }] } : undefined,
      include: { template: true, platform: { select: { id: true, name: true } } },
      orderBy: [{ trigger: 'asc' }, { platformId: 'asc' }],
    });
  }

  async upsertRule(dto: UpsertRuleDto) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) throw new NotFoundException('Plantilla no encontrada.');

    const platformId = dto.platformId || null;
    if (platformId) {
      const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
      if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    }

    // No hay un @@unique de Prisma sobre (trigger, platformId) — ver la nota
    // en schema.prisma sobre por qué eso no funcionaría con platformId
    // null (regla global) — así que se resuelve a mano: buscar y
    // actualizar, o crear. La unicidad real la garantizan los dos índices
    // únicos parciales de la migración (create lanzaría P2002 si hay una
    // carrera con otra petición simultánea, lo cual es aceptable aquí: es
    // un panel de administración, no una ruta de alta concurrencia).
    const existing = await this.prisma.notificationRule.findFirst({ where: { trigger: dto.trigger as any, platformId } });
    const params = (dto.params ?? {}) as Prisma.InputJsonValue;
    if (existing) {
      return this.prisma.notificationRule.update({
        where: { id: existing.id },
        data: { templateId: dto.templateId, isActive: dto.isActive ?? true, params },
      });
    }
    return this.prisma.notificationRule.create({
      data: { trigger: dto.trigger as any, platformId, templateId: dto.templateId, isActive: dto.isActive ?? true, params },
    });
  }

  async deleteRule(id: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Regla no encontrada.');
    await this.prisma.notificationRule.delete({ where: { id } });
    return { message: 'Regla eliminada.' };
  }

  // ─── Variantes de plantilla por parámetro (ej. progreso + calificaciones) ───

  // Las 2 filas (variant='positive'/'negative') de un mismo trigger+plataforma
  // comparten el mismo variantParam+threshold en sus `params` — son
  // parámetros del trigger, no de una plantilla en particular, guardados en
  // ambas para que getConfigForPlatform pueda leerlos de cualquiera de las
  // dos sin tener que consultar una tercera tabla.
  async upsertTriggerVariants(dto: UpsertTriggerVariantsDto) {
    const triggerDef = NOTIFICATION_TRIGGERS.find((t) => t.key === dto.trigger) as { variantParams?: readonly string[] } | undefined;
    if (!triggerDef?.variantParams?.length) {
      throw new BadRequestException(`El disparador "${dto.trigger}" no admite plantillas por variante.`);
    }
    if (!triggerDef.variantParams.includes(dto.variantParam)) {
      throw new BadRequestException(`El parámetro "${dto.variantParam}" no es válido para este disparador.`);
    }
    const [positiveTemplate, negativeTemplate] = await Promise.all([
      this.prisma.notificationTemplate.findUnique({ where: { id: dto.positiveTemplateId } }),
      this.prisma.notificationTemplate.findUnique({ where: { id: dto.negativeTemplateId } }),
    ]);
    if (!positiveTemplate) throw new NotFoundException('Plantilla "positiva" no encontrada.');
    if (!negativeTemplate) throw new NotFoundException('Plantilla "negativa" no encontrada.');

    const platformId = dto.platformId || null;
    if (platformId) {
      const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
      if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    }

    const params = { variantParam: dto.variantParam, threshold: dto.threshold } as Prisma.InputJsonValue;
    const upsertVariant = async (variant: 'positive' | 'negative', templateId: string) => {
      const existing = await this.prisma.notificationRule.findFirst({ where: { trigger: dto.trigger as any, platformId, variant } });
      if (existing) {
        return this.prisma.notificationRule.update({ where: { id: existing.id }, data: { templateId, params, isActive: true } });
      }
      return this.prisma.notificationRule.create({
        data: { trigger: dto.trigger as any, platformId, variant, templateId, params, isActive: true },
      });
    };

    const [positive, negative] = await Promise.all([
      upsertVariant('positive', dto.positiveTemplateId),
      upsertVariant('negative', dto.negativeTemplateId),
    ]);
    return { positive, negative };
  }

  // Vuelve el trigger a modo "una sola plantilla" — borra las 2 filas de
  // variante; la regla normal (variant null), si existe, no se toca.
  async deleteTriggerVariants(trigger: string, platformId?: string) {
    await this.prisma.notificationRule.deleteMany({
      where: { trigger: trigger as any, platformId: platformId || null, variant: { not: null } },
    });
    return { message: 'Variantes eliminadas.' };
  }

  // ─── API key del plugin (por plataforma) ───

  // Genera (o rota) la API key de notificaciones de una plataforma. Se
  // devuelve en texto plano UNA sola vez — igual que un token de API
  // normal — porque solo guardamos el hash (bcrypt), nunca el valor real.
  async generateApiKey(platformId: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');

    // "<platformId>.<secreto>": el guard extrae el platformId de aquí
    // mismo, así el plugin no necesita guardar el id como un campo aparte
    // (ver PlatformApiKeyGuard).
    const plainKey = `${platformId}.${randomBytes(32).toString('hex')}`;
    const hash = await bcrypt.hash(plainKey, 10);
    await this.prisma.platform.update({ where: { id: platformId }, data: { notificationsApiKeyHash: hash } });
    return { apiKey: plainKey };
  }

  async revokeApiKey(platformId: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    await this.prisma.platform.update({ where: { id: platformId }, data: { notificationsApiKeyHash: null } });
    return { message: 'API key de notificaciones revocada.' };
  }

  // ─── Ajustes de plataforma (no ligados a un disparador concreto) ───

  async getPlatformSettings(platformId: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    return { ...DEFAULT_PLATFORM_SETTINGS, ...((platform.notificationSettings as object) ?? {}) };
  }

  async updatePlatformSettings(platformId: string, dto: UpdatePlatformSettingsDto) {
    const current = await this.getPlatformSettings(platformId);
    const next = {
      ...current,
      ...(dto.courseCustomFieldShortname !== undefined ? { courseCustomFieldShortname: dto.courseCustomFieldShortname } : {}),
      ...(dto.diplomaOnlyCourseIds !== undefined ? { diplomaOnlyCourseIds: dto.diplomaOnlyCourseIds } : {}),
      ...(dto.notificationsEnabled !== undefined ? { notificationsEnabled: dto.notificationsEnabled } : {}),
      ...(dto.enabledCategoryIds !== undefined ? { enabledCategoryIds: dto.enabledCategoryIds } : {}),
    };
    await this.prisma.platform.update({
      where: { id: platformId },
      data: { notificationSettings: next as Prisma.InputJsonValue },
    });
    return next;
  }

  // Nombres cortos de campo personalizado ya usados en OTRAS plataformas —
  // alimenta el desplegable del formulario de ajustes para reducir el
  // riesgo de typo (la causa más común de "no llega ningún email": el
  // nombre no coincide exactamente con el campo real de esa Moodle). No es
  // una lista en vivo de los campos que existen en Moodle porque esa
  // consulta necesitaría una función de Web Service que no todas las
  // ~24 plataformas reales tienen habilitada en su token (ver
  // NOTIFICATIONS_INTEGRATION_PLAN.md) — así que se ofrece como sugerencia
  // editable, no como una lista cerrada.
  async listKnownCustomFieldShortnames(): Promise<string[]> {
    const platforms = await this.prisma.platform.findMany({ select: { notificationSettings: true } });
    const values = new Set<string>([DEFAULT_PLATFORM_SETTINGS.courseCustomFieldShortname]);
    for (const p of platforms) {
      const shortname = (p.notificationSettings as any)?.courseCustomFieldShortname;
      if (typeof shortname === 'string' && shortname.trim()) {
        values.add(shortname.trim());
      }
    }
    return Array.from(values).sort();
  }

  // Cursos sincronizados de la plataforma, para el selector de "solo
  // diploma" — reutiliza los datos que ya trae el sync de Cursos y Alumnos,
  // no hace falta llamar a Moodle en vivo.
  async listPlatformCourses(platformId: string) {
    const courses = await this.prisma.course.findMany({
      where: { platformId },
      select: { courseId: true, courseName: true },
      orderBy: { courseName: 'asc' },
    });
    return courses;
  }

  // Categorías distintas de Moodle presentes entre los cursos sincronizados
  // de la plataforma — para el selector de "categorías habilitadas" en
  // Ajustes por plataforma (enabledCategoryIds).
  async listPlatformCategories(platformId: string) {
    const courses = await this.prisma.course.findMany({
      where: { platformId },
      select: { categoryId: true, categoryName: true },
      distinct: ['categoryId'],
      orderBy: { categoryName: 'asc' },
    });
    return courses;
  }

  // ─── Llamadas del plugin (autenticadas por PlatformApiKeyGuard) ───

  // Reglas activas para ESA plataforma: las específicas suyas tienen
  // prioridad sobre las globales del mismo trigger (una plataforma nunca
  // recibe las dos a la vez para un mismo disparador).
  async getConfigForPlatform(platformId: string) {
    const settings = await this.getPlatformSettings(platformId);

    // Interruptor maestro: con esto en false, el plugin de esa plataforma
    // recibe cero disparadores aunque haya reglas/plantillas activas — así
    // se puede conectar (API key pegada) sin ningún riesgo de envío hasta
    // que alguien lo active aquí explícitamente. No hace falta tocar
    // ninguna regla ni plantilla para "pausar" una plataforma.
    if (!settings.notificationsEnabled) {
      return { triggers: [], settings };
    }

    const rules = await this.prisma.notificationRule.findMany({
      where: { isActive: true, OR: [{ platformId }, { platformId: null }] },
      include: { template: true },
    });

    // Las reglas "normales" (variant null) y las de variante (positive/
    // negative) se resuelven por separado — un trigger puede tener solo
    // una normal, solo las 2 variantes, o (si alguien las dejó a medias)
    // ninguna de las dos.
    const defaultByTrigger = new Map<string, (typeof rules)[number]>();
    const variantsByTrigger = new Map<string, Map<string, (typeof rules)[number]>>();
    const prefersNewRule = (existing: (typeof rules)[number] | undefined, candidate: (typeof rules)[number]) =>
      !existing || (existing.platformId === null && candidate.platformId !== null);

    for (const rule of rules) {
      if (rule.variant) {
        const byVariant = variantsByTrigger.get(rule.trigger) ?? new Map<string, (typeof rules)[number]>();
        if (prefersNewRule(byVariant.get(rule.variant), rule)) byVariant.set(rule.variant, rule);
        variantsByTrigger.set(rule.trigger, byVariant);
      } else if (prefersNewRule(defaultByTrigger.get(rule.trigger), rule)) {
        defaultByTrigger.set(rule.trigger, rule);
      }
    }

    const triggerKeys = new Set<string>([...defaultByTrigger.keys(), ...variantsByTrigger.keys()]);
    const toTemplatePayload = (rule: (typeof rules)[number]) => ({
      language: rule.template.language,
      subject: rule.template.subject,
      bodyHtml: rule.template.bodyHtml,
    });

    return {
      triggers: Array.from(triggerKeys).map((key) => {
        const defaultRule = defaultByTrigger.get(key);
        const variantRules = variantsByTrigger.get(key);
        const entry: Record<string, unknown> = {
          trigger: key,
          params: defaultRule?.params ?? {},
        };
        if (defaultRule) entry.template = toTemplatePayload(defaultRule);
        if (variantRules?.size) {
          const anyVariantRule = variantRules.values().next().value as (typeof rules)[number];
          const variantParams = anyVariantRule.params as { variantParam?: string; threshold?: number };
          entry.variantParam = variantParams?.variantParam ?? null;
          entry.threshold = variantParams?.threshold ?? 50;
          entry.variants = Object.fromEntries(
            Array.from(variantRules.entries()).map(([variant, rule]) => [variant, toTemplatePayload(rule)]),
          );
        }
        return entry;
      }),
      settings,
    };
  }

  async reportDelivery(platformId: string, dto: ReportDeliveryDto) {
    let logged = 0;
    let duplicates = 0;
    for (const result of dto.results) {
      try {
        await this.prisma.notificationDeliveryLog.create({
          data: {
            platformId,
            trigger: result.trigger as any,
            courseId: result.courseId,
            userId: result.userId,
            // '' (no null) para triggers sin entidad — el indice unico de
            // deduplicacion incluye entityId, y NULL no es igual a si mismo
            // en una unique constraint normal de Postgres (dos reintentos
            // con entityId ausente no colisionarian si se guardara null).
            entityId: result.entityId ?? '',
            success: result.success,
            errorMessage: result.errorMessage ?? null,
          },
        });
        logged += 1;
      } catch (err: any) {
        // Índice único (deduplicación): un reintento del plugin para un
        // envío ya registrado no debe romper el resto del lote.
        if (err.code === 'P2002') {
          duplicates += 1;
          continue;
        }
        throw err;
      }
    }
    return { logged, duplicates };
  }

  // ─── Seguimiento (panel del dashboard) ───

  async listDeliveryLog(params: { platformId?: string; trigger?: string; limit?: number }) {
    return this.prisma.notificationDeliveryLog.findMany({
      where: {
        platformId: params.platformId,
        trigger: params.trigger as any,
      },
      include: { platform: { select: { id: true, name: true } } },
      orderBy: { sentAt: 'desc' },
      take: Math.min(params.limit ?? 200, 1000),
    });
  }
}
