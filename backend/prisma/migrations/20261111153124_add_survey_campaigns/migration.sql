-- CreateEnum
CREATE TYPE "survey_recipient_source" AS ENUM ('manual', 'course_enrollment');

-- CreateTable
CREATE TABLE "survey_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "survey_url" TEXT NOT NULL,
    "message_template" TEXT NOT NULL DEFAULT 'Hola {{nombre}}, nos gustaría conocer tu opinión sobre el curso. Por favor completa esta breve encuesta: {{link}}',
    "recipient_source" "survey_recipient_source" NOT NULL DEFAULT 'manual',
    "manual_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platform_id" TEXT,
    "course_id" INTEGER,
    "start_date" DATE NOT NULL,
    "days_count" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_campaign_sends" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "moodle_user_id" INTEGER,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_campaign_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_campaign_sends_campaign_id_day_index_recipient_email_key" ON "survey_campaign_sends"("campaign_id", "day_index", "recipient_email");

-- AddForeignKey
ALTER TABLE "survey_campaigns" ADD CONSTRAINT "survey_campaigns_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_campaign_sends" ADD CONSTRAINT "survey_campaign_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "survey_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
