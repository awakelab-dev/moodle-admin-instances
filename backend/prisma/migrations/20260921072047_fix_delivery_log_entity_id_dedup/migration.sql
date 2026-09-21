/*
  Warnings:

  - Made the column `entity_id` on table `notification_delivery_log` required. This step will fail if there are existing NULL values in that column.

*/
-- Convierte los NULL existentes (si los hay) a '' antes de exigir NOT NULL,
-- para que esta migracion sea segura tambien contra datos ya insertados
-- (no solo el caso local recien creado sin filas).
UPDATE "notification_delivery_log" SET "entity_id" = '' WHERE "entity_id" IS NULL;

-- AlterTable
ALTER TABLE "notification_delivery_log" ALTER COLUMN "entity_id" SET NOT NULL,
ALTER COLUMN "entity_id" SET DEFAULT '';
