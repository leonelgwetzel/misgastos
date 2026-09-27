const { z } = require('zod');
const prisma = require('../lib/prisma');
const { roundMoney } = require('../lib/money');
const { parseInputDate } = require('../lib/dates');
const divisaService = require('./divisa.service');
const cuentaService = require('./cuenta.service');

const movimientoSchema = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO']),
  monto: z.coerce.number().positive('Monto debe ser positivo'),
  fecha: z.string().min(1),
  descripcion: z.string().max(200).optional().or(z.literal('')),
  categoriaId: z.string().optional().or(z.literal('')),
});

const ajusteSchema = z.object({
  saldoReal: z.coerce.number(),
});

async function listByCuenta(userId, cuentaId, { limit = 50 } = {}) {
  await cuentaService.getForUser(cuentaId, userId);
  return prisma.movimiento.findMany({
    where: { cuentaId, usuarioId: userId },
    include: { divisa: true, categoria: true },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
}

async function createMovimiento(userId, cuentaId, rawData, { gastoId, ingresoFijoId, mesGenerado } = {}, tx = null) {
  const parsed = movimientoSchema.parse(rawData);
  const fecha = parseInputDate(parsed.fecha);
  if (!fecha) throw new Error('Fecha inválida');

  const cuenta = await cuentaService.getForUser(cuentaId, userId);
  const monto = roundMoney(parsed.monto);

  const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
    userId,
    cuenta.divisaId,
    monto,
  );

  const run = async (db) => {
    const movimiento = await db.movimiento.create({
      data: {
        usuarioId: userId,
        cuentaId: cuenta.id,
        tipo: parsed.tipo,
        monto,
        divisaId: cuenta.divisaId,
        tasaConversion,
        montoPrincipal,
        fecha,
        descripcion: parsed.descripcion || null,
        categoriaId: parsed.categoriaId || null,
        gastoId: gastoId || null,
        ingresoFijoId: ingresoFijoId || null,
        mesGenerado: mesGenerado || null,
      },
      include: { divisa: true, categoria: true },
    });

    const delta = parsed.tipo === 'INGRESO' ? monto : -monto;
    await db.cuenta.update({
      where: { id: cuenta.id },
      data: { saldoActual: roundMoney(Number(cuenta.saldoActual) + delta) },
    });

    return movimiento;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

async function createEgresoFromGasto(userId, cuentaId, gasto, tx = null) {
  const { formatDbDateInput } = require('../lib/dates');
  return createMovimiento(
    userId,
    cuentaId,
    {
      tipo: 'EGRESO',
      monto: Number(gasto.montoOriginal),
      fecha: formatDbDateInput(gasto.fechaCompra),
      descripcion: gasto.descripcion,
      categoriaId: gasto.categoriaId || '',
    },
    { gastoId: gasto.id },
    tx,
  );
}

async function ajustarSaldo(userId, cuentaId, rawData) {
  const parsed = ajusteSchema.parse(rawData);
  const cuenta = await cuentaService.getForUser(cuentaId, userId);
  const saldoReal = roundMoney(parsed.saldoReal);
  const saldoActual = roundMoney(Number(cuenta.saldoActual));
  const delta = roundMoney(saldoReal - saldoActual);

  if (delta === 0) {
    return { cuenta, movimiento: null };
  }

  const { tasaConversion, montoPrincipal } = await divisaService.resolveMontoPrincipal(
    userId,
    cuenta.divisaId,
    Math.abs(delta),
  );

  const today = new Date();
  const fechaStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return prisma.$transaction(async (tx) => {
    const movimiento = await tx.movimiento.create({
      data: {
        usuarioId: userId,
        cuentaId: cuenta.id,
        tipo: 'AJUSTE',
        monto: Math.abs(delta),
        divisaId: cuenta.divisaId,
        tasaConversion,
        montoPrincipal,
        fecha: parseInputDate(fechaStr),
        descripcion: 'Ajuste manual de saldo',
      },
    });

    await tx.cuenta.update({
      where: { id: cuenta.id },
      data: { saldoActual: saldoReal },
    });

    return { cuenta: { ...cuenta, saldoActual: saldoReal }, movimiento };
  });
}

module.exports = {
  movimientoSchema,
  ajusteSchema,
  listByCuenta,
  createMovimiento,
  createEgresoFromGasto,
  ajustarSaldo,
};
