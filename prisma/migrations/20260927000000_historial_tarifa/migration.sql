-- CreateTable
CREATE TABLE "HistorialTarifaCambio" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "divisaId" TEXT NOT NULL,
    "tasa" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialTarifaCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistorialTarifaCambio_divisaId_createdAt_idx" ON "HistorialTarifaCambio"("divisaId", "createdAt");

-- AddForeignKey
ALTER TABLE "HistorialTarifaCambio" ADD CONSTRAINT "HistorialTarifaCambio_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill current rates as the first log entry
INSERT INTO "HistorialTarifaCambio" ("id", "usuarioId", "divisaId", "tasa", "createdAt")
SELECT concat('ht_', "id"), "usuarioId", "divisaId", "tasa", "updatedAt"
FROM "TarifaCambioDefault";
