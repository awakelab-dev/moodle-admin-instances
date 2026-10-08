-- CreateEnum
CREATE TYPE "notification_template_history_action" AS ENUM ('created', 'updated', 'deleted');

-- CreateTable
CREATE TABLE "notification_template_history" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "action" "notification_template_history_action" NOT NULL,
    "template_name" TEXT NOT NULL,
    "previous_data" JSONB,
    "new_data" JSONB,
    "changed_by_user_id" TEXT,
    "changed_by_username" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_template_history_template_id_idx" ON "notification_template_history"("template_id");

-- AddForeignKey
ALTER TABLE "notification_template_history" ADD CONSTRAINT "notification_template_history_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
