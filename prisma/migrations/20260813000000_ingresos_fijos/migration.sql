-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN "ingresoFijoId" TEXT;
ALTER TABLE "Movimiento" ADD COLUMN "mesGenerado" DATE;

-- CreateTable
CREATE TABLE "IngresoFijo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "divisaId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "diaDelMes" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenteDesde" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngresoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialMontoIngreso" (
    "id" TEXT NOT NULL,
    "ingresoFijoId" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "divisaId" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialMontoIngreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngresoFijoMes" (
    "id" TEXT NOT NULL,
    "ingresoFijoId" TEXT NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "omitido" BOOLEAN NOT NULL DEFAULT false,
    "montoOverride" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngresoFijoMes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_ingresoFijoId_mesGenerado_key" ON "Movimiento"("ingresoFijoId", "mesGenerado");

-- CreateIndex
CREATE UNIQUE INDEX "IngresoFijoMes_ingresoFijoId_mesReferencia_key" ON "IngresoFijoMes"("ingresoFijoId", "mesReferencia");

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_ingresoFijoId_fkey" FOREIGN KEY ("ingresoFijoId") REFERENCES "IngresoFijo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoFijo" ADD CONSTRAINT "IngresoFijo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoFijo" ADD CONSTRAINT "IngresoFijo_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoFijo" ADD CONSTRAINT "IngresoFijo_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoFijo" ADD CONSTRAINT "IngresoFijo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMontoIngreso" ADD CONSTRAINT "HistorialMontoIngreso_ingresoFijoId_fkey" FOREIGN KEY ("ingresoFijoId") REFERENCES "IngresoFijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialMontoIngreso" ADD CONSTRAINT "HistorialMontoIngreso_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngresoFijoMes" ADD CONSTRAINT "IngresoFijoMes_ingresoFijoId_fkey" FOREIGN KEY ("ingresoFijoId") REFERENCES "IngresoFijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
