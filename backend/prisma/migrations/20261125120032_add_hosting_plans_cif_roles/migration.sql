-- AlterEnum
ALTER TYPE "AuthRole" ADD VALUE 'config_viewer';

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "cif" TEXT,
ADD COLUMN     "client_name" TEXT,
ADD COLUMN     "hosting_plan_key" TEXT;

-- CreateTable
CREATE TABLE "hosting_plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disk_gb" INTEGER NOT NULL,
    "base_price_eur" DECIMAL(12,2) NOT NULL,
    "base_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hosting_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosting_ipc_rates" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rate_percent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "hosting_ipc_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hosting_plans_key_key" ON "hosting_plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "hosting_ipc_rates_year_key" ON "hosting_ipc_rates"("year");

-- AddForeignKey
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_hosting_plan_key_fkey" FOREIGN KEY ("hosting_plan_key") REFERENCES "hosting_plans"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- Catalogo inicial de planes de hosting, tal cual la tabla "PLANES Y PRECIOS
-- HOSTING" enviada (30/50/80 GB, precio base 2025). Se mete aqui (y no en un
-- script de seed aparte) para que exista automaticamente en cualquier
-- entorno donde se aplique esta migracion, incluida produccion.
INSERT INTO "hosting_plans" ("id", "key", "name", "disk_gb", "base_price_eur", "base_year", "updated_at") VALUES
  ('a0e1a001-0000-4000-8000-000000000001', 'BASIC', 'Basic', 30, 625.68, 2025, CURRENT_TIMESTAMP),
  ('a0e1a001-0000-4000-8000-000000000002', 'PROFESSIONAL', 'Professional', 50, 1152.36, 2025, CURRENT_TIMESTAMP),
  ('a0e1a001-0000-4000-8000-000000000003', 'EXPERT', 'Expert', 80, 2053.92, 2025, CURRENT_TIMESTAMP);

-- Tasa de IPC interanual aplicada cada ano (2,90% segun "TABLA EVOLUCION IPC
-- INTERANUAL" — el dato de 2025 es el real/actualizado, el resto son
-- provisionales hasta tener el dato real de cada ano, ver comentario en
-- HostingIpcRate).
INSERT INTO "hosting_ipc_rates" ("id", "year", "rate_percent") VALUES
  ('a0e1a002-0000-4000-8000-000000000025', 2025, 2.90),
  ('a0e1a002-0000-4000-8000-000000000026', 2026, 2.90),
  ('a0e1a002-0000-4000-8000-000000000027', 2027, 2.90),
  ('a0e1a002-0000-4000-8000-000000000028', 2028, 2.90);
