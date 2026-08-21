-- AlterTable
ALTER TABLE "course_enrollments" ADD COLUMN     "active_enrollment" BOOLEAN,
ADD COLUMN     "activities_completed" INTEGER,
ADD COLUMN     "activities_total" INTEGER,
ADD COLUMN     "course_percentage" TEXT,
ADD COLUMN     "course_score_out_of_10" TEXT,
ADD COLUMN     "evaluations_completed" INTEGER,
ADD COLUMN     "evaluations_total" INTEGER,
ADD COLUMN     "final_grade" TEXT,
ADD COLUMN     "first_access" INTEGER,
ADD COLUMN     "forum_message_count" INTEGER,
ADD COLUMN     "grade_items" JSONB,
ADD COLUMN     "last_access" INTEGER,
ADD COLUMN     "last_course_access" INTEGER,
ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "courses_last_synced_at" TIMESTAMP(3);
