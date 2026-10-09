-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "security_api_key_hash" TEXT;

-- CreateTable
CREATE TABLE "security_suspicious_patterns" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "course_id" INTEGER NOT NULL,
    "course_name" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "user_ids" JSONB NOT NULL,
    "usernames" JSONB NOT NULL,
    "detail_json" JSONB,
    "risk_level" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_suspicious_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_suspicious_patterns_platform_id_idx" ON "security_suspicious_patterns"("platform_id");

-- CreateIndex
CREATE INDEX "security_suspicious_patterns_risk_level_idx" ON "security_suspicious_patterns"("risk_level");

-- AddForeignKey
ALTER TABLE "security_suspicious_patterns" ADD CONSTRAINT "security_suspicious_patterns_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
