const { z } = require('zod');
const prisma = require('../lib/prisma');
const {
  dateFromMonthKey,
  monthKeyFromDate,
  parseInputDate,
  utcDate,
  utcToday,
  daysInMonth,
} = require('../lib/dates');
const divisaService = require('./divisa.service');
const gastoService = require('./gasto.service');
const cicloService = require('./cicloFacturacion.service');
const cuotaService = require('./cuota.service');

const gastoFijoSchema = z.object({
  descripcion: z.string().min(1).max(200),
  divisaId: z.string().min(1),
  medioPago: z.enum(['TARJETA', 'EFECTIVO', 'DEBITO']),
  tarjetaId: z.string().optional().or(z.literal('')),
  cuentaId: z.string().optional().or(z.literal('')),
  monto: z.coerce.number().positive(),
  diaDelMes: z.coerce.number().int().min(1).max(28).default(1),
  vigenteDesde: z.string().min(1),
  tipoGastoId: z.string().optional().or(z.literal('')),
});

const historialSchema = z.object({
  monto: z.coerce.number().positive(),
  vigenteDesde: z.string().min(1),
});

const overrideSchema = z.object({
  monthKey: z.string().min(1),
  omitido: z.union([z.boolean(), z.string(), z.undefined()]).optional()
    .transform((v) => v === true || v === 'true' || v === 'on'),
  montoOverride: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().positive().optional(),
  ),
});

async function listByUser(userId) {
  return prisma.gastoFijo.findMany({
    where: { usuarioId: userId },
    include: {
      divisa: true,
      tarjeta: true,
      cuenta: true,
      historial: { orderBy: { vigenteDesde: 'desc' }, include: { divisa: true } },
      overrides: { orderBy: { mesReferencia: 'desc' } },
    },
    orderBy: { descripcion: 'asc' },
  });
}

function resolveMontoFromHistorial(historial, mesRef) {
  const vigentes = historial
    .filter((h) => h.vigenteDesde <= mesRef)
    .sort((a, b) => b.vigenteDesde - a.vigenteDesde);
  return vigentes[0] ? Number(vigentes[0].monto) : null;
}

async function create(userId, rawData) {
  const parsed = gastoFijoSchema.parse(rawData);
  const vigenteDesde = parseInputDate(parsed.vigenteDesde);
  if (!vigenteDesde) throw new Error('Fecha vigente inválida');

  if (parsed.medioPago === 'TARJETA' && !parsed.tarjetaId) {
    throw new Error('Seleccioná una tarjeta');
  }
  if (parsed.medioPago === 'DEBITO' && !parsed.cuentaId) {
    throw new Error('Seleccioná una cuenta para débito');
  }

  return prisma.$transaction(async (tx) => {
    const fijo = await tx.gastoFijo.create({
      data: {
        usuarioId: userId,
        descripcion: parsed.descripcion,
        divisaId: parsed.divisaId,
        medioPago: parsed.medioPago,
        tarjetaId: parsed.medioPago === 'TARJETA' ? parsed.tarjetaId : null,
        cuentaId: parsed.cuentaId || null,
        diaDelMes: parsed.diaDelMes,
        vigenteDesde: dateFromMonthKey(monthKeyFromDate(vigenteDesde)),
        tipoGastoId: parsed.tipoGastoId || null,
      },
    });

    await tx.historialMonto.create({
      data: {
        gastoFijoId: fijo.id,
        monto: parsed.monto,
        divisaId: parsed.divisaId,
        vigenteDesde: dateFromMonthKey(monthKeyFromDate(vigenteDesde)),
      },
    });

    return fijo;
  });
}

async function addHistorial(userId, gastoFijoId, rawData) {
  const parsed = historialSchema.parse(rawData);
  const vigenteDesde = parseInputDate(parsed.vigenteDesde);
  if (!vigenteDesde) throw new Error('Fecha vigente inválida');

  const fijo = await prisma.gastoFijo.findFirst({
    where: { id: gastoFijoId, usuarioId: userId },
  });
  if (!fijo) throw new Error('Gasto fijo no encontrado');

  return prisma.historialMonto.create({
    data: {
      gastoFijoId: fijo.id,
      monto: parsed.monto,
      divisaId: fijo.divisaId,
      vigenteDesde: dateFromMonthKey(monthKeyFromDate(vigenteDesde)),
    },
  });
}

async function setMesOverride(userId, gastoFijoId, rawData) {
  const parsed = overrideSchema.parse(rawData);
  const mesReferencia = dateFromMonthKey(parsed.monthKey);

  const fijo = await prisma.gastoFijo.findFirst({
    where: { id: gastoFijoId, usuarioId: userId },
  });
  if (!fijo) throw new Error('Gasto fijo no encontrado');

  return prisma.gastoFijoMes.upsert({
    where: {
      gastoFijoId_mesReferencia: { gastoFijoId: fijo.id, mesReferencia },
    },
    create: {
      gastoFijoId: fijo.id,
      mesReferencia,
      omitido: Boolean(parsed.omitido),
      montoOverride: parsed.montoOverride ?? null,
    },
    update: {
      omitido: Boolean(parsed.omitido),
      montoOverride: parsed.montoOverride ?? null,
    },
  });
}

async function generateGastoFromFijo(userId, fijo, monthKey, historial, override) {
  const mesRef = dateFromMonthKey(monthKey);
  const [year, month] = monthKey.split('-').map(Number);

  if (fijo.vigenteDesde > mesRef) return null;

  if (override?.omitido) return null;

  const existing = await prisma.gasto.findFirst({
    where: { gastoFijoId: fijo.id, mesGenerado: mesRef },
  });
  if (existing) return existing;

  const monto = override?.montoOverride != null
    ? Number(override.montoOverride)
    : resolveMontoFromHistorial(historial, mesRef);

  if (!monto) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(fijo.diaDelMes, lastDay);
  const fechaCompra = utcDate(year, month, day);

  if (fijo.medioPago !== 'TARJETA' && fechaCompra > utcToday()) {
    return null;
  }

  const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
    userId,
    fijo.divisaId,
    monto,
  );

  if (fijo.medioPago === 'TARJETA') {
    const tarjeta = await cicloService.getTarjetaForUser(fijo.tarjetaId, userId);
    return prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data: {
          usuarioId: userId,
          tarjetaId: tarjeta.id,
          montoOriginal: monto,
          divisaId: fijo.divisaId,
          tasaConversion,
          montoPrincipal,
          fechaCompra,
          descripcion: fijo.descripcion,
          tipoGastoId: fijo.tipoGastoId,
          medioPago: 'TARJETA',
          cantidadCuotas: 1,
          gastoFijoId: fijo.id,
          mesGenerado: mesRef,
        },
      });
      await cuotaService.generateCuotasForGasto(gasto, tarjeta, tx);
      return gasto;
    });
  }

  return gastoService.createEfectivoDebitoGasto(userId, {
    medioPago: fijo.medioPago,
    montoOriginal: monto,
    divisaId: fijo.divisaId,
    fechaCompra: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    descripcion: fijo.descripcion,
    cuentaId: fijo.cuentaId || '',
  }, { gastoFijoId: fijo.id, mesGenerado: mesRef });
}

async function generateForMonth(userId, monthKey) {
  const mesRef = dateFromMonthKey(monthKey);

  const fijos = await prisma.gastoFijo.findMany({
    where: { usuarioId: userId, activo: true },
    include: {
      historial: { orderBy: { vigenteDesde: 'asc' } },
      overrides: { where: { mesReferencia: mesRef } },
    },
  });

  for (const fijo of fijos) {
    const override = fijo.overrides[0] || null;
    await generateGastoFromFijo(userId, fijo, monthKey, fijo.historial, override);
  }
}

async function previewPendingCashForMonth(userId, monthKey) {
  const mesRef = dateFromMonthKey(monthKey);
  const today = utcToday();
  const [year, month] = monthKey.split('-').map(Number);

  const fijos = await prisma.gastoFijo.findMany({
    where: {
      usuarioId: userId,
      activo: true,
      medioPago: { in: ['EFECTIVO', 'DEBITO'] },
    },
    include: {
      historial: { orderBy: { vigenteDesde: 'asc' } },
      overrides: { where: { mesReferencia: mesRef } },
      cuenta: true,
      divisa: true,
      tipoGasto: true,
    },
  });

  const items = [];
  for (const fijo of fijos) {
    if (fijo.vigenteDesde > mesRef) continue;
    const override = fijo.overrides[0] || null;
    if (override?.omitido) continue;

    const existing = await prisma.gasto.findFirst({
      where: { gastoFijoId: fijo.id, mesGenerado: mesRef },
    });
    if (existing) continue;

    const day = Math.min(fijo.diaDelMes, daysInMonth(year, month));
    const fecha = utcDate(year, month, day);
    if (!(fecha > today)) continue;

    const monto = override?.montoOverride != null
      ? Number(override.montoOverride)
      : resolveMontoFromHistorial(fijo.historial, mesRef);
    if (!monto) continue;

    const { montoPrincipal } = await divisaService.resolveMontoPrincipal(
      userId,
      fijo.divisaId,
      monto,
    );

    items.push({
      id: `preview-gf-${fijo.id}`,
      descripcion: fijo.descripcion,
      cuenta: fijo.cuenta?.nombre || 'Sin cuenta',
      monto,
      montoPrincipal,
      simbolo: fijo.divisa.simbolo,
      fecha,
      esFijo: true,
      proyectado: true,
      categoria: fijo.tipoGasto?.nombre || 'Sin categoría',
    });
  }
  return items;
}

async function deactivate(userId, gastoFijoId) {
  const fijo = await prisma.gastoFijo.findFirst({
    where: { id: gastoFijoId, usuarioId: userId },
  });
  if (!fijo) throw new Error('Gasto fijo no encontrado');

  return prisma.gastoFijo.update({
    where: { id: gastoFijoId },
    data: { activo: false },
  });
}

module.exports = {
  gastoFijoSchema,
  historialSchema,
  overrideSchema,
  listByUser,
  create,
  addHistorial,
  setMesOverride,
  generateForMonth,
  previewPendingCashForMonth,
  deactivate,
  resolveMontoFromHistorial,
};
