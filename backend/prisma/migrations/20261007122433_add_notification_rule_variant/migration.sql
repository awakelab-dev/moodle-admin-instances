-- AlterTable
ALTER TABLE "notification_rules" ADD COLUMN     "variant" TEXT;

-- Los dos índices únicos parciales de la migración anterior
-- (20260921065802_add_notifications_module) solo cubrían (trigger,
-- platform_id) — con "variant" ahora en juego hace falta distinguir entre
-- la fila "normal" (variant IS NULL, el comportamiento de siempre) y las
-- filas de variante (variant = 'positive' | 'negative', como mucho una
-- por combinación trigger+platform+variant).
DROP INDEX "notification_rules_trigger_platform_specific_key";
DROP INDEX "notification_rules_trigger_global_key";

CREATE UNIQUE INDEX "notification_rules_trigger_platform_default_key" ON "notification_rules"("trigger", "platform_id") WHERE "platform_id" IS NOT NULL AND "variant" IS NULL;
CREATE UNIQUE INDEX "notification_rules_trigger_global_default_key" ON "notification_rules"("trigger") WHERE "platform_id" IS NULL AND "variant" IS NULL;
CREATE UNIQUE INDEX "notification_rules_trigger_platform_variant_key" ON "notification_rules"("trigger", "platform_id", "variant") WHERE "platform_id" IS NOT NULL AND "variant" IS NOT NULL;
CREATE UNIQUE INDEX "notification_rules_trigger_global_variant_key" ON "notification_rules"("trigger", "variant") WHERE "platform_id" IS NULL AND "variant" IS NOT NULL;
