-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD');

-- CreateEnum
CREATE TYPE "AuthRole" AS ENUM ('admin', 'limited');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "monthly_charge" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "moodle_name" TEXT NOT NULL,
    "course_id" INTEGER NOT NULL,
    "course_name" TEXT NOT NULL,
    "shortname" TEXT NOT NULL DEFAULT '',
    "category_id" INTEGER NOT NULL,
    "category_name" TEXT NOT NULL DEFAULT 'Sin categoría',
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "backup_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "assignment_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "forum_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "detailed_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "detailed_backup_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "detailed_assignment_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "detailed_forum_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "detailed_total_bytes" BIGINT NOT NULL DEFAULT 0,
    "detailed_calculated_at" TIMESTAMP(3),
    "storage_breakdown" JSONB NOT NULL DEFAULT '[]',
    "detailed_storage_breakdown" JSONB NOT NULL DEFAULT '[]',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle_users" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "moodle_name" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "fullname" TEXT NOT NULL DEFAULT '',
    "total_size_bytes" BIGINT NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodle_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_snapshots" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "moodle_name" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "total_bytes" BIGINT NOT NULL DEFAULT 0,
    "monthly_charge" DECIMAL(12,2),
    "cost_per_gb" DECIMAL(12,4),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "income" DECIMAL(12,2),
    "cost" DECIMAL(12,2),
    "margin" DECIMAL(12,2),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'running',
    "platforms_total" INTEGER NOT NULL DEFAULT 0,
    "platforms_synced" INTEGER NOT NULL DEFAULT 0,
    "current_platform" TEXT NOT NULL DEFAULT '',
    "sync_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "AuthRole" NOT NULL DEFAULT 'limited',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "courses_category_id_idx" ON "courses"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_platform_id_course_id_key" ON "courses"("platform_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "moodle_users_platform_id_user_id_key" ON "moodle_users"("platform_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_snapshots_platform_id_month_key" ON "platform_snapshots"("platform_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_username_key" ON "auth_users"("username");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_users" ADD CONSTRAINT "moodle_users_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_snapshots" ADD CONSTRAINT "platform_snapshots_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
