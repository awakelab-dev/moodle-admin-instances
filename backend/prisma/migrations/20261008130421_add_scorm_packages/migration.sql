-- CreateTable
CREATE TABLE "scorm_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "s3_prefix" TEXT NOT NULL,
    "entry_point" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "uploaded_by_user_id" TEXT,
    "uploaded_by_username" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorm_packages_pkey" PRIMARY KEY ("id")
);
