const { z } = require('zod');
const prisma = require('../lib/prisma');
const {
  dateFromMonthKey,
  monthKeyFromDate,
  parseInputDate,
  utcDate,
  utcToday,
  daysInMonth,
  formatDbDateInput,
} = require('../lib/dates');
const divisaService = require('./divisa.service');
const movimientoService = require('./movimiento.service');

const ingresoFijoSchema = z.object({
  descripcion: z.string().min(1).max(200),
  cuentaId: z.string().min(1, 'Seleccioná una cuenta'),
  monto: z.coerce.number().positive(),
  diaDelMes: z.coerce.number().int().min(1).max(28).default(1),
  vigenteDesde: z.string().min(1),
  categoriaId: z.string().optional().or(z.literal('')),
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

function resolveMontoFromHistorial(historial, mesRef) {
  const vigentes = historial
    .filter((h) => h.vigenteDesde <= mesRef)
    .sort((a, b) => b.vigenteDesde - a.vigenteDesde);
  return vigentes[0] ? Number(vigentes[0].monto) : null;
}

async function listByUser(userId) {
  return prisma.ingresoFijo.findMany({
    where: { usuarioId: userId },
    include: {
      divisa: true,
      cuenta: true,
      categoria: true,
      historial: { orderBy: { vigenteDesde: 'desc' }, include: { divisa: true } },
      overrides: { orderBy: { mesReferencia: 'desc' } },
    },
    orderBy: { descripcion: 'asc' },
  });
}

async function create(userId, rawData) {
  const parsed = ingresoFijoSchema.parse(rawData);
  const vigenteDesde = parseInputDate(parsed.vigenteDesde);
  if (!vigenteDesde) throw new Error('Fecha vigente inválida');

  const cuenta = await prisma.cuenta.findFirst({
    where: { id: parsed.cuentaId, usuarioId: userId, activa: true },
  });
  if (!cuenta) throw new Error('Cuenta inválida');

  return prisma.$transaction(async (tx) => {
    const fijo = await tx.ingresoFijo.create({
      data: {
        usuarioId: userId,
        descripcion: parsed.descripcion,
        cuentaId: cuenta.id,
        divisaId: cuenta.divisaId,
        categoriaId: parsed.categoriaId || null,
        diaDelMes: parsed.diaDelMes,
        vigenteDesde: dateFromMonthKey(monthKeyFromDate(vigenteDesde)),
      },
    });

    await tx.historialMontoIngreso.create({
      data: {
        ingresoFijoId: fijo.id,
        monto: parsed.monto,
        divisaId: cuenta.divisaId,
        vigenteDesde: dateFromMonthKey(monthKeyFromDate(vigenteDesde)),
      },
    });

    return fijo;
  });
}

async function addHistorial(userId, ingresoFijoId, rawData) {
  const parsed = historialSchema.parse(rawData);
  const vigenteDesde = parseInputDate(parsed.vigenteDesde);
  if (!vigenteDesde) throw new Error('Fecha vigente inválida');

  const fijo = await prisma.ingresoFijo.findFirst({
    where: { id: ingresoFijoId, usuarioId: userId },
  });
  if (!fijo) throw new Error('Ingreso fijo no encontrado');

  return prisma.historialMontoIngreso.create({
    data: {
      ingresoFijoId: fijo.id,
      monto: parsed.monto,
      divisaId: fijo.divisaId,
      vigenteDesde: dateFromMonthKey(monthKeyFromDate(vigenteDesde)),
    },
  });
}

async function setMesOverride(userId, ingresoFijoId, rawData) {
  const parsed = overrideSchema.parse(rawData);
  const mesReferencia = dateFromMonthKey(parsed.monthKey);

  const fijo = await prisma.ingresoFijo.findFirst({
    where: { id: ingresoFijoId, usuarioId: userId },
  });
  if (!fijo) throw new Error('Ingreso fijo no encontrado');

  return prisma.ingresoFijoMes.upsert({
    where: {
      ingresoFijoId_mesReferencia: { ingresoFijoId: fijo.id, mesReferencia },
    },
    create: {
      ingresoFijoId: fijo.id,
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

function buildFecha(monthKey, diaDelMes) {
  const [year, month] = monthKey.split('-').map(Number);
  const day = Math.min(diaDelMes, daysInMonth(year, month));
  return utcDate(year, month, day);
}

async function generateFromFijo(userId, fijo, monthKey, historial, override) {
  const mesRef = dateFromMonthKey(monthKey);
  if (fijo.vigenteDesde > mesRef) return null;
  if (override?.omitido) return null;

  const existing = await prisma.movimiento.findFirst({
    where: { ingresoFijoId: fijo.id, mesGenerado: mesRef },
  });
  if (existing) return existing;

  const fecha = buildFecha(monthKey, fijo.diaDelMes);
  if (fecha > utcToday()) return null;

  const monto = override?.montoOverride != null
    ? Number(override.montoOverride)
    : resolveMontoFromHistorial(historial, mesRef);
  if (!monto) return null;

  return movimientoService.createMovimiento(
    userId,
    fijo.cuentaId,
    {
      tipo: 'INGRESO',
      monto,
      fecha: formatDbDateInput(fecha),
      descripcion: fijo.descripcion,
      categoriaId: fijo.categoriaId || '',
    },
    { ingresoFijoId: fijo.id, mesGenerado: mesRef },
  );
}

async function generateForMonth(userId, monthKey) {
  const mesRef = dateFromMonthKey(monthKey);
  const fijos = await prisma.ingresoFijo.findMany({
    where: { usuarioId: userId, activo: true },
    include: {
      historial: { orderBy: { vigenteDesde: 'asc' } },
      overrides: { where: { mesReferencia: mesRef } },
    },
  });

  for (const fijo of fijos) {
    const override = fijo.overrides[0] || null;
    await generateFromFijo(userId, fijo, monthKey, fijo.historial, override);
  }
}

async function previewPendingForMonth(userId, monthKey) {
  const mesRef = dateFromMonthKey(monthKey);
  const today = utcToday();
  const fijos = await prisma.ingresoFijo.findMany({
    where: { usuarioId: userId, activo: true },
    include: {
      historial: { orderBy: { vigenteDesde: 'asc' } },
      overrides: { where: { mesReferencia: mesRef } },
      cuenta: true,
      divisa: true,
      categoria: true,
    },
  });

  const items = [];
  for (const fijo of fijos) {
    if (fijo.vigenteDesde > mesRef) continue;
    const override = fijo.overrides[0] || null;
    if (override?.omitido) continue;

    const existing = await prisma.movimiento.findFirst({
      where: { ingresoFijoId: fijo.id, mesGenerado: mesRef },
    });
    if (existing) continue;

    const fecha = buildFecha(monthKey, fijo.diaDelMes);
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
      id: `preview-${fijo.id}`,
      descripcion: fijo.descripcion,
      cuenta: fijo.cuenta.nombre,
      monto,
      montoPrincipal,
      simbolo: fijo.divisa.simbolo,
      fecha,
      categoria: fijo.categoria?.nombre || 'Sin categoría',
      esFijo: true,
      proyectado: true,
    });
  }
  return items;
}

async function deactivate(userId, ingresoFijoId) {
  const fijo = await prisma.ingresoFijo.findFirst({
    where: { id: ingresoFijoId, usuarioId: userId },
  });
  if (!fijo) throw new Error('Ingreso fijo no encontrado');

  return prisma.ingresoFijo.update({
    where: { id: ingresoFijoId },
    data: { activo: false },
  });
}

module.exports = {
  ingresoFijoSchema,
  historialSchema,
  overrideSchema,
  listByUser,
  create,
  addHistorial,
  setMesOverride,
  generateForMonth,
  previewPendingForMonth,
  deactivate,
  resolveMontoFromHistorial,
};
