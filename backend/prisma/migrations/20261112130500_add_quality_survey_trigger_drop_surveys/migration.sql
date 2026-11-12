-- AlterEnum
ALTER TYPE "notification_trigger" ADD VALUE 'quality_survey';

-- DropForeignKey
ALTER TABLE "survey_campaign_sends" DROP CONSTRAINT "survey_campaign_sends_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "survey_campaigns" DROP CONSTRAINT "survey_campaigns_platform_id_fkey";

-- AlterTable
ALTER TABLE "platforms" DROP COLUMN "surveys_api_key_hash";

-- DropTable
DROP TABLE "survey_campaign_sends";

-- DropTable
DROP TABLE "survey_campaigns";

-- DropEnum
DROP TYPE "survey_recipient_source";

