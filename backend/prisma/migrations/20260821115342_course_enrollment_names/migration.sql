-- AlterTable
ALTER TABLE "course_enrollments" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "firstname" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastname" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "username" TEXT NOT NULL DEFAULT '';
