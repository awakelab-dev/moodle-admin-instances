-- CreateTable
CREATE TABLE "hosting_extra_gb_rate" (
    "id" TEXT NOT NULL,
    "base_price_eur" DECIMAL(12,4) NOT NULL,
    "base_year" INTEGER NOT NULL,

    CONSTRAINT "hosting_extra_gb_rate_pkey" PRIMARY KEY ("id")
);

-- Fila de referencia ("PAGO POR USO EXTRA" en la tabla de precios enviada):
-- 0,87 EUR/GB en 2025, igual que los planes se encadena con HostingIpcRate
-- para los anos siguientes.
INSERT INTO "hosting_extra_gb_rate" ("id", "base_price_eur", "base_year") VALUES
  ('a0e1a003-0000-4000-8000-000000000001', 0.87, 2025);
