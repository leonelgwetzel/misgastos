-- CreateEnum
CREATE TYPE "TitularidadTarjeta" AS ENUM ('PROPIA', 'TERCERO');

-- CreateEnum
CREATE TYPE "EstadoResumen" AS ENUM ('PENDIENTE', 'PAGADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('TARJETA', 'EFECTIVO', 'DEBITO');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE_FACTURAR', 'COMPROMETIDA', 'PAGADA');

-- CreateEnum
CREATE TYPE "ModoSplit" AS ENUM ('EQUITATIVO', 'PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "EstadoParticipacion" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoConfirmacion" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoDeuda" AS ENUM ('ME_DEBEN', 'DEBO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "divisaPrincipalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Divisa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Divisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaCambioDefault" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "divisaId" TEXT NOT NULL,
    "tasa" DECIMAL(18,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifaCambioDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarjeta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "banco" TEXT,
    "divisaId" TEXT NOT NULL,
    "titularidad" "TitularidadTarjeta" NOT NULL DEFAULT 'PROPIA',
    "defaultCierreDia" INTEGER NOT NULL DEFAULT 25,
    "defaultVencimientoMes" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloFacturacion" (
    "id" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "fechaCierre" DATE NOT NULL,
    "mesVencimiento" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CicloFacturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumenTarjeta" (
    "id" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "mesReferencia" DATE NOT NULL,
    "estado" "EstadoResumen" NOT NULL DEFAULT 'PENDIENTE',
    "pagadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumenTarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nombre" TEXT NOT NULL,
    "esSistema" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoGasto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nombre" TEXT NOT NULL,
    "esSistema" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TipoGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tarjetaId" TEXT,
    "montoOriginal" DECIMAL(18,2) NOT NULL,
    "divisaId" TEXT NOT NULL,
    "tasaConversion" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "montoPrincipal" DECIMAL(18,2) NOT NULL,
    "fechaCompra" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoriaId" TEXT,
    "tipoGastoId" TEXT,
    "medioPago" "MedioPago" NOT NULL,
    "cantidadCuotas" INTEGER NOT NULL DEFAULT 1,
    "esCompartido" BOOLEAN NOT NULL DEFAULT false,
    "gastoFijoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "montoOriginal" DECIMAL(18,2) NOT NULL,
    "divisaId" TEXT NOT NULL,
    "tasaConversion" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "montoPrincipal" DECIMAL(18,2) NOT NULL,
    "mesImpacto" DATE NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'COMPROMETIDA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaExterna" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonaExterna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoParticipante" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "personaExternaId" TEXT,
    "montoPorcion" DECIMAL(18,2) NOT NULL,
    "porcentaje" DECIMAL(5,2),
    "modoSplit" "ModoSplit" NOT NULL,
    "estado" "EstadoParticipacion" NOT NULL DEFAULT 'PENDIENTE',
    "registradorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmacionPendiente" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" "EstadoConfirmacion" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEn" TIMESTAMP(3),

    CONSTRAINT "ConfirmacionPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeudaInformal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "montoOriginal" DECIMAL(18,2) NOT NULL,
    "divisaId" TEXT NOT NULL,
    "tasaConversion" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "montoPrincipal" DECIMAL(18,2) NOT NULL,
    "tipo" "TipoDeuda" NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeudaInformal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Divisa_usuarioId_codigo_key" ON "Divisa"("usuarioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaCambioDefault_usuarioId_divisaId_key" ON "TarifaCambioDefault"("usuarioId", "divisaId");

-- CreateIndex
CREATE UNIQUE INDEX "CicloFacturacion_tarjetaId_mesReferencia_key" ON "CicloFacturacion"("tarjetaId", "mesReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "ResumenTarjeta_tarjetaId_mesReferencia_key" ON "ResumenTarjeta"("tarjetaId", "mesReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_usuarioId_nombre_key" ON "Categoria"("usuarioId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TipoGasto_usuarioId_nombre_key" ON "TipoGasto"("usuarioId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_gastoId_numero_key" ON "Cuota"("gastoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "PersonaExterna_usuarioId_nombre_key" ON "PersonaExterna"("usuarioId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmacionPendiente_gastoId_usuarioId_key" ON "ConfirmacionPendiente"("gastoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_divisaPrincipalId_fkey" FOREIGN KEY ("divisaPrincipalId") REFERENCES "Divisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divisa" ADD CONSTRAINT "Divisa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaCambioDefault" ADD CONSTRAINT "TarifaCambioDefault_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaCambioDefault" ADD CONSTRAINT "TarifaCambioDefault_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarjeta" ADD CONSTRAINT "Tarjeta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarjeta" ADD CONSTRAINT "Tarjeta_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CicloFacturacion" ADD CONSTRAINT "CicloFacturacion_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "Tarjeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenTarjeta" ADD CONSTRAINT "ResumenTarjeta_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "Tarjeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipoGasto" ADD CONSTRAINT "TipoGasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "Tarjeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_tipoGastoId_fkey" FOREIGN KEY ("tipoGastoId") REFERENCES "TipoGasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaExterna" ADD CONSTRAINT "PersonaExterna_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoParticipante" ADD CONSTRAINT "GastoParticipante_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoParticipante" ADD CONSTRAINT "GastoParticipante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoParticipante" ADD CONSTRAINT "GastoParticipante_personaExternaId_fkey" FOREIGN KEY ("personaExternaId") REFERENCES "PersonaExterna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoParticipante" ADD CONSTRAINT "GastoParticipante_registradorId_fkey" FOREIGN KEY ("registradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmacionPendiente" ADD CONSTRAINT "ConfirmacionPendiente_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmacionPendiente" ADD CONSTRAINT "ConfirmacionPendiente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeudaInformal" ADD CONSTRAINT "DeudaInformal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeudaInformal" ADD CONSTRAINT "DeudaInformal_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "PersonaExterna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeudaInformal" ADD CONSTRAINT "DeudaInformal_divisaId_fkey" FOREIGN KEY ("divisaId") REFERENCES "Divisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
