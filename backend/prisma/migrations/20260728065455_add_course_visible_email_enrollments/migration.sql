-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "visible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "moodle_users" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "course_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_enrollments_platform_id_course_id_idx" ON "course_enrollments"("platform_id", "course_id");

-- CreateIndex
CREATE INDEX "course_enrollments_platform_id_user_id_idx" ON "course_enrollments"("platform_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_platform_id_course_id_user_id_key" ON "course_enrollments"("platform_id", "course_id", "user_id");

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
