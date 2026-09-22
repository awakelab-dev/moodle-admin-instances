-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "notification_settings" JSONB NOT NULL DEFAULT '{}';
