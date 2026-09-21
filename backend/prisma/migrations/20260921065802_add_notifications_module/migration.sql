-- CreateEnum
CREATE TYPE "notification_trigger" AS ENUM ('progress_25', 'progress_50', 'progress_75', 'course_end_soon', 'course_last_day', 'zoom_session', 'presential_exam', 'presential_tutoring', 'diploma_available', 'first_day', 'second_day');

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "notifications_api_key_hash" TEXT;

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "trigger" "notification_trigger" NOT NULL,
    "platform_id" TEXT,
    "template_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_log" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "trigger" "notification_trigger" NOT NULL,
    "course_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity_id" TEXT,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_rules_trigger_platform_id_idx" ON "notification_rules"("trigger", "platform_id");

-- CreateIndex
-- Indices unicos PARCIALES (no expresables con @@unique de Prisma): a lo
-- sumo una regla especifica por (trigger, platform_id) cuando platform_id
-- no es null, y a lo sumo una regla GLOBAL por trigger cuando platform_id
-- SI es null. Un @@unique([trigger, platformId]) normal no serviria para
-- el segundo caso, porque Postgres trata cada NULL como distinto de si
-- mismo en una unique constraint corriente.
CREATE UNIQUE INDEX "notification_rules_trigger_platform_specific_key" ON "notification_rules"("trigger", "platform_id") WHERE "platform_id" IS NOT NULL;
CREATE UNIQUE INDEX "notification_rules_trigger_global_key" ON "notification_rules"("trigger") WHERE "platform_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_log_platform_id_trigger_course_id_use_key" ON "notification_delivery_log"("platform_id", "trigger", "course_id", "user_id", "entity_id");

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
